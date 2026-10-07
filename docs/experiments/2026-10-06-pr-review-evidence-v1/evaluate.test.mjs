import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluate, rate, hash } from '../../../skills/pr-refine/scripts/evaluate.mjs';

const root = mkdtempSync(join(tmpdir(), 'pr-eval-'));
const dataset = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));
let checks = 0;
function test(name, fn) { fn(); checks++; console.log(`ok: ${name}`); }
function file(name, bytes) { writeFileSync(join(root, name), bytes); return { path: name, sha256: hash(bytes) }; }
const packet = file('packet.md', 'Synthetic packet, not a generated skill output.');
const transcript = file('transcript.json', '{"simulated":true}');
function observation(case_id, arm, repeat, human, judge = null) {
  const reviewer_id = `${case_id}-${arm}-${repeat}`;
  return { case_id, arm, repeat, reviewer_id, packet, transcript, human, judge,
    adjudication: file(`${reviewer_id}.json`, JSON.stringify({ human, judge })) };
}
const human = (decision, seconds = 10) => ({ decision, acceptable_packet: decision !== 'merge_recommendation', review_seconds: seconds,
  supported_claims: 1, material_claims: 1, captured_risks: 1, material_risks: 1, correct_answers: 2, questions: 2 });
const run = observations => ({ version: 1, phase: 'development', synthetic: true,
  candidate_revision: 'test-only', model: 'no-model-simulated', prompt_sha256: hash('test'), observations });

try {
  test('empty evidence stays unverified; no rate equals perfect success', () => {
    const r = evaluate(dataset, run([]), root);
    assert.equal(r.promotion, 'unverified'); assert.equal(r.arms.A.unsafe_approval.value, null);
  });
  test('Wilson uncertainty remains nonzero after zero observed failures', () => {
    const r = rate(0, 5); assert.equal(r.value, 0); assert.ok(r.wilson95[1] > 0.4);
    assert.throws(() => rate(2, 1)); assert.throws(() => rate(NaN, 1));
  });
  test('a fast unsafe merge counts as an error, not an improvement', () => {
    const r = evaluate(dataset, run([observation('secret-log','A',1,human('request_changes',20)),
      observation('secret-log','B',1,human('merge_recommendation',1))]), root);
    assert.equal(r.arms.B.unsafe_approval.numerator, 1);
    assert.equal(r.arms.B.decision_accuracy.numerator, 0);
    assert.equal(r.paired_time.B_vs_A.mean_seconds, -19);
    assert.equal(r.promotion, 'unverified');
  });
  test('a correct safe recommendation differs from rejecting every case', () => {
    const r = evaluate(dataset, run([observation('docs-link','A',1,human('merge_recommendation')),
      observation('docs-link','B',1,human('request_changes'))]), root);
    assert.equal(r.arms.A.decision_accuracy.value, 1); assert.equal(r.arms.B.decision_accuracy.value, 0);
  });
  test('model false acceptance and Brier score use human denominators', () => {
    const h = { ...human('request_changes'), acceptable_packet: false };
    const r = evaluate(dataset, run([observation('secret-log','B',1,h,{acceptable_packet:true,probability_acceptable:1})]), root);
    assert.equal(r.arms.B.judge_false_acceptance.value, 1); assert.equal(r.arms.B.judge_brier.mean, 1);
  });
  test('claim and risk omissions remain visible despite correct decision', () => {
    const h = { ...human('request_changes'), supported_claims: 0, captured_risks: 0 };
    const r = evaluate(dataset, run([observation('secret-log','B',1,h)]), root);
    assert.equal(r.arms.B.claim_support.value, 0); assert.equal(r.arms.B.risk_recall.value, 0);
  });
  test('repeats do not create independent uncertainty estimates', () => {
    const r = evaluate(dataset, run([observation('secret-log','B',1,human('request_changes')),
      observation('secret-log','B',2,human('request_changes'))]), root);
    assert.equal(r.arms.B.families, 1); assert.equal(r.arms.B.decision_accuracy.wilson95, null);
  });
  test('tampered artifacts fail before reporting', () => {
    const o = observation('secret-log','A',1,human('request_changes'));
    assert.throws(() => evaluate(dataset,run([{...o,packet:{...packet,sha256:'0'.repeat(64)}}]),root), /hash mismatch/);
  });
  test('mismatched human labels cannot silently override the adjudication file', () => {
    const o = observation('secret-log','A',1,human('request_changes'));
    assert.throws(() => evaluate(dataset,run([{...o,human:human('merge_recommendation')}]),root), /labels differ/);
  });
  test('missing artifacts, unknown cases, duplicate observations, and invalid counts fail', () => {
    const o = observation('secret-log','A',1,human('request_changes'));
    assert.throws(() => evaluate(dataset,run([{...o,packet:null}]),root), /artifact/);
    assert.throws(() => evaluate(dataset,run([{...o,case_id:'unknown'}]),root), /mismatch/);
    assert.throws(() => evaluate(dataset,run([o,o]),root), /duplicate/);
    assert.throws(() => evaluate(dataset,run([observation('secret-log','A',2,{...human('defer'),questions:1})]),root), /counts/);
  });
  test('prior reviewer exposure and family split leakage fail', () => {
    const a = observation('secret-log','A',1,human('defer'));
    const b = { ...observation('secret-log','B',1,human('defer')), reviewer_id:a.reviewer_id };
    assert.throws(() => evaluate(dataset,run([a,b]),root), /saw family twice/);
    const leaked = structuredClone(dataset); leaked.cases.push({...leaked.cases[0],id:'copy',split:'test'});
    assert.throws(() => evaluate(leaked,run([]),root), /crosses splits/);
  });
  test('holdout without custody, with exposed families, or public synthetic cases fails', () => {
    const external = structuredClone(dataset); external.cases.forEach(c => c.split='test');
    const holdout = { ...run([]),phase:'test' };
    assert.throws(() => evaluate(external,holdout,root), /attestation/);
    holdout.custody = {unseen_attested:true,manifest:file('custody.json','{"synthetic_test":true}')};
    holdout.development_family_ids = ['secret-log']; holdout.validation_family_ids = [];
    assert.throws(() => evaluate(external,holdout,root), /overlap/);
    holdout.development_family_ids = [];
    assert.throws(() => evaluate(external,holdout,root), /public fixture/);
  });
  test('missing human or model labels are counted, never replaced by zero errors', () => {
    const r = evaluate(dataset,run([observation('secret-log','A',1,null)]),root);
    assert.equal(r.arms.A.human_missing,1); assert.equal(r.arms.A.decision_accuracy.value,null);
  });
  test('the CLI separates report success from evidence status and input failure', () => {
    const script = fileURLToPath(new URL('../../../skills/pr-refine/scripts/evaluate.mjs', import.meta.url));
    const casesPath = fileURLToPath(new URL('./cases.json', import.meta.url));
    const runPath = join(root,'empty-run.json'); writeFileSync(runPath,JSON.stringify(run([])));
    const good = spawnSync(process.execPath,[script,'--cases',casesPath,'--run',runPath],{encoding:'utf8'});
    assert.equal(good.status,0); assert.equal(JSON.parse(good.stdout).promotion,'unverified');
    writeFileSync(runPath,'{');
    const bad = spawnSync(process.execPath,[script,'--cases',casesPath,'--run',runPath],{encoding:'utf8'});
    assert.equal(bad.status,2); assert.equal(bad.stdout,'');
  });
  console.log(`${checks} checks passed; simulated observations only, no skill or reviewer benefit measured.`);
} finally { rmSync(root,{recursive:true,force:true}); }

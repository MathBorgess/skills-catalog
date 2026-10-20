// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkRun } from './check-run.mjs';
import { createDraw } from './sample-paths.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'morphological-check-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  async function artifact(path, contents = path) {
    await writeFile(join(root, path), contents);
    return { path, sha256: createHash('sha256').update(contents).digest('hex') };
  }
  const input = 'A: a,b\nB: c,d\n';
  await artifact('morphbox.input.txt', input);
  const draw = createDraw(input, { seed: '42', count: 3 });
  const ids = draw.sequences.map(entry => entry.id);
  const rounds = [];
  const reviews = [];
  for (const id of ['initial', 'revised']) {
    const proposals = [];
    for (const proposalId of ids) proposals.push({ id: proposalId, ...await artifact(`${id}-${proposalId}.md`), agentId: `worker-${proposalId}` });
    rounds.push({ id, proposals });
    reviews.push({ id, ...await artifact(`${id}-review.md`), agentId: 'critic' });
  }
  const research = [{ proposalId: ids[0], ...await artifact('research.md'), status: 'complete' }];
  const artifacts = [];
  for (const path of ['brief.md', 'ideas.md', 'morphbox.md', 'morphbox.json', 'criteria.json', 'validation-plan.md', 'project.md', 'pitch.md']) artifacts.push(await artifact(path));
  artifacts.push(await artifact('RCD-LICENSE.txt', await readFile(new URL('../RCD-LICENSE.txt', import.meta.url))));
  const run = {
    schemaVersion: 1,
    draw: { ...await artifact('paths.json', JSON.stringify(draw)), inputPath: 'morphbox.input.txt' }, rounds, reviews, research,
    decision: { status: 'selected', proposalId: ids[0], considered: ids, report: await artifact('decision.md'), selectionHistory: [{ proposalId: ids[0], researchPath: 'research.md' }] },
    artifacts,
  };
  const manifest = join(root, 'run.json');
  const save = () => writeFile(manifest, JSON.stringify(run));
  await save();
  return { root, run, manifest, save, artifact };
}

test('complete selected and rejected-all runs pass only structural checks', async t => {
  const f = await fixture(t);
  assert.deepEqual(await checkRun(f.manifest), { status: 'selected', count: 3, checkedFiles: 21, researchLimited: [] });
  f.run.decision.status = 'rejected_all';
  f.run.decision.proposalId = null;
  f.run.decision.selectionHistory = [];
  f.run.research = [];
  f.run.artifacts = f.run.artifacts.filter(entry => !['project.md', 'pitch.md'].includes(entry.path));
  await f.save();
  assert.equal((await checkRun(f.manifest)).status, 'rejected_all');
});

test('selected packages require core deliverables and an unmodified complete RCD license', async t => {
  const f = await fixture(t);
  const original = [...f.run.artifacts];
  for (const removed of original) {
    f.run.artifacts = original.filter(entry => entry !== removed);
    await f.save();
    await assert.rejects(checkRun(f.manifest), /Missing required package artifact/);
  }
  f.run.artifacts = original.map(entry => entry.path === 'RCD-LICENSE.txt' ? null : entry).filter(Boolean);
  f.run.artifacts.push(await f.artifact('RCD-LICENSE.txt', 'An abbreviated or changed license'));
  await f.save();
  await assert.rejects(checkRun(f.manifest), /preserve the complete bundled terms/);
});

test('a separate hashed criteria entry is supported and rejected-all still requires its validation plan', async t => {
  const f = await fixture(t);
  f.run.criteria = f.run.artifacts.find(entry => entry.path === 'criteria.json');
  f.run.artifacts = f.run.artifacts.filter(entry => entry !== f.run.criteria);
  await f.save();
  assert.equal((await checkRun(f.manifest)).status, 'selected');
  f.run.decision.status = 'rejected_all';
  f.run.decision.proposalId = null;
  f.run.artifacts = f.run.artifacts.filter(entry => entry.path !== 'validation-plan.md');
  await f.save();
  await assert.rejects(checkRun(f.manifest), /Missing required package artifact: validation-plan.md/);
});

test('partial or misidentified rounds and a missing second review fail', async t => {
  const f = await fixture(t);
  const removed = f.run.rounds[1].proposals.pop();
  await f.save();
  await assert.rejects(checkRun(f.manifest), /every draw ID/);
  f.run.rounds[1].proposals.push(removed);
  f.run.reviews.pop();
  await f.save();
  await assert.rejects(checkRun(f.manifest), /reviews/);
});

test('tampered artifact bytes and altered draw mappings fail', async t => {
  const f = await fixture(t);
  const path = f.run.rounds[0].proposals[0].path;
  await writeFile(join(f.root, path), 'tampered');
  await assert.rejects(checkRun(f.manifest), /sha256 mismatch/);
  await writeFile(join(f.root, path), path);
  const draw = JSON.parse(await readFile(join(f.root, 'paths.json'), 'utf8'));
  draw.sequences[0].choices[0].item = 'wrong option';
  f.run.draw = { ...await f.artifact('paths.json', JSON.stringify(draw)), inputPath: 'morphbox.input.txt' };
  await f.save();
  await assert.rejects(checkRun(f.manifest), /do not replay/);
});

test('raw input is required and altered bytes or snapshot mismatch cannot pass', async t => {
  const f = await fixture(t);
  const inputPath = f.run.draw.inputPath;
  delete f.run.draw.inputPath;
  await f.save();
  await assert.rejects(checkRun(f.manifest), /raw box input: missing path/);
  f.run.draw.inputPath = inputPath;
  await f.save();
  await writeFile(join(f.root, inputPath), 'A: altered\n');
  await assert.rejects(checkRun(f.manifest), /raw box input: sha256 mismatch/);
  const changedInput = 'A: altered,other\nB: c,d\n';
  await writeFile(join(f.root, inputPath), changedInput);
  const draw = JSON.parse(await readFile(join(f.root, 'paths.json'), 'utf8'));
  draw.input.sha256 = createHash('sha256').update(changedInput).digest('hex');
  f.run.draw = { ...await f.artifact('paths.json', JSON.stringify(draw)), inputPath };
  await f.save();
  await assert.rejects(checkRun(f.manifest), /Input dimensions do not match/);
});

test('parent traversal, absolute paths and symlink escapes fail', async t => {
  const f = await fixture(t);
  const original = f.run.draw.path;
  for (const unsafe of ['../paths.json', join(f.root, 'paths.json'), '..\\paths.json']) {
    f.run.draw.path = unsafe;
    await f.save();
    await assert.rejects(checkRun(f.manifest), /unsafe/);
  }
  const outside = await mkdtemp(join(tmpdir(), 'morphological-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, 'paths.json'), await readFile(join(f.root, original)));
  await symlink(join(outside, 'paths.json'), join(f.root, 'escaped.json'));
  f.run.draw.path = 'escaped.json';
  await f.save();
  await assert.rejects(checkRun(f.manifest), /escapes run folder/);
});

test('reselection requires research for every candidate, not only the final winner', async t => {
  const f = await fixture(t);
  const replacement = f.run.decision.considered[1];
  f.run.decision.selectionHistory.push({ proposalId: replacement, researchPath: 'replacement-research.md' });
  f.run.decision.proposalId = replacement;
  await f.save();
  await assert.rejects(checkRun(f.manifest), /matching recorded research/);
  f.run.research.push({ proposalId: replacement, ...await f.artifact('replacement-research.md'), status: 'limited', notes: 'Catalog blocked; user-provided links only.' });
  await f.save();
  assert.deepEqual((await checkRun(f.manifest)).researchLimited, [replacement]);
  f.run.research[1].notes = '';
  await f.save();
  await assert.rejects(checkRun(f.manifest), /Limited research needs notes/);
});

test('incomplete decisions, reused outputs and a declared proponent acting as critic fail', async t => {
  const f = await fixture(t);
  f.run.decision.status = 'incomplete';
  await f.save();
  await assert.rejects(checkRun(f.manifest), /incomplete runs/);
  f.run.decision.status = 'selected';
  f.run.reviews[0].agentId = f.run.rounds[0].proposals[0].agentId;
  await f.save();
  await assert.rejects(checkRun(f.manifest), /reviewer must differ/);
  f.run.reviews[0].agentId = 'critic';
  f.run.rounds[1].proposals[0] = { ...f.run.rounds[0].proposals[0] };
  await f.save();
  await assert.rejects(checkRun(f.manifest), /separate output files/);
});

test('aliases, symlinks and hard links cannot reuse proposal or review output files', async t => {
  const f = await fixture(t);
  const source = f.run.rounds[0].proposals[0];
  const revised = f.run.rounds[1].proposals[0];
  f.run.rounds[1].proposals[0] = { ...revised, path: `./${source.path}`, sha256: source.sha256 };
  await f.save();
  await assert.rejects(checkRun(f.manifest), /separate output files/);
  f.run.rounds[1].proposals[0] = revised;
  await symlink(join(f.root, source.path), join(f.root, 'alias.md'));
  f.run.reviews[0] = { ...f.run.reviews[0], path: 'alias.md', sha256: source.sha256 };
  await f.save();
  await assert.rejects(checkRun(f.manifest), /separate output files/);
  await link(join(f.root, source.path), join(f.root, 'hard-link.md'));
  f.run.reviews[0].path = 'hard-link.md';
  await f.save();
  await assert.rejects(checkRun(f.manifest), /separate output files/);
});

test('selection history rejects A-B-A cycles even if both candidates were researched', async t => {
  const f = await fixture(t);
  const first = f.run.decision.proposalId;
  const second = f.run.decision.considered[1];
  f.run.research.push({ proposalId: second, ...await f.artifact('second-research.md'), status: 'complete' });
  f.run.decision.selectionHistory.push({ proposalId: second, researchPath: 'second-research.md' }, { proposalId: first, researchPath: 'research.md' });
  await f.save();
  await assert.rejects(checkRun(f.manifest), /rejected candidates cannot be revisited/);
});

test('reviewer declared only as a proponent in the other round is still rejected', async t => {
  const f = await fixture(t);
  f.run.rounds[1].proposals[0].agentId = 'revised-only-proponent';
  f.run.reviews[0].agentId = 'revised-only-proponent';
  await f.save();
  await assert.rejects(checkRun(f.manifest), /proponent agents in both rounds/);
});

test('installed directory symlink runs the checker CLI from an unrelated cwd', async t => {
  const f = await fixture(t);
  const directory = await mkdtemp(join(tmpdir(), 'morphological-installed-checker-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const installation = join(directory, 'installed-skill');
  await symlink(fileURLToPath(new URL('../', import.meta.url)), installation, 'dir');
  const cwd = join(directory, 'unrelated-cwd');
  await mkdir(cwd);
  const invoke = () => spawnSync(process.execPath, [join(installation, 'scripts', 'check-run.mjs'), f.manifest], { cwd, encoding: 'utf8' });
  const result = invoke();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /STRUCTURE OK: 3 paths/);
  await writeFile(join(f.root, f.run.draw.inputPath), 'tampered input');
  const failure = invoke();
  assert.equal(failure.status, 1);
  assert.match(failure.stderr, /raw box input: sha256 mismatch/);
});

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
  await mkdir(join(root, 'prompts'));
  await mkdir(join(root, 'research'));
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
    for (const proposalId of ids) proposals.push({
      id: proposalId, ...await artifact(`${id}-${proposalId}.md`), agentId: `worker-${proposalId}`,
      prompt: await artifact(`prompts/${id}-${proposalId}.md`, `Full ${id} prompt for ${proposalId}`),
    });
    rounds.push({ id, proposals });
    reviews.push({ id, ...await artifact(`${id}-review.md`), agentId: 'critic', prompt: await artifact(`prompts/${id}-review.md`) });
  }
  const research = [{ proposalId: ids[0], ...await artifact('research.md'), status: 'complete' }];
  const sources = {
    schemaVersion: 1,
    sources: [{ proposalId: ids[0], date: '2026-10-20', url: 'https://example.org/product/docs', claim: 'Synthetic documented capability', provenance: 'Synthetic directly consulted official documentation' }],
    gaps: [],
  };
  async function postReview(entry) {
    return {
      proposalId: entry.proposalId, researchPath: entry.path, researchSha256: entry.sha256, agentId: 'critic',
      ...await artifact(`research/${entry.proposalId}-critic.md`),
      prompt: await artifact(`prompts/post-research-${entry.proposalId}.md`),
    };
  }
  const artifacts = [];
  for (const path of ['brief.md', 'ideas.md', 'morphbox.md', 'morphbox.json', 'criteria.json', 'validation-plan.md', 'project.md', 'pitch.md']) artifacts.push(await artifact(path));
  artifacts.push(await artifact('RCD-LICENSE.txt', await readFile(new URL('../RCD-LICENSE.txt', import.meta.url))));
  artifacts.push(await artifact('research/sources.json', JSON.stringify(sources)));
  const run = {
    schemaVersion: 1,
    draw: { ...await artifact('paths.json', JSON.stringify(draw)), inputPath: 'morphbox.input.txt' }, rounds, reviews, research,
    decision: { status: 'selected', proposalId: ids[0], considered: ids, report: await artifact('decision.md'), selectionHistory: [{ proposalId: ids[0], researchPath: 'research.md' }] },
    postResearchReviews: [await postReview(research[0])],
    artifacts,
  };
  const manifest = join(root, 'run.json');
  const save = () => writeFile(manifest, JSON.stringify(run));
  async function saveSources() {
    const entry = await artifact('research/sources.json', JSON.stringify(sources));
    run.artifacts = run.artifacts.map(previous => previous.path === entry.path ? entry : previous);
  }
  await save();
  return { root, run, manifest, save, artifact, sources, saveSources, postReview };
}

test('complete selected and rejected-all runs pass only structural checks', async t => {
  const f = await fixture(t);
  assert.deepEqual(await checkRun(f.manifest), { status: 'selected', count: 3, checkedFiles: 32, researchLimited: [] });
  f.run.decision.status = 'rejected_all';
  f.run.decision.proposalId = null;
  f.run.decision.selectionHistory = [];
  f.run.research = [];
  delete f.run.postResearchReviews;
  f.run.artifacts = f.run.artifacts.filter(entry => !['project.md', 'pitch.md', 'research/sources.json'].includes(entry.path));
  await f.save();
  assert.equal((await checkRun(f.manifest)).status, 'rejected_all');
});

test('decision reports require decision.md and cannot reuse another artifact by path or physical alias', async t => {
  const f = await fixture(t);
  const original = f.run.decision.report;
  f.run.decision.report = f.run.artifacts.find(entry => entry.path === 'brief.md');
  await f.save();
  await assert.rejects(checkRun(f.manifest), /Decision report path must be decision.md/);
  f.run.decision.report = original;
  await rm(join(f.root, 'decision.md'));
  await symlink(join(f.root, 'brief.md'), join(f.root, 'decision.md'));
  f.run.decision.report.sha256 = f.run.artifacts.find(entry => entry.path === 'brief.md').sha256;
  await f.save();
  await assert.rejects(checkRun(f.manifest), /Decision report must be a distinct file/);
  await rm(join(f.root, 'decision.md'));
  await link(join(f.root, f.run.rounds[0].proposals[0].path), join(f.root, 'decision.md'));
  f.run.decision.report.sha256 = f.run.rounds[0].proposals[0].sha256;
  await f.save();
  await assert.rejects(checkRun(f.manifest), /Decision report must be a distinct file/);
});

test('selected and post-research no-go decisions require a separate hashed critic output and prompt', async t => {
  const f = await fixture(t);
  const original = f.run.postResearchReviews;
  delete f.run.postResearchReviews;
  await f.save();
  await assert.rejects(checkRun(f.manifest), /Every researched candidate needs a hashed post-research critic review/);
  f.run.decision.status = 'rejected_all';
  f.run.decision.proposalId = null;
  f.run.decision.selectionHistory = [];
  await f.save();
  await assert.rejects(checkRun(f.manifest), /Every researched candidate needs a hashed post-research critic review/);
  f.run.postResearchReviews = original;
  await f.save();
  assert.equal((await checkRun(f.manifest)).status, 'rejected_all');
  delete original[0].prompt;
  await f.save();
  await assert.rejects(checkRun(f.manifest), /retain the submitted prompt/);
});

test('post-research reviews bind the research hash, use an independent critic and preserve distinct outputs', async t => {
  const f = await fixture(t);
  const review = f.run.postResearchReviews[0];
  const original = { ...review };
  review.researchSha256 = '0'.repeat(64);
  await f.save();
  await assert.rejects(checkRun(f.manifest), /recorded research path and hash/);
  Object.assign(review, original, { agentId: f.run.rounds[0].proposals[0].agentId });
  await f.save();
  await assert.rejects(checkRun(f.manifest), /Post-research reviewer must differ/);
  Object.assign(review, original, { path: f.run.reviews[1].path, sha256: f.run.reviews[1].sha256 });
  await f.save();
  await assert.rejects(checkRun(f.manifest), /Post-research critic output must be a distinct file/);
  Object.assign(review, original);
  await f.save();
  await writeFile(join(f.root, review.path), 'Tampered post-research review');
  await assert.rejects(checkRun(f.manifest), /post-research review: sha256 mismatch/);
});

test('post-research critic outputs cannot reuse research files through direct paths, symlinks or hard links', async t => {
  const f = await fixture(t);
  const review = f.run.postResearchReviews[0];
  const original = { ...review };
  const research = f.run.research[0];
  review.path = research.path;
  review.sha256 = research.sha256;
  await f.save();
  await assert.rejects(checkRun(f.manifest), /Post-research critic output must be a distinct file/);
  Object.assign(review, original);
  await rm(join(f.root, review.path));
  await symlink(join(f.root, research.path), join(f.root, review.path));
  review.sha256 = research.sha256;
  await f.save();
  await assert.rejects(checkRun(f.manifest), /Post-research critic output must be a distinct file/);
  await rm(join(f.root, review.path));
  await link(join(f.root, research.path), join(f.root, review.path));
  await assert.rejects(checkRun(f.manifest), /Post-research critic output must be a distinct file/);
});

test('research requires a structured hashed source record for every researched candidate', async t => {
  const f = await fixture(t);
  const original = [...f.run.artifacts];
  f.run.artifacts = original.filter(entry => entry.path !== 'research/sources.json');
  await f.save();
  await assert.rejects(checkRun(f.manifest), /Missing required package artifact: research\/sources.json/);
  f.run.artifacts = original;
  await writeFile(join(f.root, 'research/sources.json'), '{}');
  await f.save();
  await assert.rejects(checkRun(f.manifest), /sha256 mismatch/);
  const source = { ...f.sources.sources[0] };
  for (const field of ['date', 'url', 'claim', 'provenance']) {
    f.sources.sources[0] = { ...source };
    delete f.sources.sources[0][field];
    await f.saveSources();
    await f.save();
    await assert.rejects(checkRun(f.manifest), /Research source|research source/);
  }
  f.sources.sources = [];
  await f.saveSources();
  await f.save();
  await assert.rejects(checkRun(f.manifest), /Every research candidate needs a source record/);
});

test('limited research preserves user-supplied evidence with unknown dates and URLs or explicit no-source gaps', async t => {
  const f = await fixture(t);
  f.run.research[0].status = 'limited';
  f.run.research[0].notes = 'Supplied excerpts only; publication date and original URL were not supplied.';
  f.sources.sources[0] = {
    proposalId: f.run.research[0].proposalId, date: null, url: null,
    claim: 'Capability described in the supplied excerpt', provenance: 'User message retained in brief.md',
    limitations: 'Publication date and original URL are unknown; not directly verified.',
  };
  await f.saveSources();
  await f.save();
  assert.deepEqual((await checkRun(f.manifest)).researchLimited, [f.run.research[0].proposalId]);
  delete f.sources.sources[0].limitations;
  await f.saveSources();
  await f.save();
  await assert.rejects(checkRun(f.manifest), /Unknown source date\/URL requires limited research and explicit limitations/);
  f.sources.sources = [];
  f.sources.gaps = [{ proposalId: f.run.research[0].proposalId, notes: 'Research was blocked and no source excerpt was provided.' }];
  await f.saveSources();
  await f.save();
  assert.equal((await checkRun(f.manifest)).status, 'selected');
  f.run.research[0].status = 'complete';
  await f.save();
  await assert.rejects(checkRun(f.manifest), /Research gap needs a limited candidate/);
});

test('every proposal and review requires a retained, hashed and nonempty submitted prompt', async t => {
  const f = await fixture(t);
  const invocations = [...f.run.rounds.flatMap(round => round.proposals), ...f.run.reviews];
  for (const invocation of invocations) {
    const original = invocation.prompt;
    delete invocation.prompt;
    await f.save();
    await assert.rejects(checkRun(f.manifest), /retain the submitted prompt/);
    invocation.prompt = original;
  }
  const first = invocations[0];
  await writeFile(join(f.root, first.prompt.path), 'Changed prompt after recording its hash');
  await f.save();
  await assert.rejects(checkRun(f.manifest), /prompt: sha256 mismatch/);
  first.prompt = await f.artifact(first.prompt.path, '  \n');
  await f.save();
  await assert.rejects(checkRun(f.manifest), /submitted prompt is empty/);
  first.prompt = await f.artifact('untracked-prompt.md', 'Full prompt');
  await f.save();
  await assert.rejects(checkRun(f.manifest), /retain the submitted prompt under prompts/);
});

test('prompt files must exist and remain distinct from proposal outputs and peer prompts', async t => {
  const f = await fixture(t);
  const first = f.run.rounds[0].proposals[0];
  const original = first.prompt;
  first.prompt = { ...original, path: 'prompts/missing.md' };
  await f.save();
  await assert.rejects(checkRun(f.manifest), /ENOENT/);
  await symlink(join(f.root, first.path), join(f.root, 'prompts', 'output-alias.md'));
  first.prompt = { path: 'prompts/output-alias.md', sha256: first.sha256 };
  await f.save();
  await assert.rejects(checkRun(f.manifest), /separate output files/);
  first.prompt = original;
  f.run.rounds[0].proposals[1].prompt = original;
  await f.save();
  await assert.rejects(checkRun(f.manifest), /separate output files/);
});

test('additional invocation prompts are hashed and have unique invocation IDs', async t => {
  const f = await fixture(t);
  f.run.additionalPrompts = [{ id: 'post-research-01', ...await f.artifact('prompts/post-research-01.md', 'Full post-research prompt') }];
  await f.save();
  assert.equal((await checkRun(f.manifest)).checkedFiles, 33);
  await writeFile(join(f.root, f.run.additionalPrompts[0].path), 'tampered');
  await assert.rejects(checkRun(f.manifest), /prompt: sha256 mismatch/);
  f.run.additionalPrompts.push({ ...f.run.additionalPrompts[0] });
  await f.save();
  await assert.rejects(checkRun(f.manifest), /distinct nonempty invocation IDs/);
});

test('a changed candidate author requires an explicit matching replacement record', async t => {
  const f = await fixture(t);
  const revised = f.run.rounds[1].proposals[0];
  const originalAgentId = revised.agentId;
  revised.agentId = 'replacement-worker';
  await f.save();
  await assert.rejects(checkRun(f.manifest), /changed author requires replacement/);
  revised.replacement = { fromAgentId: 'wrong-author', reason: 'Original author became unavailable.' };
  await f.save();
  await assert.rejects(checkRun(f.manifest), /changed author requires replacement/);
  revised.replacement.fromAgentId = originalAgentId;
  revised.replacement.reason = '  ';
  await f.save();
  await assert.rejects(checkRun(f.manifest), /changed author requires replacement/);
  revised.replacement.reason = 'Original author became unavailable; replacement received only this candidate context.';
  await f.save();
  assert.equal((await checkRun(f.manifest)).status, 'selected');
  revised.agentId = originalAgentId;
  await f.save();
  await assert.rejects(checkRun(f.manifest), /unchanged author must not declare a replacement/);
});

test('authors cannot switch candidate IDs between rounds, even with replacement claims', async t => {
  const f = await fixture(t);
  const [first, second] = f.run.rounds[1].proposals;
  const firstAgent = first.agentId;
  first.agentId = second.agentId;
  second.agentId = firstAgent;
  first.replacement = { fromAgentId: firstAgent, reason: 'Claimed replacement' };
  second.replacement = { fromAgentId: first.agentId, reason: 'Claimed replacement' };
  await f.save();
  await assert.rejects(checkRun(f.manifest), /agentId belongs to a different candidate/);
});

test('all native invocation entries require an agent identity', async t => {
  const f = await fixture(t);
  const invocations = [...f.run.rounds.flatMap(round => round.proposals), ...f.run.reviews];
  for (const invocation of invocations) {
    const original = invocation.agentId;
    delete invocation.agentId;
    await f.save();
    await assert.rejects(checkRun(f.manifest), /missing native agentId/);
    invocation.agentId = original;
  }
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
  f.run.postResearchReviews.push(await f.postReview(f.run.research[1]));
  f.sources.gaps.push({ proposalId: replacement, notes: 'Catalog blocked; no directly verified sources.' });
  await f.saveSources();
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
  const originalAgentId = f.run.rounds[1].proposals[0].agentId;
  f.run.rounds[1].proposals[0].agentId = 'revised-only-proponent';
  f.run.rounds[1].proposals[0].replacement = { fromAgentId: originalAgentId, reason: 'Original author unavailable.' };
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

#!/usr/bin/env node
// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { ALGORITHM, drawSequences, isEntrypoint, parseBox } from './sample-paths.mjs';

const HELP = `Usage: node check-run.mjs RUN.json
Read-only structural check: snapshot replay, two complete proposal rounds,
reviews and submitted prompts, declared author continuity, required package files
and license, hashes, decision and researched selections.
All artifact paths are relative to RUN.json's folder and must remain inside it.
run.draw.inputPath must name the retained raw box input. Its bytes must match
the sampler's input hash and its parsed dimensions must match the snapshot.
Run schema 1 retains the complete historical RCD notice; run schema 2 requires
the bundled MIT notice. Draw and research-source schemas remain at version 1.
A schema change, notice replacement or structural pass does not relicense
existing material or establish rights in supplied inputs and generated outputs.
This does not prove agent isolation/concurrency, semantic fidelity, research
quality, economic viability or a commercial outcome.
`;
// Pinned upstream LICENSE at 1942760c2242f609bf63ce2c97204f5a1791bd68.
// Retain validation of historical runs without shipping their instructional terms.
const historicalRcdLicenseSha256 = '29e6d8b0a1e3dd78776b46b22b9a9a3df94fdbf6a73482f59d688dee7fd38e32';
const demand = (condition, message) => { if (!condition) throw new Error(message); };
const array = (value, label) => { demand(Array.isArray(value), `${label} must be an array`); return value; };
const shaPattern = /^[a-f0-9]{64}$/;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const validUrl = value => {
  try { return typeof value === 'string' && ['https:', 'http:'].includes(new URL(value).protocol); }
  catch { return false; }
};

function checkSources(bytes, research) {
  const record = JSON.parse(bytes.toString('utf8'));
  demand(record.schemaVersion === 1, 'Unsupported research sources schemaVersion');
  const sources = array(record.sources, 'research sources');
  const gaps = array(record.gaps, 'research gaps');
  const byId = new Map(research.map(entry => [entry.proposalId, entry]));
  for (const source of sources) {
    const entry = byId.get(source.proposalId);
    demand(entry, 'Research source refers to an unrecorded research candidate');
    demand(nonempty(source.claim) && nonempty(source.provenance), 'Each research source needs a claim and provenance');
    demand(source.date === null || validDate(source.date), 'Research source date must be YYYY-MM-DD or explicit null');
    demand(source.url === null || validUrl(source.url), 'Research source URL must be HTTP(S) or explicit null');
    if (source.date === null || source.url === null) {
      demand(entry.status === 'limited' && nonempty(source.limitations), 'Unknown source date/URL requires limited research and explicit limitations');
    }
  }
  for (const gap of gaps) {
    demand(byId.get(gap.proposalId)?.status === 'limited' && nonempty(gap.notes), 'Research gap needs a limited candidate and nonempty notes');
  }
  for (const entry of research) {
    demand(sources.some(source => source.proposalId === entry.proposalId)
      || (entry.status === 'limited' && gaps.some(gap => gap.proposalId === entry.proposalId)),
    'Every research candidate needs a source record or an explicit limited-research gap');
  }
}

export async function checkRun(manifestPath) {
  const manifestFile = await realpath(manifestPath);
  const root = dirname(manifestFile);
  const run = JSON.parse(await readFile(manifestFile, 'utf8'));
  demand([1, 2].includes(run.schemaVersion), 'Unsupported run schemaVersion');
  const requiredLicense = run.schemaVersion === 1 ? 'RCD-LICENSE.txt' : 'MIT-LICENSE.txt';
  let checkedFiles = 0;
  const outputPaths = new Set();
  const outputInodes = new Set();
  const allPaths = new Set();
  const allInodes = new Set();
  const exclusiveFiles = [];
  async function artifact(entry, label, uniqueOutput = false, exclusiveRole) {
    demand(entry && typeof entry.path === 'string' && entry.path.length > 0, `${label}: missing path`);
    demand(!isAbsolute(entry.path) && !entry.path.includes('\\') && !entry.path.split('/').includes('..'), `${label}: unsafe relative path`);
    demand(shaPattern.test(entry.sha256 ?? ''), `${label}: invalid sha256`);
    const actual = await realpath(resolve(root, entry.path));
    const rel = relative(root, actual);
    demand(rel !== '' && rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel), `${label}: path escapes run folder`);
    const info = await stat(actual, { bigint: true });
    demand(info.isFile(), `${label}: expected a regular file`);
    const inode = `${info.dev}:${info.ino}`;
    const collision = exclusiveFiles.find(file => file.actual === actual || file.inode === inode);
    demand(!collision, `${collision?.role} must be a distinct file from every other artifact`);
    if (exclusiveRole) {
      demand(!allPaths.has(actual) && !allInodes.has(inode), `${exclusiveRole} must be a distinct file from every other artifact`);
      exclusiveFiles.push({ actual, inode, role: exclusiveRole });
    }
    allPaths.add(actual);
    allInodes.add(inode);
    if (uniqueOutput) {
      demand(!outputPaths.has(actual) && !outputInodes.has(inode), 'Proposals, reviews and prompts must preserve separate output files with distinct realpaths and file identities');
      outputPaths.add(actual);
      outputInodes.add(inode);
    }
    const bytes = await readFile(actual);
    demand(createHash('sha256').update(bytes).digest('hex') === entry.sha256, `${label}: sha256 mismatch`);
    checkedFiles += 1;
    return bytes;
  }
  async function prompt(entry, label) {
    demand(entry && typeof entry.path === 'string' && entry.path.startsWith('prompts/'), `${label}: retain the submitted prompt under prompts/`);
    const bytes = await artifact(entry, label, true);
    demand(bytes.toString('utf8').trim().length > 0, `${label}: submitted prompt is empty`);
  }
  function agentId(entry, label) {
    demand(typeof entry.agentId === 'string' && entry.agentId.trim().length > 0 && entry.agentId === entry.agentId.trim(), `${label}: missing native agentId`);
    return entry.agentId;
  }
  const draw = JSON.parse((await artifact(run.draw, 'draw')).toString('utf8'));
  demand(draw.schemaVersion === 1 && draw.algorithm === ALGORITHM, 'Unsupported draw schemaVersion or algorithm');
  demand(typeof draw.seed === 'string', 'Draw seed must be a decimal string');
  demand(shaPattern.test(draw.input?.sha256 ?? ''), 'Draw input hash is missing or malformed');
  const inputBytes = await artifact({ path: run.draw.inputPath, sha256: draw.input.sha256 }, 'raw box input');
  demand(['json', 'text'].includes(draw.input.format), 'Draw input format must be json or text');
  assert.deepEqual(draw.dimensions, parseBox(inputBytes.toString('utf8'), draw.input.format).dimensions, 'Input dimensions do not match draw snapshot');
  const replay = drawSequences(draw.dimensions, draw.seed, draw.count);
  assert.deepEqual(draw.sequences, replay.sequences, 'Draw sequences/attempts do not replay');
  assert.deepEqual(draw.discardedDuplicates, replay.discardedDuplicates, 'Discarded duplicates do not replay');
  const ids = draw.sequences.map(sequence => sequence.id);
  const expected = new Set(ids);
  function completeIds(entries, label) {
    const values = entries.map(entry => typeof entry === 'string' ? entry : entry.id);
    demand(values.length === ids.length && new Set(values).size === values.length && values.every(id => expected.has(id)), `${label}: expected every draw ID exactly once`);
  }
  const rounds = array(run.rounds, 'rounds');
  demand(rounds.length === 2 && ['initial', 'revised'].every(id => rounds.some(round => round.id === id)), 'Both initial and revised rounds are required');
  const proponentAgents = new Set();
  const initialAuthors = new Map();
  const candidateByAuthor = new Map();
  for (const roundId of ['initial', 'revised']) {
    const round = rounds.find(entry => entry.id === roundId);
    const proposals = array(round.proposals, `${round.id}.proposals`);
    completeIds(proposals, `${round.id}.proposals`);
    const declaredAgents = proposals.map(proposal => agentId(proposal, `${round.id}/${proposal.id}`));
    demand(new Set(declaredAgents).size === declaredAgents.length, `${round.id}: duplicated declared proponent agentId`);
    declaredAgents.forEach(agent => proponentAgents.add(agent));
    for (const proposal of proposals) {
      const label = `${round.id}/${proposal.id}`;
      const owner = candidateByAuthor.get(proposal.agentId);
      demand(owner === undefined || owner === proposal.id, `${label}: agentId belongs to a different candidate`);
      candidateByAuthor.set(proposal.agentId, proposal.id);
      if (round.id === 'initial') {
        demand(proposal.replacement === undefined, `${label}: replacement is only valid for a revised candidate`);
        initialAuthors.set(proposal.id, proposal.agentId);
      } else if (proposal.agentId === initialAuthors.get(proposal.id)) {
        demand(proposal.replacement === undefined, `${label}: unchanged author must not declare a replacement`);
      } else {
        demand(proposal.replacement?.fromAgentId === initialAuthors.get(proposal.id)
          && typeof proposal.replacement.reason === 'string' && proposal.replacement.reason.trim().length > 0,
        `${label}: changed author requires replacement.fromAgentId and a nonempty reason`);
      }
      await artifact(proposal, `${round.id}/${proposal.id}`, true);
      await prompt(proposal.prompt, `${label} prompt`);
    }
  }
  const reviews = array(run.reviews, 'reviews');
  demand(reviews.length === 2 && ['initial', 'revised'].every(id => reviews.some(review => review.id === id)), 'Both initial and revised reviews are required');
  for (const review of reviews) {
    demand(!proponentAgents.has(agentId(review, `${review.id} review`)), `${review.id}: declared reviewer must differ from proponent agents in both rounds`);
    await artifact(review, `${review.id} review`, true);
    await prompt(review.prompt, `${review.id} review prompt`);
  }
  const additionalPrompts = run.additionalPrompts === undefined ? [] : array(run.additionalPrompts, 'additionalPrompts');
  demand(additionalPrompts.every(entry => typeof entry.id === 'string' && entry.id.trim().length > 0)
    && new Set(additionalPrompts.map(entry => entry.id)).size === additionalPrompts.length, 'Additional prompts need distinct nonempty invocation IDs');
  for (const entry of additionalPrompts) {
    await prompt(entry, `${entry.id} additional prompt`);
  }
  const research = array(run.research, 'research');
  demand(new Set(research.map(entry => entry.proposalId)).size === research.length, 'Duplicate research proposalId');
  for (const entry of research) {
    demand(expected.has(entry.proposalId), 'Research refers to unknown proposalId');
    demand(['complete', 'limited'].includes(entry.status), 'Research status must be complete or limited');
    demand(entry.status !== 'limited' || (typeof entry.notes === 'string' && entry.notes.trim()), 'Limited research needs notes describing the gap');
    await artifact(entry, `${entry.proposalId} research`);
  }
  const decision = run.decision;
  demand(decision && ['selected', 'rejected_all'].includes(decision.status), 'Decision must be selected or rejected_all; incomplete runs cannot pass');
  completeIds(array(decision.considered, 'decision.considered'), 'decision.considered');
  demand(decision.report?.path === 'decision.md', 'Decision report path must be decision.md');
  await artifact(decision.report, 'decision report', true, 'Decision report');
  const history = array(decision.selectionHistory, 'decision.selectionHistory');
  demand(history.length <= ids.length && new Set(history.map(item => item.proposalId)).size === history.length, 'Selection history must contain unique candidate IDs; rejected candidates cannot be revisited');
  for (const item of history) {
    demand(expected.has(item.proposalId), 'Selection history refers to unknown proposalId');
    demand(research.some(entry => entry.proposalId === item.proposalId && entry.path === item.researchPath), 'Every selected/substitute candidate needs matching recorded research');
  }
  if (decision.status === 'selected') {
    demand(expected.has(decision.proposalId), 'Selected proposalId is missing or unknown');
    demand(history.at(-1)?.proposalId === decision.proposalId, 'Final selected candidate must end selectionHistory with research');
  } else {
    demand(decision.proposalId === undefined || decision.proposalId === null, 'rejected_all must not name a winner');
  }
  const postResearchReviews = run.postResearchReviews === undefined ? [] : array(run.postResearchReviews, 'postResearchReviews');
  demand(new Set(postResearchReviews.map(review => review.proposalId)).size === postResearchReviews.length, 'Duplicate post-research review proposalId');
  for (const review of postResearchReviews) {
    const entry = research.find(candidate => candidate.proposalId === review.proposalId);
    demand(entry && review.researchPath === entry.path && review.researchSha256 === entry.sha256, 'Post-research review must reference the recorded research path and hash');
    demand(!proponentAgents.has(agentId(review, `${review.proposalId} post-research review`)), 'Post-research reviewer must differ from all proponent agents');
    const bytes = await artifact(review, `${review.proposalId} post-research review`, true, 'Post-research critic output');
    demand(bytes.toString('utf8').trim().length > 0, 'Post-research review output is empty');
    await prompt(review.prompt, `${review.proposalId} post-research review prompt`);
  }
  for (const entry of research) {
    demand(postResearchReviews.some(review => review.proposalId === entry.proposalId), 'Every researched candidate needs a hashed post-research critic review and prompt');
  }
  const artifacts = array(run.artifacts, 'artifacts');
  const entries = [...artifacts, ...(run.criteria ? [run.criteria] : [])];
  demand(new Set(entries.map(entry => entry.path)).size === entries.length, 'Duplicate additional artifact path');
  const required = ['brief.md', 'ideas.md', 'morphbox.md', 'morphbox.json', 'criteria.json', 'validation-plan.md', requiredLicense];
  if (research.length) required.push('research/sources.json');
  if (decision.status === 'selected') required.push('project.md', 'pitch.md');
  for (const path of required) demand(entries.some(entry => entry.path === path), `Missing required package artifact: ${path}`);
  for (const entry of entries) {
    const bytes = await artifact(entry, 'package artifact');
    if (entry.path === 'RCD-LICENSE.txt') {
      demand(createHash('sha256').update(bytes).digest('hex') === historicalRcdLicenseSha256, 'RCD-LICENSE.txt must preserve the complete historical terms');
    }
    if (entry.path === 'MIT-LICENSE.txt') {
      demand(bytes.equals(await readFile(new URL('../MIT-LICENSE.txt', import.meta.url))), 'MIT-LICENSE.txt must preserve the complete bundled terms');
    }
    if (entry.path === 'research/sources.json') checkSources(bytes, research);
  }
  return { schemaVersion: run.schemaVersion, status: decision.status, count: ids.length, checkedFiles, researchLimited: research.filter(entry => entry.status === 'limited').map(entry => entry.proposalId) };
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(HELP); return; }
  demand(args.length === 1 && !args[0].startsWith('--'), 'Provide one run.json path. Use --help');
  const result = await checkRun(args[0]);
  process.stdout.write(`STRUCTURE OK: ${result.count} paths, two complete rounds; decision=${result.status}; ${result.checkedFiles} file checks.\n`);
  process.stdout.write(result.schemaVersion === 1
    ? 'Historical run schema 1: complete RCD terms retained; this run has not been relicensed.\n'
    : 'Run schema 2: bundled MIT notice retained; this is not a rights assessment of inputs or outputs.\n');
  if (result.researchLimited.length) process.stdout.write(`Research gaps recorded: ${result.researchLimited.join(', ')}.\n`);
  process.stdout.write('A structural pass or schema change does not relicense existing material.\n');
  process.stdout.write('No assertion of agent isolation, research quality, viability or revenue.\n');
}

if (isEntrypoint(import.meta.url)) {
  main().catch(error => { process.stderr.write(`STRUCTURE FAIL: ${error.message}\n`); process.exitCode = 1; });
}

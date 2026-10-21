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
This does not prove agent isolation/concurrency, semantic fidelity, research
quality, economic viability or a commercial outcome.
`;
const demand = (condition, message) => { if (!condition) throw new Error(message); };
const array = (value, label) => { demand(Array.isArray(value), `${label} must be an array`); return value; };
const shaPattern = /^[a-f0-9]{64}$/;

export async function checkRun(manifestPath) {
  const manifestFile = await realpath(manifestPath);
  const root = dirname(manifestFile);
  const run = JSON.parse(await readFile(manifestFile, 'utf8'));
  demand(run.schemaVersion === 1, 'Unsupported run schemaVersion');
  let checkedFiles = 0;
  const outputPaths = new Set();
  const outputInodes = new Set();
  async function artifact(entry, label, uniqueOutput = false) {
    demand(entry && typeof entry.path === 'string' && entry.path.length > 0, `${label}: missing path`);
    demand(!isAbsolute(entry.path) && !entry.path.includes('\\') && !entry.path.split('/').includes('..'), `${label}: unsafe relative path`);
    demand(shaPattern.test(entry.sha256 ?? ''), `${label}: invalid sha256`);
    const actual = await realpath(resolve(root, entry.path));
    const rel = relative(root, actual);
    demand(rel !== '' && rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel), `${label}: path escapes run folder`);
    const info = await stat(actual, { bigint: true });
    demand(info.isFile(), `${label}: expected a regular file`);
    if (uniqueOutput) {
      const inode = `${info.dev}:${info.ino}`;
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
  await artifact(decision.report, 'decision report');
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
  const artifacts = array(run.artifacts, 'artifacts');
  const entries = [...artifacts, ...(run.criteria ? [run.criteria] : [])];
  demand(new Set(entries.map(entry => entry.path)).size === entries.length, 'Duplicate additional artifact path');
  const required = ['brief.md', 'ideas.md', 'morphbox.md', 'morphbox.json', 'criteria.json', 'validation-plan.md', 'RCD-LICENSE.txt'];
  if (decision.status === 'selected') required.push('project.md', 'pitch.md');
  for (const path of required) demand(entries.some(entry => entry.path === path), `Missing required package artifact: ${path}`);
  for (const entry of entries) {
    const bytes = await artifact(entry, 'package artifact');
    if (entry.path === 'RCD-LICENSE.txt') {
      demand(bytes.equals(await readFile(new URL('../RCD-LICENSE.txt', import.meta.url))), 'RCD-LICENSE.txt must preserve the complete bundled terms');
    }
  }
  return { status: decision.status, count: ids.length, checkedFiles, researchLimited: research.filter(entry => entry.status === 'limited').map(entry => entry.proposalId) };
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(HELP); return; }
  demand(args.length === 1 && !args[0].startsWith('--'), 'Provide one run.json path. Use --help');
  const result = await checkRun(args[0]);
  process.stdout.write(`STRUCTURE OK: ${result.count} paths, two complete rounds; decision=${result.status}; ${result.checkedFiles} file checks.\n`);
  if (result.researchLimited.length) process.stdout.write(`Research gaps recorded: ${result.researchLimited.join(', ')}.\n`);
  process.stdout.write('No assertion of agent isolation, research quality, viability or revenue.\n');
}

if (isEntrypoint(import.meta.url)) {
  main().catch(error => { process.stderr.write(`STRUCTURE FAIL: ${error.message}\n`); process.exitCode = 1; });
}

// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ALGORITHM, createDraw, drawSequences, parseBox, parseSeed, splitmix64 } from './sample-paths.mjs';

const script = fileURLToPath(new URL('./sample-paths.mjs', import.meta.url));
const box = [{ name: 'Audience', alternatives: ['A', 'B', 'C', 'D'] }, { name: 'AI', alternatives: ['Support', 'Generation', 'Hybrid'] }];

test('SplitMix64 seed 0 matches a fixed known stream, including unsigned 64-bit arithmetic', () => {
  const next = splitmix64('0');
  assert.deepEqual(Array.from({ length: 4 }, () => next().toString(16)), [
    'e220a8397b1dcdaf', '6e789e6aa1b965f4', '6c45d188009454f', 'f88bb8a8724c81ec',
  ]);
  assert.equal(parseSeed('18446744073709551615'), (1n << 64n) - 1n);
  for (const seed of ['-1', '1.5', '01', '18446744073709551616', 'x']) assert.throws(() => parseSeed(seed));
});

test('same seed replays every choice and rejection and maps to the snapshot', () => {
  const first = drawSequences(box, '42', 8);
  assert.deepEqual(first, drawSequences(box, '42', 8));
  assert.equal(new Set(first.sequences.map(item => item.numbers.join(','))).size, 8);
  for (const sequence of [...first.sequences, ...first.discardedDuplicates]) {
    sequence.choices.forEach((choice, index) => {
      assert.equal(choice.dimension, box[index].name);
      assert.equal(choice.position, sequence.numbers[index]);
      assert.equal(choice.item, box[index].alternatives[choice.position - 1]);
      assert.equal(choice.attempts.at(-1), choice.position);
      assert(choice.attempts.every(value => value >= 1 && value <= 4));
      assert(choice.attempts.slice(0, -1).every(value => value > box[index].alternatives.length));
    });
  }
});

test('unavailable fourth position is rejected and logged without changing the box', () => {
  const result = drawSequences([{ name: 'AI', alternatives: ['Support', 'Generation', 'Hybrid'] }], '0', 1);
  assert.deepEqual(result.sequences[0].choices[0], { dimension: 'AI', position: 1, item: 'Support', attempts: [4, 1] });
});

test('duplicate full paths are logged while accepted paths remain distinct', () => {
  const result = drawSequences([{ name: 'A', alternatives: ['a', 'b'] }], '0', 2);
  assert.equal(result.sequences.length, 2);
  assert.deepEqual(new Set(result.sequences.map(item => item.numbers[0])), new Set([1, 2]));
  assert(result.discardedDuplicates.length > 0);
});

test('impossible, unsafe and nonpositive counts fail before drawing', () => {
  for (const count of [0, -1, 1.5, 2, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => drawSequences([{ name: 'A', alternatives: ['a'] }], '0', count), /Count/);
  }
});

test('JSON and text share normalized snapshots; ambiguous inputs fail', () => {
  const json = JSON.stringify({ dimensions: box });
  assert.deepEqual(parseBox(json).dimensions, parseBox('Audience: A, B, C, D\n\nAI: Support, Generation, Hybrid\n').dimensions);
  for (const raw of ['', 'A a,b', 'A: a,,b', 'A: a,b,c,d,e', 'A: a,a', 'A: a\nA: b', 'A: a:b', '{"dimensions":[]}', '{"dimensions":[{"name":"A","alternatives":[42]}]}']) {
    assert.throws(() => parseBox(raw), raw);
  }
});

test('draw stores raw-input hash, snapshot, algorithm and lossless decimal seed', () => {
  const raw = Buffer.from('A: first, second\n');
  const draw = createDraw(raw, { seed: '18446744073709551615', count: 1, createdAtUtc: 'fixed' });
  assert.equal(draw.algorithm, ALGORITHM);
  assert.equal(draw.seed, '18446744073709551615');
  assert.equal(draw.input.sha256, createHash('sha256').update(raw).digest('hex'));
  assert.deepEqual(draw.dimensions, [{ name: 'A', alternatives: ['first', 'second'] }]);
});

test('CLI replay matches records and refuses to overwrite an existing output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'morphological-sampler-'));
  try {
    const input = join(directory, 'box.json');
    await writeFile(input, JSON.stringify({ dimensions: box }));
    const invoke = output => spawnSync(process.execPath, [script, '--input', input, '--output', output, '--seed', '42', '--count', '3'], { encoding: 'utf8' });
    const output = join(directory, 'draw.json');
    assert.equal(invoke(output).status, 0);
    const before = await readFile(output, 'utf8');
    const repeated = join(directory, 'repeat.json');
    assert.equal(invoke(repeated).status, 0);
    const first = JSON.parse(before);
    const second = JSON.parse(await readFile(repeated, 'utf8'));
    for (const field of ['seed', 'input', 'dimensions', 'count', 'sequences', 'discardedDuplicates']) assert.deepEqual(first[field], second[field]);
    assert.equal(invoke(output).status, 1);
    assert.equal(await readFile(output, 'utf8'), before);
    assert.equal(spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' }).status, 0);
    assert.equal(spawnSync(process.execPath, [script, '--input', input, '--output', repeated, '--count', '1.2']).status, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('installed directory symlink runs the sampler CLI from an unrelated cwd', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'morphological-installed-sampler-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const installation = join(directory, 'installed-skill');
  await symlink(fileURLToPath(new URL('../', import.meta.url)), installation, 'dir');
  const cwd = join(directory, 'unrelated-cwd');
  await mkdir(cwd);
  await writeFile(join(cwd, 'box.json'), JSON.stringify({ dimensions: box }));
  const result = spawnSync(process.execPath, [join(installation, 'scripts', 'sample-paths.mjs'), '--input', 'box.json', '--output', 'paths.json', '--count', '3', '--seed', '42'], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Seed: 42/);
  const draw = JSON.parse(await readFile(join(cwd, 'paths.json'), 'utf8'));
  assert.deepEqual(draw.sequences, drawSequences(box, '42', 3).sequences);
});

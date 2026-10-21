#!/usr/bin/env node
// SPDX-License-Identifier: MIT
import { createHash, randomBytes } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALGORITHM = 'splitmix64-v1-low2';
const MASK = (1n << 64n) - 1n;
const HELP = `Draw distinct morphological paths without semantic filtering.

Usage: node sample-paths.mjs --input BOX --output NEW.json [--count N] [--seed UINT64] [--format auto|json|text]

BOX: JSON {"dimensions":[{"name":"Audience","alternatives":["A","B"]}]}
     or text, one row per dimension: Audience: A, B
Each dimension has 1..4 distinct alternatives. N defaults to 3.
Each position is drawn uniformly from 1..4; unavailable positions and duplicate
paths are rejected and logged. The output is exclusively created, never replaced.
Omit --seed for a random 64-bit seed. Replay with the same input, count and seed.
The algorithm is stable SplitMix64; it does NOT reproduce Python random.Random.
--help prints this message. No model calls, package dependencies or network access.
`;

export function isEntrypoint(moduleUrl) {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(moduleUrl)); }
  catch { return false; }
}

export function parseSeed(value) {
  const raw = String(value);
  if (!/^(0|[1-9]\d*)$/.test(raw)) throw new Error('Seed must be an unsigned decimal 64-bit integer');
  const seed = BigInt(raw);
  if (seed > MASK) throw new Error('Seed must be at most 18446744073709551615');
  return seed;
}

export function splitmix64(seed) {
  let state = parseSeed(seed);
  return () => {
    state = (state + 0x9e3779b97f4a7c15n) & MASK;
    let word = state;
    word = ((word ^ (word >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
    word = ((word ^ (word >> 27n)) * 0x94d049bb133111ebn) & MASK;
    return (word ^ (word >> 31n)) & MASK;
  };
}

export function validateDimensions(dimensions) {
  if (!Array.isArray(dimensions) || !dimensions.length) throw new Error('Box needs at least one dimension');
  const names = new Set();
  return dimensions.map((entry, index) => {
    if (!entry || typeof entry.name !== 'string') throw new Error(`Dimension ${index + 1}: name must be a string`);
    const name = entry.name.trim();
    if (!name || names.has(name)) throw new Error(`Dimension ${index + 1}: empty or repeated name`);
    names.add(name);
    if (!Array.isArray(entry.alternatives) || entry.alternatives.length < 1 || entry.alternatives.length > 4) {
      throw new Error(`${name}: provide 1..4 alternatives`);
    }
    const alternatives = entry.alternatives.map(value => typeof value === 'string' ? value.trim() : '');
    if (alternatives.some(value => !value) || new Set(alternatives).size !== alternatives.length) {
      throw new Error(`${name}: alternatives must be nonempty distinct strings`);
    }
    return { name, alternatives };
  });
}

export function parseBox(raw, format = 'auto') {
  if (!['auto', 'json', 'text'].includes(format)) throw new Error('Format must be auto, json or text');
  const actualFormat = format === 'auto' ? (raw.trimStart().startsWith('{') ? 'json' : 'text') : format;
  let dimensions;
  if (actualFormat === 'json') {
    dimensions = JSON.parse(raw).dimensions;
  } else {
    dimensions = raw.split(/\r?\n/).filter(line => line.trim()).map((line, index) => {
      if (line.split(':').length !== 2) throw new Error(`Text row ${index + 1}: use exactly one ':'`);
      const [name, values] = line.split(':');
      return { name, alternatives: values.split(',') };
    });
  }
  return { dimensions: validateDimensions(dimensions), format: actualFormat };
}

export function drawSequences(dimensions, seed, count = 3) {
  const box = validateDimensions(dimensions);
  const capacity = box.reduce((total, entry) => total * BigInt(entry.alternatives.length), 1n);
  if (!Number.isSafeInteger(count) || count < 1 || BigInt(count) > capacity) {
    throw new Error(`Count must be a positive safe integer no larger than capacity ${capacity}`);
  }
  const next = splitmix64(seed);
  const seen = new Set();
  const sequences = [];
  const discardedDuplicates = [];
  while (sequences.length < count) {
    const choices = box.map(({ name, alternatives }) => {
      const attempts = [];
      let position;
      do {
        position = Number(next() & 3n) + 1;
        attempts.push(position);
      } while (position > alternatives.length);
      return { dimension: name, position, item: alternatives[position - 1], attempts };
    });
    const numbers = choices.map(choice => choice.position);
    const record = { numbers, choices };
    const key = numbers.join(',');
    if (seen.has(key)) {
      discardedDuplicates.push(record);
    } else {
      seen.add(key);
      sequences.push({ id: `proposal-${String(sequences.length + 1).padStart(2, '0')}`, ...record });
    }
  }
  return { sequences, discardedDuplicates };
}

export function createDraw(raw, { seed, count = 3, format = 'auto', createdAtUtc = new Date().toISOString() }) {
  const box = parseBox(raw.toString('utf8'), format);
  const normalizedSeed = parseSeed(seed).toString();
  return {
    schemaVersion: 1,
    createdAtUtc,
    algorithm: ALGORITHM,
    seed: normalizedSeed,
    input: { sha256: createHash('sha256').update(raw).digest('hex'), format: box.format },
    dimensions: box.dimensions,
    count,
    rule: 'Draw positions 1..4; reject unavailable positions and duplicate full paths only; no semantic filtering.',
    ...drawSequences(box.dimensions, normalizedSeed, count),
  };
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(HELP); return; }
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!['--input', '--output', '--count', '--seed', '--format'].includes(key) || args[index + 1] === undefined || options[key] !== undefined) {
      throw new Error(`Unknown, repeated or incomplete option: ${key}. Use --help`);
    }
    options[key] = args[index + 1];
  }
  if (!options['--input'] || !options['--output']) throw new Error('--input and --output are required. Use --help');
  const raw = await readFile(options['--input']);
  const seed = options['--seed'] ?? randomBytes(8).readBigUInt64BE().toString();
  const count = options['--count'] === undefined ? 3 : (/^[1-9]\d*$/.test(options['--count']) ? Number(options['--count']) : NaN);
  const draw = createDraw(raw, { seed, count, format: options['--format'] ?? 'auto' });
  await mkdir(dirname(resolve(options['--output'])), { recursive: true });
  await writeFile(options['--output'], `${JSON.stringify(draw, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(`Seed: ${draw.seed}\n${draw.sequences.map(item => `${item.id}: ${item.numbers.join(' - ')}`).join('\n')}\nSaved: ${options['--output']}\n`);
}

if (isEntrypoint(import.meta.url)) {
  main().catch(error => { process.stderr.write(`Error: ${error.message}\n`); process.exitCode = 1; });
}

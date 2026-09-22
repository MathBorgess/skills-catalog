#!/usr/bin/env node
// Opt-in integration/parity test for the real cua-ai/cua-s1-forms checkpoint.
// Not part of `npm run check` and not run by any skill: `npm run fetch:cua-s1`
// first, then `npm run check:cua-s1-official`. Skips cleanly with a stated
// reason when the pinned, verified asset is not cached locally — it never
// fetches itself.
//
// Positive control: the native form-filling domain the checkpoint was trained
// for (fixtures/cua-s1-forms-real/native-corpus.json). The reference logits
// were produced by a numpy transliteration of the upstream torch forward pass,
// not by running torch itself. The transfer trial that reused these weights
// outside that contract is docs/experiments/2026-09-21-cua-s1-forms-v1/.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cacheDir, REVISION } from "./fetch-cua-s1.mjs";
import { loadCheckpoint, infer } from "./s1.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(here, "fixtures", "cua-s1-forms-real");

function close(a, b, atol, rtol) {
  return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= atol + rtol * Math.abs(b[i]));
}

function main() {
  const weightsPath = join(cacheDir(REVISION), "cua-s1-forms.safetensors");
  let checkpoint;
  const t0 = process.hrtime.bigint();
  try {
    checkpoint = loadCheckpoint(weightsPath);
  } catch (err) {
    console.log(`skip: cua-s1-forms official checkpoint not available at ${weightsPath}`);
    console.log(`skip reason: ${err.message ?? err}`);
    console.log("skip: run `npm run fetch:cua-s1` to fetch and verify it, then re-run this test.");
    return 0;
  }
  const loadMs = Number(process.hrtime.bigint() - t0) / 1e6;

  const corpus = JSON.parse(readFileSync(join(FIXTURES, "native-corpus.json"), "utf8"));
  const reference = JSON.parse(readFileSync(join(FIXTURES, "native-corpus.reference.json"), "utf8"));
  if (reference.revision !== REVISION) {
    console.error(`FAIL reference fixture pinned to revision ${reference.revision}, runtime pinned to ${REVISION}`);
    return 1;
  }

  let failed = 0;
  const latenciesMs = [];
  for (const [i, c] of corpus.entries()) {
    const ref = reference.cases[i];
    if (ref.name !== c.name) {
      console.error(`FAIL corpus/reference order drift at index ${i}: ${c.name} vs ${ref.name}`);
      failed++;
      continue;
    }
    const t1 = process.hrtime.bigint();
    const logits = infer(checkpoint, c.context, c.options);
    latenciesMs.push(Number(process.hrtime.bigint() - t1) / 1e6);
    const argmax = logits.indexOf(Math.max(...logits));
    const ok = argmax === ref.argmax && close(logits, ref.logits, reference.atol, reference.rtol);
    console.log(`${ok ? "ok  " : "FAIL"} ${c.name}: argmax=${argmax} (${c.options[argmax]}) vs numpy argmax=${ref.argmax}`);
    if (!ok) failed++;
  }

  const mem = process.memoryUsage();
  console.log(`\nload_time_ms=${loadMs.toFixed(2)}`);
  console.log(
    `inference_latency_ms min=${Math.min(...latenciesMs).toFixed(2)} max=${Math.max(...latenciesMs).toFixed(2)} ` +
      `mean=${(latenciesMs.reduce((a, b) => a + b, 0) / latenciesMs.length).toFixed(2)}`,
  );
  console.log(`peak_rss_mb=${(mem.rss / (1024 * 1024)).toFixed(1)} heap_used_mb=${(mem.heapUsed / (1024 * 1024)).toFixed(1)}`);

  if (failed) {
    console.error(`\n${failed}/${corpus.length} cua-s1-official cases failed`);
    return failed;
  }
  console.log(`\nok: cua-s1-official parity (${corpus.length} native-form cases, argmax match against numpy reference)`);
  return 0;
}

const isMain = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (isMain) {
  const failed = main();
  process.exit(failed ? 1 : 0);
}

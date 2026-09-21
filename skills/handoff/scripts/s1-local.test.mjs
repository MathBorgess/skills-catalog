#!/usr/bin/env node
// Local CUA-S1 tinyx backend contracts.
// Architecture source: trycua/cua libs/cua-s1 TinyTransformerScorer (tinyx),
// commit 9bbfa7dd3e27ca7f1861ede70aaca390174493f9. The committed fixture is a
// synthetic, license-safe toy checkpoint with independently recorded logits —
// not cua-s1-form-v0 and not a calibration claim.

import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  choice,
  createLocalBackend,
  encodeBytes,
  getBackend,
  infer,
  loadCheckpoint,
  rules,
  setBackend,
  EFFORTS,
} from "./s1.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "fixtures", "cua-s1-tinyx-toy", "checkpoint.json");
const REFERENCE = join(here, "fixtures", "cua-s1-tinyx-toy", "reference.json");

let failed = 0;

function assert(name, cond) {
  if (cond) {
    console.log(`ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL ${name}`);
  }
}

function close(a, b, atol, rtol) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((v, i) => {
    const diff = Math.abs(v - b[i]);
    return Number.isFinite(v) && Number.isFinite(b[i]) && diff <= atol + rtol * Math.abs(b[i]);
  });
}

function tmpJson(doc, name = "checkpoint.json") {
  const dir = mkdtempSync(join(tmpdir(), "s1-ckpt-"));
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(doc));
  return path;
}

function throws(fn) {
  try {
    fn();
    return null;
  } catch (err) {
    return err;
  }
}

export function runAllLocalTests() {
  console.log("# s1 local CUA-S1 backend");

  const ref = JSON.parse(readFileSync(REFERENCE, "utf8"));
  const good = JSON.parse(readFileSync(FIXTURE, "utf8"));

  assert("default backend remains rules", getBackend()?.name === "rules");
  assert("createLocalBackend is not the implicit default", getBackend()?.name !== "local");

  const pickle = throws(() => loadCheckpoint(join(tmpdir(), "model.pkl")));
  assert("rejects pickle paths before inference", Boolean(pickle) && /pickle|legacy|unsupported/i.test(String(pickle)));

  const pth = throws(() => loadCheckpoint(join(tmpdir(), "model.pt")));
  assert("rejects .pt paths", Boolean(pth));

  const bin = throws(() => loadCheckpoint(join(tmpdir(), "weights.bin")));
  assert("rejects .bin paths", Boolean(bin));

  const url = throws(() => loadCheckpoint("https://example.invalid/model.json"));
  assert("rejects network URLs", Boolean(url));

  const unknownVer = throws(() =>
    loadCheckpoint(tmpJson({ ...good, format_version: 99 })),
  );
  assert("rejects unknown format versions", Boolean(unknownVer) && /version/i.test(String(unknownVer)));

  const unknownFmt = throws(() => loadCheckpoint(tmpJson({ ...good, format: "mystery" })));
  assert("rejects unknown formats", Boolean(unknownFmt));

  const badWidth = throws(() =>
    loadCheckpoint(tmpJson({ ...good, config: { ...good.config, width: 7 } })),
  );
  assert("rejects width not divisible by heads", Boolean(badWidth));

  const zeroDim = throws(() =>
    loadCheckpoint(tmpJson({ ...good, config: { ...good.config, width: 0 } })),
  );
  assert("rejects non-positive dimensions", Boolean(zeroDim));

  const huge = throws(() =>
    loadCheckpoint(
      tmpJson({
        ...good,
        config: { ...good.config, width: 8, layers: 2 },
        tensors: {
          ...good.tensors,
          "embedding.weight": {
            dtype: "float32",
            shape: [2_000_000, 8],
            data: [0],
          },
        },
      }),
    ),
  );
  assert("rejects excessive tensor sizes", Boolean(huge));

  const nonFinite = JSON.parse(JSON.stringify(good));
  nonFinite.tensors["embedding.weight"].data[10] = null;
  nonFinite.tensors["embedding.weight"].data[10] = "nan";
  const nanErr = throws(() => loadCheckpoint(tmpJson(nonFinite)));
  assert("rejects non-finite tensor values", Boolean(nanErr));

  const infDoc = JSON.parse(JSON.stringify(good));
  infDoc.tensors["head.query.weight"].data[0] = Infinity;
  const infErr = throws(() => loadCheckpoint(tmpJson(infDoc)));
  assert("rejects infinite tensor values", Boolean(infErr));

  const mismatch = JSON.parse(JSON.stringify(good));
  mismatch.tensors["head.query.weight"].data[0] = 0.123456;
  const sigErr = throws(() => loadCheckpoint(tmpJson(mismatch)));
  assert("rejects checksum/signature mismatch", Boolean(sigErr) && /signature/i.test(String(sigErr)));

  const loaded = loadCheckpoint(FIXTURE);
  assert("loads the reviewable JSON fixture", loaded.config.encoder === "tinyx" && loaded.config.width === 8);

  const city = encodeBytes("city", loaded.config.context_tokens);
  assert(
    "byte tokenization is UTF-8 id+1 without padding to the max length",
    JSON.stringify(city) === JSON.stringify(ref.context_ids),
  );
  const fill = encodeBytes("fill city", loaded.config.option_tokens);
  assert(
    "byte tokenization truncates to the configured option length",
    JSON.stringify(fill) === JSON.stringify(ref.option_ids[0]),
  );

  const logits = infer(loaded, ref.context, ref.options);
  assert(
    "forward pass matches independently recorded reference logits",
    close(logits, ref.logits, ref.atol, ref.rtol),
  );
  assert("forward pass returns one finite logit per option", logits.length === 3 && logits.every(Number.isFinite));

  const local = createLocalBackend(FIXTURE);
  assert("local backend is named local", local.name === "local");
  assert("rules remains default after createLocalBackend", getBackend()?.name === "rules");

  const decided = local.decide({
    kind: "choice",
    context: ref.context,
    options: ref.options,
    site: "effort",
  });
  const expectedIndex = ref.logits.indexOf(Math.max(...ref.logits));
  assert("local decide argmax matches reference logits", decided.index === expectedIndex);
  assert("local decide returns a calibrated-looking distribution", decided.dist.length === 3 && Math.abs(decided.dist.reduce((a, b) => a + b, 0) - 1) < 1e-5);

  const perCall = choice(ref.context, ref.options, { backend: local, site: "effort" });
  assert("per-call local backend runs a real forward pass", perCall.label === ref.options[expectedIndex]);
  assert("per-call local does not replace the default backend", getBackend()?.name === "rules");

  setBackend(local);
  assert("explicit setBackend(local) is required to opt in", getBackend()?.name === "local");
  setBackend(rules);
  assert("resetting restores the rules floor", getBackend()?.name === "rules");

  assert("EFFORTS includes xhigh so routing cannot silently drop it", EFFORTS.includes("xhigh"));
  const explicit = choice({ tier: "design", effort: "xhigh" }, EFFORTS, { site: "effort" });
  assert("explicit xhigh is not collapsed to high/medium", explicit.label === "xhigh");
  const encoded = choice(
    { tier: "design", model: "cursor-grok-4.6-xhigh" },
    EFFORTS,
    { site: "effort" },
  );
  assert("model-encoded xhigh is preserved instead of a lower override", encoded.label === "xhigh");
  const ownerEffort = choice(
    { tier: "design", model: "cursor-grok-4.6-xhigh", effort: "low" },
    EFFORTS,
    { site: "effort" },
  );
  assert("explicit effort still wins over a model-encoded suffix", ownerEffort.label === "low");
  const tierDefault = choice({ tier: "mechanical" }, EFFORTS, { site: "effort" });
  assert("tier defaults are unchanged when no effort/model suffix is present", tierDefault.label === "low");

  if (failed) {
    console.error(`\n${failed} s1-local failed`);
    return failed;
  }
  return 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  runAllLocalTests();
  if (failed) process.exit(1);
  console.log("\nok: s1-local tests");
}

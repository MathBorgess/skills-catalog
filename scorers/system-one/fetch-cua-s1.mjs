#!/usr/bin/env node
// Explicit, opt-in fetch of the real cua-ai/cua-s1-forms checkpoint (MIT
// license) from Hugging Face. Never run implicitly by `npm run check` or any
// skill: this is the only place the repo talks to the network for CUA-S1.
// The closed trial that used these weights is
// docs/experiments/2026-09-21-cua-s1-forms-v1/.
//
// Pinned revision and independently-verified SHA-256 hashes; any drift on the
// remote (a different byte for byte content at the same file name) is
// rejected rather than silently accepted. Weights are cached under
// .cache/cua-s1/ (gitignored) — never committed.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = "cua-ai/cua-s1-forms";
export const REVISION = "f54adbf447f4ca6ec259f529ee3f2e3e09f8cc71";
export const FILES = {
  "cua-s1-forms.safetensors": "05954c1caf51c2fb6c13ea4acbfc88a2e7653dea192252bb51dc89e76a356ddc",
  "cua-s1-forms.json": "62d31e2f9a001a8e9b6f8534c5194d07ebdd3f9d62ef1ac281906622992650ca",
};

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

export function cacheDir(revision = REVISION) {
  return join(repoRoot, ".cache", "cua-s1", revision);
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function fetchFile(repo, revision, name) {
  const url = `https://huggingface.co/${repo}/resolve/${revision}/${name}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${name} failed: HTTP ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function verified(dir) {
  for (const [name, expected] of Object.entries(FILES)) {
    const path = join(dir, name);
    if (!existsSync(path)) return false;
    if (sha256(readFileSync(path)) !== expected) return false;
  }
  return true;
}

export async function fetchCuaS1({ repo = REPO, revision = REVISION, dir = cacheDir(revision) } = {}) {
  if (verified(dir)) {
    return { dir, downloaded: false };
  }
  mkdirSync(dir, { recursive: true });
  try {
    for (const [name, expected] of Object.entries(FILES)) {
      const buf = await fetchFile(repo, revision, name);
      const got = sha256(buf);
      if (got !== expected) {
        throw new Error(
          `${name} sha256 mismatch: expected ${expected}, got ${got} — refusing drifted artifact`,
        );
      }
      writeFileSync(join(dir, name), buf);
    }
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    throw err;
  }
  return { dir, downloaded: true };
}

async function main() {
  const { dir, downloaded } = await fetchCuaS1();
  console.log(`${downloaded ? "fetched and verified" : "already cached and verified"}: ${dir}`);

  const { loadCheckpoint } = await import("./s1.mjs");
  const ckpt = loadCheckpoint(join(dir, "cua-s1-forms.safetensors"));
  const paramCount = Object.values(ckpt.tensors).reduce(
    (n, t) => n + t.data.length,
    0,
  );
  console.log(
    `loadCheckpoint OK: encoder=${ckpt.config.encoder} width=${ckpt.config.width} ` +
      `heads=${ckpt.config.heads} layers=${ckpt.config.layers} context_tokens=${ckpt.config.context_tokens} ` +
      `option_tokens=${ckpt.config.option_tokens} tensors=${Object.keys(ckpt.tensors).length} params=${paramCount}`,
  );
}

const isMain = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(`fetch-cua-s1: ${err.message ?? err}`);
    process.exit(1);
  });
}

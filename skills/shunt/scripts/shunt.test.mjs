#!/usr/bin/env node
// Tests for shunt scripts. Run: node skills/shunt/scripts/shunt.test.mjs

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BYTE_MAX,
  LINE_MAX,
  buildOutline,
  classifyRead,
  emptyState,
  isOver,
  lineAndByteCount,
  windowAllowed,
} from "./shunt.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const guard = join(here, "guard.mjs");
let failed = 0;

function assert(name, cond) {
  if (cond) {
    console.log(`ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL ${name}`);
  }
}

const dir = mkdtempSync(join(tmpdir(), "shunt-test-"));
const small = join(dir, "small.js");
writeFileSync(small, "export const x = 1;\n");

const tall = join(dir, "tall.js");
writeFileSync(tall, Array.from({ length: LINE_MAX + 10 }, (_, i) => `// L${i + 1}`).join("\n") + "\n");

const wide = join(dir, "wide.js");
writeFileSync(wide, "x".repeat(BYTE_MAX + 50));

const countsSmall = lineAndByteCount(small);
const countsTall = lineAndByteCount(tall);
const countsWide = lineAndByteCount(wide);
assert("small is under", !isOver(countsSmall));
assert("tall is over on lines", isOver(countsTall) && countsTall.lines > LINE_MAX);
assert("wide is over on bytes", isOver(countsWide) && countsWide.bytes > BYTE_MAX);

assert("window limit under cap", windowAllowed(1, 40, countsTall.lines));
assert("window limit over cap", !windowAllowed(1, LINE_MAX + 1, countsTall.lines));
assert("offset remaining under cap", windowAllowed(countsTall.lines - 10, undefined, countsTall.lines));

const outline = buildOutline(tall);
assert("outline is capped", outline.split("\n").length <= 81);
assert("outline has path", outline.includes(tall));

const state = emptyState(dir);
state.activatedAt = new Date().toISOString();
state.cwd = dir;

let d = classifyRead(tall, undefined, undefined, state, countsTall);
assert("full tall read denied", !d.allow && d.reason.includes("Do not Read"));

d = classifyRead(tall, 10, 20, state, countsTall);
assert("tall window allowed", d.allow);

d = classifyRead(small, undefined, undefined, state, countsSmall);
assert("small read allowed", d.allow);

state.write.running = [tall];
d = classifyRead(tall, 1, 10, state, countsTall);
assert("running write denies even a window", !d.allow && d.reason.includes("write-delegate running"));

state.write.running = [];
state.write.done = [small];
d = classifyRead(small, undefined, undefined, state, countsSmall);
assert("done write denies full read-back", !d.allow && d.reason.includes("small subagent"));
d = classifyRead(small, 1, 1, state, countsSmall);
assert("done write allows excerpt window", d.allow);

function runGuard(payload) {
  const r = spawnSync(process.execPath, [guard], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    cwd: dir,
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
  });
  return { status: r.status, out: r.stdout, err: r.stderr };
}

let g = runGuard({ tool_name: "Read", tool_input: { file_path: tall }, cwd: dir });
assert("inert without activate (exit 0, no deny)", g.status === 0 && !g.out.includes("permissionDecision"));

const cli = join(here, "shunt.mjs");
const act = spawnSync(process.execPath, [cli, "activate"], { cwd: dir, encoding: "utf8" });
assert("activate ok", act.status === 0 && act.stdout.includes("active"));

g = runGuard({ tool_name: "Read", tool_input: { file_path: tall }, cwd: dir });
assert("active denies full tall Read", g.status === 0 && g.out.includes("\"permissionDecision\":\"deny\""));

g = runGuard({
  tool_name: "Read",
  tool_input: { file_path: tall, offset: 1, limit: 20 },
  cwd: dir,
});
assert("active allows tall window", g.status === 0 && !g.out.includes("permissionDecision"));

g = runGuard({ tool_name: "Read", tool_input: { file_path: small }, cwd: dir });
assert("active allows small Read", g.status === 0 && !g.out.includes("permissionDecision"));

// FUTURE parent_composed_write — assert current behaviour (A): over-cap Write is allowed.
const blob = Array.from({ length: LINE_MAX + 20 }, () => "line").join("\n");
g = runGuard({
  tool_name: "Write",
  tool_input: { file_path: join(dir, "generated.js"), contents: blob },
  cwd: dir,
});
assert("FUTURE parent_composed_write: over-cap Write is NOT denied", g.status === 0 && !g.out.includes("permissionDecision"));

const insp = spawnSync(process.execPath, [cli, "inspect", "--file", tall], {
  cwd: dir,
  encoding: "utf8",
});
assert("inspect labels over", insp.status === 0 && insp.stdout.startsWith("over"));
assert("inspect writes outline", insp.stdout.includes("outline"));

mkdirSync(join(dir, "src"), { recursive: true });
const src = join(dir, "src", "mod.js");
writeFileSync(src, "function foo() {}\nclass Bar {}\n");
const ex = spawnSync(process.execPath, [cli, "excerpt", "--file", src, "--start", "1", "--end", "1"], {
  cwd: dir,
  encoding: "utf8",
});
assert("excerpt ok", ex.status === 0 && readFileSync(ex.stdout.trim(), "utf8").includes("function foo"));

const tooWide = spawnSync(process.execPath, [cli, "excerpt", "--file", tall, "--start", "1", "--end", String(LINE_MAX + 5)], {
  cwd: dir,
  encoding: "utf8",
});
assert("excerpt over cap fails", tooWide.status !== 0);

spawnSync(process.execPath, [cli, "deactivate"], { cwd: dir, encoding: "utf8" });
g = runGuard({ tool_name: "Read", tool_input: { file_path: tall }, cwd: dir });
assert("deactivate returns hook to inert", g.status === 0 && !g.out.includes("permissionDecision"));

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nok: shunt tests");

#!/usr/bin/env node
// Tests for shunt scripts. Run: node skills/shunt/scripts/shunt.test.mjs

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BYTE_MAX,
  LINE_MAX,
  EDIT_LINE_MAX,
  EDIT_BYTE_MAX,
  OUTLINE_MAX,
  buildOutline,
  classifyRead,
  emptyState,
  isOver,
  lineAndByteCount,
  windowAllowed,
  filterOutput,
  readEvents,
  runDir,
  computeMetrics,
  mustReachWhole,
  summaryPathFor,
} from "./shunt.mjs";
import {
  READ_LEVELS,
  decisionsPath,
  getBackend,
  guardedSkip as s1GuardedSkip,
  rules,
  setBackend,
} from "./s1.mjs";
import { chmodSync } from "node:fs";
import { createRequire } from "node:module";
import {
  guardedSkip,
  historyStats,
  hookOutput,
  isRecall,
  modeFromArgv,
  normalizeMode,
  rewrite,
} from "./rtk.mjs";

// Keep test runs out of the real metrics history in the OS temp dir.
process.env.TMPDIR = mkdtempSync(join(tmpdir(), "skills-test-"));

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

// --- Tests for issue #17: edit bypass, run wrapper, events, deactivate & clean ---

// 1. Edit bypass in shunt.mjs + guard.mjs
const mediumTall = join(dir, "mediumTall.js");
writeFileSync(mediumTall, Array.from({ length: LINE_MAX + 50 }, (_, i) => `// M${i + 1}`).join("\n") + "\n");

const hugeTall = join(dir, "hugeTall.js");
writeFileSync(hugeTall, Array.from({ length: EDIT_LINE_MAX + 20 }, (_, i) => `// H${i + 1}`).join("\n") + "\n");

// Reactivate shunt
spawnSync(process.execPath, [cli, "activate"], { cwd: dir, encoding: "utf8" });

// Medium tall without edit mark is denied
g = runGuard({ tool_name: "Read", tool_input: { file_path: mediumTall }, cwd: dir });
assert("unmarked medium tall is denied", g.status === 0 && g.out.includes('"permissionDecision":"deny"'));

// Mark as edit target
const editRes = spawnSync(process.execPath, [cli, "edit", "--file", mediumTall], { cwd: dir, encoding: "utf8" });
assert("edit command marks target", editRes.status === 0 && editRes.stdout.includes("edit-target"));

// Medium tall with edit mark allows full Read (edit bypass)
g = runGuard({ tool_name: "Read", tool_input: { file_path: mediumTall }, cwd: dir });
assert("edit bypass allows full read under ceiling", g.status === 0 && !g.out.includes("permissionDecision"));

let evs = readEvents(dir);
assert("edit_read event recorded", evs.some((e) => e.event === "edit_read" && e.path === mediumTall));

// Huge tall marked as edit target still exceeds 2× ceiling and is denied
spawnSync(process.execPath, [cli, "edit", "--file", hugeTall], { cwd: dir, encoding: "utf8" });
g = runGuard({ tool_name: "Read", tool_input: { file_path: hugeTall }, cwd: dir });
assert("edit bypass ceiling enforced (>2x cap denied)", g.status === 0 && g.out.includes('"permissionDecision":"deny"'));

// Edit on edit target records edit_done event
g = runGuard({ tool_name: "Edit", tool_input: { file_path: mediumTall }, cwd: dir });
assert("Edit tool on edit target allowed", g.status === 0 && !g.out.includes("permissionDecision"));
evs = readEvents(dir);
assert("edit_done event recorded", evs.some((e) => e.event === "edit_done" && e.path === mediumTall));

// 2. Run wrapper with filter
const rawAnsiProgress = [
  "Error: something broke in mod A\x07",
  ...Array.from({ length: 50 }, (_, i) => `build target step ${i + 1}: item-${String.fromCharCode(65 + (i % 26))}`),
  "\x1b[32m[ 10%] Building mod A\x1b[0m",
  "\x1b[32m[ 50%] Building mod A\x1b[0m",
  "\x1b[32m[100%] Building mod A\x1b[0m",
].join("\n");

const filtered = filterOutput(rawAnsiProgress, "/tmp/test.log", 1);
assert("filterOutput strips ANSI and controls", !filtered.includes("\x1b[") && !filtered.includes("\x07"));
assert("filterOutput collapses progress lines", filtered.includes("[100%] Building mod A (×3)"));
assert("filterOutput retains early error lines", filtered.includes("Error: something broke in mod A"));
assert("filterOutput retains tail lines", filtered.includes("item-Y"));
assert("filterOutput drops early non-error lines", !filtered.includes("build target step 5:"));
assert("filterOutput ends with exit and raw log", filtered.includes("exit 1") && filtered.includes("raw /tmp/test.log"));

// CLI run command
const runRes = spawnSync(
  process.execPath,
  [cli, "run", "--", "node -e 'console.log(\"[10%] a\"); console.log(\"[20%] a\"); console.error(\"warning: test\");'"],
  { cwd: dir, encoding: "utf8" },
);
assert("run command exits 0 and prints output", runRes.status === 0 && runRes.stdout.includes("warning: test"));
assert("run command includes raw log pointer", runRes.stdout.includes("raw ") && runRes.stdout.includes(".log"));
evs = readEvents(dir);
assert("run event recorded in events.jsonl", evs.some((e) => e.event === "run" && e.raw_bytes > 0));

// Disallowed commands in run
const diffRes = spawnSync(process.execPath, [cli, "run", "--", "git diff"], { cwd: dir, encoding: "utf8" });
assert("run disallows git diff", diffRes.status !== 0);

// 3. events.jsonl written by script and guard, recover vs excerpt separated
// Inspect tall writes outline and records inspect + outline events
spawnSync(process.execPath, [cli, "inspect", "--file", tall], { cwd: dir, encoding: "utf8" });
evs = readEvents(dir);
assert("inspect event recorded", evs.some((e) => e.event === "inspect" && e.path === tall));
assert("outline event recorded", evs.some((e) => e.event === "outline" && e.path === tall));

// Re-read denied for file with existing outline records recover event
g = runGuard({ tool_name: "Read", tool_input: { file_path: tall }, cwd: dir });
assert("re-read denied", g.status === 0 && g.out.includes('"permissionDecision":"deny"'));
evs = readEvents(dir);
assert("recover event on outline re-read", evs.some((e) => e.event === "recover" && e.path === tall && e.reason === "outline_exists"));

// Read of run log records recover event
const logsDir = join(runDir(dir), "logs");
mkdirSync(logsDir, { recursive: true });
const dummyLog = join(logsDir, "test.log");
writeFileSync(dummyLog, "raw log contents\n");
g = runGuard({ tool_name: "Read", tool_input: { file_path: dummyLog }, cwd: dir });
assert("read of run log allowed", g.status === 0 && !g.out.includes("permissionDecision"));
evs = readEvents(dir);
assert("recover event on reading run log", evs.some((e) => e.event === "recover" && e.path === dummyLog && e.reason === "run_log"));

// Excerpt records excerpt event, distinct from recover
spawnSync(process.execPath, [cli, "excerpt", "--file", src, "--start", "1", "--end", "1"], { cwd: dir, encoding: "utf8" });
evs = readEvents(dir);
const excerptsCount = evs.filter((e) => e.event === "excerpt").length;
const recoverCount = evs.filter((e) => e.event === "recover").length;
assert("excerpt and recover counts are distinct", excerptsCount > 0 && recoverCount > 0);

// 4. deactivate report + metrics line + clean
const deactRes = spawnSync(process.execPath, [cli, "deactivate"], { cwd: dir, encoding: "utf8" });
assert("deactivate prints report header", deactRes.stdout.includes("# shunt report"));
assert("deactivate prints recover count", deactRes.stdout.includes("- recover:"));
assert("deactivate prints edit bypass", deactRes.stdout.includes("- edit bypass:"));
assert("deactivate prints est. tokens saved with estimate", deactRes.stdout.includes("(estimate)"));

const metricsFile = join(tmpdir(), "shunt", "metrics.jsonl");
assert("metrics.jsonl exists", existsSync(metricsFile));
const metricLines = readFileSync(metricsFile, "utf8").split("\n").filter(Boolean);
const lastMetric = JSON.parse(metricLines[metricLines.length - 1]);
assert("metrics line skill is shunt", lastMetric.skill === "shunt");
assert("metrics line has required fields", "recover" in lastMetric && "edit_bypass" in lastMetric && "est_tokens_saved" in lastMetric);

const cleanRes = spawnSync(process.execPath, [cli, "clean"], { cwd: dir, encoding: "utf8" });
assert("clean command succeeds", cleanRes.status === 0);
assert("runDir removed by clean", !existsSync(runDir(dir)));


// ------------------------------------------------------------------ rtk
{
  // A fake rtk: rewrite answers by exit code, filtered commands echo a marker.
  const bin = mkdtempSync(join(tmpdir(), "fake-rtk-"));
  const fake = join(bin, "rtk");
  writeFileSync(
    fake,
    `#!/bin/sh
case "$1" in
  --version) echo "rtk 9.9.9" ;;
  rewrite)
    case "$2" in
      "git status") echo "rtk git status"; exit 3 ;;
      "cargo test") echo "rtk cargo test"; exit 0 ;;
      "rm -rf x") exit 2 ;;
      *) exit 1 ;;
    esac ;;
  *) echo "FILTERED $*" ;;
esac
`,
  );
  chmodSync(fake, 0o755);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };

  assert("rtk: --rtk alone is guarded", modeFromArgv(["node", "x", "activate", "--rtk"]) === "guarded");
  assert("rtk: --rtk=full is full", modeFromArgv(["node", "x", "--rtk=full"]) === "full");
  assert("rtk: no flag is off", modeFromArgv(["node", "x"]) === "off");
  let threw = false;
  try { normalizeMode("loud"); } catch { threw = true; }
  assert("rtk: unknown mode is refused", threw);

  assert("rtk guarded: git diff stays raw", guardedSkip("git diff HEAD~1"));
  assert("rtk guarded: git -C x show stays raw", guardedSkip("git -C repo show abc"));
  assert("rtk guarded: cat inside a chain keeps the chain raw", guardedSkip("cargo build && cat out.txt"));
  assert("rtk guarded: env-prefixed grep stays raw", guardedSkip("LC_ALL=C grep -rn foo ."));
  assert("rtk guarded: build noise is eligible", !guardedSkip("cargo test && git status"));

  assert("rtk rewrite: exit 3 rewrites (host still prompts)", rewrite("git status", "guarded", fake) === "rtk git status");
  assert("rtk rewrite: exit 0 rewrites", rewrite("cargo test", "guarded", fake) === "rtk cargo test");
  assert("rtk rewrite: exit 1 runs as typed", rewrite("echo hi", "guarded", fake) === null);
  assert("rtk rewrite: exit 2 (deny rule) runs as typed", rewrite("rm -rf x", "guarded", fake) === null);
  assert("rtk rewrite: off never rewrites", rewrite("git status", "off", fake) === null);
  assert("rtk rewrite: guarded never sends git diff", rewrite("git diff", "guarded", fake) === null);
  assert("rtk rewrite: already-prefixed is left alone", rewrite("rtk git status", "full", fake) === null);
  assert("rtk: recall and proxy count as recall", isRecall("rtk recall ab12") && isRecall(" rtk proxy git log") && !isRecall("rtk git log"));

  const out = hookOutput({ command: "git status", description: "d", timeout: 5 }, "rtk git status");
  const u = out.hookSpecificOutput.updatedInput;
  assert("rtk hook: swaps only the command", u.command === "rtk git status" && u.description === "d" && u.timeout === 5);
  assert("rtk hook: never asserts a permission decision", !("permissionDecision" in out.hookSpecificOutput));

  // history.db: only rows under the project and inside the window count.
  const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
  const dbPath = join(bin, "history.db");
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE commands (timestamp TEXT, original_cmd TEXT, rtk_cmd TEXT, project_path TEXT,
    input_tokens INTEGER, output_tokens INTEGER, saved_tokens INTEGER, savings_pct REAL, exec_time_ms INTEGER)`);
  const ins = db.prepare("INSERT INTO commands VALUES (?, 'c', 'rtk c', ?, ?, ?, ?, 0, 1)");
  ins.run("2026-09-18T10:00:00.500000+00:00", "/p/wt/01", 100, 10, 90);
  ins.run("2026-09-18T10:00:05.000000+00:00", "/p/wt/01/sub", 50, 5, 45);
  ins.run("2026-09-18T10:00:06.000000+00:00", "/p/wt/02", 999, 1, 998);
  ins.run("2026-09-18T09:59:59.000000+00:00", "/p/wt/01", 999, 1, 998);
  db.close();
  const h = historyStats({ project: "/p/wt/01", since: "2026-09-18T10:00:00.000Z", until: "2026-09-18T10:00:05.000Z", db: dbPath });
  assert("rtk history: window and project subtree are counted", h?.commands === 2 && h.input_tokens === 150 && h.output_tokens === 15);
  assert("rtk history: missing db is null", historyStats({ project: "/p", since: "2026-01-01T00:00:00Z", db: join(bin, "none.db") }) === null);

  // End to end: activate --rtk, the guard rewrites Bash, run delegates, report shows rtk.
  const d = mkdtempSync(join(tmpdir(), "shunt-rtk-"));
  const a = spawnSync(process.execPath, [cli, "activate", "--rtk"], { cwd: d, encoding: "utf8", env });
  assert("rtk e2e: activate --rtk reports the mode", a.status === 0 && /rtk\s+guarded \(9\.9\.9\)/.test(a.stdout));
  const g = (command) =>
    spawnSync(process.execPath, [guard], {
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd: d }),
      encoding: "utf8",
      env,
    }).stdout;
  assert("rtk e2e: guard rewrites git status", JSON.parse(g("git status") || "{}").hookSpecificOutput?.updatedInput?.command === "rtk git status");
  assert("rtk e2e: guard leaves git diff alone", g("git diff") === "");
  assert("rtk e2e: guard leaves a recall alone", g("rtk recall ab12") === "");
  const r = spawnSync(process.execPath, [cli, "run", "--", "git", "status"], { cwd: d, encoding: "utf8", env });
  assert("rtk e2e: run delegates to rtk", r.status === 0 && /FILTERED git status/.test(r.stdout) && /via rtk git status/.test(r.stdout));
  const m = computeMetrics(d);
  assert("rtk e2e: metrics count rewrites and recalls", m.rtk.mode === "guarded" && m.rtk.rewrites === 2 && m.rtk.recalls === 1);
  const again = spawnSync(process.execPath, [cli, "activate"], { cwd: d, encoding: "utf8", env });
  assert("activate starts a fresh run: no events leak", again.status === 0 && readEvents(d).length === 0);
  assert("activate without --rtk recommends it when rtk is installed", /tip\s+rtk 9\.9\.9 is installed.*--rtk/.test(again.stdout));
  const noRtk = spawnSync(process.execPath, [cli, "activate"], { cwd: d, encoding: "utf8", env: { ...process.env, PATH: "/usr/bin:/bin" } });
  assert("activate stays quiet when rtk is absent", noRtk.status === 0 && !/tip/.test(noRtk.stdout));
  const plain = spawnSync(process.execPath, [guard], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "git status" }, cwd: d }),
    encoding: "utf8",
    env,
  });
  assert("rtk e2e: without --rtk the guard ignores Bash", plain.stdout === "");
  spawnSync(process.execPath, [cli, "clean"], { cwd: d, encoding: "utf8", env });
}

// ------------------------------------------------------------------ s1 (wave 0)
{
  function decisionRecords() {
    const p = decisionsPath();
    if (!existsSync(p)) return [];
    return readFileSync(p, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  function pickBackend(name, index, n, p = 0.6) {
    const dist = Array.from({ length: n }, (_, i) => (i === index ? p : 0));
    return { name, decide: () => ({ index, p, dist }) };
  }

  function legacyClassifyRead(abs, offset, limit, state, counts) {
    const n = abs.replace(/\\/g, "/");
    if (n.includes("/handoff/") && (n.includes("/wt/") || n.includes("/logs/"))) {
      return { allow: true, reason: "handoff" };
    }
    const underRun =
      abs.startsWith(runDir(state.cwd) + "/") || abs.startsWith(runDir() + "/");
    if (underRun && !isOver(counts)) return { allow: true, reason: "artifact" };
    if (state.write.running.includes(abs)) {
      return {
        allow: false,
        reason: `${abs} is write-delegate running. Do not Read/Edit/Write it. Wait, then \`write-done --file\` and excerpt only if you must edit.`,
      };
    }
    if (state.write.done.includes(abs) && !windowAllowed(offset, limit, counts.lines)) {
      return {
        allow: false,
        reason: `${abs} was written by a small subagent. Do not Read it back. Excerpt a span if you must edit: \`shunt.mjs excerpt --file ${abs} --start N --end M\`.`,
      };
    }
    const isEditTarget = state.edit?.targets?.includes(abs);
    if (isEditTarget && counts.lines <= EDIT_LINE_MAX && counts.bytes <= EDIT_BYTE_MAX) {
      if (isOver(counts)) return { allow: true, reason: "edit_bypass" };
    }
    if (!isOver(counts)) return { allow: true, reason: "under" };
    if (windowAllowed(offset, limit, counts.lines)) return { allow: true, reason: "window" };
    const outline = state.read.outlines[abs];
    const summary = summaryPathFor(abs, state.cwd);
    return {
      allow: false,
      reason:
        `${abs} is ${counts.lines} lines / ${counts.bytes} bytes (caps ${LINE_MAX} lines, ${BYTE_MAX} bytes). Do not Read it. ` +
        `Run \`node <skill>/scripts/shunt.mjs inspect --file ${abs}\`, then Read the outline` +
        (outline ? ` at ${outline}` : "") +
        `. If the outline is not enough, spawn a small/fast subagent to write a summary to ${summary} (≤ ${OUTLINE_MAX} lines) and Read only that. ` +
        `For an edit, \`excerpt --file ${abs} --start N --end M\` and Read the excerpt.`,
    };
  }

  const s1State = emptyState(dir);
  s1State.activatedAt = new Date().toISOString();
  s1State.cwd = dir;

  const equivalenceCases = [
    [small, undefined, undefined, countsSmall],
    [tall, undefined, undefined, countsTall],
    [tall, 10, 20, countsTall],
    [wide, undefined, undefined, countsWide],
    [mediumTall, undefined, undefined, lineAndByteCount(mediumTall)],
  ];
  let equivOk = true;
  for (const [path, offset, limit, counts] of equivalenceCases) {
    const got = classifyRead(path, offset, limit, s1State, counts);
    const want = legacyClassifyRead(path, offset, limit, s1State, counts);
    if (got.allow !== want.allow || got.reason !== want.reason) equivOk = false;
  }
  const marked = emptyState(dir);
  marked.activatedAt = s1State.activatedAt;
  marked.cwd = dir;
  marked.edit.targets = [mediumTall];
  {
    const counts = lineAndByteCount(mediumTall);
    const got = classifyRead(mediumTall, undefined, undefined, marked, counts);
    const want = legacyClassifyRead(mediumTall, undefined, undefined, marked, counts);
    if (got.allow !== want.allow || got.reason !== want.reason) equivOk = false;
  }
  const hugeCounts = lineAndByteCount(hugeTall);
  marked.edit.targets = [hugeTall];
  {
    const got = classifyRead(hugeTall, undefined, undefined, marked, hugeCounts);
    const want = legacyClassifyRead(hugeTall, undefined, undefined, marked, hugeCounts);
    if (got.allow !== want.allow || got.reason !== want.reason) equivOk = false;
  }
  assert("s1: classifyRead matches pre-scorer allow/reason", equivOk);

  const cmds = [
    "git diff HEAD~1",
    "git -C repo show abc",
    "cargo build && cat out.txt",
    "LC_ALL=C grep -rn foo .",
    "cargo test && git status",
    "npm test",
  ];
  assert(
    "s1: guardedSkip matches rtk.mjs",
    cmds.every((c) => s1GuardedSkip(c) === guardedSkip(c)),
  );
  assert("s1: git diff must reach the model whole", mustReachWhole("git diff HEAD").yes === true && mustReachWhole("git diff HEAD").p === 1);
  assert("s1: cargo test is not a guarded skip", mustReachWhole("cargo test").yes === false && mustReachWhole("cargo test").p === 1);

  const before = decisionRecords().length;
  classifyRead(tall, undefined, undefined, s1State, countsTall);
  classifyRead(small, undefined, undefined, s1State, countsSmall);
  mustReachWhole("git status");
  const after = decisionRecords();
  const added = after.slice(before);
  assert("s1: one record per caller invocation", added.length === 3);
  assert(
    "s1: records are unresolved rules decisions",
    added.every((r) => r.outcome?.unresolved === true && r.resolved_at === null && r.backend === "rules"),
  );
  const handoffBefore = decisionRecords().length;
  classifyRead("/tmp/handoff/run/wt/01/f.js", undefined, undefined, s1State, countsSmall);
  assert("s1: hard-rule paths do not log a decision", decisionRecords().length === handoffBefore);

  const secretCmd =
    "echo ana@example.invalid ghp_AAAAAAAAAAAAAAAAAAAA at /Users/someone/secret.env";
  mustReachWhole(secretCmd);
  const redacted = decisionRecords().at(-1);
  const dumped = JSON.stringify(redacted);
  assert("s1: redaction strips email, token, and home path", !dumped.includes("ana@example.invalid") && !dumped.includes("ghp_AAAAAAAAAAAAAAAAAAAA") && !dumped.includes("/Users/someone/secret.env"));
  assert("s1: redaction leaves placeholders", dumped.includes("<redacted>") && dumped.includes("<path>"));

  const teacherRead = pickBackend("teacher", 0, READ_LEVELS.length);
  const swapped = classifyRead(tall, undefined, undefined, s1State, countsTall, { backend: teacherRead });
  assert("s1: call-site backend swap can widen a read", swapped.allow === true);
  const floorAgain = classifyRead(tall, undefined, undefined, s1State, countsTall);
  assert("s1: rules floor still denies the same read", floorAgain.allow === false);

  const teacherRtk = pickBackend("teacher", 0, 2);
  assert("s1: noul call site accepts a backend swap", mustReachWhole("cargo test", { backend: teacherRtk }).yes === true);

  const boom = { name: "boom", decide() { throw new Error("backend down"); } };
  const fallback = classifyRead(tall, undefined, undefined, s1State, countsTall, { backend: boom });
  assert("s1: backend errors fail open to the rules floor", fallback.allow === false && fallback.reason.includes("Do not Read"));

  const prev = getBackend();
  setBackend(teacherRead);
  const viaActive = classifyRead(tall, undefined, undefined, s1State, countsTall);
  setBackend(rules);
  assert("s1: setBackend swaps without changing classifyRead", viaActive.allow === true && getBackend() === rules);
  setBackend(prev);
}

// ------------------------------------------------------------------ e3 noul (issue #36)
{
  const shuntMod = await import("./shunt.mjs");
  const route = shuntMod.maybeRewrite;
  const parseNoul = shuntMod.noulFromArgv;
  const FIXTURE = join(here, "..", "..", "handoff", "scripts", "fixtures", "cua-s1-tinyx-toy", "checkpoint.json");

  function backend(index, p, dist, name = "local") {
    return { name, decide: () => ({ index, p, dist }) };
  }
  const forceRaw = backend(0, 0.99, [0.99, 0.01]);
  const forceCompress = backend(1, 0.99, [0.01, 0.99]);
  const abstain = { name: "local", decide: () => ({ abstain: true, index: 0, p: 0, dist: [0, 0] }) };
  const boom = { name: "local", decide() { throw new Error("inference down"); } };
  const uncertainNo = backend(1, 0.55, [0.45, 0.55]);

  const bin = mkdtempSync(join(tmpdir(), "fake-rtk-e3-"));
  const fake = join(bin, "rtk");
  writeFileSync(
    fake,
    `#!/bin/sh
case "$1" in
  --version) echo "rtk 9.9.9" ;;
  rewrite)
    case "$2" in
      "git status") echo "rtk git status"; exit 3 ;;
      "cargo test") echo "rtk cargo test"; exit 0 ;;
      "npm test") echo "rtk npm test"; exit 0 ;;
      *) exit 1 ;;
    esac ;;
  *) echo "FILTERED $*" ;;
esac
`,
  );
  chmodSync(fake, 0o755);

  assert("e3: maybeRewrite is exported", typeof route === "function");
  assert("e3: noulFromArgv is exported", typeof parseNoul === "function");

  if (typeof parseNoul === "function") {
    assert("e3: default argv policy is rules", parseNoul(["node", "x", "activate"]).policy === "rules");
    assert(
      "e3: --noul=action needs a checkpoint",
      parseNoul(["node", "x", "--noul=action", "--checkpoint", FIXTURE]).policy === "action" &&
        parseNoul(["node", "x", "--noul=action", "--checkpoint", FIXTURE]).checkpoint === FIXTURE,
    );
    assert("e3: --noul=shadow is explicit", parseNoul(["node", "x", "--noul=shadow", "--checkpoint", "/p.json"]).policy === "shadow");
    let threw = false;
    try { parseNoul(["node", "x", "--noul"]); } catch { threw = true; }
    assert("e3: bare --noul is refused (opt-in must name a policy)", threw);
    threw = false;
    try { parseNoul(["node", "x", "--noul=action"]); } catch { threw = true; }
    assert("e3: action without --checkpoint is refused", threw);
  }

  const floorNo = mustReachWhole("git diff HEAD", { policy: "action", backend: forceCompress });
  assert(
    "e3: guard floor beats a local 'compress' vote",
    floorNo.yes === true && (floorNo.source === "floor" || floorNo.p === 1),
  );
  const floorRules = mustReachWhole("git diff HEAD");
  assert("e3: default policy remains rules/raw on a floor command", floorRules.yes === true);

  const abs = mustReachWhole("cargo test", { policy: "action", backend: abstain });
  assert("e3: abstention fails open to raw", abs.yes === true);
  const err = mustReachWhole("cargo test", { policy: "action", backend: boom });
  assert("e3: inference error fails open to raw", err.yes === true);
  const low = mustReachWhole("cargo test", { policy: "action", backend: uncertainNo, threshold: 0.8 });
  assert("e3: uncertainty fails open to raw", low.yes === true);
  const badCkpt = mustReachWhole("cargo test", { policy: "action", checkpoint: join(bin, "missing.json") });
  assert("e3: invalid checkpoint fails open to raw", badCkpt.yes === true);
  const floorBad = mustReachWhole("git show HEAD", { policy: "action", checkpoint: join(bin, "missing.json") });
  assert("e3: invalid checkpoint cannot compress a floor command", floorBad.yes === true);

  const shadowLive = mustReachWhole("cargo test", { policy: "shadow", backend: forceRaw });
  assert("e3: shadow does not add raw (live stays rules)", shadowLive.yes === false);
  assert("e3: shadow still records the scorer opinion", shadowLive.shadow?.yes === true);

  const actionAdd = mustReachWhole("cargo test", { policy: "action", backend: forceRaw });
  assert("e3: action may add raw for a non-floor command", actionAdd.yes === true);
  const actionCompress = mustReachWhole("cargo test", { policy: "action", backend: forceCompress });
  assert("e3: action may send a confident non-floor command to rtk", actionCompress.yes === false);
  assert("e3: rules remains default without explicit policy", mustReachWhole("cargo test").yes === false);

  if (typeof route === "function") {
    assert(
      "e3: shadow rewrite matches rules (non-interference)",
      route("cargo test", "guarded", { policy: "shadow", backend: forceRaw }, fake) === "rtk cargo test",
    );
    assert(
      "e3: action skip rewrite when adding raw",
      route("cargo test", "guarded", { policy: "action", backend: forceRaw }, fake) === null,
    );
    assert(
      "e3: action still does not rewrite a floor command",
      route("git diff", "guarded", { policy: "action", backend: forceCompress }, fake) === null,
    );
    assert(
      "e3: full arm is unchanged experiment (floor not claimed cheaper)",
      route("cargo test", "full", { policy: "rules" }, fake) === "rtk cargo test",
    );
  }

  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
  const d = mkdtempSync(join(tmpdir(), "shunt-e3-"));
  const act = spawnSync(
    process.execPath,
    [cli, "activate", "--rtk", "--noul=action", "--checkpoint", FIXTURE],
    { cwd: d, encoding: "utf8", env },
  );
  assert("e3: activate --noul=action stores the opt-in", act.status === 0);
  const st = JSON.parse(readFileSync(join(runDir(d), "state.json"), "utf8"));
  assert("e3: live state policy is action", st.noul?.policy === "action" && st.noul?.checkpoint === FIXTURE);

  let inferCalled = false;
  const { createLocalBackend } = await import("./s1.mjs");
  const real = createLocalBackend(FIXTURE);
  const spy = {
    name: "local",
    decide(req) {
      inferCalled = true;
      return real.decide(req);
    },
  };
  const inferred = mustReachWhole("npm test", { policy: "action", backend: spy, threshold: 0.8 });
  assert("e3: shunt action path runs real local inference", inferCalled === true);
  assert("e3: real local returns a typed noul", typeof inferred.yes === "boolean" && typeof inferred.p === "number");
  const realFloor = mustReachWhole("git diff HEAD", { policy: "action", backend: real, threshold: 0.51 });
  assert("e3: real local cannot override the regex floor", realFloor.yes === true);

  const rulesAgain = spawnSync(process.execPath, [cli, "activate"], { cwd: d, encoding: "utf8", env });
  assert("e3: activate without --noul stays rules", rulesAgain.status === 0);
  const stRules = JSON.parse(readFileSync(join(runDir(d), "state.json"), "utf8"));
  assert("e3: default live policy is rules", !stRules.noul || stRules.noul.policy === "rules");
  spawnSync(process.execPath, [cli, "clean"], { cwd: d, encoding: "utf8", env });

  let ab = null;
  try {
    ab = await import("./s1-ab.mjs");
  } catch {
    ab = null;
  }
  assert("e3: s1-ab.mjs loads", ab != null);
  if (ab) {
    const pair = ab.startPair({
      task_class: "build-test",
      repo: "MathBorgess/skills-catalog",
      commit: "deadbeef",
      brief: "fix a failing test suite",
      model: "cursor-grok-4.6-xhigh",
      effort: "high",
      first_arm: "off",
    });
    assert("e3: pair records same-repo/commit/brief/model provenance", pair.repo === "MathBorgess/skills-catalog" && pair.commit === "deadbeef" && pair.model === "cursor-grok-4.6-xhigh" && pair.brief === "fix a failing test suite" && pair.effort === "high");
    assert("e3: build-test arms are off vs guarded", JSON.stringify(pair.arms) === JSON.stringify(["off", "guarded"]));
    const off = ab.recordArm(pair, { arm: "off", policy: "rules", outcome: "done" });
    assert("e3: missing outcome fields are unmeasured", off.input_tokens === ab.UNMEASURED && off.saved_tokens === ab.UNMEASURED && off.recalls === ab.UNMEASURED && off.turns === ab.UNMEASURED);
    const guarded = ab.recordArm(pair, {
      arm: "guarded",
      policy: "action",
      outcome: "done",
      input_tokens: 1200,
      turns: 8,
      wall_time_s: 40,
      tests_green: true,
      recalls: 0,
      saved_tokens: 90,
    });
    assert("e3: observed fields stay numeric", guarded.input_tokens === 1200 && guarded.recalls === 0);
    const diffPair = ab.startPair({
      task_class: "diff-edit",
      repo: "MathBorgess/skills-catalog",
      commit: "deadbeef",
      brief: "refactor across files",
      model: "cursor-grok-4.6-xhigh",
      effort: "medium",
      first_arm: "guarded",
      evidence: "fixture",
    });
    assert("e3: diff-edit includes the full experiment arm", JSON.stringify(diffPair.arms) === JSON.stringify(["off", "guarded", "full"]));
    const report = ab.formatReport([pair, diffPair]);
    assert("e3: report labels unmeasured fields", report.includes("unmeasured"));
    assert("e3: report does not claim calibration", !/calibrated|calibration claim/i.test(report) || /not calibrated|uncalibrated/i.test(report));
    assert("e3: fixture rows are not production evidence", /fixture/i.test(report));
    assert("e3: full arm is labelled experiment", /experiment/i.test(report));
    const decision = ab.classDecision([pair]);
    assert("e3: fewer than 3 pairs is unmeasured, not a default", decision === ab.UNMEASURED || decision === "unmeasured");
  }
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nok: shunt tests");

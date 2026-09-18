#!/usr/bin/env node
// shunt — procedure for the `shunt` skill.
//
// Activate/deactivate the live marker, count a file, write a capped outline
// or excerpt. Judgment (what to spawn, what the child may write) stays in
// SKILL.md. Zero dependencies, Node 18+.

import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { RTK_ENV, historyStats, modeFromArgv, rewrite, rtkVersion } from "./rtk.mjs";

export const LINE_MAX = 350;
export const BYTE_MAX = 32 * 1024;
export const EDIT_LINE_MAX = LINE_MAX * 2;
export const EDIT_BYTE_MAX = BYTE_MAX * 2;
export const OUTLINE_MAX = 80;
export const LIVE_MAX_AGE_S = 7200;

const nowISO = () => new Date().toISOString();

export function workspaceId(cwd = process.cwd()) {
  let p;
  try {
    p = realpathSync.native ? realpathSync.native(cwd) : realpathSync(cwd);
  } catch {
    p = resolve(cwd);
  }
  return createHash("sha256").update(p).digest("hex").slice(0, 12);
}

export function runDir(cwd = process.cwd()) {
  return join(tmpdir(), "shunt", workspaceId(cwd));
}

export function statePath(cwd = process.cwd()) {
  return join(runDir(cwd), "state.json");
}

export function readJSON(p, fallback = null) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

export function eventsPath(cwd = process.cwd()) {
  return join(runDir(cwd), "events.jsonl");
}

export function appendEvent(data, cwd = process.cwd()) {
  const dir = runDir(cwd);
  mkdirSync(dir, { recursive: true });
  const entry = { ts: nowISO(), ...data };
  writeFileSync(eventsPath(cwd), JSON.stringify(entry) + "\n", { flag: "a" });
}

export function readEvents(cwd = process.cwd()) {
  const p = eventsPath(cwd);
  if (!existsSync(p)) return [];
  try {
    return readFileSync(p, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

export function emptyState(cwd = process.cwd()) {
  return {
    cwd: resolve(cwd),
    activatedAt: nowISO(),
    read: { blocked: [], outlines: {}, summaries: {} },
    write: { running: [], done: [] },
    edit: { targets: [] },
  };
}

export function loadState(cwd = process.cwd()) {
  return readJSON(statePath(cwd), null);
}

export function saveState(state, cwd = process.cwd()) {
  const dir = runDir(cwd);
  mkdirSync(join(dir, "outlines"), { recursive: true });
  mkdirSync(join(dir, "summaries"), { recursive: true });
  mkdirSync(join(dir, "excerpts"), { recursive: true });
  writeFileSync(statePath(cwd), JSON.stringify(state, null, 2) + "\n");
}

export function isLive(state) {
  if (!state?.activatedAt) return false;
  if (state.deactivatedAt) return false;
  const age = (Date.now() - Date.parse(state.activatedAt)) / 1000;
  return Number.isFinite(age) && age <= LIVE_MAX_AGE_S;
}

export function findLiveState(cwd = process.cwd()) {
  const state = loadState(cwd);
  return isLive(state) ? state : null;
}

export function markEdit(path, cwd = process.cwd()) {
  const abs = resolve(path);
  const state = loadState(cwd);
  if (!isLive(state)) throw new Error("shunt is not active — run activate");
  if (!state.edit) state.edit = { targets: [] };
  if (!state.edit.targets.includes(abs)) state.edit.targets.push(abs);
  saveState(state, cwd);
  return abs;
}

export function lineAndByteCount(path) {
  const abs = resolve(path);
  const bytes = statSync(abs).size;
  const fd = openSync(abs, "r");
  try {
    const buf = Buffer.alloc(64 * 1024);
    let pos = 0;
    let lines = 0;
    let last = 10;
    for (;;) {
      const n = readSync(fd, buf, 0, buf.length, pos);
      if (n === 0) break;
      pos += n;
      for (let i = 0; i < n; i++) if (buf[i] === 10) lines++;
      last = buf[n - 1];
    }
    if (pos > 0 && last !== 10) lines++;
    return { lines, bytes };
  } finally {
    closeSync(fd);
  }
}

export function isOver({ lines, bytes }) {
  return lines > LINE_MAX || bytes > BYTE_MAX;
}

export function windowAllowed(offset, limit, lines) {
  const off = Number(offset);
  const lim = Number(limit);
  const hasOff = Number.isFinite(off) && off > 0;
  const hasLim = Number.isFinite(lim) && lim > 0;
  if (hasOff && hasLim) return lim <= LINE_MAX;
  if (hasLim) return lim <= LINE_MAX;
  if (hasOff) return lines - off + 1 <= LINE_MAX;
  return false;
}

function slug(file) {
  return basename(file).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80);
}

const SYMBOL =
  /\b(function|class|def|fn|func|struct|impl|interface|enum|type|const|let|var)\s+([A-Za-z_][\w]*)/;
const HEADING = /^(#{1,6})\s+(.+)$/;

export function buildOutline(path) {
  const abs = resolve(path);
  const { lines, bytes } = lineAndByteCount(abs);
  const raw = readFileSync(abs, "utf8");
  const fileLines = raw.split(/\r?\n/);
  const symbols = [];
  const headings = [];
  for (let i = 0; i < fileLines.length; i++) {
    const text = fileLines[i].slice(0, 200);
    const h = text.match(HEADING);
    if (h) headings.push(`- L${i + 1} ${h[1]} ${h[2].trim()}`);
    const s = text.match(SYMBOL);
    if (s) symbols.push(`- L${i + 1} ${s[1]} ${s[2]}`);
  }
  const body = [
    `# Outline: ${basename(abs)}`,
    `- path: ${abs}`,
    `- lines: ${lines}`,
    `- bytes: ${bytes}`,
    "",
    "## Headings",
    ...(headings.slice(0, 30).length ? headings.slice(0, 30) : ["- (none)"]),
    "",
    "## Symbols",
    ...(symbols.slice(0, 40).length ? symbols.slice(0, 40) : ["- (none)"]),
  ];
  if (body.length > OUTLINE_MAX) body.length = OUTLINE_MAX;
  return body.join("\n") + "\n";
}

export function writeOutline(path, cwd = process.cwd()) {
  const abs = resolve(path);
  const dir = join(runDir(cwd), "outlines");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${slug(abs)}.md`);
  const { lines, bytes } = lineAndByteCount(abs);
  writeFileSync(out, buildOutline(abs));
  const state = loadState(cwd) || emptyState(cwd);
  if (!state.read.blocked.includes(abs)) state.read.blocked.push(abs);
  state.read.outlines[abs] = out;
  saveState(state, cwd);
  appendEvent({ event: "outline", path: abs, lines, bytes }, cwd);
  return out;
}

export function writeExcerpt(path, start, end, cwd = process.cwd()) {
  const abs = resolve(path);
  const from = Number(start);
  const to = Number(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to < from) {
    throw new Error("excerpt needs --start N --end M (1-indexed, inclusive)");
  }
  if (to - from + 1 > LINE_MAX) {
    throw new Error(`excerpt span ${from}-${to} exceeds ${LINE_MAX} lines`);
  }
  const fileLines = readFileSync(abs, "utf8").split(/\r?\n/);
  const slice = fileLines.slice(from - 1, to);
  const dir = join(runDir(cwd), "excerpts");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${slug(abs)}-${from}-${to}.txt`);
  writeFileSync(out, slice.join("\n") + "\n");
  appendEvent({ event: "excerpt", path: abs, start: from, end: to }, cwd);
  return out;
}

export function summaryPathFor(path, cwd = process.cwd()) {
  return join(runDir(cwd), "summaries", `${slug(resolve(path))}.md`);
}

function trackList(list, abs, add) {
  if (add && !list.includes(abs)) list.push(abs);
  if (!add) {
    const i = list.indexOf(abs);
    if (i !== -1) list.splice(i, 1);
  }
}

export function trackWrite(path, cwd = process.cwd()) {
  const abs = resolve(path);
  const state = loadState(cwd);
  if (!isLive(state)) throw new Error("shunt is not active — run activate");
  trackList(state.write.running, abs, true);
  trackList(state.write.done, abs, false);
  saveState(state, cwd);
  return abs;
}

export function writeDone(path, cwd = process.cwd()) {
  const abs = resolve(path);
  const state = loadState(cwd);
  if (!isLive(state)) throw new Error("shunt is not active — run activate");
  trackList(state.write.running, abs, false);
  trackList(state.write.done, abs, true);
  saveState(state, cwd);
  return abs;
}

export function isHandoffChildPath(p) {
  const n = p.replace(/\\/g, "/");
  return n.includes("/handoff/") && (n.includes("/wt/") || n.includes("/logs/"));
}

export function classifyRead(abs, offset, limit, state, counts) {
  if (isHandoffChildPath(abs)) return { allow: true, reason: "handoff" };
  const underRun = resolve(abs).startsWith(runDir(state.cwd) + "/") ||
    resolve(abs).startsWith(runDir() + "/");
  if (underRun && !isOver(counts)) return { allow: true, reason: "artifact" };

  if (state.write.running.includes(abs)) {
    return {
      allow: false,
      reason:
        `${abs} is write-delegate running. Do not Read/Edit/Write it. Wait, then \`write-done --file\` and excerpt only if you must edit.`,
    };
  }
  if (state.write.done.includes(abs) && !windowAllowed(offset, limit, counts.lines)) {
    return {
      allow: false,
      reason:
        `${abs} was written by a small subagent. Do not Read it back. Excerpt a span if you must edit: \`shunt.mjs excerpt --file ${abs} --start N --end M\`.`,
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

export const ANSI_REGEX =
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

export function stripAnsiAndControls(text) {
  let s = text.replace(ANSI_REGEX, "");
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return s;
}

export function progressKey(line) {
  return line
    .replace(/\[\s+/g, "[")
    .replace(/\s+\]/g, "]")
    .replace(/[\d%]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isProgressDiff(a, b) {
  if (!a || !b) return false;
  if (!/[\d%]/.test(a) && !/[\d%]/.test(b)) return false;
  return progressKey(a) === progressKey(b);
}

export function collapseProgress(lines) {
  const collapsed = [];
  let i = 0;
  while (i < lines.length) {
    const current = lines[i];
    let count = 1;
    while (
      i + count < lines.length &&
      isProgressDiff(current, lines[i + count])
    ) {
      count++;
    }
    if (count > 1) {
      const lastLine = lines[i + count - 1].trimEnd();
      collapsed.push(`${lastLine} (×${count})`);
      i += count;
    } else {
      collapsed.push(current);
      i++;
    }
  }
  return collapsed;
}

export const ERROR_REGEX = /error|warn|fail|exception/i;

export function filterOutput(raw, logPath = "", code = 0) {
  const rawText = typeof raw === "string" ? raw : raw.toString("utf8");
  const rawBytes = typeof raw === "string" ? Buffer.byteLength(raw, "utf8") : raw.length;

  const cleaned = stripAnsiAndControls(rawText);
  let lines = cleaned.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const collapsed = collapseProgress(lines);

  let kept;
  if (collapsed.length <= 40) {
    kept = collapsed;
  } else {
    const earlier = collapsed.slice(0, -40);
    const tail = collapsed.slice(-40);
    const keptErrors = earlier.filter((l) => ERROR_REGEX.test(l));
    kept = [...keptErrors, ...tail];
  }

  const resultLines = [...kept];
  resultLines.push(`exit ${code}`);
  if (logPath) {
    resultLines.push(`raw ${logPath} (${rawBytes} bytes)`);
  }
  return resultLines.join("\n") + "\n";
}

export function runCommand(cmd, cwd = process.cwd()) {
  return new Promise((resolve) => {
    const child = spawn(cmd, {
      shell: true,
      cwd,
      env: RTK_ENV,
      stdio: ["inherit", "pipe", "pipe"],
    });
    const chunks = [];
    child.stdout?.on("data", (chunk) => chunks.push(chunk));
    child.stderr?.on("data", (chunk) => chunks.push(chunk));
    child.on("close", (code) => {
      resolve({ code: code ?? 0, raw: Buffer.concat(chunks) });
    });
    child.on("error", (err) => {
      resolve({ code: 1, raw: Buffer.from(err.message, "utf8") });
    });
  });
}

export async function cmdRun(cmdString, cwd = process.cwd()) {
  const forbidden = /^\s*(git\s+(diff|show)|cat\b|grep\b|rg\b)/;
  if (forbidden.test(cmdString)) {
    die(`do not wrap ${cmdString} — code, diffs, and search results are never compressed; run directly`);
  }
  const state = loadState(cwd);
  if (!isLive(state)) die("shunt is not active — run activate");

  const rewritten = rewrite(cmdString, state.rtk?.mode);
  if (rewritten) {
    // RTK filters and keeps its own recall store; its output is the view.
    const { code, raw } = await runCommand(rewritten, cwd);
    const view = raw.toString("utf8") + `exit ${code} · via ${rewritten.split(/\s+/).slice(0, 3).join(" ")}\n`;
    process.stdout.write(view);
    appendEvent(
      { event: "run", via: "rtk", cmd: cmdString, rewritten, code, printed_bytes: Buffer.byteLength(view, "utf8") },
      cwd,
    );
    process.exit(code);
  }

  const { code, raw } = await runCommand(cmdString, cwd);
  const logsDir = join(runDir(cwd), "logs");
  mkdirSync(logsDir, { recursive: true });
  const logSlug = slug(cmdString) || "run";
  const logFile = join(logsDir, `${logSlug}.log`);
  writeFileSync(logFile, raw);

  const filtered = filterOutput(raw, logFile, code);
  process.stdout.write(filtered);

  const rawBytes = raw.length;
  const printedBytes = Buffer.byteLength(filtered, "utf8");
  appendEvent(
    {
      event: "run",
      cmd: cmdString,
      code,
      raw_bytes: rawBytes,
      printed_bytes: printedBytes,
      log: logFile,
    },
    cwd,
  );
  process.exit(code);
}

export function computeMetrics(cwd = process.cwd()) {
  const events = readEvents(cwd);
  let inspected = 0;
  let outlines = 0;
  let excerpts = 0;
  let recover = 0;
  let run_cmds = 0;
  let raw_bytes = 0;
  let printed_bytes = 0;
  let rtk_rewrites = 0;
  const rtk_recalls = events.filter((e) => e.event === "recover" && e.reason === "rtk_recall").length;

  const overCapMap = new Map();
  const editReads = [];
  const editDones = [];

  for (const e of events) {
    if (e.event === "inspect") {
      inspected++;
      if (e.over && e.path) {
        overCapMap.set(e.path, e.bytes || 0);
      }
    } else if (e.event === "outline") {
      outlines++;
      if (e.bytes && e.path) {
        overCapMap.set(e.path, e.bytes);
      }
    } else if (e.event === "excerpt") {
      excerpts++;
    } else if (e.event === "recover") {
      recover++;
    } else if (e.event === "edit_read") {
      editReads.push(e);
    } else if (e.event === "edit_done") {
      editDones.push(e);
    } else if (e.event === "rtk_rewrite") {
      rtk_rewrites++;
    } else if (e.event === "run" && e.via === "rtk") {
      run_cmds++;
      rtk_rewrites++;
    } else if (e.event === "run") {
      run_cmds++;
      raw_bytes += e.raw_bytes || 0;
      printed_bytes += e.printed_bytes || 0;
    }
  }

  const readPaths = new Set(editReads.map((e) => e.path));
  const editedPaths = new Set(
    editDones.filter((e) => readPaths.has(e.path)).map((e) => e.path),
  );

  for (const p of readPaths) {
    overCapMap.delete(p);
  }
  let overCapBytes = 0;
  for (const b of overCapMap.values()) {
    overCapBytes += b;
  }

  const est_tokens_saved = Math.max(
    0,
    Math.round((raw_bytes - printed_bytes + overCapBytes) / 4),
  );

  const state = loadState(cwd);
  const rtkMode = state?.rtk?.mode ?? "off";
  const rtk =
    rtkMode === "off"
      ? { mode: "off" }
      : {
          mode: rtkMode,
          version: state.rtk.version ?? null,
          rewrites: rtk_rewrites,
          recalls: rtk_recalls,
          history: historyStats({ project: cwd, since: state.activatedAt, until: state.deactivatedAt ?? nowISO() }),
        };

  return {
    skill: "shunt",
    ts: nowISO(),
    run: runDir(cwd),
    cwd: resolve(cwd),
    inspected,
    outlines,
    excerpts,
    recover,
    edit_bypass: {
      reads: editReads.length,
      edited: editedPaths.size,
    },
    run_cmds,
    raw_bytes,
    printed_bytes,
    est_tokens_saved,
    rtk,
  };
}

export function writeMetricsLine(metric, cwd = process.cwd()) {
  const dir = join(tmpdir(), "shunt");
  mkdirSync(dir, { recursive: true });
  const metricsFile = join(dir, "metrics.jsonl");
  writeFileSync(metricsFile, JSON.stringify(metric) + "\n", { flag: "a" });
  return metricsFile;
}

export function formatReport(m) {
  return [
    `# shunt report`,
    `- run: ${m.run}`,
    `- inspected: ${m.inspected}`,
    `- outlines: ${m.outlines}`,
    `- excerpts: ${m.excerpts}`,
    `- recover: ${m.recover}`,
    `- edit bypass: ${m.edit_bypass.reads} reads, ${m.edit_bypass.edited} edited`,
    `- commands: ${m.run_cmds} runs (${m.raw_bytes} raw bytes, ${m.printed_bytes} printed bytes)`,
    `- est. tokens saved: ${m.est_tokens_saved} (estimate)`,
    ...(m.rtk?.mode && m.rtk.mode !== "off"
      ? [
          `- rtk ${m.rtk.mode} ${m.rtk.version ?? ""}: ${m.rtk.rewrites} rewrites, ${m.rtk.recalls} recalls` +
            (m.rtk.history
              ? `; ${m.rtk.history.commands} filtered commands, ${m.rtk.history.input_tokens} → ${m.rtk.history.output_tokens} tokens (RTK estimate)`
              : "; no RTK history for this run"),
        ]
      : []),
  ].join("\n");
}

export function cmdDeactivate(cwd = process.cwd()) {
  const m = computeMetrics(cwd);
  writeMetricsLine(m, cwd);
  console.log(formatReport(m));
  const state = loadState(cwd);
  if (state) {
    state.deactivatedAt = nowISO();
    saveState(state, cwd);
  }
  console.log("inert");
}

export function cleanRun(cwd = process.cwd(), runPath = null) {
  const dir = runPath ? resolve(runPath) : runDir(cwd);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  return dir;
}

export function cmdClean(cwd = process.cwd()) {
  const r = arg("run");
  const cleaned = cleanRun(cwd, r);
  console.log(`cleaned ${cleaned}`);
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

function die(msg, code = 1) {
  console.error(`shunt: ${msg}`);
  process.exit(code);
}

function cmdActivate() {
  const cwd = process.cwd();
  const state = emptyState(cwd);
  let mode;
  try {
    mode = modeFromArgv();
  } catch (e) {
    die(e.message);
  }
  if (mode !== "off") {
    const version = rtkVersion();
    if (!version) die("--rtk needs the rtk binary on PATH (brew install rtk). Do not run `rtk init -g`: the run scopes it.");
    state.rtk = { mode, version };
  }
  // A new activation is a new run: events from the last one must not leak into this report.
  rmSync(eventsPath(cwd), { force: true });
  saveState(state, cwd);
  console.log(`active  ${runDir(cwd)}`);
  if (state.rtk) console.log(`rtk     ${state.rtk.mode} (${state.rtk.version}) — Bash commands route through rtk while active`);
  else {
    const found = rtkVersion();
    if (found) console.log(`tip     rtk ${found} is installed — re-run \`activate --rtk\` to filter build/test/git noise (recommended; A/B in skills-catalog#27)`);
  }
  console.log(`caps    ${LINE_MAX} lines · ${BYTE_MAX} bytes · outline ≤ ${OUTLINE_MAX} lines`);
}

function cmdStatus() {
  const state = loadState();
  if (!isLive(state)) {
    console.log("inert   (run activate)");
    return;
  }
  console.log(`active  ${runDir()}`);
  console.log(`since   ${state.activatedAt}`);
  console.log(`blocked ${state.read.blocked.length}  writing ${state.write.running.length}  written ${state.write.done.length}`);
  console.log(`summaries ${join(runDir(), "summaries")}`);
}

function cmdInspect() {
  const file = arg("file");
  if (!file) die("inspect --file PATH");
  const abs = resolve(file);
  if (!existsSync(abs)) die(`no such file ${abs}`);
  const counts = lineAndByteCount(abs);
  const over = isOver(counts);
  const tag = over ? "over " : "under";
  process.stdout.write(
    `${tag}  ${counts.lines} lines  ${counts.bytes} bytes  ${abs}\n`,
  );
  appendEvent(
    { event: "inspect", path: abs, lines: counts.lines, bytes: counts.bytes, over },
    process.cwd(),
  );
  if (!over) return;
  if (!isLive(loadState())) die("file is over threshold but shunt is not active — run activate");
  const outline = writeOutline(abs);
  console.log(`outline ${outline}`);
  console.log(`summary ${summaryPathFor(abs)}`);
}

function cmdOutline() {
  const file = arg("file");
  if (!file) die("outline --file PATH");
  if (!isLive(loadState())) die("not active — run activate");
  console.log(writeOutline(file));
}

function cmdExcerpt() {
  const file = arg("file");
  if (!file) die("excerpt --file PATH --start N --end M");
  if (!isLive(loadState())) die("not active — run activate");
  try {
    console.log(writeExcerpt(file, arg("start"), arg("end")));
  } catch (e) {
    die(e.message);
  }
}

function cmdEdit() {
  const file = arg("file");
  if (!file) die("edit --file PATH");
  try {
    console.log(`edit-target ${markEdit(file)}`);
  } catch (e) {
    die(e.message);
  }
}

function cmdTrackWrite() {
  const file = arg("file");
  if (!file) die("track-write --file PATH");
  try {
    console.log(`running ${trackWrite(file)}`);
  } catch (e) {
    die(e.message);
  }
}

function cmdWriteDone() {
  const file = arg("file");
  if (!file) die("write-done --file PATH");
  try {
    console.log(`done    ${writeDone(file)}`);
  } catch (e) {
    die(e.message);
  }
}

async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case "activate":
      return cmdActivate();
    case "deactivate":
      return cmdDeactivate();
    case "clean":
      return cmdClean();
    case "status":
      return cmdStatus();
    case "inspect":
      return cmdInspect();
    case "outline":
      return cmdOutline();
    case "excerpt":
      return cmdExcerpt();
    case "edit":
      return cmdEdit();
    case "track-write":
      return cmdTrackWrite();
    case "write-done":
      return cmdWriteDone();
    case "run": {
      const dashDash = process.argv.indexOf("--");
      if (dashDash === -1 || dashDash === process.argv.length - 1) {
        die("run -- <cmd...>");
      }
      const cmdString = process.argv.slice(dashDash + 1).join(" ");
      return await cmdRun(cmdString);
    }
    default:
      die(
        "commands: activate | deactivate | clean | status | inspect --file | outline --file | excerpt --file --start --end | edit --file | run -- <cmd> | track-write --file | write-done --file",
      );
  }
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] && resolve(process.argv[1]) === thisFile;
if (invoked) await main();

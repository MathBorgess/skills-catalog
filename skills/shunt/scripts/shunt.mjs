#!/usr/bin/env node
// shunt — procedure for the `shunt` skill.
//
// Activate/deactivate the live marker, count a file, write a capped outline
// or excerpt. Judgment (what to spawn, what the child may write) stays in
// SKILL.md. Zero dependencies, Node 18+.

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

export const LINE_MAX = 350;
export const BYTE_MAX = 32 * 1024;
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

export function emptyState(cwd = process.cwd()) {
  return {
    cwd: resolve(cwd),
    activatedAt: nowISO(),
    read: { blocked: [], outlines: {}, summaries: {} },
    write: { running: [], done: [] },
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
  const age = (Date.now() - Date.parse(state.activatedAt)) / 1000;
  return Number.isFinite(age) && age <= LIVE_MAX_AGE_S;
}

export function findLiveState(cwd = process.cwd()) {
  const state = loadState(cwd);
  return isLive(state) ? state : null;
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
  writeFileSync(out, buildOutline(abs));
  const state = loadState(cwd) || emptyState(cwd);
  if (!state.read.blocked.includes(abs)) state.read.blocked.push(abs);
  state.read.outlines[abs] = out;
  saveState(state, cwd);
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
  saveState(state, cwd);
  console.log(`active  ${runDir(cwd)}`);
  console.log(`caps    ${LINE_MAX} lines · ${BYTE_MAX} bytes · outline ≤ ${OUTLINE_MAX} lines`);
}

function cmdDeactivate() {
  const dir = runDir();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  console.log("inert");
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

function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case "activate":
      return cmdActivate();
    case "deactivate":
      return cmdDeactivate();
    case "status":
      return cmdStatus();
    case "inspect":
      return cmdInspect();
    case "outline":
      return cmdOutline();
    case "excerpt":
      return cmdExcerpt();
    case "track-write":
      return cmdTrackWrite();
    case "write-done":
      return cmdWriteDone();
    default:
      die(
        "commands: activate | deactivate | status | inspect --file | outline --file | excerpt --file --start --end | track-write --file | write-done --file",
      );
  }
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] && resolve(process.argv[1]) === thisFile;
if (invoked) main();

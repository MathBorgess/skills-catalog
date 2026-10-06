// The motion proof: a short, deterministic HyperFrames clip that plays a spec's motion identity —
// big words entering in its personality, one emphasis, a move, the signature, an exit — so the owner
// approves the identity by watching it, not by reading it.
//
// The timeline is planned here, in Node, from the spec alone; the page (assets/proof.html) only executes
// the plan. Same spec, same plan, same frames.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HEX_RE, contrastRatio, isPlainObject, pickAccent } from "./spec.mjs";

export const FRAME_SIZES = { landscape: { width: 1920, height: 1080 }, portrait: { width: 1080, height: 1920 } };
// explain-me's default safe boxes, so a proof lands where an explain-me video would put its content.
export const DEFAULT_SAFE = { landscape: [120, 120, 1800, 960], portrait: [60, 220, 960, 1380] };
export const DEFAULT_DURATIONS = { draw: 1.2, write: 0.9, morph: 1.0, move: 1.2, camera: 1.5, indicate: 0.6, count: 1.0, grow: 0.6, fade: 0.5 };
export const DEFAULT_EASE = "power2.inOut";
const LEAD_IN = 0.3; // HyperFrames: a first motion at t=0 reads as a jump cut
const END_HOLD = 0.5;
const SIGNATURE_SEC = 1.8;
// Per personality: seconds between words, and the emphasis peak (the exaggeration budget of the archetype).
const RHYTHM = {
  playful: { stagger: 0.12, peak: 1.18 },
  premium: { stagger: 0.18, peak: 1.03 },
  corporate: { stagger: 0.08, peak: 1.06 },
  energetic: { stagger: 0.06, peak: 1.22 },
};
const NEUTRAL_RHYTHM = { stagger: 0.1, peak: 1.08 };
export const MAX_WORDS = 6;
const STAGGER_BUDGET = 0.5; // total stagger of one group stays under half a second

const round3 = (n) => Math.round(n * 1000) / 1000;

export function normalizeOrientation(v) {
  const s = String(v ?? "portrait").toLowerCase();
  if (["portrait", "vertical", "9:16", "reels", "shorts", "tiktok", "stories"].includes(s)) return "portrait";
  if (["landscape", "horizontal", "16:9"].includes(s)) return "landscape";
  return null;
}

// spec data + options -> the whole timeline in seconds, and the moments worth looking at.
export function planProof(data, { orientation = "portrait", text, sub, accentKey, accentWord, hasSignature = false, lang = "en" } = {}) {
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(String(lang))) throw new Error(`--lang ${JSON.stringify(lang)} is not a language tag such as pt-BR or en`);
  const o = normalizeOrientation(orientation);
  if (!o) throw new Error(`unknown orientation ${JSON.stringify(orientation)}; use portrait or landscape`);
  const { width, height } = FRAME_SIZES[o];
  const safeIn = data?.layout?.[o]?.safe;
  const safe = Array.isArray(safeIn) && safeIn.length === 4 && safeIn.every(Number.isFinite) ? safeIn : DEFAULT_SAFE[o];
  const words = String(text ?? data?.name ?? "Motion identity").trim().split(/\s+/).filter(Boolean);
  if (!words.length) throw new Error("--text needs at least one word");
  if (words.length > MAX_WORDS) throw new Error(`--text has ${words.length} words; a proof headline holds ${MAX_WORDS} at most (big words, few of them)`);
  const accentIndex = accentWord == null ? words.length - 1 : Number(accentWord) - 1;
  if (!(Number.isInteger(accentIndex) && accentIndex >= 0 && accentIndex < words.length)) throw new Error(`--accent-word must be a word number from 1 to ${words.length}`);
  const accent = pickAccent(data?.colors, accentKey);
  if (!accent) throw new Error(accentKey ? `colors.${accentKey} is not a hex color in the spec` : "the spec has no color to use as the accent");

  const m = isPlainObject(data?.motion) ? data.motion : {};
  const durations = { ...DEFAULT_DURATIONS, ...(isPlainObject(m.durations) ? m.durations : {}) };
  const base = typeof m.ease === "string" ? m.ease : DEFAULT_EASE;
  const e = isPlainObject(m.eases) ? m.eases : {};
  const eases = { enter: e.enter ?? base, exit: e.exit ?? base, emphasis: e.emphasis ?? base, move: base };
  const personality = typeof m.personality === "string" ? m.personality : "corporate";
  const rhythm = RHYTHM[personality] ?? NEUTRAL_RHYTHM;
  const stagger = words.length > 1 ? Math.min(rhythm.stagger, STAGGER_BUDGET / (words.length - 1)) : 0;
  const exitDur = round3(Math.max(0.2, durations.fade * 0.7)); // exits are shorter than entrances
  const exitStagger = round3(stagger * 0.6);

  const t = {};
  t.enter = LEAD_IN;
  t.settled = round3(t.enter + stagger * (words.length - 1) + durations.grow);
  t.emphasis = round3(t.settled + 0.25);
  t.rule = round3(t.emphasis + 0.15);
  t.sub = round3(t.emphasis + durations.indicate);
  t.move = round3(t.sub + 0.2);
  const afterMove = round3(Math.max(t.move + durations.move, t.rule + durations.draw, t.sub + durations.fade));
  t.signature = hasSignature ? round3(afterMove + 0.1) : null;
  t.exit = round3(hasSignature ? t.signature + SIGNATURE_SEC : afterMove + 0.35);
  const exitEnd = round3(t.exit + exitStagger * (words.length - 1) + exitDur);
  const total = round3(exitEnd + END_HOLD);

  const frames = [
    { name: "entrance", t: round3(t.enter + (t.settled - t.enter) * 0.45) },
    { name: "settled", t: round3(t.settled + 0.1) },
    { name: "emphasis", t: round3(t.emphasis + durations.indicate * 0.5) },
    { name: "moved", t: round3(afterMove - 0.05) },
    ...(hasSignature ? [{ name: "signature", t: round3(t.signature + SIGNATURE_SEC * 0.6) }] : []),
    { name: "exit", t: round3(t.exit + (exitEnd - t.exit) * 0.5) },
  ];

  return {
    lang: String(lang),
    orientation: o,
    width,
    height,
    safe,
    words,
    accentIndex,
    accent,
    sub: sub ? String(sub).trim() : null,
    personality,
    peak: rhythm.peak,
    stagger: round3(stagger),
    exitStagger,
    exitDur,
    durations,
    eases,
    ambient: ["subtle", "lively"].includes(m.ambient) ? m.ambient : "none",
    signature: hasSignature ? { start: t.signature, dur: SIGNATURE_SEC, name: m.signature?.name ?? null } : null,
    times: t,
    gateEnd: exitEnd,
    maxStaticSec: typeof m.maxStaticSec === "number" && m.maxStaticSec > 0 ? m.maxStaticSec : 2,
    total,
    frames,
  };
}

// ---------------------------------------------------------------------------------------------------------
// the page
// ---------------------------------------------------------------------------------------------------------

const GENERIC = new Set(["serif", "sans-serif", "monospace", "system-ui", "cursive", "fantasy"]);
function fontStack(t, fallback) {
  const family = String(t?.family ?? "").trim();
  if (!family) return fallback;
  const parts = family.split(",").map((s) => s.trim()).filter(Boolean).map((n) => (/^["']/.test(n) || GENERIC.has(n) || /^[A-Za-z][A-Za-z0-9-]*$/.test(n) ? n : `"${n.replace(/"/g, '\\"')}"`));
  const fb = typeof t?.fallback === "string" && t.fallback.trim() ? t.fallback.trim() : fallback;
  if (!parts.some((p) => GENERIC.has(p))) parts.push(fb);
  return parts.join(", ");
}

export function tokensCss(data, plan) {
  const c = isPlainObject(data?.colors) ? data.colors : {};
  const ty = isPlainObject(data?.typography) ? data.typography : {};
  const lines = [
    `--mi-bg: ${c.background};`,
    `--mi-text: ${c.text};`,
    `--mi-muted: ${c.muted ?? c.text};`,
    `--mi-accent: ${plan.accent.value};`,
    // the supporting line uses muted only where muted stays readable on the background
    `--mi-sub: ${HEX_RE.test(c.muted ?? "") && HEX_RE.test(c.background ?? "") && contrastRatio(c.muted, c.background) >= 4.5 ? c.muted : c.text};`,
    `--mi-ambient: ${c.ambient ?? c.muted ?? plan.accent.value};`,
    `--mi-font-display: ${fontStack(ty.display, "sans-serif")};`,
    `--mi-font-body: ${fontStack(ty.body ?? ty.display, "sans-serif")};`,
    `--mi-weight-display: ${Number.isFinite(ty.display?.weight) ? ty.display.weight : 800};`,
    `--mi-weight-body: ${Number.isFinite(ty.body?.weight) ? ty.body.weight : 500};`,
  ];
  return `:root {\n${lines.map((l) => `        ${l}`).join("\n")}\n      }`;
}

const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jsonForScript = (v) => JSON.stringify(v, null, 2).replace(/</g, "\\u003c");

// Deterministic-motion rules a signature script must keep (HyperFrames renders by seeking a paused timeline).
const SIGNATURE_BANS = [
  [/\.play\s*\(/, "play() — the timeline is paused and seeked"],
  [/repeat\s*:\s*-\s*1/, "repeat: -1 — repeats must be finite"],
  [/\bDate\.now\b|\bperformance\.now\b/, "clocks — every frame is a function of the playhead"],
  [/\bMath\.random\b/, "Math.random — use a fixed list of values"],
  [/\bsetTimeout\b|\bsetInterval\b|\brequestAnimationFrame\b/, "timers — add tweens to tl instead"],
  [/\bgsap\.(to|from|fromTo|timeline)\s*\(/, "a bare gsap tween — add it to tl so it seeks with the video"],
  [/\bfetch\s*\(|XMLHttpRequest/, "network calls"],
];

export function lintSignature(source) {
  const problems = [];
  for (const [re, why] of SIGNATURE_BANS) if (re.test(source)) problems.push(why);
  return problems;
}

export function buildPage(template, data, plan, signatureSource) {
  const marks = ["<!-- mi:tokens -->", "<!-- mi:headline -->", "/* mi:plan */", "/* mi:signature */", '<html lang="en">'];
  for (const mark of marks) if (!template.includes(mark)) throw new Error(`assets/proof.html lost its ${mark} marker`);
  const words = plan.words.map((w, i) => `<span class="mi-word${i === plan.accentIndex ? " mi-accent-word" : ""}" id="mi-w${i + 1}">${escapeHtml(w)}</span>`).join(" ");
  return template
    .replace("<!-- mi:tokens -->", `<style>\n      ${tokensCss(data, plan)}\n    </style>`)
    .replace("<!-- mi:headline -->", words)
    .replace("/* mi:plan */", `window.MOTION_PROOF = ${jsonForScript(plan)};`)
    .replace("/* mi:signature */", signatureSource ? signatureSource.trim() : "/* no signature script: the proof skips the signature beat */")
    .replace('<html lang="en">', `<html lang="${escapeHtml(plan.lang)}">`)
    .replace(/data-width="\d+"/, `data-width="${plan.width}"`)
    .replace(/data-height="\d+"/, `data-height="${plan.height}"`)
    .replace(/data-duration="[\d.]+"/, `data-duration="${plan.total}"`);
}

// keepsMoving over the stage until the exit ends (the end hold is deliberate), and the headline on time.
export function motionJson(plan) {
  return {
    duration: plan.gateEnd,
    assertions: [
      { kind: "keepsMoving", maxStaticSec: plan.maxStaticSec, withinSelector: "#mi-stage" },
      { kind: "appearsBy", selector: "#mi-w1", bySec: round3(plan.times.enter + 0.5) },
    ],
  };
}

// ---------------------------------------------------------------------------------------------------------
// running HyperFrames and ffmpeg
// ---------------------------------------------------------------------------------------------------------

const QUIET_ENV = { HYPERFRAMES_NO_TELEMETRY: "1", HYPERFRAMES_NO_UPDATE_CHECK: "1", HYPERFRAMES_NO_AUTO_INSTALL: "1" };

export function hfEnv(base = process.env) {
  const env = { ...base };
  for (const [k, v] of Object.entries(QUIET_ENV)) if (env[k] === undefined) env[k] = v;
  return env;
}

export function defaultExec(command, args, { cwd, env, timeoutMs = 10 * 60 * 1000 } = {}) {
  const r = spawnSync(command, args, { cwd, env, encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", error: r.error ?? null };
}

export function onPath(name, env = process.env) {
  for (const dir of String(env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const p = path.join(dir, name);
    try {
      fs.accessSync(p, fs.constants.X_OK);
      return p;
    } catch {
      /* next */
    }
  }
  return null;
}

// An installed `hyperframes` first; otherwise npx, which reuses its cache when a copy is there.
export function resolveHyperframes(env = process.env) {
  const bin = onPath("hyperframes", env);
  if (bin) return { command: bin, prefix: [], via: "PATH" };
  const npx = onPath("npx", env);
  if (npx) return { command: npx, prefix: ["--yes", "hyperframes@latest"], via: "npx" };
  return null;
}

export function firstJsonObject(text) {
  const s = String(text ?? "");
  for (let start = s.indexOf("{"); start >= 0; start = s.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inString) {
        if (ch === "\\") i++;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        try {
          return JSON.parse(s.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  return null;
}

// The `hyperframes check --json` envelope reduced to errors and warnings worth reading.
export function summarizeCheck(envelope) {
  const findings = [];
  let errors = 0;
  let warnings = 0;
  for (const name of ["lint", "runtime", "layout", "motion", "contrast"]) {
    const s = envelope?.[name];
    if (!s || typeof s !== "object") continue;
    const list = Array.isArray(s.findings) ? s.findings : [];
    errors += Math.max(list.filter((f) => f.severity === "error").length, Number(s.errorCount) || 0);
    warnings += Math.max(list.filter((f) => f.severity === "warning").length, Number(s.warningCount) || 0);
    for (const f of list) if (f.severity === "error" || f.severity === "warning") findings.push({ section: name, severity: f.severity, code: f.code, selector: f.selector ?? null, time: f.time ?? null, message: f.message ?? "" });
  }
  return { ok: envelope?.ok === true && errors === 0, errors, warnings, findings, version: envelope?._meta?.version ?? null };
}

export function proofHome(env = process.env) {
  return env.MOTION_IDENTITY_HOME ? path.resolve(env.MOTION_IDENTITY_HOME) : path.join(os.homedir(), ".cache", "motion-identity");
}

export function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function slugify(s) {
  return String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "proof";
}

export function appendMetrics(line, { tmpdir = os.tmpdir() } = {}) {
  const dir = path.join(tmpdir, "motion-identity");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "metrics.jsonl");
  fs.appendFileSync(file, JSON.stringify(line) + "\n");
  return file;
}

// Writes the project, then check -> render -> frames -> contact sheet. Each step reports and stops on failure.
export function runProof({ dir, page, plan, render = true, exec = defaultExec, env = process.env }) {
  const project = path.join(dir, "project");
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, "index.html"), page);
  fs.writeFileSync(path.join(project, "index.motion.json"), JSON.stringify(motionJson(plan), null, 2) + "\n");
  fs.writeFileSync(path.join(dir, "plan.json"), JSON.stringify(plan, null, 2) + "\n");
  const result = { dir, project, page: path.join(project, "index.html"), rendered: false, check: null, mp4: null, frames: [], contact: null, problems: [] };
  if (!render) return result;

  const hf = resolveHyperframes(env);
  if (!hf) {
    result.problems.push("HyperFrames is not reachable: neither `hyperframes` nor `npx` is on PATH. Install Node 22+ and run again.");
    return result;
  }
  const hfe = hfEnv(env);
  const c = exec(hf.command, [...hf.prefix, "check", project, "--json"], { cwd: project, env: hfe });
  const envelope = firstJsonObject(c.stdout);
  if (!envelope) {
    result.problems.push(`hyperframes check did not answer: ${(c.stderr || c.stdout || String(c.error ?? "")).trim().slice(-600)}`);
    return result;
  }
  result.check = summarizeCheck(envelope);
  if (!result.check.ok) {
    result.problems.push(`hyperframes check found ${result.check.errors} error(s); fix them before the render`);
    return result;
  }
  const mp4 = path.join(dir, "proof.mp4");
  const r = exec(hf.command, [...hf.prefix, "render", project, "-o", mp4, "--quality", "looks", "--quiet"], { cwd: project, env: hfe, timeoutMs: 30 * 60 * 1000 });
  if (r.status !== 0 || r.error || !fs.existsSync(mp4)) {
    result.problems.push(`hyperframes render failed: ${(r.stderr || r.stdout || String(r.error ?? "")).trim().slice(-800)} (try: npx hyperframes doctor)`);
    return result;
  }
  result.rendered = true;
  result.mp4 = mp4;
  const framesDir = path.join(dir, "frames");
  fs.mkdirSync(framesDir, { recursive: true });
  plan.frames.forEach((f, i) => {
    const out = path.join(framesDir, `${String(i + 1).padStart(2, "0")}-${f.name}.png`);
    const x = exec("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(f.t), "-i", mp4, "-frames:v", "1", out], { env, timeoutMs: 60000 });
    if (x.status === 0 && fs.existsSync(out)) result.frames.push({ ...f, file: out });
    else result.problems.push(`ffmpeg could not take the ${f.name} frame at ${f.t}s: ${x.stderr.trim().slice(-200)}`);
  });
  if (result.frames.length) {
    const contact = path.join(dir, "contact-sheet.png");
    const tileW = plan.orientation === "portrait" ? 360 : 480;
    const args = ["-y", "-loglevel", "error"];
    for (const f of result.frames) args.push("-i", f.file);
    const scaled = result.frames.map((_, i) => `[${i}:v]scale=${tileW}:-2[s${i}]`).join(";");
    const stack = `${result.frames.map((_, i) => `[s${i}]`).join("")}hstack=inputs=${result.frames.length}`;
    args.push("-filter_complex", result.frames.length > 1 ? `${scaled};${stack}` : `[0:v]scale=${tileW}:-2`, contact);
    const s = exec("ffmpeg", args, { env, timeoutMs: 60000 });
    if (s.status === 0 && fs.existsSync(contact)) result.contact = contact;
    else result.problems.push(`ffmpeg could not build the contact sheet: ${s.stderr.trim().slice(-200)}`);
  }
  return result;
}

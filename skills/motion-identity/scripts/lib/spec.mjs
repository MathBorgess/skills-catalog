// A brand spec (frame.md, design.md or DESIGN.md) as the motion identity sees it: frontmatter, prose
// sections, and the checks that decide whether a motion identity is complete enough for a video tool.
//
// The key lists below are the contract explain-me reads (skills/explain-me/scripts/lib/design.mjs);
// motion.test.mjs fails when the two drift apart.

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml, YamlError } from "./yaml.mjs";

// Same precedence HyperFrames and explain-me use to find a project's brand spec.
export const PROJECT_SPEC_NAMES = ["frame.md", "design.md", "DESIGN.md"];
export const KIT_PRIMITIVES = ["draw", "write", "morph", "move", "camera", "indicate", "count", "grow", "fade"];
export const MOTION_PERSONALITIES = ["playful", "premium", "corporate", "energetic"];
export const EASE_ROLES = ["enter", "exit", "emphasis"];
export const AMBIENT_LEVELS = ["none", "subtle", "lively"];
export const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export const STATUS_RE = /^\*\*Status:\*\*\s*(draft|approved)\b(.*)$/im;
export const BRIEF_MAX_LINES = 8;
// Colors that carry the page rather than an accent: never picked as the proof's accent by default.
const NEUTRAL_KEYS = new Set(["background", "surface", "text", "muted", "light", "ambient", "white", "black", "neutral"]);

export class SpecError extends Error {
  constructor(message, file) {
    super(file ? `${file}: ${message}` : message);
    this.name = "SpecError";
  }
}

export const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const typeName = (v) => (v === null ? "null" : Array.isArray(v) ? "a list" : typeof v === "object" ? "a map" : typeof v);

export function splitFrontmatter(source, file) {
  const text = String(source).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  if (!/^---\s*$/.test(lines[0] ?? "")) return { data: {}, body: text.trim(), hasFrontmatter: false };
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (/^(---|\.\.\.)\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (end === -1) throw new SpecError("frontmatter opens with --- on line 1 but never closes; add a closing --- line", file);
  let data;
  try {
    data = parseYaml(lines.slice(1, end).join("\n"), { lineOffset: 1 });
  } catch (e) {
    if (e instanceof YamlError) throw new SpecError(`frontmatter does not parse: ${e.message}`, file);
    throw e;
  }
  if (data === null || data === undefined) data = {};
  if (!isPlainObject(data)) throw new SpecError("frontmatter must be a map of keys", file);
  return { data, body: lines.slice(end + 1).join("\n").trim(), hasFrontmatter: true };
}

export function loadSpec(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    throw new SpecError(`cannot read the spec (${e.code ?? e.message})`, file);
  }
  return { path: file, ...splitFrontmatter(text, file) };
}

// frame.md, then design.md, then DESIGN.md. Uses the real listing so a case-insensitive file system
// cannot report design.md when only DESIGN.md exists.
export function findProjectSpec(dir) {
  let names;
  try {
    names = new Set(fs.readdirSync(dir));
  } catch {
    return null;
  }
  for (const name of PROJECT_SPEC_NAMES) if (names.has(name)) return path.join(dir, name);
  return null;
}

// "## " headings outside fenced code split the prose; keys are lowercase headings.
export function splitSections(body) {
  const sections = [];
  let current = null;
  let fence = false;
  for (const line of String(body ?? "").split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const m = !fence && /^## +(.+?)\s*$/.exec(line);
    if (m) {
      current = { heading: m[1], key: m[1].toLowerCase(), lines: [] };
      sections.push(current);
    } else if (current) current.lines.push(line);
  }
  return sections.map((s) => ({ heading: s.heading, key: s.key, text: s.lines.join("\n").trim() }));
}

export const section = (body, key) => splitSections(body).find((s) => s.key === key) ?? null;

// ---------------------------------------------------------------------------------------------------------
// eases: GSAP names only. Agents copy CSS names and cubic-bezier() from UI motion tables; GSAP silently
// falls back to its default for a name it does not know, so a typo would ship as the wrong curve.
// ---------------------------------------------------------------------------------------------------------

const GSAP_FAMILIES = ["none", "linear", "power0", "power1", "power2", "power3", "power4", "quad", "cubic", "quart", "quint", "strong", "back", "bounce", "circ", "elastic", "expo", "sine", "steps"];
const GSAP_EASE_RE = new RegExp(`^(?:${GSAP_FAMILIES.join("|")})(?:\\.(?:in|out|inOut))?(?:\\(\\s*-?\\d*\\.?\\d+(?:\\s*,\\s*-?\\d*\\.?\\d+)*\\s*\\))?$`);
const CSS_TO_GSAP = {
  linear: "none",
  ease: "power2.out",
  "ease-in": "power2.in",
  "ease-out": "power2.out",
  "ease-in-out": "power2.inOut",
  "ease-out-back": "back.out(1.7)",
  "ease-in-back": "back.in(1.7)",
  "ease-out-expo": "expo.out",
  "ease-in-expo": "expo.in",
  "ease-out-cubic": "power2.out",
  "ease-in-out-cubic": "power2.inOut",
  "ease-out-quart": "power3.out",
  "ease-out-elastic": "elastic.out(1, 0.4)",
};

export function isGsapEase(name) {
  return typeof name === "string" && GSAP_EASE_RE.test(name.trim());
}

export function easeHint(name) {
  const n = String(name ?? "").trim().toLowerCase();
  if (CSS_TO_GSAP[n]) return `use the GSAP name ${CSS_TO_GSAP[n]}`;
  if (/^cubic-bezier\(/.test(n)) return "a cubic-bezier needs CustomEase, which the video tools do not load; pick the nearest named ease in references/personality-and-timing.md";
  if (/^spring/.test(n)) return "springs are not GSAP eases; use back.out(n) for overshoot or elastic.out(a, p) for oscillation";
  return "write a GSAP ease such as power2.out, back.out(1.6), expo.out or sine.inOut";
}

// ---------------------------------------------------------------------------------------------------------
// contrast (WCAG 2.x relative luminance)
// ---------------------------------------------------------------------------------------------------------

function luminance(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrastRatio(a, b) {
  const [la, lb] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (la + 0.05) / (lb + 0.05);
}

// The accent the proof colors its emphasis with: the named key, else the non-neutral color with the
// best contrast on the background (text must stay readable), else the text color.
export function pickAccent(colors, wanted) {
  if (!isPlainObject(colors)) return null;
  if (wanted) return HEX_RE.test(colors[wanted] ?? "") ? { key: wanted, value: colors[wanted] } : null;
  const bg = colors.background;
  const candidates = Object.entries(colors).filter(([k, v]) => !NEUTRAL_KEYS.has(k) && typeof v === "string" && HEX_RE.test(v));
  if (!candidates.length || !HEX_RE.test(bg ?? "")) return HEX_RE.test(colors.text ?? "") ? { key: "text", value: colors.text } : null;
  const ranked = candidates.map(([k, v]) => ({ key: k, value: v, ratio: contrastRatio(v, bg) })).sort((a, b) => b.ratio - a.ratio);
  return { key: ranked[0].key, value: ranked[0].value };
}

// ---------------------------------------------------------------------------------------------------------
// the motion identity check
// ---------------------------------------------------------------------------------------------------------

function motionExampleCalls(body) {
  const s = section(body, "motion examples");
  if (!s) return [];
  const calls = [];
  let fence = false;
  for (const line of s.text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      continue;
    }
    if (!fence) continue;
    for (const m of line.matchAll(/\bb\.([A-Za-z_]\w*)\s*\(/g)) calls.push(m[1]);
    for (const m of line.matchAll(/\bb\.at\s*\([^)]*\)\s*\.\s*([A-Za-z_]\w*)\s*\(/g)) calls.push(m[1]);
  }
  return calls;
}

export function briefLines(body) {
  const s = section(body, "brief block");
  if (!s) return null;
  const text = s.text.replace(/^```[^\n]*\n?|\n?```$/g, "");
  return text.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
}

export function identityStatus(body) {
  const s = section(body, "motion identity");
  if (!s) return null;
  const m = STATUS_RE.exec(s.text);
  return m ? { status: m[1].toLowerCase(), detail: m[2].trim() } : null;
}

// spec: {path, data, body}. Returns {errors, warnings}, each {path, message}. Errors are what a video tool
// would get wrong or a run could not produce; warnings are what a reader should look at.
export function checkIdentity(spec) {
  const errors = [];
  const warnings = [];
  const err = (p, message) => errors.push({ path: p, message });
  const warn = (p, message) => warnings.push({ path: p, message });
  const data = spec.data ?? {};
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);

  // the floor every video tool reads before it moves anything: page colors and two type roles
  const colors = isPlainObject(data.colors) ? data.colors : null;
  if (data.colors !== undefined && !colors) err("colors", `must be a map of hex colors, got ${typeName(data.colors)}`);
  for (const k of ["background", "text"]) {
    const v = colors?.[k];
    if (v === undefined) err(`colors.${k}`, "is missing: transcribe it from the brand's own palette; never invent a value");
    else if (typeof v !== "string" || !HEX_RE.test(v)) err(`colors.${k}`, `must be a quoted hex color like "#061A31", got ${JSON.stringify(v)}`);
  }
  if (colors) {
    for (const [k, v] of Object.entries(colors)) {
      if (k === "background" || k === "text") continue;
      if (typeof v !== "string" || !HEX_RE.test(v)) err(`colors.${k}`, `must be a quoted hex color, got ${JSON.stringify(v)}`);
    }
    if (HEX_RE.test(colors.background ?? "") && HEX_RE.test(colors.text ?? "")) {
      const ratio = contrastRatio(colors.text, colors.background);
      if (ratio < 4.5) err("colors.text", `contrast with colors.background is ${ratio.toFixed(2)}:1; text needs 4.5:1`);
    }
  }
  const typo = isPlainObject(data.typography) ? data.typography : null;
  for (const role of ["display", "body"]) {
    const t = typo?.[role];
    if (!isPlainObject(t) || typeof t.family !== "string" || t.family.trim() === "") err(`typography.${role}.family`, "is missing: name the brand's family exactly as the brand writes it");
    else if (t.weight !== undefined && !(isNum(t.weight) && t.weight >= 1 && t.weight <= 1000)) err(`typography.${role}.weight`, "must be a number between 1 and 1000");
  }

  // the motion identity itself
  const m = isPlainObject(data.motion) ? data.motion : null;
  if (!m) {
    err("motion", data.motion === undefined ? "is missing: run the grilling rounds and write the motion identity" : `must be a map, got ${typeName(data.motion)}`);
  } else {
    if (m.gate === false) err("motion.gate", "cannot be off: loosen motion.maxStaticSec instead");
    if (m.maxStaticSec !== undefined && !(isNum(m.maxStaticSec) && m.maxStaticSec > 0)) err("motion.maxStaticSec", "must be a number greater than 0");
    if (typeof m.personality !== "string" || m.personality.trim() === "") err("motion.personality", "is missing: one archetype, chosen in round 2");
    else if (!MOTION_PERSONALITIES.includes(m.personality)) warn("motion.personality", `not one of ${MOTION_PERSONALITIES.join(", ")}; tools read it as a note only`);
    if (m.ease === undefined) warn("motion.ease", "is missing: moves, morphs and camera pushes fall back to each tool's default");
    else if (!isGsapEase(m.ease)) err("motion.ease", `${JSON.stringify(m.ease)} is not a GSAP ease: ${easeHint(m.ease)}`);
    if (!isPlainObject(m.eases)) err("motion.eases", "is missing: one GSAP ease each for enter, exit and emphasis");
    else {
      for (const role of EASE_ROLES) {
        const v = m.eases[role];
        if (v === undefined) err(`motion.eases.${role}`, "is missing");
        else if (!isGsapEase(v)) err(`motion.eases.${role}`, `${JSON.stringify(v)} is not a GSAP ease: ${easeHint(v)}`);
      }
      for (const k of Object.keys(m.eases)) if (!EASE_ROLES.includes(k)) warn(`motion.eases.${k}`, `not a role (${EASE_ROLES.join(", ")}); nothing reads it`);
      if (m.eases.enter && m.eases.enter === m.eases.exit) warn("motion.eases.exit", "is the same curve as enter: an exit should accelerate away (.in) where an entrance decelerates (.out)");
    }
    if (!AMBIENT_LEVELS.includes(m.ambient)) err("motion.ambient", `must be one of ${AMBIENT_LEVELS.join(", ")}, got ${JSON.stringify(m.ambient)}`);
    if (!isPlainObject(m.signature) || typeof m.signature.name !== "string" || m.signature.name.trim() === "") err("motion.signature", "is missing: a map with the name and a note of the brand's own move");
    else if (typeof m.signature.note !== "string" || m.signature.note.trim() === "") warn("motion.signature.note", "is empty: say what moves, how, and where in a video it lands");
    if (m.durations !== undefined) {
      if (!isPlainObject(m.durations)) err("motion.durations", `must be a map of kit primitives to seconds, got ${typeName(m.durations)}`);
      else
        for (const [k, v] of Object.entries(m.durations)) {
          if (!KIT_PRIMITIVES.includes(k)) warn(`motion.durations.${k}`, `not a kit primitive (${KIT_PRIMITIVES.join(", ")})`);
          if (!(isNum(v) && v > 0)) err(`motion.durations.${k}`, "must be a number of seconds greater than 0");
        }
    } else warn("motion.durations", "is missing: entrances, emphasis and exits keep each tool's default lengths");
    if (Array.isArray(m.preferred)) {
      m.preferred.forEach((item, i) => {
        if (!isPlainObject(item) || !KIT_PRIMITIVES.includes(item.primitive)) err(`motion.preferred[${i}]`, `must be { primitive, note } with a kit primitive (${KIT_PRIMITIVES.join(", ")})`);
      });
    }
  }

  // the prose the tools read for judgment
  const body = spec.body ?? "";
  if (!section(body, "motion identity")) err("## Motion identity", "is missing: the intent, the principles in use and refused, kinetic type and the never-list");
  else if (!identityStatus(body)) err("## Motion identity", "needs a status line: **Status:** draft (why) or **Status:** approved on AAAA-MM-DD by <role>");
  const brief = briefLines(body);
  if (!brief) err("## Brief block", `is missing: at most ${BRIEF_MAX_LINES} lines for a HyperFrames BRIEF.md`);
  else if (brief.length > BRIEF_MAX_LINES) err("## Brief block", `has ${brief.length} lines; keep it to ${BRIEF_MAX_LINES}`);
  else if (brief.length === 0) err("## Brief block", "is empty");
  const allowed = new Set([...KIT_PRIMITIVES, "at"]);
  for (const name of new Set(motionExampleCalls(body).filter((n) => !allowed.has(n)))) err("## Motion examples", `b.${name}( is not a kit primitive; explain-me examples use only ${KIT_PRIMITIVES.join(", ")}`);
  if (!section(body, "motion examples")) warn("## Motion examples", "is missing: one kit beat shows explain-me the identity better than any note");

  return { errors, warnings };
}

// The brief block, or a draft built from the keys when the prose has none yet.
export function briefFor(spec) {
  const lines = briefLines(spec.body);
  if (lines && lines.length) return { lines, drafted: false };
  const m = isPlainObject(spec.data?.motion) ? spec.data.motion : {};
  const e = isPlainObject(m.eases) ? m.eases : {};
  const out = [];
  if (m.personality) out.push(`Motion personality: ${m.personality}.`);
  if (e.enter || e.exit || e.emphasis) out.push(`Eases: enter ${e.enter ?? "?"}, exit ${e.exit ?? "?"}, emphasis ${e.emphasis ?? "?"}; moves ${m.ease ?? "?"}.`);
  if (m.ambient) out.push(`Ambient: ${m.ambient}.`);
  if (isPlainObject(m.signature) && m.signature.name) out.push(`Signature: ${m.signature.name}${m.signature.note ? ` (${m.signature.note})` : ""}.`);
  return { lines: out, drafted: true };
}

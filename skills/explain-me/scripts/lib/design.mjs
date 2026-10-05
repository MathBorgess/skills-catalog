// Design spec: layers, merge, overrides, validation, tokens CSS, frame.md.
//
// A design spec is a markdown file with YAML frontmatter (the subset in ./yaml.mjs) and a prose
// body. A run resolves it in layers, key by key: explicit spec, then the user's personal
// DESIGN.md in the skill home, then the shipped default. Maps merge deeply, arrays and scalars
// replace, a null/missing value in a higher layer leaves the lower value in place.

import fs from "node:fs";
import path from "node:path";
import { FRAME_SIZES, ORIENTATIONS } from "./orientation.mjs";
import { parse as parseYaml, stringify as stringifyYaml, YamlError } from "./yaml.mjs";

export const KIT_PRIMITIVES = ["draw", "write", "morph", "move", "camera", "indicate", "count", "grow", "fade"];
// Chain modifiers of the beat object that are part of the kit API but are not primitives.
export const KIT_MODIFIERS = ["at"];
export const IMAGE_ROLES = ["reference", "asset", "logo"];
// Same precedence HyperFrames uses to discover a project's brand spec.
export const PROJECT_SPEC_NAMES = ["frame.md", "design.md", "DESIGN.md"];
export const KOKORO_LANGS = ["pt-br", "en-us", "en-gb", "es", "fr-fr", "it", "ja", "zh", "hi"];
export const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const TOP_LEVEL_KEYS = ["name", "colors", "typography", "motion", "rules", "layout", "captions", "narration", "images"];
const TYPOGRAPHY_ROLES = ["display", "body", "mono"];
const MOTION_KEYS = ["gate", "maxStaticSec", "leadInSec", "beatGapSec", "tailSec", "ease", "durations", "preferred", "examples"];
const RULE_KEYS = ["centralObject", "hud", "cardsAsLayout", "maxWordsOnScreen"];
const NARRATION_KEYS = ["speed", "voices"];
const LAYOUT_KEYS = ["safe", "captions"];
const CAPTIONS_KEYS = ["burn", "maxWords"];
export const MAX_CAPTION_WORDS = 20;

export const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

export function deepEqual(a, b) {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (isPlainObject(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

// ---------------------------------------------------------------------------
// reading a spec file
// ---------------------------------------------------------------------------

export class SpecError extends Error {
  constructor(message, file) {
    super(file ? `${file}: ${message}` : message);
    this.name = "SpecError";
    this.file = file ?? null;
  }
}

// Splits "---\n<yaml>\n---\n<prose>" into {data, body}. No frontmatter means {data: {}, body: text}.
export function splitFrontmatter(source, file) {
  const text = String(source).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  if (!/^---\s*$/.test(lines[0] ?? "")) return { data: {}, body: text.trim() };
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
  if (!isPlainObject(data)) throw new SpecError("frontmatter must be a map of keys (name, colors, motion, ...)", file);
  return { data, body: lines.slice(end + 1).join("\n").trim() };
}

export function loadSpec(file, fsApi = fs) {
  let text;
  try {
    text = fsApi.readFileSync(file, "utf8");
  } catch (e) {
    throw new SpecError(`cannot read the design spec (${e.code ?? e.message})`, file);
  }
  const { data, body } = splitFrontmatter(text, file);
  return { path: file, data, body };
}

// frame.md, then design.md, then DESIGN.md in `dir`. Uses the real directory listing so a
// case-insensitive file system cannot report design.md when only DESIGN.md exists.
export function findProjectSpec(dir, fsApi = fs) {
  let names;
  try {
    names = new Set(fsApi.readdirSync(dir));
  } catch {
    return null;
  }
  for (const name of PROJECT_SPEC_NAMES) if (names.has(name)) return path.join(dir, name);
  return null;
}

// ---------------------------------------------------------------------------
// merging
// ---------------------------------------------------------------------------

export function deepMerge(base, over) {
  if (over === undefined || over === null) return clone(base);
  if (isPlainObject(base) && isPlainObject(over)) {
    const out = {};
    for (const k of Object.keys(base)) out[k] = k in over ? deepMerge(base[k], over[k]) : clone(base[k]);
    for (const k of Object.keys(over)) if (!(k in base) && over[k] !== null && over[k] !== undefined) out[k] = clone(over[k]);
    return out;
  }
  return clone(over);
}

// Splits a prose body into {preamble, sections}; sections start at a "## " heading. Headings
// inside fenced code blocks do not count.
export function splitSections(body) {
  const preamble = [];
  const sections = [];
  let current = null;
  let fence = false;
  for (const line of String(body ?? "").split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const m = !fence && /^## +(.+?)\s*$/.exec(line);
    if (m) {
      current = { heading: m[1], key: m[1].toLowerCase(), lines: [line] };
      sections.push(current);
    } else if (current) current.lines.push(line);
    else preamble.push(line);
  }
  const text = (lines) => lines.join("\n").trim();
  return { preamble: text(preamble), sections: sections.map((s) => ({ heading: s.heading, key: s.key, text: text(s.lines) })) };
}

// Bodies come highest priority first. A heading present in a higher layer replaces the same
// heading below; headings only in lower layers are kept, after the higher layer's, in order.
export function mergeProse(bodies) {
  const parts = bodies.map(splitSections);
  const preamble = parts.map((p) => p.preamble).find((p) => p !== "") ?? "";
  const seen = new Set();
  const sections = [];
  for (const part of parts) {
    for (const s of part.sections) {
      if (seen.has(s.key)) continue;
      seen.add(s.key);
      sections.push(s.text);
    }
  }
  return [preamble, ...sections].filter((t) => t !== "").join("\n\n");
}

const isUrl = (p) => /^[a-z][a-z0-9+.-]*:\/\//i.test(p);

// Image and example paths are relative to the spec file that names them; once layers merge
// that origin is lost, so resolve them against their own file first.
export function absolutisePaths(data, dir) {
  const out = clone(data);
  const fix = (p) => (typeof p === "string" && p !== "" && !isUrl(p) && !path.isAbsolute(p) ? path.resolve(dir, p) : p);
  if (Array.isArray(out.images)) for (const img of out.images) if (isPlainObject(img)) img.path = fix(img.path);
  if (isPlainObject(out.motion) && Array.isArray(out.motion.examples)) out.motion.examples = out.motion.examples.map(fix);
  return out;
}

// What the run changed against the shipped default: every `rules.*` value, motion.maxStaticSec and every
// `captions.burn.*` switch.
export function diffOverrides(merged, base) {
  const out = [];
  const rules = isPlainObject(merged?.rules) ? merged.rules : {};
  for (const k of Object.keys(rules)) {
    const def = base?.rules?.[k];
    if (!deepEqual(rules[k], def === undefined ? null : def)) out.push({ key: `rules.${k}`, default: def === undefined ? null : def, value: rules[k] });
  }
  const mv = merged?.motion?.maxStaticSec;
  const bv = base?.motion?.maxStaticSec;
  if (mv !== undefined && mv !== bv) out.push({ key: "motion.maxStaticSec", default: bv === undefined ? null : bv, value: mv });
  const burn = isPlainObject(merged?.captions?.burn) ? merged.captions.burn : {};
  for (const k of Object.keys(burn)) {
    const def = base?.captions?.burn?.[k];
    if (!deepEqual(burn[k], def === undefined ? null : def)) out.push({ key: `captions.burn.${k}`, default: def === undefined ? null : def, value: burn[k] });
  }
  return out;
}

export function describeOverride(o) {
  return `${o.key}: ${JSON.stringify(o.default)} -> ${JSON.stringify(o.value)}`;
}

// layers: highest priority first, each {kind, path, data, body}. The last layer is the shipped default.
export function mergeLayers(layers) {
  const ordered = [...layers].reverse(); // lowest first
  let data = {};
  for (const layer of ordered) data = deepMerge(data, absolutisePaths(layer.data, path.dirname(layer.path)));
  const body = mergeProse(layers.map((l) => l.body));
  const shipped = layers[layers.length - 1];
  const overrides = diffOverrides(data, shipped.data);
  return { data, body, layers: layers.map((l) => ({ kind: l.kind, path: l.path })), overrides };
}

// explicit (optional) -> personal DESIGN.md in the skill home (if present) -> shipped default.
export function resolveDesign({ explicit, personal, shipped, fsApi = fs }) {
  const layers = [];
  if (explicit) {
    if (!fsApi.existsSync(explicit)) throw new SpecError("design spec not found", explicit);
    layers.push({ kind: "explicit", ...loadSpec(explicit, fsApi) });
  }
  if (personal && fsApi.existsSync(personal)) layers.push({ kind: "personal", ...loadSpec(personal, fsApi) });
  if (!fsApi.existsSync(shipped)) throw new SpecError("the shipped default design spec is missing from the skill (assets/DESIGN.md)", shipped);
  layers.push({ kind: "shipped", ...loadSpec(shipped, fsApi) });
  return { ...mergeLayers(layers), loaded: layers };
}

// ---------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------

function motionExampleCalls(body) {
  const section = splitSections(body).sections.find((s) => s.key === "motion examples");
  if (!section) return [];
  const calls = [];
  const lines = section.text.split("\n");
  let fence = false;
  for (const line of lines) {
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

const typeName = (v) => (v === null ? "null" : Array.isArray(v) ? "a list" : typeof v === "object" ? "a map" : typeof v);

// spec: {path, data, body}. Returns {errors, warnings}, each {path, message}.
export function validateSpec(spec, { fileExists = (p) => fs.existsSync(p) } = {}) {
  const errors = [];
  const warnings = [];
  const err = (p, message) => errors.push({ path: p, message });
  const warn = (p, message) => warnings.push({ path: p, message });
  const data = spec.data ?? {};
  const dir = spec.path ? path.dirname(spec.path) : process.cwd();
  const resolveLocal = (p) => (path.isAbsolute(p) ? p : path.resolve(dir, p));

  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const expectMap = (v, p) => {
    if (v === undefined) return false;
    if (!isPlainObject(v)) {
      err(p, `must be a map, got ${typeName(v)}`);
      return false;
    }
    return true;
  };

  for (const k of Object.keys(data)) if (!TOP_LEVEL_KEYS.includes(k)) warn(k, "unknown top-level key (nothing reads it)");

  if (data.name !== undefined && typeof data.name !== "string") err("name", `must be a string, got ${typeName(data.name)}`);

  // colors
  if (expectMap(data.colors, "colors")) {
    const css = new Map();
    for (const [k, v] of Object.entries(data.colors)) {
      const p = `colors.${k}`;
      if (typeof v !== "string") {
        err(p, v === null ? 'is empty; quote hex values ("#58C4DD") because an unquoted # starts a comment' : `must be a hex color string, got ${typeName(v)}`);
      } else if (!HEX_RE.test(v)) err(p, `must be a hex color like "#58C4DD", got ${JSON.stringify(v)}`);
      const cssName = kebab(k);
      if (css.has(cssName)) warn(p, `becomes --em-${cssName}, the same custom property as colors.${css.get(cssName)}`);
      css.set(cssName, k);
    }
  }

  // typography
  if (expectMap(data.typography, "typography")) {
    for (const [role, spec_] of Object.entries(data.typography)) {
      const p = `typography.${role}`;
      if (!TYPOGRAPHY_ROLES.includes(role)) warn(p, `unknown role (known: ${TYPOGRAPHY_ROLES.join(", ")}); no --em-font-${kebab(role)} is emitted`);
      if (!isPlainObject(spec_)) {
        err(p, `must be a map with family and weight, got ${typeName(spec_)}`);
        continue;
      }
      if (typeof spec_.family !== "string" || spec_.family.trim() === "") err(`${p}.family`, "must be a non-empty string");
      if (spec_.weight !== undefined && !(isNum(spec_.weight) && spec_.weight >= 1 && spec_.weight <= 1000)) err(`${p}.weight`, "must be a number between 1 and 1000");
      if (spec_.fallback !== undefined && typeof spec_.fallback !== "string") err(`${p}.fallback`, "must be a string such as serif, sans-serif or monospace");
    }
  }

  // motion
  if (expectMap(data.motion, "motion")) {
    const m = data.motion;
    for (const k of Object.keys(m)) if (!MOTION_KEYS.includes(k)) warn(`motion.${k}`, "unknown key (nothing reads it)");
    if (m.gate !== undefined) {
      if (m.gate === false) err("motion.gate", "cannot be off: the Motion Gate is blocking in every design; loosen motion.maxStaticSec instead");
      else if (m.gate !== true) err("motion.gate", `must be on, got ${typeName(m.gate)} ${JSON.stringify(m.gate)}`);
    }
    if (m.maxStaticSec !== undefined && !(isNum(m.maxStaticSec) && m.maxStaticSec > 0)) err("motion.maxStaticSec", "must be a number greater than 0");
    for (const k of ["leadInSec", "beatGapSec", "tailSec"]) {
      if (m[k] !== undefined && !(isNum(m[k]) && m[k] >= 0)) err(`motion.${k}`, "must be a number of seconds, 0 or more");
    }
    if (m.ease !== undefined && (typeof m.ease !== "string" || m.ease.trim() === "")) err("motion.ease", "must be a non-empty GSAP ease name");
    if (expectMap(m.durations, "motion.durations")) {
      for (const [k, v] of Object.entries(m.durations)) {
        if (!KIT_PRIMITIVES.includes(k)) warn(`motion.durations.${k}`, `not a kit primitive (${KIT_PRIMITIVES.join(", ")})`);
        if (!(isNum(v) && v > 0)) err(`motion.durations.${k}`, "must be a number of seconds greater than 0");
      }
    }
    if (m.preferred !== undefined) {
      if (!Array.isArray(m.preferred)) err("motion.preferred", `must be a list, got ${typeName(m.preferred)}`);
      else
        m.preferred.forEach((item, i) => {
          const p = `motion.preferred[${i}]`;
          if (!isPlainObject(item)) return err(p, "must be a map with primitive and note");
          if (!KIT_PRIMITIVES.includes(item.primitive)) err(`${p}.primitive`, `${JSON.stringify(item.primitive)} is not a kit primitive (${KIT_PRIMITIVES.join(", ")})`);
          if (item.note !== undefined && typeof item.note !== "string") err(`${p}.note`, "must be a string");
        });
    }
    if (m.examples !== undefined) {
      if (!Array.isArray(m.examples)) err("motion.examples", `must be a list of paths, got ${typeName(m.examples)}`);
      else
        m.examples.forEach((item, i) => {
          const p = `motion.examples[${i}]`;
          if (typeof item !== "string" || item === "") return err(p, "must be a path string");
          if (!fileExists(resolveLocal(item))) err(p, `file not found: ${item} (relative to ${dir})`);
        });
    }
  }

  // rules
  if (expectMap(data.rules, "rules")) {
    for (const [k, v] of Object.entries(data.rules)) {
      const p = `rules.${k}`;
      if (!RULE_KEYS.includes(k)) warn(p, `unknown rule (known: ${RULE_KEYS.join(", ")}); it is reported as an override but nothing reads it`);
      else if (k === "maxWordsOnScreen") {
        if (!(Number.isInteger(v) && v >= 0)) err(p, "must be a whole number, 0 or more");
      } else if (typeof v !== "boolean") err(p, `must be true or false, got ${typeName(v)}`);
    }
  }

  // layout: one safe box and one captions box per orientation, [x0, y0, x1, y1] inside that orientation's frame
  if (expectMap(data.layout, "layout")) {
    for (const [name, entry] of Object.entries(data.layout)) {
      const p = `layout.${name}`;
      if (!ORIENTATIONS.includes(name)) {
        warn(p, `unknown orientation (known: ${ORIENTATIONS.join(", ")}); nothing reads it`);
        continue;
      }
      if (!isPlainObject(entry)) {
        err(p, `must be a map with safe and captions boxes, got ${typeName(entry)}`);
        continue;
      }
      const { width, height } = FRAME_SIZES[name];
      for (const k of Object.keys(entry)) if (!LAYOUT_KEYS.includes(k)) warn(`${p}.${k}`, `unknown key (known: ${LAYOUT_KEYS.join(", ")})`);
      for (const k of LAYOUT_KEYS) {
        if (entry[k] === undefined) continue;
        const box = entry[k];
        const at = `${p}.${k}`;
        if (!Array.isArray(box) || box.length !== 4 || !box.every(isNum)) {
          err(at, `must be a box [x0, y0, x1, y1] of 4 numbers, got ${JSON.stringify(box)}`);
          continue;
        }
        const [x0, y0, x1, y1] = box;
        if (!(x0 < x1 && y0 < y1)) err(at, `must have x0 < x1 and y0 < y1, got ${JSON.stringify(box)}`);
        else if (x0 < 0 || y0 < 0 || x1 > width || y1 > height) err(at, `must stay inside the ${width} x ${height} ${name} frame, got ${JSON.stringify(box)}`);
      }
    }
  }

  // captions: which orientations burn them in, and how many words one chunk holds
  if (expectMap(data.captions, "captions")) {
    const c = data.captions;
    for (const k of Object.keys(c)) if (!CAPTIONS_KEYS.includes(k)) warn(`captions.${k}`, `unknown key (known: ${CAPTIONS_KEYS.join(", ")})`);
    if (expectMap(c.burn, "captions.burn")) {
      for (const [k, v] of Object.entries(c.burn)) {
        if (!ORIENTATIONS.includes(k)) warn(`captions.burn.${k}`, `unknown orientation (known: ${ORIENTATIONS.join(", ")}); nothing reads it`);
        else if (typeof v !== "boolean") err(`captions.burn.${k}`, `must be true or false, got ${typeName(v)}`);
      }
    }
    if (c.maxWords !== undefined && !(Number.isInteger(c.maxWords) && c.maxWords >= 1 && c.maxWords <= MAX_CAPTION_WORDS)) {
      err("captions.maxWords", `must be a whole number from 1 to ${MAX_CAPTION_WORDS}, got ${JSON.stringify(c.maxWords)}`);
    }
  }

  // narration
  if (expectMap(data.narration, "narration")) {
    const n = data.narration;
    for (const k of Object.keys(n)) if (!NARRATION_KEYS.includes(k)) warn(`narration.${k}`, "unknown key (nothing reads it)");
    if (n.speed !== undefined && !(isNum(n.speed) && n.speed > 0 && n.speed <= 3)) err("narration.speed", "must be a number above 0 and at most 3");
    if (expectMap(n.voices, "narration.voices")) {
      for (const [k, v] of Object.entries(n.voices)) {
        if (!KOKORO_LANGS.includes(k)) warn(`narration.voices.${k}`, `not a Kokoro language (${KOKORO_LANGS.join(", ")}); languages without a voice get a silent video`);
        if (typeof v !== "string" || v.trim() === "") err(`narration.voices.${k}`, "must be a Kokoro voice id such as pf_dora");
        else if (!/^[a-z]{2}_[a-z0-9]+$/.test(v)) warn(`narration.voices.${k}`, `${JSON.stringify(v)} does not look like a Kokoro voice id (pf_dora, af_heart, ...)`);
      }
    }
  }

  // images
  if (data.images !== undefined) {
    if (!Array.isArray(data.images)) err("images", `must be a list, got ${typeName(data.images)}`);
    else
      data.images.forEach((img, i) => {
        const p = `images[${i}]`;
        if (!isPlainObject(img)) return err(p, "must be a map with path, role and note");
        if (typeof img.path !== "string" || img.path === "") err(`${p}.path`, "must be a file path");
        else if (isUrl(img.path)) err(`${p}.path`, "must be a local file path, not a URL");
        else if (!fileExists(resolveLocal(img.path))) err(`${p}.path`, `file not found: ${img.path} (relative to ${dir})`);
        if (!IMAGE_ROLES.includes(img.role)) err(`${p}.role`, `must be one of ${IMAGE_ROLES.join(", ")}, got ${JSON.stringify(img.role)}`);
        if (img.note !== undefined && typeof img.note !== "string") err(`${p}.note`, "must be a string");
      });
  }

  // `b.<primitive>(` calls inside the "Motion examples" code blocks
  const allowed = new Set([...KIT_PRIMITIVES, ...KIT_MODIFIERS]);
  const bad = new Set(motionExampleCalls(spec.body).filter((name) => !allowed.has(name)));
  for (const name of bad) err("## Motion examples", `b.${name}( is not a kit primitive (${KIT_PRIMITIVES.join(", ")}); examples must only use the kit`);

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// outputs: tokens.css, frame.md, explain-data design block
// ---------------------------------------------------------------------------

export function kebab(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

const GENERIC_FALLBACK = { display: "sans-serif", body: "sans-serif", mono: "monospace" };
const GENERIC_NAMES = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace"]);

function fontStack(role, t) {
  const family = String(t.family).trim();
  const fallback = typeof t.fallback === "string" && t.fallback.trim() ? t.fallback.trim() : GENERIC_FALLBACK[role] ?? "sans-serif";
  const quote = (name) => {
    const n = name.trim();
    if (/^["'].*["']$/.test(n) || GENERIC_NAMES.has(n.toLowerCase()) || /^[A-Za-z][A-Za-z0-9-]*$/.test(n)) return n;
    return `"${n.replace(/"/g, '\\"')}"`;
  };
  const parts = family.split(",").map(quote);
  if (!parts.some((p) => GENERIC_NAMES.has(p.toLowerCase()))) parts.push(fallback);
  return parts.join(", ");
}

export function tokensCss(data) {
  const colors = isPlainObject(data.colors) ? data.colors : {};
  const lines = [];
  const seen = new Set();
  const add = (name, value) => {
    if (seen.has(name) || value === undefined || value === null) return;
    seen.add(name);
    lines.push(`  --em-${name}: ${value};`);
  };
  // fixed aliases first, then one property per color key
  add("bg", colors.background);
  add("surface", colors.surface);
  add("text", colors.text);
  add("muted", colors.muted);
  for (const [k, v] of Object.entries(colors)) add(kebab(k), v);
  const typo = isPlainObject(data.typography) ? data.typography : {};
  for (const role of TYPOGRAPHY_ROLES) {
    if (!isPlainObject(typo[role]) || !typo[role].family) continue;
    add(`font-${role}`, fontStack(role, typo[role]));
    if (typeof typo[role].weight === "number" && Number.isFinite(typo[role].weight)) add(`weight-${role}`, typo[role].weight);
  }
  return `:root {\n${lines.join("\n")}\n}\n`;
}

export function frameMd(data, body) {
  const yaml = stringifyYaml(data);
  return `---\n${yaml}---\n${body ? `\n${body}\n` : ""}`;
}

// The slice of the design that ends up in explain-data.js (what kit.js reads at runtime).
export function explainDesign(data) {
  return {
    colors: data.colors ?? {},
    typography: data.typography ?? {},
    motion: data.motion ?? {},
    rules: data.rules ?? {},
  };
}

export { stringifyYaml };

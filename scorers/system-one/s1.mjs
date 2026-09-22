// System One runtime. One copy, outside skills/. Handoff and shunt do not
// import this file. `propose.mjs` is the only way a trial turns a decision
// into the skill's field names, and it does not write a plan.
//
// Three typed calls, one swappable backend. `rules` is the default floor
// (GUARDED / LINE_MAX / BYTE_MAX / EFFORT_BY_TIER). `local` is an explicit
// opt-in TinyTransformerScorer (CUA-S1 tinyx) over a reviewable JSON checkpoint.
// Every call appends one redacted record to $TMPDIR/handoff/decisions.jsonl.
// Outcome resolution is not done here: records stay unresolved.

import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

export const LINE_MAX = 350;
export const BYTE_MAX = 32 * 1024;
export const EDIT_LINE_MAX = LINE_MAX * 2;
export const EDIT_BYTE_MAX = BYTE_MAX * 2;
export const EFFORT_BY_TIER = { mechanical: "low", review: "medium", design: "high" };
export const DEFAULT_EFFORT = "medium";
export const READ_LEVELS = ["read-whole", "excerpt", "outline-only", "subagent-summary"];
export const EFFORTS = ["low", "medium", "high", "xhigh"];
export const NOUL_OPTIONS = ["yes", "no"];

// Copied from rtk.mjs: one matching segment keeps the compound command raw.
export const GUARDED =
  /^(git\s+((-[Cc]|--git-dir|--work-tree)\s+\S+\s+|-\S+\s+)*(diff|show)\b|cat\b|head\b|tail\b|grep\b|rg\b|read\b|less\b|more\b)/;

const LOG_MAX = 2048;
const YES_NO = NOUL_OPTIONS;

const SENSITIVE_KEYS = new Set([
  "allowedroots",
  "apikey",
  "authorization",
  "bearer",
  "binary",
  "cookie",
  "credential",
  "email",
  "filepath",
  "homedir",
  "label",
  "observedtitle",
  "passwd",
  "password",
  "path",
  "phone",
  "privatekey",
  "requestedtitle",
  "response",
  "secret",
  "ssn",
  "stderr",
  "telephone",
  "title",
  "token",
  "treemarkdown",
  "username",
  "value",
  "window",
  "accesstoken",
  "refreshtoken",
  "idtoken",
]);

const SECRET_RE = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\bBearer\s+[A-Za-z0-9._\-+=/]{8,}/gi,
  /\b(?:password|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi,
  /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]\d{4}\b/g,
];

const PATH_RE =
  /(?:file:\/\/)?(?:~(?:[A-Za-z0-9._-]+)?\/[^\s"'`]+|\/(?:Users|home|private|var|tmp|etc|opt|usr|root|Volumes)\/[^\s"'`]+|[A-Za-z]:\\[^\s"'`]+|\\\\[^\s"'`]+)/g;

let active = null;

function keyName(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isAbsPath(s) {
  if (typeof s !== "string" || !s) return false;
  if (isAbsolute(s)) return true;
  return /^[A-Za-z]:[\\/]/.test(s) || s.startsWith("\\\\") || s.startsWith("file://");
}

function clip(s) {
  if (typeof s !== "string") return s;
  return s.length <= LOG_MAX ? s : `${s.slice(0, LOG_MAX)}…`;
}

function redactString(s) {
  let out = String(s);
  if (isAbsPath(out.trim())) return "<path>";
  for (const re of SECRET_RE) out = out.replace(re, "<redacted>");
  out = out.replace(PATH_RE, "<path>");
  return out;
}

export function redact(value, key) {
  if (key != null && SENSITIVE_KEYS.has(keyName(key))) return "<redacted>";
  if (typeof value === "string") return clip(redactString(value));
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redact(v, k);
    return out;
  }
  return value;
}

export function decisionsPath() {
  return join(tmpdir(), "handoff", "decisions.jsonl");
}

function runId(run) {
  const v = run ?? process.env.HANDOFF_RUN ?? "";
  if (!v) return null;
  const parts = String(v).replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

function contextString(context) {
  if (typeof context === "string") return context;
  if (context == null) return "";
  try {
    return JSON.stringify(context);
  } catch {
    return String(context);
  }
}

function appendRecord(record) {
  try {
    const path = decisionsPath();
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(redact(record))}\n`);
  } catch {
    /* logging must not change the decision; fail open */
  }
}

function bareCommand(seg) {
  return seg
    .trim()
    .replace(/^(\w+=("[^"]*"|'[^']*'|\S*)\s+)+/, "")
    .replace(/^(env|time|timeout\s+\S+)\s+/, "");
}

export function guardedSkip(cmd) {
  return String(cmd)
    .split(/&&|\|\||;|\|/)
    .some((seg) => GUARDED.test(bareCommand(seg)));
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

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function truthy(v) {
  if (v === true || v === 1) return true;
  if (typeof v === "string") return /^(1|true|yes)$/i.test(v);
  return false;
}

function factsFrom(context) {
  if (context && typeof context === "object" && !Array.isArray(context)) return { ...context };
  const s = context == null ? "" : String(context);
  const facts = { text: s };
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) Object.assign(facts, parsed);
  } catch {
    /* plain text */
  }
  for (const m of s.matchAll(/\b(tier|size|lines|bytes|offset|limit|command|effort|model)\s*[:=]\s*(\S+)/gi)) {
    facts[m[1].toLowerCase()] = m[2];
  }
  if (/\bedit(?:target)?\s*[:=]\s*(1|true|yes)\b/i.test(s)) facts.edit = true;
  if (/\boutline\s*[:=]\s*(1|true|yes)\b/i.test(s)) facts.outline = true;
  return facts;
}

function looksLikeCommand(s) {
  if (!s) return false;
  return String(s)
    .split(/&&|\|\||;|\|/)
    .some((seg) => {
      const bare = bareCommand(seg);
      return GUARDED.test(bare) || /^(git|cat|head|tail|grep|rg|read|less|more|ls|find|cargo|npm|node)\b/.test(bare);
    });
}

function isEffortOptions(options) {
  const set = new Set(options);
  return EFFORTS.filter((e) => set.has(e)).length >= 2;
}

function encodedEffort(model) {
  if (typeof model !== "string" || !model) return undefined;
  const patterns = [
    /-(none|minimal|low|medium|high|xhigh|max)(?:-fast)?$/i,
    /-(none|minimal|low|medium|high|xhigh|max)-thinking(?:-fast)?$/i,
    /-thinking-(none|minimal|low|medium|high|xhigh|max)(?:-fast)?$/i,
  ];
  for (const re of patterns) {
    const m = model.match(re);
    if (m) return m[1].toLowerCase();
  }
  return undefined;
}

function inferSite(kind, facts, options, question) {
  if (kind === "noul" && (facts.command != null || looksLikeCommand(facts.text) || /whole|raw|guarded|\brtk\b/i.test(question ?? ""))) {
    return "rtk";
  }
  if (kind === "noul" && /capability|capabilities/i.test(question ?? "")) return "capabilities";
  if (kind === "score" && (num(facts.lines) != null || num(facts.bytes) != null || options.includes("read-whole"))) {
    return "read";
  }
  if (kind === "choice" && (facts.tier != null || isEffortOptions(options))) return "effort";
  return undefined;
}

function oneHot(index, n) {
  const dist = Array.from({ length: n }, () => 0);
  if (index >= 0 && index < n) dist[index] = 1;
  return dist;
}

function hit(options, label) {
  const index = options.indexOf(label);
  if (index < 0) return { abstain: true, index: 0, p: 0, dist: oneHot(0, options.length) };
  return { index, p: 1, dist: oneHot(index, options.length) };
}

function commandFrom(facts, context) {
  if (typeof facts.command === "string") return facts.command;
  if (typeof context === "string") return context;
  if (typeof facts.text === "string") return facts.text;
  return contextString(context);
}

function readLevel(facts) {
  const lines = num(facts.lines);
  const bytes = num(facts.bytes);
  if (lines == null && bytes == null) return null;
  const counts = { lines: lines ?? 0, bytes: bytes ?? 0 };
  const edit = truthy(facts.edit) || truthy(facts.editTarget);
  if (edit && counts.lines <= EDIT_LINE_MAX && counts.bytes <= EDIT_BYTE_MAX) {
    if (isOver(counts)) return "read-whole";
  }
  if (!isOver(counts)) return "read-whole";
  if (windowAllowed(facts.offset, facts.limit, counts.lines)) return "excerpt";
  if (truthy(facts.outline)) return "subagent-summary";
  return "outline-only";
}

function decideRules({ kind, context, options, site, question }) {
  const facts = factsFrom(context);
  const resolved = site ?? inferSite(kind, facts, options, question);

  if (resolved === "rtk") {
    const yes = guardedSkip(commandFrom(facts, context));
    return hit(options, yes ? "yes" : "no");
  }

  if (resolved === "read") {
    const level = readLevel(facts);
    if (!level) return { abstain: true, index: 0, p: 0, dist: oneHot(0, options.length) };
    return hit(options, level);
  }

  if (resolved === "effort") {
    const effort = facts.effort ?? encodedEffort(facts.model) ?? EFFORT_BY_TIER[facts.tier] ?? DEFAULT_EFFORT;
    return hit(options, String(effort));
  }

  if (resolved === "capabilities") {
    // Floor: do not add undeclared capabilities. Today's routing behaviour.
    return hit(options, "no");
  }

  return { abstain: true, index: 0, p: 0, dist: oneHot(0, options.length) };
}

export const rules = {
  name: "rules",
  decide(req) {
    return decideRules(req);
  },
};

active = rules;

export function setBackend(backend) {
  active = backend && typeof backend.decide === "function" ? backend : rules;
  return active;
}

export function getBackend() {
  return active;
}

function labelsOf(kind, options) {
  if (kind === "noul") return YES_NO;
  return (options ?? []).map((x) => String(x));
}

function validateDecision(result, options) {
  if (!result || result.abstain) return null;
  const index = result.index;
  if (!Number.isInteger(index) || index < 0 || index >= options.length) return null;
  const p = result.p;
  if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1) return null;
  let dist = result.dist;
  if (!Array.isArray(dist) || dist.length !== options.length) dist = oneHot(index, options.length);
  if (dist.some((x) => typeof x !== "number" || !Number.isFinite(x))) return null;
  return { index, p, dist };
}

function failOpen(kind, options) {
  let index = 0;
  if (kind === "noul") index = Math.max(0, options.indexOf("yes"));
  else if (isEffortOptions(options)) index = Math.max(0, options.indexOf(DEFAULT_EFFORT));
  if (index < 0 || index >= options.length) index = 0;
  return { index, p: 0, dist: oneHot(index, Math.max(options.length, 1)) };
}

function decide(kind, context, options, extra = {}) {
  const labels = labelsOf(kind, options);
  const req = {
    kind,
    context,
    options: labels,
    site: extra.site,
    question: extra.question,
  };
  const requested = extra.backend ?? active;
  let used = requested;
  let abstain = false;
  let decision;

  const tryBackend = (backend) => {
    if (!backend || typeof backend.decide !== "function") return null;
    return validateDecision(backend.decide(req), labels);
  };

  try {
    decision = tryBackend(requested);
    if (!decision) throw new Error("abstain");
  } catch {
    abstain = true;
    if (requested !== rules) {
      try {
        decision = tryBackend(rules);
        used = rules;
        if (!decision) throw new Error("floor-abstain");
      } catch {
        decision = failOpen(kind, labels);
        used = { name: "fail-open" };
      }
    } else {
      decision = failOpen(kind, labels);
      used = { name: "fail-open" };
    }
  }

  const record = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    run: runId(extra.run),
    site: extra.site ?? inferSite(kind, factsFrom(context), labels, extra.question) ?? null,
    kind,
    backend: used?.name ?? "unknown",
    context: extra.question ? `${extra.question} :: ${contextString(context)}` : contextString(context),
    options: labels,
    chosen: decision.index,
    p: decision.p,
    dist: decision.dist,
    outcome: { unresolved: true },
    resolved_at: null,
  };
  if (extra.session) record.session = extra.session;
  if (extra.question) record.question = extra.question;
  if (abstain) record.abstain = true;
  if (requested?.name && requested.name !== used?.name) record.requested = requested.name;
  appendRecord(record);

  return { ...decision, label: labels[decision.index], backend: used?.name ?? "unknown", abstain };
}

export function choice(context, options, extra = {}) {
  const d = decide("choice", context, options, extra);
  return { index: d.index, label: d.label, p: d.p, dist: d.dist };
}

export function score(context, levels, extra = {}) {
  const d = decide("score", context, levels, extra);
  return { level: d.label, p: d.p, dist: d.dist };
}

export function noul(context, question, extra = {}) {
  const d = decide("noul", context, YES_NO, { ...extra, question });
  const yesIndex = Math.max(0, YES_NO.indexOf("yes"));
  const pYes = Array.isArray(d.dist) && d.dist.length > yesIndex
    ? d.dist[yesIndex]
    : d.label === "yes" ? d.p : 1 - d.p;
  return { yes: d.label === "yes", p: d.p, p_yes: pYes, dist: d.dist, abstain: Boolean(d.abstain) };
}

export function readDecisions(run = null) {
  const path = decisionsPath();
  if (!existsSync(path)) return [];
  try {
    const lines = readFileSync(path, "utf8").trim().split("\n").filter(Boolean);
    const targetRun = run ? runId(run) : null;
    const records = [];
    for (const l of lines) {
      try {
        const r = JSON.parse(l);
        if (!targetRun || r.run === targetRun) records.push(r);
      } catch {}
    }
    return records;
  } catch {
    return [];
  }
}

export function resolveDecisions(run, resolver) {
  const path = decisionsPath();
  if (!existsSync(path)) {
    return { total: 0, resolved: 0, unresolved: 0, by_site: {} };
  }
  const targetRun = run ? runId(run) : null;
  let total = 0;
  let resolved = 0;
  let unresolved = 0;
  const by_site = {};

  let lines;
  try {
    lines = readFileSync(path, "utf8").trim().split("\n").filter(Boolean);
  } catch {
    return { total: 0, resolved: 0, unresolved: 0, by_site: {} };
  }

  const updated = lines.map((line) => {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      return line;
    }
    if (targetRun && row.run !== targetRun) {
      return JSON.stringify(row);
    }
    total++;
    const site = row.site ?? "unknown";
    by_site[site] ??= { total: 0, resolved: 0, unresolved: 0 };
    by_site[site].total++;

    const outcome = typeof resolver === "function" ? resolver(row) : resolver?.[row.id] ?? resolver?.[row.site];
    if (outcome && !outcome.unresolved) {
      row.outcome = outcome;
      row.resolved_at = new Date().toISOString();
      resolved++;
      by_site[site].resolved++;
    } else {
      row.outcome = { unresolved: true };
      row.resolved_at = null;
      unresolved++;
      by_site[site].unresolved++;
    }
    return JSON.stringify(row);
  });

  try {
    writeFileSync(path, updated.length ? updated.join("\n") + "\n" : "");
  } catch {}
  return { total, resolved, unresolved, by_site };
}

// --- local CUA-S1 tinyx backend (opt-in) ------------------------------------
// Architecture: trycua/cua TinyTransformerScorer, encoder=tinyx
// (libs/cua-s1/python/src/cua_s1/model.py). Two checkpoint encodings load
// through the same loadCheckpoint(path)/infer() pair:
//  - a reviewable JSON-tensor fixture (encoding: "json-tensors"), never pickle;
//  - the real published cua-ai/cua-s1-forms safetensors+JSON pair (see
//    scorers/system-one/README.md for the pinned revision, the explicit
//    fetch-cua-s1.mjs fetch step, and integrity verification). Weights
//    are never committed to git and never fetched implicitly.

const CUA_S1_FORMAT = "cua-s1";
const CUA_S1_VERSION = 1;
const F32MIN = -3.4028234663852886e38;
const UNSAFE_CKPT = /\.(pt|pth|bin|pkl|pickle)$/i;
const CKPT_LIMITS = {
  width: 256,
  rank: 256,
  layers: 8,
  heads: 16,
  context_tokens: 512,
  option_tokens: 256,
  tensor_elems: 1_000_000,
  file_bytes: 8_000_000,
};

function f32(x) {
  return Math.fround(x);
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(",")}}`;
}

function product(shape) {
  return shape.reduce((a, b) => a * b, 1);
}

function positiveInt(config, key, cap) {
  const value = config[key];
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`model config field '${key}' must be a positive integer`);
  }
  if (value > cap) throw new Error(`model config field '${key}' exceeds limit ${cap}`);
  return value;
}

function expectedTensors(config) {
  const width = config.width;
  const rank = config.rank;
  const pos = Math.max(config.context_tokens, config.option_tokens);
  const names = {
    "embedding.weight": [257, width],
    "position.weight": [pos, width],
    "head.context_norm.weight": [width],
    "head.context_norm.bias": [width],
    "head.option_norm.weight": [width],
    "head.option_norm.bias": [width],
    "head.query.weight": [rank, width],
    "head.key.weight": [rank, width],
    "head.value.weight": [rank, width],
  };
  const prefixes = [];
  for (let i = 0; i < config.layers; i++) prefixes.push(`encoder.layers.${i}`);
  prefixes.push("option_encoder.layers.0");
  for (const prefix of prefixes) {
    names[`${prefix}.self_attn.in_proj_weight`] = [3 * width, width];
    names[`${prefix}.self_attn.in_proj_bias`] = [3 * width];
    names[`${prefix}.self_attn.out_proj.weight`] = [width, width];
    names[`${prefix}.self_attn.out_proj.bias`] = [width];
    names[`${prefix}.linear1.weight`] = [4 * width, width];
    names[`${prefix}.linear1.bias`] = [4 * width];
    names[`${prefix}.linear2.weight`] = [width, 4 * width];
    names[`${prefix}.linear2.bias`] = [width];
    names[`${prefix}.norm1.weight`] = [width];
    names[`${prefix}.norm1.bias`] = [width];
    names[`${prefix}.norm2.weight`] = [width];
    names[`${prefix}.norm2.bias`] = [width];
  }
  return names;
}

function stateSignature(tensors, config) {
  const digest = createHash("sha256");
  digest.update(stableJson(config));
  for (const name of Object.keys(tensors).sort()) {
    const spec = tensors[name];
    digest.update(stableJson([name, spec.dtype, spec.shape]));
    const buf = Buffer.alloc(spec.data.length * 4);
    for (let i = 0; i < spec.data.length; i++) buf.writeFloatLE(f32(spec.data[i]), i * 4);
    digest.update(buf);
  }
  return digest.digest("hex");
}

// --- safetensors reader (bounded, dependency-free) --------------------------
// Format: https://github.com/huggingface/safetensors — an 8-byte little-endian
// header length, a JSON header {tensor: {dtype, shape, data_offsets}, ...,
// __metadata__?}, then the raw tensor bytes. Only float32 ("F32") tensors are
// supported, matching this runtime's forward pass.

const SAFETENSORS_HEADER_MAX = 65_536;
const SAFETENSORS_DTYPE_TORCH_NAME = { F32: "torch.float32" };

// Scan only top-level (depth 1) keys of the header object; JSON.parse silently
// keeps the last value for a duplicate key, so this must run before parsing.
function safetensorsDuplicateKeyCheck(headerText) {
  const seen = new Set();
  let depth = 0;
  let inString = false;
  let escape = false;
  let key = null;
  for (let i = 0; i < headerText.length; i++) {
    const c = headerText[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (c === "\\") {
        escape = true;
      } else if (c === '"') {
        inString = false;
      } else if (depth === 1) {
        key = (key ?? "") + c;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      if (depth === 1) key = "";
      continue;
    }
    if (c === "{" || c === "[") {
      if (depth === 1 && key !== null) {
        if (seen.has(key)) throw new Error(`safetensors header has a duplicate tensor name: ${key}`);
        seen.add(key);
        key = null;
      }
      depth++;
      continue;
    }
    if (c === "}" || c === "]") {
      depth--;
      continue;
    }
  }
}

function parseSafetensorsHeader(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 8) throw new Error("safetensors file is too small");
  const headerLen = buf.readBigUInt64LE(0);
  if (headerLen <= 0n || headerLen > BigInt(SAFETENSORS_HEADER_MAX)) {
    throw new Error("safetensors header length is out of bounds");
  }
  const n = Number(headerLen);
  const dataStart = 8 + n;
  if (dataStart > buf.length) throw new Error("safetensors header exceeds file size");
  const headerText = buf.toString("utf8", 8, dataStart);
  safetensorsDuplicateKeyCheck(headerText);
  let header;
  try {
    header = JSON.parse(headerText);
  } catch (err) {
    throw new Error(`invalid safetensors header JSON: ${err.message}`);
  }
  if (!header || typeof header !== "object" || Array.isArray(header)) {
    throw new Error("safetensors header must be an object");
  }
  const rawMeta = header.__metadata__;
  const metadata = rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta) ? rawMeta : {};
  const dataLen = buf.length - dataStart;
  const tensors = {};
  for (const [name, spec] of Object.entries(header)) {
    if (name === "__metadata__") continue;
    if (!spec || typeof spec !== "object") throw new Error(`safetensors tensor ${name} entry must be an object`);
    if (spec.dtype !== "F32") throw new Error(`safetensors tensor ${name} has an unsupported dtype: ${spec.dtype}`);
    if (!Array.isArray(spec.shape) || !spec.shape.length || spec.shape.some((d) => !Number.isInteger(d) || d <= 0)) {
      throw new Error(`safetensors tensor ${name} has a malformed shape`);
    }
    const offsets = spec.data_offsets;
    if (!Array.isArray(offsets) || offsets.length !== 2) throw new Error(`safetensors tensor ${name} has malformed offsets`);
    const [start, end] = offsets;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > dataLen) {
      throw new Error(`safetensors tensor ${name} offsets are out of bounds`);
    }
    const count = product(spec.shape);
    if (count > CKPT_LIMITS.tensor_elems) throw new Error(`safetensors tensor ${name} exceeds size limit`);
    if (end - start !== count * 4) throw new Error(`safetensors tensor ${name} byte length does not match its shape`);
    tensors[name] = { shape: spec.shape, start: dataStart + start, end: dataStart + end };
  }
  return { tensors, metadata };
}

function readF32Range(buf, start, end) {
  const n = (end - start) / 4;
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) data[i] = buf.readFloatLE(start + i * 4);
  return data;
}

function realStateSignature(headerTensors, rawConfig, buf) {
  const digest = createHash("sha256");
  digest.update(stableJson(rawConfig));
  for (const name of Object.keys(headerTensors).sort()) {
    const t = headerTensors[name];
    digest.update(stableJson([name, SAFETENSORS_DTYPE_TORCH_NAME.F32, t.shape]));
    digest.update(buf.subarray(t.start, t.end));
  }
  return digest.digest("hex");
}

function asTensor(spec, name) {
  if (!spec || spec.dtype !== "float32" || !Array.isArray(spec.shape) || !Array.isArray(spec.data)) {
    throw new Error(`tensor ${name} must be float32 with shape and data arrays`);
  }
  if (spec.shape.some((d) => !Number.isInteger(d) || d <= 0)) {
    throw new Error(`tensor ${name} has malformed dimensions`);
  }
  const n = product(spec.shape);
  if (n > CKPT_LIMITS.tensor_elems) throw new Error(`tensor ${name} exceeds size limit`);
  if (spec.data.length !== n) throw new Error(`tensor ${name} data length does not match shape`);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = spec.data[i];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new Error(`tensor ${name} contains a non-finite value`);
    }
    data[i] = f32(v);
  }
  return { shape: spec.shape, data };
}

function parseArchConfig(config) {
  if (!config || typeof config !== "object") throw new Error("checkpoint JSON field 'config' must be an object");
  if (config.encoder !== "tinyx" && config.encoder !== "tiny") {
    throw new Error("model config field 'encoder' must be 'tiny' or 'tinyx'");
  }
  if (config.encoder !== "tinyx") throw new Error("this runtime implements the tinyx encoder only");
  const width = positiveInt(config, "width", CKPT_LIMITS.width);
  const rank = positiveInt(config, "rank", CKPT_LIMITS.rank);
  const layers = positiveInt(config, "layers", CKPT_LIMITS.layers);
  const heads = positiveInt(config, "heads", CKPT_LIMITS.heads);
  const contextTokens = positiveInt(config, "context_tokens", CKPT_LIMITS.context_tokens);
  const optionTokens = positiveInt(config, "option_tokens", CKPT_LIMITS.option_tokens);
  if (width % heads) throw new Error("width not divisible by heads");
  if (config.dropout != null && !(typeof config.dropout === "number" && config.dropout >= 0 && config.dropout < 1)) {
    throw new Error("dropout must be in [0, 1)");
  }
  return {
    encoder: "tinyx",
    width,
    rank,
    layers,
    heads,
    context_tokens: contextTokens,
    option_tokens: optionTokens,
    dropout: config.dropout ?? 0,
  };
}

function readDocument(resolved, label) {
  if (!existsSync(resolved)) throw new Error(`${label} not found: ${resolved}`);
  const bytes = statSync(resolved).size;
  if (bytes > CKPT_LIMITS.file_bytes) throw new Error(`${label} exceeds size limit`);
  let doc;
  try {
    doc = JSON.parse(readFileSync(resolved, "utf8"));
  } catch (err) {
    throw new Error(`invalid ${label} JSON: ${err.message}`);
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) throw new Error(`${label} must contain an object`);
  if (doc.format !== CUA_S1_FORMAT) throw new Error(`unsupported checkpoint format: ${doc.format}`);
  if (doc.format_version !== CUA_S1_VERSION) {
    throw new Error(`unsupported checkpoint format version: ${doc.format_version}`);
  }
  if (typeof doc.state_signature !== "string" || doc.state_signature.length !== 64) {
    throw new Error(`${label} field 'state_signature' must be a SHA-256 digest`);
  }
  return doc;
}

function loadJsonTensorCheckpoint(resolved, doc) {
  const config = doc.config;
  const arch = parseArchConfig(config);
  const rawTensors = doc.tensors;
  if (!rawTensors || typeof rawTensors !== "object") throw new Error("checkpoint JSON field 'tensors' must be an object");
  let total = 0;
  for (const spec of Object.values(rawTensors)) {
    if (spec?.shape) total += product(spec.shape);
  }
  if (total > CKPT_LIMITS.tensor_elems) throw new Error("checkpoint tensors exceed size limit");
  if (stateSignature(rawTensors, config) !== doc.state_signature) {
    throw new Error("checkpoint state signature mismatch");
  }
  const expected = expectedTensors(arch);
  const tensors = {};
  for (const [name, shape] of Object.entries(expected)) {
    const spec = rawTensors[name];
    if (!spec) throw new Error(`checkpoint missing tensor ${name}`);
    const t = asTensor(spec, name);
    if (t.shape.length !== shape.length || t.shape.some((d, i) => d !== shape[i])) {
      throw new Error(`tensor ${name} has malformed dimensions`);
    }
    tensors[name] = t;
  }
  if (Object.keys(rawTensors).length !== Object.keys(expected).length) {
    throw new Error("checkpoint contains unknown tensors for this config");
  }
  return {
    config: arch,
    tensors,
    metadata: doc.metadata && typeof doc.metadata === "object" ? doc.metadata : {},
  };
}

function safetensorsPathFor(resolved) {
  return resolved.replace(/\.json$/i, ".safetensors");
}

function jsonPathFor(resolved) {
  return resolved.replace(/\.safetensors$/i, ".json");
}

function loadSafetensorsCheckpoint(weightsPath, doc) {
  const config = doc.config;
  const arch = parseArchConfig(config);
  if (!existsSync(weightsPath)) throw new Error(`checkpoint weights not found: ${weightsPath}`);
  const bytes = statSync(weightsPath).size;
  if (bytes > CKPT_LIMITS.file_bytes) throw new Error("checkpoint weights file exceeds size limit");
  const buf = readFileSync(weightsPath);
  const { tensors: headerTensors, metadata } = parseSafetensorsHeader(buf);
  if (metadata.format !== CUA_S1_FORMAT) throw new Error("unsupported safetensors checkpoint format");
  if (metadata.format_version !== String(CUA_S1_VERSION)) {
    throw new Error("unsupported safetensors checkpoint format version");
  }
  if (metadata.state_signature !== doc.state_signature) {
    throw new Error("checkpoint state signature mismatch");
  }
  let total = 0;
  for (const spec of Object.values(headerTensors)) total += product(spec.shape);
  if (total > CKPT_LIMITS.tensor_elems) throw new Error("checkpoint tensors exceed size limit");
  if (realStateSignature(headerTensors, doc.config, buf) !== doc.state_signature) {
    throw new Error("checkpoint state signature mismatch");
  }
  const expected = expectedTensors(arch);
  const tensors = {};
  for (const [name, shape] of Object.entries(expected)) {
    const spec = headerTensors[name];
    if (!spec) throw new Error(`checkpoint missing tensor ${name}`);
    if (spec.shape.length !== shape.length || spec.shape.some((d, i) => d !== shape[i])) {
      throw new Error(`tensor ${name} has malformed dimensions`);
    }
    tensors[name] = { shape: spec.shape, data: readF32Range(buf, spec.start, spec.end) };
  }
  if (Object.keys(headerTensors).length !== Object.keys(expected).length) {
    throw new Error("checkpoint contains unknown tensors for this config");
  }
  return {
    config: arch,
    tensors,
    metadata: doc.metadata && typeof doc.metadata === "object" ? doc.metadata : {},
  };
}

export function loadCheckpoint(path) {
  if (typeof path !== "string" || !path) throw new Error("checkpoint path required");
  if (path.includes("\0")) throw new Error("unsafe checkpoint path");
  if (/^(https?:|file:)/i.test(path)) throw new Error("network and file URLs are unsupported checkpoint paths");
  if (UNSAFE_CKPT.test(path)) {
    throw new Error("legacy pickle-based checkpoints are not supported; use a JSON tensor or safetensors checkpoint");
  }
  const resolved = resolve(path);
  const lower = resolved.toLowerCase();
  if (!lower.endsWith(".json") && !lower.endsWith(".safetensors")) {
    throw new Error("checkpoint path must be a .json or .safetensors file");
  }
  if (lower.endsWith(".safetensors")) {
    const jsonPath = jsonPathFor(resolved);
    const doc = readDocument(jsonPath, "checkpoint sidecar JSON");
    return loadSafetensorsCheckpoint(resolved, doc);
  }
  const doc = readDocument(resolved, "checkpoint JSON");
  if (doc.encoding === "json-tensors") return loadJsonTensorCheckpoint(resolved, doc);
  if (doc.encoding != null) throw new Error("unsupported checkpoint encoding");
  // No "encoding" field and no inline "tensors": the real cua-s1 sidecar shape
  // (cua_s1.checkpoint.save_checkpoint_files) — tensors live in the paired
  // .safetensors file next to it.
  if (doc.tensors) throw new Error("checkpoint JSON field 'encoding' is required alongside inline 'tensors'");
  return loadSafetensorsCheckpoint(safetensorsPathFor(resolved), doc);
}

export function encodeBytes(text, length) {
  const n = Number(length);
  if (!Number.isInteger(n) || n <= 0) throw new Error("token limit must be positive");
  const bytes = Buffer.from(String(text ?? ""), "utf8");
  const out = [];
  const cap = Math.min(bytes.length, n);
  for (let i = 0; i < cap; i++) out.push(bytes[i] + 1);
  return out;
}

function row(tensors, name, r) {
  const t = tensors[name];
  const cols = t.shape[1] ?? t.shape[0];
  if (t.shape.length === 1) return Array.from(t.data);
  const out = new Array(cols);
  const off = r * cols;
  for (let j = 0; j < cols; j++) out[j] = t.data[off + j];
  return out;
}

function vec(tensors, name) {
  return Array.from(tensors[name].data);
}

function zeros(n) {
  return Array.from({ length: n }, () => 0);
}

function addVec(a, b) {
  return a.map((v, i) => f32(v + b[i]));
}

function matmul(a, b) {
  const m = a.length;
  const k = a[0].length;
  const n = b[0].length;
  const out = [];
  for (let i = 0; i < m; i++) {
    const rowOut = [];
    for (let j = 0; j < n; j++) {
      let acc = 0;
      for (let t = 0; t < k; t++) acc = f32(acc + f32(a[i][t] * b[t][j]));
      rowOut.push(acc);
    }
    out.push(rowOut);
  }
  return out;
}

function transpose(a) {
  const m = a.length;
  const n = a[0].length;
  const out = [];
  for (let j = 0; j < n; j++) {
    const rowOut = [];
    for (let i = 0; i < m; i++) rowOut.push(a[i][j]);
    out.push(rowOut);
  }
  return out;
}

function weightRows(tensors, name) {
  const t = tensors[name];
  const [rows, cols] = t.shape;
  const out = [];
  for (let i = 0; i < rows; i++) {
    const r = [];
    const off = i * cols;
    for (let j = 0; j < cols; j++) r.push(t.data[off + j]);
    out.push(r);
  }
  return out;
}

function linear(x, weight, bias) {
  const wt = transpose(weight);
  const y = matmul(x, wt);
  if (!bias) return y;
  return y.map((r) => addVec(r, bias));
}

function reluMat(x) {
  return x.map((r) => r.map((v) => f32(v > 0 ? v : 0)));
}

function layernorm(x, weight, bias, eps = 1e-5) {
  const w = x[0].length;
  return x.map((rowX) => {
    let sum = 0;
    for (let i = 0; i < w; i++) sum += rowX[i];
    const mean = f32(sum / w);
    let vsum = 0;
    for (let i = 0; i < w; i++) {
      const d = f32((rowX[i] - mean) * (rowX[i] - mean));
      vsum += d;
    }
    const denom = f32(Math.sqrt(f32(f32(vsum / w) + eps)));
    const out = new Array(w);
    for (let i = 0; i < w; i++) {
      const n = f32((rowX[i] - mean) / denom);
      out[i] = f32(n * weight[i] + bias[i]);
    }
    return out;
  });
}

function softmaxLast(x) {
  return x.map((rowX) => {
    const m = Math.max(...rowX);
    const ex = rowX.map((v) => (v > F32MIN / 2 ? f32(Math.exp(f32(v - m))) : f32(0)));
    let s = 0;
    for (const v of ex) s += v;
    s = f32(s) || f32(1);
    return ex.map((v) => f32(v / s));
  });
}

function embedIds(tensors, ids, width) {
  const out = [];
  for (let p = 0; p < ids.length; p++) {
    out.push(addVec(row(tensors, "embedding.weight", ids[p]), row(tensors, "position.weight", p)));
  }
  if (!out.length) out.push(zeros(width));
  return out;
}

function mha(tensors, x, padMask, prefix, width, heads) {
  const dim = width / heads;
  const n = x.length;
  const qkvW = weightRows(tensors, `${prefix}.self_attn.in_proj_weight`);
  const qkvB = vec(tensors, `${prefix}.self_attn.in_proj_bias`);
  const qkv = linear(x, qkvW, qkvB);
  const q = qkv.map((r) => r.slice(0, width));
  const k = qkv.map((r) => r.slice(width, 2 * width));
  const v = qkv.map((r) => r.slice(2 * width));
  const scale = f32(1 / Math.sqrt(dim));
  const scores = [];
  for (let h = 0; h < heads; h++) {
    const mat = [];
    for (let i = 0; i < n; i++) {
      const rowS = [];
      for (let j = 0; j < n; j++) {
        let acc = 0;
        for (let t = 0; t < dim; t++) {
          acc = f32(acc + f32(q[i][h * dim + t] * k[j][h * dim + t]));
        }
        rowS.push(padMask[j] ? f32(F32MIN) : f32(acc * scale));
      }
      mat.push(rowS);
    }
    scores.push(mat);
  }
  const attn = scores.map(softmaxLast);
  const merged = Array.from({ length: n }, () => zeros(width));
  for (let h = 0; h < heads; h++) {
    for (let i = 0; i < n; i++) {
      const acc = zeros(dim);
      for (let j = 0; j < n; j++) {
        const a = attn[h][i][j];
        for (let t = 0; t < dim; t++) acc[t] = f32(acc[t] + f32(a * v[j][h * dim + t]));
      }
      for (let t = 0; t < dim; t++) merged[i][h * dim + t] = acc[t];
    }
  }
  return linear(
    merged,
    weightRows(tensors, `${prefix}.self_attn.out_proj.weight`),
    vec(tensors, `${prefix}.self_attn.out_proj.bias`),
  );
}

function encoderLayer(tensors, x, padMask, prefix, width, heads) {
  const attn = mha(
    tensors,
    layernorm(x, vec(tensors, `${prefix}.norm1.weight`), vec(tensors, `${prefix}.norm1.bias`)),
    padMask,
    prefix,
    width,
    heads,
  );
  const y = x.map((r, i) => addVec(r, attn[i]));
  const h = reluMat(
    linear(
      layernorm(y, vec(tensors, `${prefix}.norm2.weight`), vec(tensors, `${prefix}.norm2.bias`)),
      weightRows(tensors, `${prefix}.linear1.weight`),
      vec(tensors, `${prefix}.linear1.bias`),
    ),
  );
  const ff = linear(h, weightRows(tensors, `${prefix}.linear2.weight`), vec(tensors, `${prefix}.linear2.bias`));
  return y.map((r, i) => addVec(r, ff[i]));
}

function encoderStack(tensors, x, keepMask, prefixes, width, heads) {
  const pad = keepMask.map((k) => !k);
  let h = x;
  for (const prefix of prefixes) h = encoderLayer(tensors, h, pad, prefix, width, heads);
  return h;
}

function meanPool(h, keep, width) {
  const acc = zeros(width);
  let n = 0;
  for (let i = 0; i < h.length; i++) {
    if (!keep[i]) continue;
    for (let t = 0; t < width; t++) acc[t] = f32(acc[t] + h[i][t]);
    n++;
  }
  const d = f32(Math.max(n, 1));
  return acc.map((v) => f32(v / d));
}

function attentionHead(tensors, context, contextKeep, options, optionKeep, rank) {
  const ctx = layernorm(context, vec(tensors, "head.context_norm.weight"), vec(tensors, "head.context_norm.bias"));
  const opt = layernorm(options, vec(tensors, "head.option_norm.weight"), vec(tensors, "head.option_norm.bias"));
  const query = linear(opt, weightRows(tensors, "head.query.weight"), null);
  const key = linear(ctx, weightRows(tensors, "head.key.weight"), null);
  const value = linear(ctx, weightRows(tensors, "head.value.weight"), null);
  const scale = f32(1 / Math.sqrt(rank));
  const L = ctx.length;
  const nopt = opt.length;
  const scores = [];
  for (let n = 0; n < nopt; n++) {
    const rowS = [];
    for (let l = 0; l < L; l++) {
      let acc = 0;
      for (let t = 0; t < rank; t++) acc = f32(acc + f32(query[n][t] * key[l][t]));
      rowS.push(contextKeep[l] ? f32(acc * scale) : f32(F32MIN));
    }
    scores.push(rowS);
  }
  const attn = softmaxLast(scores);
  const logits = [];
  for (let n = 0; n < nopt; n++) {
    const attended = zeros(rank);
    for (let l = 0; l < L; l++) {
      const a = attn[n][l];
      for (let t = 0; t < rank; t++) attended[t] = f32(attended[t] + f32(a * value[l][t]));
    }
    let acc = 0;
    for (let t = 0; t < rank; t++) acc = f32(acc + f32(query[n][t] * attended[t]));
    logits.push(optionKeep[n] ? f32(acc * scale) : f32(F32MIN));
  }
  return logits;
}

export function infer(checkpoint, context, options) {
  const { config, tensors } = checkpoint;
  const width = config.width;
  const labels = (options ?? []).map((x) => String(x));
  let cIds = encodeBytes(context, config.context_tokens);
  const cKeep = cIds.length ? cIds.map(() => true) : [false];
  if (!cIds.length) cIds = [0];
  const oIds = labels.map((opt) => {
    const ids = encodeBytes(opt, config.option_tokens);
    return ids.length ? ids : [0];
  });
  const maxO = Math.max(1, ...oIds.map((ids) => ids.length));
  const oPad = oIds.map((ids) => ids.concat(Array.from({ length: maxO - ids.length }, () => 0)));
  const ctxH = encoderStack(
    tensors,
    embedIds(tensors, cIds, width),
    cKeep,
    Array.from({ length: config.layers }, (_, i) => `encoder.layers.${i}`),
    width,
    config.heads,
  );
  const optVecs = oPad.map((ids) => {
    const keep = ids.map((tok) => tok !== 0);
    const safe = keep.slice();
    safe[0] = true;
    const h = encoderStack(tensors, embedIds(tensors, ids, width), safe, ["option_encoder.layers.0"], width, config.heads);
    return meanPool(h, keep, width);
  });
  const optKeep = labels.map(() => true);
  return attentionHead(tensors, ctxH, cKeep, optVecs, optKeep, config.rank);
}

function softmax1d(logits) {
  const m = Math.max(...logits);
  const ex = logits.map((v) => (v > F32MIN / 2 ? f32(Math.exp(f32(v - m))) : f32(0)));
  let s = 0;
  for (const v of ex) s += v;
  s = f32(s) || f32(1);
  return ex.map((v) => f32(v / s));
}

export function createLocalBackend(path) {
  const checkpoint = loadCheckpoint(path);
  return {
    name: "local",
    decide(req) {
      const labels = req.options ?? [];
      if (!labels.length) return { abstain: true, index: 0, p: 0, dist: [] };
      const logits = infer(checkpoint, contextString(req.context), labels);
      const dist = softmax1d(logits);
      let index = 0;
      for (let i = 1; i < dist.length; i++) if (dist[i] > dist[index]) index = i;
      return { index, p: dist[index], dist };
    },
  };
}


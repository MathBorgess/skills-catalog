// System One runtime (skills-catalog#32), shared by shunt and handoff.
// Identical copies live in skills/shunt/scripts and skills/handoff/scripts so
// each skill installs on its own; handoff.test.mjs fails if they drift.
//
// Three typed calls, one swappable backend. Wave 0 ships only `rules`, which
// reproduces today's GUARDED / LINE_MAX / BYTE_MAX / EFFORT_BY_TIER floor.
// Every call appends one redacted record to $TMPDIR/handoff/decisions.jsonl.
// Outcome resolution is not done here: records stay unresolved.

import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

export const LINE_MAX = 350;
export const BYTE_MAX = 32 * 1024;
export const EDIT_LINE_MAX = LINE_MAX * 2;
export const EDIT_BYTE_MAX = BYTE_MAX * 2;
export const EFFORT_BY_TIER = { mechanical: "low", review: "medium", design: "high" };
export const DEFAULT_EFFORT = "medium";
export const READ_LEVELS = ["read-whole", "excerpt", "outline-only", "subagent-summary"];
export const EFFORTS = ["low", "medium", "high"];
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
  for (const m of s.matchAll(/\b(tier|size|lines|bytes|offset|limit|command|effort)\s*[:=]\s*(\S+)/gi)) {
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

function inferSite(kind, facts, options, question) {
  if (kind === "noul" && (facts.command != null || looksLikeCommand(facts.text) || /whole|raw|guarded|\brtk\b/i.test(question ?? ""))) {
    return "rtk";
  }
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
    const effort = facts.effort ?? EFFORT_BY_TIER[facts.tier] ?? DEFAULT_EFFORT;
    return hit(options, String(effort));
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
  return { yes: d.label === "yes", p: d.p };
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


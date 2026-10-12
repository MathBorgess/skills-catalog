// Calls into the HyperFrames CLI as a subprocess: tts, check, render. HyperFrames is only an
// engine here; no interview, brief, storyboard or sign-in happens.

import path from "node:path";

// Variables that keep HyperFrames quiet and from changing itself. A value the user already set
// (even "0") is left alone.
const QUIET_ENV = {
  HYPERFRAMES_NO_TELEMETRY: "1",
  HYPERFRAMES_NO_UPDATE_CHECK: "1",
  HYPERFRAMES_NO_AUTO_INSTALL: "1",
};

export function hfEnv(baseEnv = process.env, extra = {}) {
  const env = { ...baseEnv };
  for (const [k, v] of Object.entries(QUIET_ENV)) if (env[k] === undefined) env[k] = v;
  return { ...env, ...extra };
}

export function hfArgs(resolution, args) {
  return [...(resolution.prefixArgs ?? []), ...args];
}

// First balanced {...} in the text that parses as JSON (the CLI may print notices around it).
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

// The last line of stdout that parses as a JSON object (hyperframes prints other text too).
export function lastJsonObject(text) {
  const lines = String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].startsWith("{")) continue;
    try {
      return JSON.parse(lines[i]);
    } catch {
      /* keep looking */
    }
  }
  return firstJsonObject(text);
}

// `hyperframes tts` for one beat. Text goes through a .txt file so quoting and leading dashes
// can never change what is spoken. Returns {ok, durationSeconds, sampleRate?, error?}.
export function synthesizeBeat(deps, resolution, { textFile, out, voice, lang, speed, python, extraEnv = {}, timeoutMs = 20 * 60 * 1000 }) {
  const env = hfEnv(deps.env, { ...(python ? { HYPERFRAMES_PYTHON: python } : {}), ...extraEnv });
  const args = hfArgs(resolution, ["tts", "--text-file", textFile, "-o", out, "--voice", voice, "--lang", lang, "--speed", String(speed), "--json"]);
  const r = deps.exec(resolution.command, args, { env, timeoutMs });
  const json = lastJsonObject(r.stdout);
  if (r.error || !json || json.ok === false || typeof json.durationSeconds !== "number") {
    const detail = json?.error ?? (r.error ? String(r.error.message ?? r.error) : "");
    return { ok: false, error: String(detail || r.stderr || r.stdout || `hyperframes tts exited with status ${r.status}`).trim().slice(-800) };
  }
  return { ok: true, durationSeconds: json.durationSeconds, sampleRate: json.sampleRate, langApplied: json.langApplied };
}

// Reduces the `hyperframes check --json` envelope to what the Motion Gate needs.
export function summarizeCheck(envelope) {
  const sections = ["lint", "runtime", "layout", "motion", "contrast"];
  const findings = [];
  let errors = 0;
  let warnings = 0;
  for (const name of sections) {
    const s = envelope?.[name];
    if (!s || typeof s !== "object") continue;
    const list = Array.isArray(s.findings) ? s.findings : [];
    const e = list.filter((f) => f.severity === "error").length;
    const w = list.filter((f) => f.severity === "warning").length;
    errors += Math.max(e, Number(s.errorCount) || 0);
    warnings += Math.max(w, Number(s.warningCount) || 0);
    for (const f of list) {
      if (f.severity === "error" || f.severity === "warning") {
        findings.push({ section: name, severity: f.severity, code: f.code, selector: f.selector ?? null, time: f.time ?? null, message: f.message ?? "", fixHint: f.fixHint ?? null, sourceFile: f.sourceFile ?? null });
      }
    }
  }
  const frozen = sections.reduce((n, name) => n + (envelope?.[name]?.findings ?? []).filter((f) => f.code === "motion_frozen").length, 0);
  return { ok: envelope?.ok === true && errors === 0, errors, warnings, frozen, findings, version: envelope?._meta?.version ?? null };
}

export function runCheck(deps, resolution, projectDir, { timeoutMs = 10 * 60 * 1000 } = {}) {
  const env = hfEnv(deps.env);
  const r = deps.exec(resolution.command, hfArgs(resolution, ["check", projectDir, "--json"]), { cwd: projectDir, env, timeoutMs });
  const envelope = firstJsonObject(r.stdout);
  if (!envelope) {
    return { ok: false, crashed: true, errors: 1, warnings: 0, frozen: 0, findings: [], raw: (r.stderr || r.stdout || String(r.error ?? "")).trim().slice(-1200), version: null };
  }
  return { ...summarizeCheck(envelope), crashed: false };
}

export function runRender(deps, resolution, projectDir, { out, quality = "looks", fps, inherit = false, timeoutMs = 60 * 60 * 1000 }) {
  const env = hfEnv(deps.env);
  const args = ["render", projectDir, "-o", out, "--quality", quality];
  if (fps) args.push("--fps", String(fps));
  if (!inherit) args.push("--quiet");
  const r = deps.exec(resolution.command, hfArgs(resolution, args), { cwd: projectDir, env, timeoutMs, inherit });
  return { ok: r.status === 0 && !r.error, status: r.status, stderr: (r.stderr || r.stdout || String(r.error ?? "")).trim().slice(-1200) };
}

export function ffmpegFrame(deps, { video, atSec, out }) {
  const r = deps.exec("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(atSec), "-i", video, "-frames:v", "1", out], { env: deps.env, timeoutMs: 60000 });
  return { ok: r.status === 0 && !r.error, stderr: r.stderr.trim().slice(-400) };
}

export const relativeTo = (base, p) => path.relative(base, p) || ".";

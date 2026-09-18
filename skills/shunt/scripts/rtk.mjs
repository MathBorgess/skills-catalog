// RTK bridge (https://github.com/rtk-ai/rtk), shared by shunt and handoff.
// Identical copies live in skills/shunt/scripts and skills/handoff/scripts so
// each skill installs on its own; handoff.test.mjs fails if they drift.
//
// RTK owns the rewrite registry and the filters; we own the scope (only a run
// that asked for it) and the policy (guarded mode keeps code, diffs and search
// whole). We never approve a command: the host keeps its own permission flow.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const RTK_MODES = ["off", "guarded", "full"];
export const RTK_ENV = { ...process.env, RTK_TELEMETRY_DISABLED: "1" };

// What a run tells a hookless agent (Codex, Cursor, Antigravity children).
// Adapted from RTK's own awareness texts (hooks/rtk-awareness*.md).
export const RTK_PROMPT = {
  guarded: `## Command output (RTK)
Prefix build, test, lint, install, git status/log/add/commit/push and ls/find commands with \`rtk\` (\`rtk cargo test\`, \`rtk git status\`). Never prefix \`git diff\`, \`git show\`, \`cat\`, \`head\`, \`tail\`, \`grep\` or \`rg\`: code, diffs and search results must reach you whole. Treat \`rtk\` output as the complete result and batch related commands into one call. A truncated result prints its own recovery command (\`rtk recall <hash>\`); run \`rtk proxy <cmd>\` only when the output is empty when output was expected, contradicts its exit code, or is garbled.`,
  full: `## Command output (RTK)
Prefix every shell command with \`rtk\` (\`rtk git status\`, \`rtk cargo test\`), including inside chains. Commands RTK has no filter for run as-is, so the prefix is always safe. Treat \`rtk\` output as the complete result and batch related commands into one call. A truncated result prints its own recovery command (\`rtk recall <hash>\`); run \`rtk proxy <cmd>\` only when the output is empty when output was expected, contradicts its exit code, or is garbled.`,
};

// Guarded mode: these reach the model raw (skills-catalog#17). One matching
// segment keeps the whole compound command raw — the safe direction.
const GUARDED = /^(git\s+((-[Cc]|--git-dir|--work-tree)\s+\S+\s+|-\S+\s+)*(diff|show)\b|cat\b|head\b|tail\b|grep\b|rg\b|read\b|less\b|more\b)/;

export function normalizeMode(v) {
  if (v === true || v === "") return "guarded";
  if (v === undefined || v === null || v === false) return "off";
  if (RTK_MODES.includes(v)) return v;
  throw new Error(`rtk mode must be one of ${RTK_MODES.join(" | ")}, got ${JSON.stringify(v)}`);
}

// `--rtk` → guarded, `--rtk=full` → full, absent → off.
export function modeFromArgv(argv = process.argv) {
  const hit = argv.find((a) => a === "--rtk" || a.startsWith("--rtk="));
  if (!hit) return "off";
  return normalizeMode(hit === "--rtk" ? true : hit.slice("--rtk=".length));
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

export function rtkVersion(bin = "rtk") {
  const r = spawnSync(bin, ["--version"], { encoding: "utf8", env: RTK_ENV });
  return r.status === 0 ? r.stdout.trim().replace(/^rtk\s+/, "") : null;
}

// The rewritten command, or null when it must run as typed.
// `rtk rewrite` exits 0 (rewrite), 3 (rewrite; an ask rule matched — the host
// prompts), 1 (no equivalent) or 2 (a host deny rule matched).
export function rewrite(cmd, mode, bin = "rtk") {
  if (!cmd || !mode || mode === "off") return null;
  if (/^\s*rtk\s/.test(cmd)) return null;
  if (mode === "guarded" && guardedSkip(cmd)) return null;
  const r = spawnSync(bin, ["rewrite", cmd], { encoding: "utf8", env: RTK_ENV, timeout: 3000 });
  const out = (r.stdout ?? "").trim();
  return (r.status === 0 || r.status === 3) && out ? out : null;
}

// The agent went back for what RTK elided, or bypassed a filter.
export const isRecall = (cmd) => /^\s*rtk\s+(recall|proxy)\b/.test(cmd ?? "");

// PreToolUse answer that swaps the command and leaves permission to the host.
export function hookOutput(toolInput, command) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput: { ...toolInput, command },
    },
  };
}

export function historyDbPath() {
  if (process.env.RTK_HISTORY_DB) return process.env.RTK_HISTORY_DB;
  const data = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const candidates = [
    join(homedir(), "Library", "Application Support", "rtk", "history.db"),
    join(data, "rtk", "history.db"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

// Commands RTK filtered under `project` (exact path or below it) between
// `since` and `until` (ISO). Estimated tokens are RTK's bytes/4. Null when
// there is no history or node:sqlite is unavailable.
export function historyStats({ project, since, until = null, db = historyDbPath() }) {
  if (!db || !existsSync(db) || !project || !since) return null;
  try {
    const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
    const conn = new DatabaseSync(db, { readOnly: true });
    // RTK stores "…T18:19:16.206931+00:00"; drop our "Z" so the ISO prefix compares.
    const lo = since.replace(/Z$/, "");
    const hi = until ? until.replace(/Z$/, "") + "~" : null;
    const p = resolve(project);
    const row = conn
      .prepare(
        `SELECT COUNT(*) AS commands, COALESCE(SUM(input_tokens),0) AS input_tokens,
                COALESCE(SUM(output_tokens),0) AS output_tokens, COALESCE(SUM(saved_tokens),0) AS saved_tokens
           FROM commands
          WHERE (project_path = ? OR project_path GLOB ?)
            AND timestamp >= ? AND (? IS NULL OR timestamp <= ?)`,
      )
      .get(p, `${p}/*`, lo, hi, hi);
    conn.close();
    return { ...row };
  } catch {
    return null;
  }
}

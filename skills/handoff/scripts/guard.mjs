#!/usr/bin/env node
// handoff guard — a PreToolUse hook that refuses the two things the skill used
// to merely ask for.
//
// A rule written as guidance is a rule that gets dropped under pressure. These
// two were: "do not ingest full transcripts or CLI stdout dumps" and "the
// parent does not do the children's work". Both were measured after the fact
// (`parent_implemented`) instead of prevented. Here they are prevented.
//
// Scope, deliberately narrow: this hook does nothing at all unless a handoff
// run is live on this machine right now. It ships with the catalog plugin and
// therefore runs on every tool call in every session, so being inert by default
// is a correctness requirement, not politeness. Any error exits 0 (allow).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ALLOW = 0;
const LIVE_MAX_AGE_S = 7200;

export function redactEvidence(text) {
  if (typeof text !== "string") return "";
  let out = text;
  out = out.replace(/\b(sk-[a-zA-Z0-9_-]{8})[a-zA-Z0-9_-]+/g, "$1[REDACTED]");
  out = out.replace(/\b(gh[pous]_[a-zA-Z0-9]{4})[a-zA-Z0-9]+/g, "$1[REDACTED]");
  out = out.replace(/\b(github_pat_[a-zA-Z0-9_]{4})[a-zA-Z0-9_]+/g, "$1[REDACTED]");
  out = out.replace(/\b(bearer\s+)[a-zA-Z0-9._~+/-]{8,}/gi, "$1[REDACTED]");
  out = out.replace(/\b((?:api[_-]?key|access[_-]?token|secret|password|passwd|auth)[=:\s]+)[^\s&'"]{8,}/gi, "$1[REDACTED]");
  out = out.replace(/(--(?:api[_-]?key|token|secret|password)[=\s]+)[^\s'"]+/gi, "$1[REDACTED]");
  out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL REDACTED]");
  try {
    const home = homedir();
    if (home && home.length > 1) {
      out = out.split(home).join("~");
    }
  } catch {}
  return out;
}

export function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

export function liveRuns() {
  const root = join(tmpdir(), "handoff");
  if (!existsSync(root)) return [];
  const out = [];
  for (const entry of readdirSync(root)) {
    const dir = join(root, entry);
    const statePath = join(dir, "state.json");
    if (!existsSync(statePath)) continue;
    try {
      if ((Date.now() - statSync(statePath).mtimeMs) / 1000 > LIVE_MAX_AGE_S) continue;
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      const running = Object.entries(state.sessions ?? {}).filter(
        ([, s]) => s.status === "running" || s.status === "pending",
      );
      if (running.length) out.push({ dir, running: running.map(([id]) => id) });
    } catch {
      /* a half-written state file is not a reason to block anyone */
    }
  }
  return out;
}

// A raw provider launch while a run is live: the dispatcher owns launching, and
// a hand-rolled launch is invisible to it — no worktree, no reroute on quota
// death, no cost attribution.
export const RAW_LAUNCH =
  /\b(claude\s+(-p|--print)|codex\s+exec|cursor-agent\s+(-p|--print)|(^|[;&|]\s*)a(gent|gy)\s+(-p|--print|--prompt))/;

export function evaluatePreToolUse(input, runs = liveRuns()) {
  if (!runs.length) return null;

  const tool = input.tool_name ?? "";
  const ti = input.tool_input ?? {};

  if (["Read", "Edit", "Write", "NotebookEdit"].includes(tool)) {
    const p = ti.file_path ?? ti.notebook_path ?? "";
    if (!p) return null;
    const abs = resolve(String(p));
    for (const run of runs) {
      const wt = join(run.dir, "wt");
      const logs = join(run.dir, "logs");
      if (abs.startsWith(wt + "/")) {
        const id = abs.slice(wt.length + 1).split("/")[0];
        const safePath = redactEvidence(abs);
        return (
          `evidence: matched worktree path "${safePath}"\n` +
          `${safePath} is inside session ${id}'s worktree, and that session is still running. ` +
          `Editing or reading a child's working tree is how a parent ends up doing the child's job, ` +
          `and the child will overwrite you anyway. Read ${join(run.dir, "sessions", `${id}.result.md`)} ` +
          `when it finishes, or relaunch that session with a corrected brief.`
        );
      }
      if (abs.startsWith(logs + "/")) {
        const id = abs.slice(logs.length + 1).replace(/\.log$/, "");
        const safePath = redactEvidence(abs);
        return (
          `evidence: matched log path "${safePath}"\n` +
          `${safePath} is session ${id}'s raw stdout. Ingesting it spends the tokens this skill exists to save. ` +
          `Run \`handoff status --run ${run.dir}\` for the one-line digest, or read ` +
          `${join(run.dir, "sessions", `${id}.result.md`)}.`
        );
      }
    }
  }

  if (tool === "Bash") {
    const cmd = String(ti.command ?? "");
    for (const run of runs) {
      const logDir = join(run.dir, "logs");
      if (cmd.includes(logDir)) {
        const safeCmd = redactEvidence(cmd);
        const safeLogDir = redactEvidence(logDir);
        return (
          `evidence: matched log path "${safeLogDir}" in command "${safeCmd}"\n` +
          `That command reads a child's raw log from a live handoff run. ` +
          `Use \`handoff status --run ${run.dir}\` instead — it prints one line per session.`
        );
      }
    }
    const isDiagnostic =
      /(^|[;&|\s])(pgrep\b|ps\b|which\b)/.test(cmd) ||
      /\b(--version|-v|--help|-h)\b/.test(cmd);
    if (!isDiagnostic && RAW_LAUNCH.test(cmd) && !cmd.includes("handoff.mjs")) {
      const run = runs[0];
      const match = cmd.match(RAW_LAUNCH);
      const matchedPattern = match ? match[0].trim() : "raw launch";
      const safeCmd = redactEvidence(cmd);
      return (
        `evidence: matched launch pattern "${matchedPattern}" in command "${safeCmd}"\n` +
        `A handoff run is live (${run.dir}, sessions ${run.running.join(", ")} not finished). ` +
        `\`handoff dispatch\` owns launching: it creates the worktree, honours the dependency graph, ` +
        `reroutes on quota death and attributes cost. A hand-rolled launch does none of that and is ` +
        `invisible to the scorecard. Run \`node <plugin>/skills/handoff/scripts/handoff.mjs dispatch --run ${run.dir}\`.`
      );
    }
  }

  return null;
}

export function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(ALLOW);
  }

  const reason = evaluatePreToolUse(input);
  if (reason) {
    deny(reason);
  } else {
    process.exit(ALLOW);
  }
}

const isCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCLI) {
  try {
    main();
  } catch {
    process.exit(ALLOW);
  }
}

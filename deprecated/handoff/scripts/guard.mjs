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
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ALLOW = 0;
const LIVE_MAX_AGE_S = 7200;

function deny(reason) {
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

function liveRuns() {
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
const RAW_LAUNCH =
  /\b(claude\s+(-p|--print)|codex\s+exec|cursor-agent\s+(-p|--print)|(^|[;&|]\s*)a(gent|gy)\s+(-p|--print|--prompt))/;

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(ALLOW);
  }

  const runs = liveRuns();
  if (!runs.length) process.exit(ALLOW);

  const tool = input.tool_name ?? "";
  const ti = input.tool_input ?? {};

  if (["Read", "Edit", "Write", "NotebookEdit"].includes(tool)) {
    const p = ti.file_path ?? ti.notebook_path ?? "";
    if (!p) process.exit(ALLOW);
    const abs = resolve(String(p));
    for (const run of runs) {
      const wt = join(run.dir, "wt");
      const logs = join(run.dir, "logs");
      if (abs.startsWith(wt + "/")) {
        const id = abs.slice(wt.length + 1).split("/")[0];
        deny(
          `${abs} is inside session ${id}'s worktree, and that session is still running. ` +
            `Editing or reading a child's working tree is how a parent ends up doing the child's job, ` +
            `and the child will overwrite you anyway. Read ${join(run.dir, "sessions", `${id}.result.md`)} ` +
            `when it finishes, or relaunch that session with a corrected brief.`,
        );
      }
      if (abs.startsWith(logs + "/")) {
        const id = abs.slice(logs.length + 1).replace(/\.log$/, "");
        deny(
          `${abs} is session ${id}'s raw stdout. Ingesting it spends the tokens this skill exists to save. ` +
            `Run \`handoff status --run ${run.dir}\` for the one-line digest, or read ` +
            `${join(run.dir, "sessions", `${id}.result.md`)}.`,
        );
      }
    }
  }

  if (tool === "Bash") {
    const cmd = String(ti.command ?? "");
    for (const run of runs) {
      if (cmd.includes(join(run.dir, "logs"))) {
        deny(
          `That command reads a child's raw log from a live handoff run. ` +
            `Use \`handoff status --run ${run.dir}\` instead — it prints one line per session.`,
        );
      }
    }
    if (RAW_LAUNCH.test(cmd) && !cmd.includes("handoff.mjs")) {
      const run = runs[0];
      deny(
        `A handoff run is live (${run.dir}, sessions ${run.running.join(", ")} not finished). ` +
          `\`handoff dispatch\` owns launching: it creates the worktree, honours the dependency graph, ` +
          `reroutes on quota death and attributes cost. A hand-rolled launch does none of that and is ` +
          `invisible to the scorecard. Run \`node <plugin>/skills/handoff/scripts/handoff.mjs dispatch --run ${run.dir}\`.`,
      );
    }
  }

  process.exit(ALLOW);
}

try {
  main();
} catch {
  process.exit(ALLOW);
}

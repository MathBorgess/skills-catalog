#!/usr/bin/env node
// PreToolUse hook a Claude child receives via `claude --settings` when its
// session runs with rtk. Scoped to that child only — no `rtk init -g`.
//
//   node rtk-hook.mjs <guarded|full> <events.jsonl>
//
// Rewrites Bash through rtk (never approving it: the child's own permission
// flow decides) and logs rewrites and recalls for `handoff score`.
// Any error exits 0 with no output: the command runs as typed.

import { appendFileSync, readFileSync } from "node:fs";
import { hookOutput, isRecall, rewrite } from "./rtk.mjs";

const [mode, events] = process.argv.slice(2);
const log = (e) => {
  try {
    if (events) appendFileSync(events, JSON.stringify({ ts: new Date().toISOString(), ...e }) + "\n");
  } catch {}
};

try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  if (input.tool_name !== "Bash") process.exit(0);
  const ti = input.tool_input ?? {};
  const cmd = String(ti.command ?? "");
  if (isRecall(cmd)) {
    log({ event: "recall", cmd });
    process.exit(0);
  }
  const rewritten = rewrite(cmd, mode);
  if (rewritten) {
    log({ event: "rewrite", cmd, rewritten });
    process.stdout.write(JSON.stringify(hookOutput(ti, rewritten)));
  }
} catch {}
process.exit(0);

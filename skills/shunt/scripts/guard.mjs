#!/usr/bin/env node
// shunt guard — PreToolUse hook. Inert unless `shunt.mjs activate` left a
// live marker for this workspace. Any error exits 0 (allow).
//
// Read: refuse full-file ingest over the line/byte cap; allow excerpts.
// Write-delegate: refuse race/read-back on tracked paths.
// Write of a large parent-composed blob: NOT refused — see
// references/write-path.md (future test parent_composed_write).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classifyRead,
  findLiveState,
  isHandoffChildPath,
  lineAndByteCount,
} from "./shunt.mjs";

const ALLOW = 0;

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

function toolPath(ti) {
  return ti.file_path || ti.notebook_path || ti.path || ti.target_file || "";
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(ALLOW);
  }

  const cwd = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const state = findLiveState(cwd);
  if (!state) process.exit(ALLOW);

  const tool = input.tool_name ?? "";
  const ti = input.tool_input ?? {};

  if (["Read", "Edit", "Write", "NotebookEdit"].includes(tool)) {
    const p = toolPath(ti);
    if (!p) process.exit(ALLOW);
    const abs = resolve(String(p));
    if (isHandoffChildPath(abs)) process.exit(ALLOW);

    if (tool === "Write" || tool === "Edit" || tool === "NotebookEdit") {
      if (state.write.running.includes(abs)) {
        deny(
          `${abs} is write-delegate running. The small subagent owns it. Do not Write/Edit. After it finishes, \`write-done --file\` and excerpt only if you must change it.`,
        );
      }
      // FUTURE parent_composed_write: do not deny over-cap Write.contents.
      process.exit(ALLOW);
    }

    if (!existsSync(abs)) process.exit(ALLOW);
    let counts;
    try {
      counts = lineAndByteCount(abs);
    } catch {
      process.exit(ALLOW);
    }
    const decision = classifyRead(abs, ti.offset, ti.limit, state, counts);
    if (!decision.allow) deny(decision.reason);
  }

  process.exit(ALLOW);
}

try {
  main();
} catch {
  process.exit(ALLOW);
}

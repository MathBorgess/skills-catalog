#!/usr/bin/env node
// still-cursor-living-day guard — a PreToolUse hook that enforces the two rules
// the experiment cannot survive being asked nicely about.
//
// 1. The blind pass is blind. The judge grades twelve labelled images without
//    the prompts, the clocks or the true order, and the ordering tau is only
//    worth reading if that held. One glance at plan.json and the number is a
//    fiction that still prints to three decimals.
// 2. A verdict is written once, by the judge, through `judge submit`. Editing
//    verdicts.json or a metrics line afterwards is not correcting a result, it
//    is authoring one.
//
// Scope, deliberately narrow: nothing here does anything unless a run of this
// skill is live on this machine right now. It ships with the catalog plugin and
// runs on every tool call in every session, so being inert by default is a
// correctness requirement, not politeness. Any error exits 0 (allow).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ALLOW = 0;
const AXIS = "still-cursor-living-day";
const LIVE_MAX_AGE_S = 7200;
const SEALED = ["plan.json", "prompts", "frames", join("judge", "key.json")];
const WRITE_ONCE = ["verdicts.json", join("judge", "blind.verdicts.json"), join("judge", "informed.verdicts.json"), "metrics.jsonl"];

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
  const root = process.env.SCLD_ROOT ? resolve(process.env.SCLD_ROOT) : join(tmpdir(), AXIS);
  if (!existsSync(root)) return [];
  const out = [];
  let entries = [];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }
  for (const entry of entries) {
    const dir = join(root, entry);
    const statePath = join(dir, "state.json");
    if (!existsSync(statePath)) continue;
    try {
      if ((Date.now() - statSync(statePath).mtimeMs) / 1000 > LIVE_MAX_AGE_S) continue;
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      if (["scored", "closed"].includes(state.phase)) continue;
      out.push({ dir, phase: state.phase });
    } catch {
      /* a half-written state file is not a reason to block anyone */
    }
  }
  return out;
}

function touched(abs, dir, names) {
  return names.some((name) => {
    const target = join(dir, name);
    return abs === target || abs.startsWith(target + "/");
  });
}

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
  const script = join(AXIS, "scripts", "collection.mjs");

  if (["Read", "Edit", "Write", "NotebookEdit"].includes(tool)) {
    const p = ti.file_path ?? ti.notebook_path ?? "";
    if (!p) process.exit(ALLOW);
    const abs = resolve(String(p));
    for (const run of runs) {
      if (run.phase === "judging-blind" && touched(abs, run.dir, SEALED)) {
        deny(
          `${abs} belongs to a blind judging pass that is still open (${run.dir}). ` +
            `The judge is ordering twelve unlabelled images right now, and the run's tau only means something ` +
            `if the prompts, the clocks and the true order stayed sealed. Read ${join(run.dir, "judge", "blind", "task.md")} ` +
            `instead, or close the pass with \`judge submit --phase blind\`.`,
        );
      }
      if (["Edit", "Write", "NotebookEdit"].includes(tool) && touched(abs, run.dir, WRITE_ONCE)) {
        deny(
          `${abs} is a recorded verdict from a live run (${run.dir}). Verdicts are written once, by the judge, ` +
            `through \`judge submit\`, and the scorecard is computed from them. Editing one by hand does not correct ` +
            `a result, it authors one. Re-open the pass and submit again if the judgment was wrong.`,
        );
      }
    }
  }

  if (tool === "Bash") {
    const cmd = String(ti.command ?? "");
    if (cmd.includes(script)) process.exit(ALLOW);
    for (const run of runs) {
      if (run.phase !== "judging-blind") continue;
      for (const name of SEALED) {
        if (cmd.includes(join(run.dir, name))) {
          deny(
            `That command reads ${name} from a run whose blind judging pass is still open (${run.dir}). ` +
              `The blind pass is the measurement; opening the answer key ends it. ` +
              `Use ${join(run.dir, "judge", "blind", "task.md")}.`,
          );
        }
      }
    }
  }

  process.exit(ALLOW);
}

try {
  main();
} catch {
  process.exit(ALLOW);
}

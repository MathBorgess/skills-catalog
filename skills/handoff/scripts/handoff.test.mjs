#!/usr/bin/env node
// Tests for handoff.mjs status/dispatch result-file reconciliation.
// Run: node skills/handoff/scripts/handoff.test.mjs

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "handoff.mjs");
let failed = 0;

function assert(name, cond) {
  if (cond) {
    console.log(`ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL ${name}`);
  }
}

// Equivalent to the 20260916T231703Z-reorg session 01 result heading.
const OBSERVED_RESULT = `# Session 01 Result: Legacy-tree lifecycle migration

## Status
**Completed**. Committed as \`420c00a\` on branch \`handoff/20260916T231703Z-reorg-01\`.

## Remaining Work
None for Session 01.
`;

const CONTRACT_RESULT = `# Result 01

- status: done
- files changed:
  - skills/handoff/scripts/handoff.mjs — reconcile
- remaining: none
- summary: finished
`;

const AMBIGUOUS_RESULT = `# Result 01

Work is in progress. No terminal status line.
`;

function makeRun({ status = "running", resultBody, extraSessions } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "handoff-status-"));
  mkdirSync(join(dir, "sessions"));
  const sessions = {
    "01": {
      status,
      attempts: 1,
      slot: "antigravity",
      lane: "third-party",
      pid: 35584,
      started_at: "2026-09-16T23:18:14.168Z",
    },
    ...extraSessions,
  };
  writeFileSync(
    join(dir, "routing.json"),
    JSON.stringify({
      mode: "fan-out",
      horizon_s: 14400,
      sessions: Object.keys(sessions).map((id) => ({
        id,
        slot: sessions[id].slot ?? "antigravity",
        lane: sessions[id].lane ?? "third-party",
        deps: sessions[id].deps ?? [],
      })),
    }) + "\n",
  );
  writeFileSync(
    join(dir, "state.json"),
    JSON.stringify(
      {
        started_at: "2026-09-16T23:18:13.556Z",
        parent_turns: 1,
        sessions,
        empty_slots: [],
        events: ["2026-09-16T23:18:14.168Z 01 launched on antigravity/third-party pid 35584"],
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    join(dir, "quota.json"),
    JSON.stringify({ ts: new Date().toISOString(), slots: [] }) + "\n",
  );
  if (resultBody != null) {
    writeFileSync(join(dir, "sessions", "01.result.md"), resultBody);
  }
  return dir;
}

function run(cmd, dir, extra = []) {
  return spawnSync(process.execPath, [cli, cmd, "--run", dir, ...extra], {
    encoding: "utf8",
  });
}

function persistedStatus(dir, id = "01") {
  return JSON.parse(readFileSync(join(dir, "state.json"), "utf8")).sessions[id].status;
}

{
  const dir = makeRun({ status: "running", resultBody: OBSERVED_RESULT });
  const r = run("status", dir);
  assert("status exits 0 on observed fixture", r.status === 0);
  assert(
    "status reports done for running + ## Status Completed",
    /\| 01 \| done \|/.test(r.stdout),
  );
  assert(
    "status persists done for observed fixture",
    persistedStatus(dir) === "done",
  );
}

{
  const dir = makeRun({ status: "running", resultBody: CONTRACT_RESULT });
  const r = run("status", dir);
  assert(
    "status reports done for contract - status: done",
    r.status === 0 && /\| 01 \| done \|/.test(r.stdout) && persistedStatus(dir) === "done",
  );
}

{
  const dir = makeRun({ status: "running" });
  const r = run("status", dir);
  assert(
    "status leaves running when no result file",
    r.status === 0 && /\| 01 \| running \|/.test(r.stdout) && persistedStatus(dir) === "running",
  );
}

{
  const dir = makeRun({ status: "running", resultBody: AMBIGUOUS_RESULT });
  const r = run("status", dir);
  assert(
    "status leaves running on ambiguous result",
    r.status === 0 && /\| 01 \| running \|/.test(r.stdout) && persistedStatus(dir) === "running",
  );
}

{
  const dir = makeRun({ status: "failed", resultBody: OBSERVED_RESULT });
  const r = run("status", dir);
  assert(
    "status does not overwrite failed with a completed file",
    r.status === 0 && /\| 01 \| failed \|/.test(r.stdout) && persistedStatus(dir) === "failed",
  );
}

{
  const dir = makeRun({
    status: "blocked",
    resultBody: "\n- status: done\n- summary: ignore me\n",
  });
  const r = run("status", dir);
  assert(
    "status does not overwrite blocked with a done file",
    r.status === 0 && /\| 01 \| blocked \|/.test(r.stdout) && persistedStatus(dir) === "blocked",
  );
}

{
  const dir = makeRun({ status: "running", resultBody: OBSERVED_RESULT });
  const r = run("dispatch", dir, ["--budget", "1"]);
  assert("dispatch exits 0 on observed fixture", r.status === 0);
  assert(
    "dispatch reports done for running + terminal result",
    /\| 01 \| done \|/.test(r.stdout),
  );
  assert(
    "dispatch persists done for observed fixture",
    persistedStatus(dir) === "done",
  );
  assert(
    "dispatch does not relaunch a reconciled session",
    !/still running/.test(r.stdout) && /all sessions terminal/.test(r.stdout),
  );
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nok: handoff tests");

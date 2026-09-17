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

// P1, P4, P8: Route tests for capability needs, dead slot preservation, and auth awareness
function makeRouteRun({ plan, quota, state } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "handoff-route-test-"));
  mkdirSync(join(dir, "sessions"), { recursive: true });
  const q = quota ?? {
    ts: new Date().toISOString(),
    slots: [
      {
        key: "codex",
        provider: "codex",
        account: "default",
        installed: true,
        bin: "codex",
        remaining_pct: 80,
        bucket: "ok",
        windows: [{ name: "5h", remaining_pct: 80, resets_at: null, window_secs: 18000 }],
        source: "codex-test",
      },
      {
        key: "claude",
        provider: "claude",
        account: "default",
        installed: true,
        bin: "claude",
        remaining_pct: 90,
        bucket: "ok",
        windows: [{ name: "5h", remaining_pct: 90, resets_at: null, window_secs: 18000 }],
        source: "claude-test",
      },
    ],
  };
  writeFileSync(join(dir, "quota.json"), JSON.stringify(q, null, 2));
  const p = plan ?? {
    mode: "fan-out",
    horizon_s: 7200,
    sessions: [
      { id: "01", goal: "task 1", tier: "mechanical", size: "s", writes: ["a.txt"], deps: [] },
    ],
  };
  writeFileSync(join(dir, "plan.json"), JSON.stringify(p, null, 2));
  if (state) {
    writeFileSync(join(dir, "state.json"), JSON.stringify(state, null, 2));
  }
  return dir;
}

{
  // P4: Needs filtering excludes Codex when unix-socket is needed
  const dir = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      sessions: [
        { id: "01", goal: "daemon test", tier: "mechanical", size: "s", writes: ["d.txt"], deps: [], needs: ["unix-socket"] },
      ],
    },
  });
  const r = run("route", dir);
  assert("route exits 0 when capable provider exists for needs", r.status === 0);
  const routing = JSON.parse(readFileSync(join(dir, "routing.json"), "utf8"));
  assert("route assigns session with unix-socket to claude, not codex", routing.sessions[0].provider === "claude");
}

{
  // P4: Explicit pinned provider violating needs fails fast
  const dir = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      sessions: [
        { id: "01", goal: "daemon test", provider: "codex", tier: "mechanical", size: "s", writes: ["d.txt"], deps: [], needs: ["unix-socket"] },
      ],
    },
  });
  const r = run("route", dir);
  assert("route refuses plan pinning codex with unix-socket needs", r.status !== 0);
  assert("route error message explains sandbox capability violation", /does not satisfy required needs/.test(r.stderr));
}

{
  // P8: Dead slots in state.json are avoided by route
  const dir = makeRouteRun({
    state: { empty_slots: ["claude"], sessions: {}, parent_turns: 1 },
  });
  const r = run("route", dir);
  assert("route exits 0 avoiding empty_slots", r.status === 0);
  const routing = JSON.parse(readFileSync(join(dir, "routing.json"), "utf8"));
  assert("route skips dead claude slot and routes to codex", routing.sessions[0].provider === "codex");
}

{
  // P1: auth_expired slots are excluded by route
  const quota = {
    ts: new Date().toISOString(),
    slots: [
      {
        key: "claude",
        provider: "claude",
        account: "default",
        installed: true,
        bin: "claude",
        remaining_pct: null,
        bucket: "unknown",
        auth_expired: true,
        windows: [],
        source: "expired-credential",
      },
      {
        key: "codex",
        provider: "codex",
        account: "default",
        installed: true,
        bin: "codex",
        remaining_pct: 80,
        bucket: "ok",
        windows: [{ name: "5h", remaining_pct: 80, resets_at: null, window_secs: 18000 }],
        source: "codex-test",
      },
    ],
  };
  const dir = makeRouteRun({ quota });
  const r = run("route", dir);
  assert("route exits 0 skipping auth_expired slot", r.status === 0);
  const routing = JSON.parse(readFileSync(join(dir, "routing.json"), "utf8"));
  assert("route skips auth_expired claude and routes to codex", routing.sessions[0].provider === "codex");
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nok: handoff tests");

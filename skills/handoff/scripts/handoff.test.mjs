#!/usr/bin/env node
// Tests for handoff.mjs status/dispatch result-file reconciliation.
// Run: node skills/handoff/scripts/handoff.test.mjs

import { spawn, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseResultDigest,
  formatResultDigestBlock,
  evaluateSettle,
  DEFAULT_SETTLE_S,
  launchArgs,
  cursorModelWithEffort,
  EFFORT_BY_TIER,
  DEFAULT_EFFORT,
  renderModel,
  resolveCodexModel,
  buildParentTurnsByCause,
  cliModels,
  hashSessions,
  hashPlan,
  rtkFor,
  rtkClaudeSettings,
  sessionRtk,
  nonCausalDeps,
  clean,
  score,
  markSession,
  mergeStateFromDisk,
  saveState,
  loadState,
  classifyExit,
  reconcileFromResults,
  isPidAlive,
  adoptLiveSessions,
  route,
  CAPABILITY_NOULS,
  CAPABILITY_THRESHOLD,
  declaredCapabilities,
  predictCapabilities,
  effectiveCapabilities,
  capabilityDisagreement,
  mineRecordedCapabilityExamples,
  modelForReroute,
  firstUsable,
} from "./handoff.mjs";
import { redactEvidence, evaluatePreToolUse } from "./guard.mjs";
import { runAllGateTests } from "./gate.test.mjs";
import { runAllLocalTests } from "./s1-local.test.mjs";
import {
  choice,
  score as s1Score,
  noul,
  rules,
  setBackend,
  getBackend,
  redact,
  decisionsPath,
  readDecisions,
  resolveDecisions,
  EFFORTS,
  READ_LEVELS,
  guardedSkip,
  createLocalBackend,
} from "./s1.mjs";

// Keep test runs out of the real metrics history in the OS temp dir.
process.env.TMPDIR = mkdtempSync(join(tmpdir(), "skills-test-"));

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

function run(cmd, dir, extra = [], env = process.env) {
  return spawnSync(process.execPath, [cli, cmd, "--run", dir, ...extra], {
    encoding: "utf8",
    env,
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

{
  const dir = makeRun({ status: "pending", resultBody: CONTRACT_RESULT });
  const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  state.sessions["01"].parent_correction = {
    previous_status: "abandoned",
    status: "pending",
    note: "undo premature abandonment",
    ts: "2026-09-21T12:30:35.000Z",
  };
  writeFileSync(join(dir, "state.json"), JSON.stringify(state, null, 2) + "\n");
  const routing = JSON.parse(readFileSync(join(dir, "routing.json"), "utf8"));
  const loaded = loadState(dir);
  assert(
    "reconcile: pending + parent_correction + result file becomes done",
    reconcileFromResults(dir, routing, loaded) === true && loaded.sessions["01"].status === "done",
  );
}

{
  const dir = makeRun({ status: "abandoned", resultBody: OBSERVED_RESULT });
  const routing = JSON.parse(readFileSync(join(dir, "routing.json"), "utf8"));
  const loaded = loadState(dir);
  assert(
    "reconcile: abandoned + durable result file becomes done",
    reconcileFromResults(dir, routing, loaded) === true && loaded.sessions["01"].status === "done",
  );
}

{
  const dir = makeRun({
    status: "pending",
    extraSessions: { "02": { status: "pending", attempts: 0, deps: ["01"] } },
  });
  const routing = JSON.parse(readFileSync(join(dir, "routing.json"), "utf8"));
  const loaded = loadState(dir);
  loaded.sessions["01"].pid = 1;
  assert(
    "adopt: pending + live pid becomes running",
    adoptLiveSessions(routing, loaded, { isAlive: (pid) => pid === 1 }) === true &&
      loaded.sessions["01"].status === "running" &&
      loaded.sessions["02"].status === "pending",
  );
}

{
  assert("isPidAlive rejects non-positive pids", isPidAlive(0) === false && isPidAlive(-1) === false);
  const sleeper = spawn("sleep", ["30"], { detached: true, stdio: "ignore" });
  sleeper.unref();
  try {
    assert("isPidAlive sees a live sleep pid", isPidAlive(sleeper.pid) === true);
    const dir = makeRun({
      status: "running",
      extraSessions: { "02": { status: "pending", attempts: 0, deps: ["01"] } },
    });
    const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    state.sessions["01"].pid = sleeper.pid;
    writeFileSync(join(dir, "state.json"), JSON.stringify(state, null, 2) + "\n");
    const routing = JSON.parse(readFileSync(join(dir, "routing.json"), "utf8"));
    routing.mode = "compact";
    writeFileSync(join(dir, "routing.json"), JSON.stringify(routing, null, 2) + "\n");

    const r = run("dispatch", dir, ["--budget", "1"]);
    const after = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    const launchEvents = (after.events ?? []).filter((e) => / 01 launched /.test(e));
    assert("detached dispatch exits 0 with a live upstream pid", r.status === 0);
    assert(
      "detached dispatch does not abandon dependents of a live node",
      after.sessions["02"].status === "pending" && after.sessions["02"].reason == null,
    );
    assert("detached dispatch keeps the live session running", after.sessions["01"].status === "running");
    assert("detached dispatch does not relaunch a still-live pid", after.sessions["01"].attempts === 1);
    assert("detached dispatch does not record a second launch", launchEvents.length === 1);
  } finally {
    try { process.kill(sleeper.pid, "SIGTERM"); } catch {}
  }
}

{
  const dir = makeRun({
    status: "pending",
    resultBody: CONTRACT_RESULT,
    extraSessions: { "02": { status: "pending", attempts: 0, deps: ["01"] } },
  });
  const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  state.sessions["01"].parent_correction = {
    previous_status: "abandoned",
    status: "pending",
    ts: "2026-09-21T12:30:35.000Z",
  };
  writeFileSync(join(dir, "state.json"), JSON.stringify(state, null, 2) + "\n");
  const routing = JSON.parse(readFileSync(join(dir, "routing.json"), "utf8"));
  routing.mode = "compact";
  writeFileSync(join(dir, "routing.json"), JSON.stringify(routing, null, 2) + "\n");
  const r = run("dispatch", dir, ["--budget", "1"]);
  const after = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  assert("durable result dispatch exits 0", r.status === 0);
  assert("durable result unlocks the finished session", after.sessions["01"].status === "done");
  assert(
    "durable result does not abandon the dependent",
    after.sessions["02"].status !== "abandoned",
  );
}

{
  const pDir = mkdtempSync(join(tmpdir(), "handoff-merge-pending-"));
  const disk = {
    sessions: {
      "01": {
        status: "pending",
        pid: 4242,
        parent_correction: {
          previous_status: "abandoned",
          status: "pending",
          ts: "2026-09-21T12:30:35.000Z",
        },
      },
    },
    events: [],
    empty_slots: [],
  };
  writeFileSync(join(pDir, "state.json"), JSON.stringify(disk, null, 2) + "\n");
  const mem = {
    sessions: {
      "01": { status: "running", pid: 4242, attempts: 1, started_at: "2026-09-21T12:30:43.000Z" },
    },
    events: [],
    empty_slots: [],
  };
  mergeStateFromDisk(pDir, mem);
  assert(
    "merge: pending parent_correction does not clobber a later running launch",
    mem.sessions["01"].status === "running" && mem.sessions["01"].parent_correction?.status === "pending",
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
  assert("route error message explains sandbox capability violation", /does not satisfy required capabilities/.test(r.stderr));
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

// Issue 18: Digest result block parsing (ok/missing/malformed)
{
  const okParsed = parseResultDigest(CONTRACT_RESULT, true);
  assert("digest parser handles valid CONTRACT_RESULT", okParsed.ok === true && okParsed.status === "done" && okParsed.remaining === "none" && okParsed.paths.length === 1 && okParsed.summary === "finished");

  const missingParsed = parseResultDigest(null, false);
  assert("digest parser handles missing result.md", missingParsed.ok === false && missingParsed.missing === true);

  const malformedParsed = parseResultDigest("Not a valid result\nNo status line here", true);
  assert("digest parser handles malformed result.md", malformedParsed.ok === false && malformedParsed.malformed === true);

  const multiFileResult = `# Result 02
- status: done
- files changed:
  - a.txt — first
  - b.txt — second
  - c.txt — third
  - d.txt — fourth
- remaining: none
- summary: ` + "A".repeat(400);

  const multiParsed = parseResultDigest(multiFileResult, true);
  assert("digest parser extracts multiple files and truncates summary to 300 chars", multiParsed.ok === true && multiParsed.paths.length === 4 && multiParsed.summary.length === 300);

  const session = { id: "02", slot: "cursor", lane: "cursor-models", model: "claude-opus-4-8", effort: "high" };
  const st = { status: "done", slot: "cursor", lane: "cursor-models", model: "claude-opus-4-8", started_at: "2026-09-18T10:00:00.000Z", ended_at: "2026-09-18T10:00:45.000Z" };
  const formattedOk = formatResultDigestBlock(session, st, multiParsed);
  assert("digest block formats ok with multiple files (+k) and header", /02 done · cursor\/cursor-models · claude-opus-4-8 high · 45s/.test(formattedOk) && /changed: 4 files \(a\.txt, b\.txt, c\.txt, \+1\)/.test(formattedOk) && /remaining: none/.test(formattedOk));

  const formattedMissing = formatResultDigestBlock(session, { status: "failed" }, missingParsed);
  assert("digest block explicitly states result.md missing", /result\.md missing/.test(formattedMissing));

  const formattedMalformed = formatResultDigestBlock(session, { status: "failed" }, malformedParsed);
  assert("digest block explicitly states result.md malformed", /result\.md malformed/.test(formattedMalformed));

  // Verify renderStatus integration via status command
  const runDir = makeRun({ status: "running", resultBody: CONTRACT_RESULT });
  const statusRes = run("status", runDir);
  assert("status stdout contains digest result block", statusRes.status === 0 && /remaining:\s*none/.test(statusRes.stdout) && /changed:\s*1 file/.test(statusRes.stdout) && /summary:\s*finished/.test(statusRes.stdout));
}

// Issue 18: Settle coalescing decision function
{
  const t0 = 1726668000000; // fixed timestamp
  const stateNoFail = { sessions: { "01": { status: "running" }, "02": { status: "pending" } } };
  const resNoFail = evaluateSettle({ state: stateNoFail, settleDeadline: null, settleS: 30, now: t0 });
  assert("settle window inactive when no failed/blocked sessions", resNoFail.active === false && resNoFail.shouldExit === false && resNoFail.settleDeadline === null);

  const stateOneFail = { sessions: { "01": { status: "failed" }, "02": { status: "running" } } };
  const resFirstFail = evaluateSettle({ state: stateOneFail, settleDeadline: null, settleS: 30, now: t0 });
  assert("settle window starts on first failure without immediate exit", resFirstFail.active === true && resFirstFail.shouldExit === false && resFirstFail.settleDeadline === t0 + 30000);

  // 10s later, another session finishes as blocked (coalescing)
  const stateTwoFail = { sessions: { "01": { status: "failed" }, "02": { status: "blocked" } } };
  const resCoalesce = evaluateSettle({ state: stateTwoFail, settleDeadline: resFirstFail.settleDeadline, settleS: 30, now: t0 + 10000 });
  assert("settle window coalesces subsequent failures and keeps waiting", resCoalesce.active === true && resCoalesce.shouldExit === false && resCoalesce.settleDeadline === t0 + 30000);

  // 30s elapsed: settle window expires
  const resExpired = evaluateSettle({ state: stateTwoFail, settleDeadline: resFirstFail.settleDeadline, settleS: 30, now: t0 + 30000 });
  assert("settle window returns early once duration expires", resExpired.active === true && resExpired.shouldExit === true);
}

// Issue 19: Effort args per provider and cursor parameter handling
{
  const tmpPrompt = join(tmpdir(), "handoff-test-prompt.md");
  writeFileSync(tmpPrompt, "execute brief");

  // Claude: --effort <e>
  const [, claudeArgs] = launchArgs({ provider: "claude", bin: "claude", tier: "design" }, tmpPrompt, "/tmp");
  assert("claude launch args include --effort high for design tier", claudeArgs.includes("--effort") && claudeArgs[claudeArgs.indexOf("--effort") + 1] === "high");

  // Codex: -c model_reasoning_effort=<e>
  const [, codexArgs] = launchArgs({ provider: "codex", bin: "codex", tier: "mechanical" }, tmpPrompt, "/tmp");
  assert("codex launch args include -c model_reasoning_effort=low for mechanical tier", codexArgs.includes("-c") && codexArgs[codexArgs.indexOf("-c") + 1] === "model_reasoning_effort=low");

  // Antigravity: --effort <e>
  const [, agyArgs] = launchArgs({ provider: "antigravity", bin: "agy", tier: "review" }, tmpPrompt, "/tmp");
  assert("antigravity launch args include --effort medium for review tier", agyArgs.includes("--effort") && agyArgs[agyArgs.indexOf("--effort") + 1] === "medium");

  // Cursor: model bracket override only when model accepts it
  assert("cursorModelWithEffort appends [effort=high] to parameterized model", cursorModelWithEffort("claude-opus-4-8", "high") === "claude-opus-4-8[effort=high]");
  assert("cursorModelWithEffort leaves fixed-effort models unchanged", cursorModelWithEffort("gemini-3.8-flash-high", "high") === "gemini-3.8-flash-high");
  assert("cursorModelWithEffort merges effort into existing bracketed model", cursorModelWithEffort("claude-opus-4-8[context=1m]", "medium") === "claude-opus-4-8[context=1m,effort=medium]");
  assert("cursorModelWithEffort preserves existing effort in bracketed model", cursorModelWithEffort("claude-opus-4-8[effort=low]", "high") === "claude-opus-4-8[effort=low]");

  const [, cursorParamArgs] = launchArgs({ provider: "cursor", bin: "cursor-agent", model: "claude-opus-4-8", effort: "high" }, tmpPrompt, "/tmp");
  assert("cursor launch args format parameterized model with effort", cursorParamArgs.includes("--model") && cursorParamArgs[cursorParamArgs.indexOf("--model") + 1] === "claude-opus-4-8[effort=high]");

  const [, cursorFixedArgs] = launchArgs({ provider: "cursor", bin: "cursor-agent", model: "claude-sonnet-5-low", effort: "high" }, tmpPrompt, "/tmp");
  assert("cursor launch args keep fixed model without effort override", cursorFixedArgs.includes("--model") && cursorFixedArgs[cursorFixedArgs.indexOf("--model") + 1] === "claude-sonnet-5-low");
}

// Issue 19: Override marks and effort in routing table
{
  const renderedOverridden = renderModel({ model: "claude-3-5-sonnet", effort: "high", override: true });
  assert("renderModel includes effort and ✎ for overridden session", renderedOverridden === "claude-3-5-sonnet high ✎");

  const renderedDerived = renderModel({ model: "claude-3-5-sonnet", effort: "low", override: false });
  assert("renderModel includes effort without ✎ for derived session", renderedDerived === "claude-3-5-sonnet low");

  // Integration: route with explicit model/effort marks ✎ in routing table
  const dirOverride = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      sessions: [
        { id: "01", goal: "override task", effort: "high", writes: ["a.txt"], deps: [] },
      ],
    },
  });
  const resOverride = run("route", dirOverride);
  assert("route output contains ✎ override mark when effort is set in plan", resOverride.status === 0 && resOverride.stdout.includes("✎"));
  const routingData = JSON.parse(readFileSync(join(dirOverride, "routing.json"), "utf8"));
  assert("routing.json records override: true and effort on session", routingData.sessions[0].override === true && routingData.sessions[0].effort === "high");

  // Integration: route without override does not contain ✎
  const dirNoOverride = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      sessions: [
        { id: "01", goal: "default task", writes: ["a.txt"], deps: [] },
      ],
    },
  });
  const resNoOverride = run("route", dirNoOverride);
  assert("route output does not contain ✎ when no override in plan", resNoOverride.status === 0 && !resNoOverride.stdout.includes("✎"));

  const dirXhigh = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      sessions: [
        { id: "01", goal: "xhigh task", effort: "xhigh", tier: "design", size: "s", writes: ["a.txt"], deps: [] },
      ],
    },
  });
  const resXhigh = run("route", dirXhigh);
  const routingXhigh = existsSync(join(dirXhigh, "routing.json"))
    ? JSON.parse(readFileSync(join(dirXhigh, "routing.json"), "utf8"))
    : null;
  assert(
    "routing.json preserves explicit xhigh instead of collapsing it",
    resXhigh.status === 0 && routingXhigh?.sessions?.[0]?.effort === "xhigh",
  );
}

// Issue 19: Model validation against CLI model list
{
  const mockBinDir = mkdtempSync(join(tmpdir(), "handoff-mock-bin-"));
  const mockBin = join(mockBinDir, "mock-agy.sh");
  writeFileSync(
    mockBin,
    `#!/bin/sh\necho "gemini-3.8-flash-high"\necho "gemini-3.8-flash-low"\n`,
    { mode: 0o755 },
  );

  const quota = {
    ts: new Date().toISOString(),
    slots: [
      {
        key: "antigravity",
        provider: "antigravity",
        account: "default",
        installed: true,
        bin: mockBin,
        remaining_pct: 80,
        bucket: "ok",
        windows: [{ name: "5h", remaining_pct: 80, resets_at: null, window_secs: 18000 }],
        source: "agy-test",
      },
    ],
  };

  // 1. Invalid model fails with valid ids listed in stderr
  const dirInvalidModel = makeRouteRun({
    quota,
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      sessions: [
        { id: "01", goal: "task", model: "invalid-model-xyz", writes: ["a.txt"], deps: [] },
      ],
    },
  });
  const resInvalid = run("route", dirInvalidModel);
  assert("route fails when explicit model is not in CLI model list", resInvalid.status !== 0);
  assert("route error message lists valid models", /Valid models:.*gemini-3\.8-flash-high/.test(resInvalid.stderr));

  // 2. Valid model succeeds
  const dirValidModel = makeRouteRun({
    quota,
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      sessions: [
        { id: "01", goal: "task", model: "gemini-3.8-flash-high", writes: ["a.txt"], deps: [] },
      ],
    },
  });
  const resValid = run("route", dirValidModel);
  assert("route succeeds when explicit model is in CLI model list", resValid.status === 0);
}

// Issue 19: Hash lock (accept/refuse)
{
  const pMulti = {
    mode: "fan-out",
    horizon_s: 7200,
    sessions: [
      { id: "01", goal: "task 1", writes: ["a.txt"], deps: [] },
      { id: "02", goal: "task 2", writes: ["b.txt"], deps: [] },
    ],
  };

  // 1. Multi-session plan without --approve: dispatch refused
  const dirNoApprove = makeRouteRun({ plan: pMulti });
  const rRouteNoApprove = run("route", dirNoApprove);
  assert("route without --approve succeeds", rRouteNoApprove.status === 0);
  assert("route without --approve does not write approved.json", !existsSync(join(dirNoApprove, "approved.json")));
  const rDispatchRefuse = run("dispatch", dirNoApprove, ["--budget", "1"]);
  assert("dispatch refuses multi-session plan when approved.json is missing", rDispatchRefuse.status !== 0 && /approved\.json is missing/.test(rDispatchRefuse.stderr));

  // 2. Multi-session plan with route --approve: dispatch accepted
  const dirApprove = makeRouteRun({ plan: pMulti });
  const rRouteApprove = run("route", dirApprove, ["--approve"]);
  assert("route --approve succeeds and writes approved.json", rRouteApprove.status === 0 && existsSync(join(dirApprove, "approved.json")));
  const approvedData = JSON.parse(readFileSync(join(dirApprove, "approved.json"), "utf8"));
  assert("approved.json contains sha256 hash and ts", approvedData.hash === hashSessions(pMulti.sessions) && approvedData.ts);

  // Provide prompt files so dispatch can advance
  writeFileSync(join(dirApprove, "sessions", "01.prompt.md"), "prompt 01");
  writeFileSync(join(dirApprove, "sessions", "02.prompt.md"), "prompt 02");
  const rDispatchAccepted = run("dispatch", dirApprove, ["--budget", "1"]);
  assert("dispatch accepts multi-session plan with matching approved.json hash", rDispatchAccepted.status === 0);

  // 2b. A slot whose CLI is not installed must not kill the dispatcher.
  // `spawn` reports a missing binary as an async `error` event, never as a
  // throw, so before the handler existed an absent CLI crashed the whole run
  // and abandoned every other session. It is an ordinary launch failure.
  const absentBin = "handoff-test-absent-binary";
  const dirAbsent = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      sessions: [{ id: "01", goal: "solo task", writes: ["a.txt"], deps: [] }],
    },
    quota: {
      ts: new Date().toISOString(),
      slots: [
        {
          key: "codex",
          provider: "codex",
          account: "default",
          installed: true,
          bin: absentBin,
          remaining_pct: 80,
          bucket: "ok",
          windows: [{ name: "5h", remaining_pct: 80, resets_at: null, window_secs: 18000 }],
          source: "codex-test",
        },
      ],
    },
  });
  assert("route succeeds with an absent binary on the only slot", run("route", dirAbsent).status === 0);
  writeFileSync(join(dirAbsent, "sessions", "01.prompt.md"), "prompt 01");
  const rAbsent = run("dispatch", dirAbsent, ["--budget", "6"]);
  assert("dispatch survives a slot whose binary is missing", rAbsent.status === 0);
  const absentState = JSON.parse(readFileSync(join(dirAbsent, "state.json"), "utf8"));
  assert(
    "the session is blocked, not left running",
    absentState.sessions["01"].status === "blocked",
  );
  // P26: a guard prints the evidence it acted on. "exited with code -1" would
  // hide that the CLI is simply not on PATH.
  assert(
    "the event names the binary and the errno",
    absentState.events.some((e) => e.includes(`could not launch ${absentBin}`) && e.includes("ENOENT")),
  );

  // 3. Plan modified after approval: dispatch refused with hash mismatch
  const pModified = {
    ...pMulti,
    sessions: [
      { id: "01", goal: "task 1 MODIFIED", writes: ["a.txt"], deps: [] },
      { id: "02", goal: "task 2", writes: ["b.txt"], deps: [] },
    ],
  };
  writeFileSync(join(dirApprove, "plan.json"), JSON.stringify(pModified, null, 2));
  const rDispatchMismatch = run("dispatch", dirApprove, ["--budget", "1"]);
  assert("dispatch refuses when plan.json modified after approval", rDispatchMismatch.status !== 0 && /hash mismatch/.test(rDispatchMismatch.stderr));

  // 4. Compact mode (single session) is exempt from approved.json requirement
  const pSingle = {
    mode: "fan-out",
    horizon_s: 7200,
    sessions: [
      { id: "01", goal: "solo task", writes: ["a.txt"], deps: [] },
    ],
  };
  const dirSingle = makeRouteRun({ plan: pSingle });
  run("route", dirSingle);
  writeFileSync(join(dirSingle, "sessions", "01.prompt.md"), "prompt 01");
  const rDispatchSingle = run("dispatch", dirSingle, ["--budget", "1"]);
  assert("dispatch exempts single-session plan from approved.json requirement", rDispatchSingle.status === 0);
}

// Issue 19: Non-causal dep warning fixtures
{
  // Fixture A: independent sessions (no warning, both launch in first wave)
  const fixtureA = [
    { id: "01", writes: ["src/a.ts"], deps: [] },
    { id: "02", writes: ["src/b.ts"], deps: [] },
  ];
  assert("fixture A has no non-causal dep warnings", nonCausalDeps(fixtureA).length === 0);
  const dirA = makeRouteRun({ plan: { mode: "fan-out", horizon_s: 7200, sessions: fixtureA } });
  const rA = run("route", dirA);
  assert("route fixture A prints no non-causal warning", rA.status === 0 && !/non-causal/.test(rA.stderr + rA.stdout));
  const routingA = JSON.parse(readFileSync(join(dirA, "routing.json"), "utf8"));
  assert("fixture A has both sessions runnable in first wave", routingA.sessions.every((s) => !s.deps || s.deps.length === 0));

  // Fixture B: causal chain A writes x, B reads x (no warning, order kept)
  const fixtureB = [
    { id: "01", writes: ["src/x.ts"], deps: [] },
    { id: "02", reads: ["src/x.ts"], writes: ["src/y.ts"], deps: ["01"] },
  ];
  assert("fixture B has no non-causal dep warnings", nonCausalDeps(fixtureB).length === 0);
  const dirB = makeRouteRun({ plan: { mode: "fan-out", horizon_s: 7200, sessions: fixtureB } });
  const rB = run("route", dirB);
  assert("route fixture B prints no non-causal warning", rB.status === 0 && !/non-causal/.test(rB.stderr + rB.stdout));
  const routingB = JSON.parse(readFileSync(join(dirB, "routing.json"), "utf8"));
  assert("fixture B preserves causal order (02 depends on 01)", routingB.sessions.find((s) => s.id === "02").deps.includes("01"));

  // Fixture C: non-causal dep edge A writes a, B reads b (warns naming edge 01→02)
  const fixtureC = [
    { id: "01", writes: ["src/a.ts"], deps: [] },
    { id: "02", reads: ["src/b.ts"], writes: ["src/c.ts"], deps: ["01"] },
  ];
  const warningsC = nonCausalDeps(fixtureC);
  assert("fixture C detects non-causal edge 01→02", warningsC.length === 1 && warningsC[0].edge === "01→02");
  const dirC = makeRouteRun({ plan: { mode: "fan-out", horizon_s: 7200, sessions: fixtureC } });
  const rC = run("route", dirC);
  assert("route fixture C prints warning naming edge 01→02", rC.status === 0 && /warning: non-causal dependency edge 01→02/.test(rC.stderr));

  // Wildcard ** overlaps everything: no warning
  const fixtureWildcard = [
    { id: "01", writes: ["**"], deps: [] },
    { id: "02", reads: ["src/b.ts"], writes: ["src/c.ts"], deps: ["01"] },
  ];
  assert("wildcard ** overlaps everything, no warning", nonCausalDeps(fixtureWildcard).length === 0);
}

// Issue 18 & 19: Metrics fields in score
{
  const dirScore = mkdtempSync(join(tmpdir(), "handoff-score-"));
  mkdirSync(join(dirScore, "sessions"));
  writeFileSync(
    join(dirScore, "routing.json"),
    JSON.stringify({
      mode: "fan-out",
      horizon_s: 7200,
      sessions: [
        { id: "01", slot: "antigravity", effort: "high", override: true, tier: "design" },
        { id: "02", slot: "antigravity", effort: "low", override: false, tier: "mechanical" },
      ],
    }),
  );
  writeFileSync(
    join(dirScore, "quota.json"),
    JSON.stringify({ ts: new Date().toISOString(), slots: [] }),
  );
  writeFileSync(
    join(dirScore, "state.json"),
    JSON.stringify({
      started_at: new Date().toISOString(),
      parent_turns: 1,
      settle_s: 45,
      sessions: {
        "01": { status: "done", attempts: 1, slot: "antigravity" },
        "02": { status: "done", attempts: 1, slot: "antigravity" },
      },
      empty_slots: [],
      events: [],
    }),
  );

  const rScore = run("score", dirScore);
  assert("score command exits 0", rScore.status === 0);

  const metricsPath = join(tmpdir(), "handoff", "metrics.jsonl");
  assert("metrics.jsonl exists", existsSync(metricsPath));
  const metricsLines = readFileSync(metricsPath, "utf8").trim().split("\n");
  const lastMetrics = JSON.parse(metricsLines[metricsLines.length - 1]);

  assert("metrics records skill: 'handoff'", lastMetrics.skill === "handoff");
  assert("metrics records settle_s from state", lastMetrics.settle_s === 45);
  assert("metrics records sessions array", Array.isArray(lastMetrics.sessions) && lastMetrics.sessions.length === 2);
  assert(
    "session 01 has effort and override",
    lastMetrics.sessions[0].id === "01" &&
      lastMetrics.sessions[0].effort === "high" &&
      lastMetrics.sessions[0].override === true,
  );
  assert(
    "session 02 has effort and override",
    lastMetrics.sessions[1].id === "02" &&
      lastMetrics.sessions[1].effort === "low" &&
      lastMetrics.sessions[1].override === false,
  );

  rmSync(dirScore, { recursive: true, force: true });
}

// Issue 18 & 19: Clean command
{
  // 1. Refuses when a worktree has uncommitted changes
  const dirDirty = mkdtempSync(join(tmpdir(), "handoff-clean-dirty-"));
  const branchDirty = `handoff-test-dirty-${Date.now()}`;
  const wtDirty = join(dirDirty, "wt", "01");
  mkdirSync(join(dirDirty, "wt"), { recursive: true });

  const rAddDirty = spawnSync("git", ["worktree", "add", "-b", branchDirty, wtDirty, "HEAD"], {
    encoding: "utf8",
  });
  assert("git worktree add for dirty test succeeds", rAddDirty.status === 0);

  // Create an uncommitted file in the worktree
  writeFileSync(join(wtDirty, "dirty.txt"), "uncommitted work");

  const rCleanDirty = run("clean", dirDirty);
  assert("clean command refuses when worktree has uncommitted changes", rCleanDirty.status !== 0);
  assert("clean stderr notes uncommitted changes", /uncommitted changes/.test(rCleanDirty.stderr));
  assert("run directory not deleted when clean is refused", existsSync(dirDirty));
  assert("worktree not deleted when clean is refused", existsSync(wtDirty));

  // Clean up the dirty worktree so we can remove it
  spawnSync("git", ["clean", "-fd"], { cwd: wtDirty, encoding: "utf8" });
  spawnSync("git", ["worktree", "remove", "--force", wtDirty], { encoding: "utf8" });
  spawnSync("git", ["branch", "-D", branchDirty], { encoding: "utf8" });
  rmSync(dirDirty, { recursive: true, force: true });

  // 2. Removes clean worktrees and run dir, never deletes branches
  const dirClean = mkdtempSync(join(tmpdir(), "handoff-clean-ok-"));
  const branchClean = `handoff-test-clean-${Date.now()}`;
  const wtClean = join(dirClean, "wt", "01");
  mkdirSync(join(dirClean, "wt"), { recursive: true });

  const rAddClean = spawnSync("git", ["worktree", "add", "-b", branchClean, wtClean, "HEAD"], {
    encoding: "utf8",
  });
  assert("git worktree add for clean test succeeds", rAddClean.status === 0);

  const rCleanOk = run("clean", dirClean);
  assert("clean command exits 0 for clean worktree", rCleanOk.status === 0);
  assert("run directory is deleted", !existsSync(dirClean));

  // Verify the git branch still exists
  const branchCheck = spawnSync("git", ["branch", "--list", branchClean], { encoding: "utf8" });
  assert("git branch was NOT deleted by clean", branchCheck.stdout.includes(branchClean));

  // Clean up the test branch
  spawnSync("git", ["branch", "-D", branchClean], { encoding: "utf8" });
}

// clean --branches: deletes this run's session branches merged into HEAD, keeps unmerged ones
{
  const runId = `20990101T000000Z-${Date.now()}`;
  const dir = join(mkdtempSync(join(tmpdir(), "handoff-clean-br-")), runId);
  mkdirSync(join(dir, "wt"), { recursive: true });
  const merged = `handoff/${runId}-01`;
  const unmerged = `handoff/${runId}-02`;
  const other = `handoff/other-${runId}-01`;
  spawnSync("git", ["branch", merged, "HEAD"], { encoding: "utf8" });
  spawnSync("git", ["branch", other, "HEAD"], { encoding: "utf8" });
  const wt2 = join(dir, "wt", "02");
  spawnSync("git", ["worktree", "add", "-b", unmerged, wt2, "HEAD"], { encoding: "utf8" });
  writeFileSync(join(wt2, "only-here.txt"), "x");
  spawnSync("git", ["add", "."], { cwd: wt2 });
  spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "wip"], { cwd: wt2 });

  const r = run("clean", dir, ["--branches"]);
  const has = (b) => spawnSync("git", ["branch", "--list", b], { encoding: "utf8" }).stdout.includes(b);
  assert("clean --branches exits 0", r.status === 0);
  assert("clean --branches deletes a merged session branch", !has(merged));
  assert("clean --branches keeps an unmerged session branch", has(unmerged));
  assert("clean --branches names the kept branch", /kept \(not merged into HEAD\)/.test(r.stdout));
  assert("clean --branches ignores other runs' branches", has(other));

  spawnSync("git", ["branch", "-D", unmerged, other], { encoding: "utf8" });
}


// ------------------------------------------------------------------ rtk
{
  // The shared bridge must not drift between the two skills.
  const shuntCopy = join(here, "..", "..", "shunt", "scripts", "rtk.mjs");
  if (existsSync(shuntCopy)) {
    assert("rtk.mjs is identical in shunt and handoff", readFileSync(shuntCopy, "utf8") === readFileSync(join(here, "rtk.mjs"), "utf8"));
  }

  const bin = mkdtempSync(join(tmpdir(), "fake-rtk-"));
  writeFileSync(
    join(bin, "rtk"),
    `#!/bin/sh
case "$1" in
  --version) echo "rtk 9.9.9" ;;
  rewrite) [ "$2" = "cargo test" ] && { echo "rtk cargo test"; exit 3; }; exit 1 ;;
esac
`,
  );
  chmodSync(join(bin, "rtk"), 0o755);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };

  assert("rtk: session value wins over the plan", rtkFor({ rtk: "full" }, { rtk: "off" }, "claude").mode === "off");
  assert("rtk: claude child gets the hook", rtkFor({ rtk: "guarded" }, {}, "claude").via === "hook");
  assert("rtk: hookless child gets the prompt", rtkFor({ rtk: "guarded" }, {}, "codex").via === "prompt");
  assert("rtk: absent means off", rtkFor({}, {}, "claude").mode === "off");

  const sessions = [{ id: "01", goal: "g" }];
  assert("hashPlan: a plan without rtk hashes like before", hashPlan({ sessions }) === hashSessions(sessions));
  assert("hashPlan: plan-level rtk changes the hash", hashPlan({ sessions, rtk: "guarded" }) !== hashPlan({ sessions }));

  const prompt = join(bin, "p.md");
  writeFileSync(prompt, "execute brief");
  const events = join(bin, "01.rtk.jsonl");
  const [, cArgs] = launchArgs(
    { provider: "claude", bin: "claude", tier: "design", rtk: { mode: "guarded", via: "hook" }, rtk_events: events },
    prompt,
    "/tmp",
  );
  const settings = JSON.parse(cArgs[cArgs.indexOf("--settings") + 1]);
  const hookCmd = settings.hooks.PreToolUse[0].hooks[0].command;
  assert("rtk launch: claude child gets a Bash-only scoped hook", settings.hooks.PreToolUse[0].matcher === "Bash" && /rtk-hook\.mjs" guarded /.test(hookCmd));
  assert("rtk launch: claude prompt is untouched", cArgs[cArgs.length - 1] === "execute brief");
  const [, xArgs] = launchArgs({ provider: "codex", bin: "codex", tier: "mechanical", rtk: { mode: "guarded", via: "prompt" } }, prompt, "/tmp");
  const xPrompt = xArgs[xArgs.length - 1];
  assert("rtk launch: hookless child gets the guarded instruction", xPrompt.startsWith("execute brief") && /Never prefix `git diff`/.test(xPrompt));
  const [, oArgs] = launchArgs({ provider: "codex", bin: "codex", tier: "mechanical" }, prompt, "/tmp");
  assert("rtk launch: off leaves the prompt alone", oArgs[oArgs.length - 1] === "execute brief" && !oArgs.includes("--settings"));

  // The scoped hook itself, driven like Claude drives it.
  const hook = join(here, "rtk-hook.mjs");
  const call = (command) =>
    spawnSync(process.execPath, [hook, "guarded", events], {
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command, description: "d" } }),
      encoding: "utf8",
      env,
    }).stdout;
  const hk = JSON.parse(call("cargo test") || "{}").hookSpecificOutput;
  assert("rtk hook: rewrites and keeps other input fields", hk?.updatedInput?.command === "rtk cargo test" && hk.updatedInput.description === "d");
  assert("rtk hook: leaves permission to the child", hk && !("permissionDecision" in hk));
  assert("rtk hook: git diff runs raw", call("git diff") === "");
  assert("rtk hook: recall runs raw", call("rtk recall ab") === "");
  const counted = sessionRtk({ rtk: { mode: "guarded", via: "hook" }, rtk_events: events, isolation: "wt/01" }, {});
  assert("rtk score: counts rewrites and recalls from the hook log", counted.rewrites === 1 && counted.recalls === 1);
  const promptOnly = sessionRtk({ rtk: { mode: "guarded", via: "prompt" }, isolation: "wt/02" }, {});
  assert("rtk score: prompt-mode recalls are unknown, not zero", promptOnly.recalls === null);

  // route: plan-level rtk resolves per provider; a bad mode is refused.
  const d = makeRouteRun({
    plan: { mode: "fan-out", horizon_s: 7200, rtk: "guarded", sessions: [
      { id: "01", goal: "a", tier: "mechanical", size: "s", writes: ["a.txt"], deps: [], provider: "claude" },
      { id: "02", goal: "b", tier: "mechanical", size: "s", writes: ["b.txt"], deps: [], provider: "codex", rtk: "full" },
    ] },
  });
  const r = run("route", d, [], env);
  const routing = existsSync(join(d, "routing.json")) ? JSON.parse(readFileSync(join(d, "routing.json"), "utf8")) : null;
  const by = Object.fromEntries((routing?.sessions ?? []).map((s) => [s.id, s.rtk]));
  assert("rtk route: accepted with rtk on PATH", r.status === 0 && /\| RTK \|/.test(r.stdout));
  assert("rtk route: claude session is guarded/hook", by["01"]?.mode === "guarded" && by["01"]?.via === "hook");
  assert("rtk route: codex session override is full/prompt", by["02"]?.mode === "full" && by["02"]?.via === "prompt");
  const plain = makeRouteRun();
  const rp = run("route", plain, [], env);
  assert("rtk route: a plan without rtk gets the recommendation", rp.status === 0 && /tip: rtk 9\.9\.9 is installed/.test(rp.stdout));
  const rq = run("route", plain, [], { ...process.env, PATH: `${dirname(process.execPath)}:/usr/bin:/bin` });
  assert("rtk route: no tip without rtk on PATH", !/tip: rtk/.test(rq.stdout));
  const bad = makeRouteRun({ plan: { mode: "fan-out", rtk: "loud", sessions: [{ id: "01", goal: "a", tier: "mechanical", size: "s", writes: ["a"], deps: [] }] } });
  const rb = run("route", bad, [], env);
  assert("rtk route: unknown mode is refused", rb.status !== 0 && /rtk mode must be one of/.test(rb.stderr));
}

// ------------------------------------------------------------------ s1 byte-drift
{
  const shuntS1 = join(here, "..", "..", "shunt", "scripts", "s1.mjs");
  if (existsSync(shuntS1)) {
    assert(
      "s1.mjs is identical in shunt and handoff",
      readFileSync(shuntS1, "utf8") === readFileSync(join(here, "s1.mjs"), "utf8"),
    );
  }
}

// ------------------------------------------------------------------ s1 backend-swap & fail-open
{
  assert("s1: default backend is rules", getBackend()?.name === "rules");

  const customBackend = {
    name: "custom-mock",
    decide({ kind, options }) {
      if (kind === "choice") return { index: 1, p: 0.85, dist: [0.15, 0.85, 0] };
      if (kind === "score") return { index: 0, p: 0.9, dist: [0.9, 0.1, 0, 0] };
      if (kind === "noul") return { index: 1, p: 0.75, dist: [0.25, 0.75] };
      return null;
    },
  };

  setBackend(customBackend);
  assert("s1: backend was swapped", getBackend()?.name === "custom-mock");

  const ch = choice({ tier: "mechanical" }, EFFORTS);
  assert("s1 custom choice uses custom backend", ch.label === "medium" && ch.p === 0.85);

  const perCall = choice({ tier: "design" }, EFFORTS, { backend: rules });
  assert("s1 per-call backend override works", perCall.label === "high" && perCall.p === 1);

  const buggyBackend = {
    name: "buggy",
    decide() {
      throw new Error("crash");
    },
  };
  setBackend(buggyBackend);
  const rescued = choice({ tier: "design" }, EFFORTS);
  assert("s1 backend error fails open to rules floor", rescued.label === "high");

  setBackend(rules);
  assert("s1: reset backend to rules", getBackend()?.name === "rules");
}

// ------------------------------------------------------------------ s1 redaction
{
  assert("redact: api key is redacted", redact("my key AKIAIOSFODNN7EXAMPLE is secret") === "my key <redacted> is secret");
  assert("redact: ghp token is redacted", redact("ghp_123456789012345678901234567890") === "<redacted>");
  assert("redact: bearer token is redacted", redact("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMC6Y9JaGQFsWiHGuxZKZ0WjwtDA") === "<redacted>");
  assert("redact: email is redacted", redact("contact me@example.invalid now") === "contact <redacted> now");
  assert("redact: phone is redacted", redact("call 555-123-4567 today") === "call <redacted> today");
  assert("redact: absolute path is redacted", redact("look in /Users/someone/secret.env file") === "look in <path> file");
  assert("redact: sensitive key in object is redacted", redact({ apiKey: "secret123", normal: "ok" }).apiKey === "<redacted>");
  assert("redact: sensitive key password is redacted", redact({ password: "pass", normal: "ok" }).password === "<redacted>");

  const runId = "test-redact-run";
  choice("contact dev@example.invalid with token: ghp_123456789012345678901234567890 at /Users/john/repo", EFFORTS, {
    site: "effort",
    run: runId,
  });
  const records = readDecisions(runId);
  assert("shadow log writes record for run", records.length >= 1);
  const rec = records[records.length - 1];
  assert("shadow log context redacts email", !rec.context.includes("dev@example.invalid"));
  assert("shadow log context redacts secret token", !rec.context.includes("ghp_123456789012345678901234567890"));
  assert("shadow log context redacts absolute path", !rec.context.includes("/Users/john/repo"));
  assert("shadow log has outcome.unresolved true", rec.outcome?.unresolved === true);
}

// ------------------------------------------------------------------ s1 resolution
{
  const testRun = `res-test-${Date.now()}`;
  choice({ session: "01", tier: "mechanical" }, EFFORTS, { site: "effort", run: testRun, session: "01" });
  choice({ session: "02", tier: "design" }, EFFORTS, { site: "effort", run: testRun, session: "02" });

  const unres = readDecisions(testRun);
  assert("resolution: 2 records initially written", unres.length === 2);
  assert("resolution: initial records are unresolved", unres.every((r) => r.outcome?.unresolved === true && r.resolved_at === null));

  const summary = resolveDecisions(testRun, (row) => {
    if (row.session === "01") return { observed: "done", status: "done" };
    return { unresolved: true };
  });

  assert("resolution: summary reports 2 total", summary.total === 2);
  assert("resolution: summary reports 1 resolved", summary.resolved === 1);
  assert("resolution: summary reports 1 unresolved", summary.unresolved === 1);
  assert("resolution: summary by_site effort total 2", summary.by_site.effort?.total === 2);
  assert("resolution: summary by_site effort resolved 1", summary.by_site.effort?.resolved === 1);
  assert("resolution: summary by_site effort unresolved 1", summary.by_site.effort?.unresolved === 1);

  const after = readDecisions(testRun);
  const r01 = after.find((r) => r.session === "01");
  const r02 = after.find((r) => r.session === "02");
  assert("resolved row has observed done", r01.outcome?.observed === "done");
  assert("resolved row has resolved_at timestamp", typeof r01.resolved_at === "string" && r01.resolved_at.length > 0);
  assert("unresolved row stays unresolved", r02.outcome?.unresolved === true && r02.resolved_at === null);
}

// ------------------------------------------------------------------ ledger & parent_turns_by_cause
{
  const stateEmpty = { parent_turns: 3, empty_slots: ["claude", "cursor"], events: [] };
  const ledger1 = buildParentTurnsByCause(stateEmpty);
  assert("ledger: dead_slot matches empty_slots count", ledger1.dead_slot === 2);
  assert("ledger: other gets remaining parent_turns", ledger1.other === 1);
  assert("ledger: env_precondition defaults to 0", ledger1.env_precondition === 0);

  const stateExplicit = {
    parent_turns: 5,
    empty_slots: ["claude"],
    parent_turns_by_cause: {
      env_precondition: 2,
      dead_slot: 1,
      scope_conflict: 1,
      verify_by_hand: 1,
      disk: 0,
      other: 0,
    },
  };
  const ledger2 = buildParentTurnsByCause(stateExplicit);
  assert("ledger: explicit causes are preserved", ledger2.env_precondition === 2 && ledger2.scope_conflict === 1);

  const dir = makeRouteRun({
    state: {
      started_at: new Date().toISOString(),
      parent_turns: 2,
      settle_s: 30,
      sessions: { "01": { status: "done", attempts: 1, slot: "claude" } },
      empty_slots: ["claude"],
      events: [],
    },
  });
  run("route", dir);
  const r = run("score", dir);
  assert("score runs with ledger", r.status === 0);
  const metricsFile = join(tmpdir(), "handoff", "metrics.jsonl");
  const lastMetric = JSON.parse(readFileSync(metricsFile, "utf8").trim().split("\n").at(-1));
  assert("metrics records parent_turns_by_cause", typeof lastMetric.parent_turns_by_cause === "object");
  assert("metrics records dead_slot in parent_turns_by_cause", lastMetric.parent_turns_by_cause.dead_slot === 1);
  assert("metrics records decisions summary", typeof lastMetric.decisions === "object");
  assert("metrics records explicit unresolved_decisions count", typeof lastMetric.unresolved_decisions === "number");
}

// ------------------------------------------------------------------ caller equivalence
{
  // 1. Effort equivalence
  for (const tier of ["mechanical", "review", "design", "unknown", undefined]) {
    const direct = EFFORT_BY_TIER[tier] ?? DEFAULT_EFFORT;
    const s1Res = choice({ tier }, EFFORTS, { site: "effort" });
    assert(`caller equivalence effort for tier ${tier}`, s1Res.label === direct);
  }
  for (const override of ["low", "medium", "high"]) {
    const s1Override = choice({ tier: "design", effort: override }, EFFORTS, { site: "effort" });
    assert(`caller equivalence effort override ${override}`, s1Override.label === override);
  }

  // 2. RTK guardedSkip equivalence
  const testCommands = [
    "git diff HEAD",
    "git show",
    "cat file.txt",
    "head -n 10 file.txt",
    "tail -n 10 file.txt",
    "grep pattern file.txt",
    "rg pattern",
    "cargo test",
    "npm test",
    "pytest",
    "git status",
    "git commit -m 'test'",
  ];
  for (const cmd of testCommands) {
    const directSkip = guardedSkip(cmd);
    const noulRes = noul(cmd, "must command reach whole?", { site: "rtk" });
    assert(`caller equivalence rtk for "${cmd}"`, noulRes.yes === directSkip);
  }

  // 3. Read score equivalence
  const readFacts = [
    { lines: 100, bytes: 2000 },
    { lines: 400, bytes: 40000 },
    { lines: 400, bytes: 1000, offset: 1, limit: 50 },
    { lines: 500, bytes: 50000, edit: true },
    { lines: 1000, bytes: 100000, outline: true },
  ];
  for (const facts of readFacts) {
    const scored = s1Score(facts, READ_LEVELS, { site: "read" });
    assert(`caller equivalence read score for lines=${facts.lines}`, typeof scored.level === "string" && READ_LEVELS.includes(scored.level));
  }
}

// ------------------------------------------------------------------ codex model resolution & no placeholder
{
  const defaultResolved = resolveCodexModel();
  assert("resolveCodexModel is non-empty", Boolean(defaultResolved));
  assert("resolveCodexModel is not 'default'", defaultResolved !== "default");

  const envModel = resolveCodexModel("codex", null);
  assert("resolveCodexModel returns a real model name", typeof envModel === "string" && envModel.length > 0 && envModel !== "default");

  const codexSessionNoModel = { id: "01", provider: "codex", tier: "mechanical", size: "s" };
  const rendered = renderModel(codexSessionNoModel);
  assert("renderModel for codex session does not contain 'default'", !/\bdefault\b/.test(rendered));
  assert("renderModel contains resolved model", rendered.includes(defaultResolved));

  const digestBlock = formatResultDigestBlock(codexSessionNoModel, { status: "done", slot: "codex" }, { ok: true, paths: ["a.js"], summary: "done", remaining: "none" });
  assert("formatResultDigestBlock does not contain 'default'", !/\bdefault\b/.test(digestBlock));
  assert("formatResultDigestBlock contains resolved model", digestBlock.includes(defaultResolved));

  const codexDir = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      sessions: [
        { id: "01", goal: "codex run", provider: "codex", tier: "mechanical", size: "s", writes: ["a.txt"], deps: [] },
      ],
    },
    quota: {
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
      ],
    },
  });
  const rRoute = run("route", codexDir);
  assert("route exits 0 for codex plan", rRoute.status === 0);
  const routing = JSON.parse(readFileSync(join(codexDir, "routing.json"), "utf8"));
  const assignedModel = routing.sessions[0].model;
  assert("routed codex session has model assigned", Boolean(assignedModel));
  assert("routed codex session model is NOT 'default'", assignedModel !== "default");
  assert("route stdout table does not contain 'default' in model column", !/\|\s*default\s*\|/.test(rRoute.stdout));
  assert("route stdout table contains real model name", rRoute.stdout.includes(assignedModel));

  const models = cliModels("codex", "codex");
  assert("cliModels('codex', 'codex') returns non-empty list", models.length > 0);
  assert("cliModels('codex', 'codex') does not contain 'default'", !models.includes("default"));
}

// ------------------------------------------- every session names a real model
{
  // The claude CLI lists no models, so a claude session used to route as
  // "unpinned" and the child inherited whatever default the CLI carried.
  const claudeOnly = {
    ts: new Date().toISOString(),
    slots: [
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
  const planFor = (tier) => ({
    mode: "fan-out",
    horizon_s: 7200,
    sessions: [{ id: "01", goal: "t", tier, size: "s", writes: ["a.txt"], deps: [] }],
  });

  const designDir = makeRouteRun({ plan: planFor("design"), quota: claudeOnly });
  const rDesign = run("route", designDir);
  const designModel = JSON.parse(readFileSync(join(designDir, "routing.json"), "utf8")).sessions[0].model;
  assert("route names a model for a claude session", rDesign.status === 0 && designModel === "opus");
  assert("route table never says 'unpinned'", !/unpinned/.test(rDesign.stdout));

  const mechDir = makeRouteRun({ plan: planFor("mechanical"), quota: claudeOnly });
  run("route", mechDir);
  const mechModel = JSON.parse(readFileSync(join(mechDir, "routing.json"), "utf8")).sessions[0].model;
  assert("mechanical claude session takes the cheaper roster model", mechModel === "sonnet");

  // With the roster emptied nothing can name the model, and route refuses
  // rather than letting the CLI's current default decide after approval.
  const noRosterDir = makeRouteRun({ plan: planFor("design"), quota: claudeOnly });
  const rNone = run("route", noRosterDir, [], { ...process.env, HANDOFF_CLAUDE_MODELS: "" });
  assert("route refuses a session whose model nothing can name", rNone.status !== 0);
  assert("refusal names the session and the fix", /session 01 routes to claude with no model named/.test(rNone.stderr) && /set "model" in plan\.json/.test(rNone.stderr));

  const declaredDir = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      sessions: [{ id: "01", goal: "t", tier: "design", size: "s", model: "opusplan", writes: ["a.txt"], deps: [] }],
    },
    quota: claudeOnly,
  });
  run("route", declaredDir, [], { ...process.env, HANDOFF_CLAUDE_MODELS: "" });
  const declared = JSON.parse(readFileSync(join(declaredDir, "routing.json"), "utf8")).sessions[0].model;
  assert("a declared model is kept even with no roster", declared === "opusplan");

  // Rerouting after a quota death must land on a named model too.
  const claudeSlot = { key: "claude", provider: "claude", bin: "claude", account: "default" };
  assert(
    "reroute onto the same provider keeps the named model",
    modelForReroute(claudeSlot, null, { provider: "claude", model: "opusplan", tier: "design" }) === "opusplan",
  );
  assert(
    "reroute onto another provider falls back to that provider's roster",
    modelForReroute(claudeSlot, null, { provider: "cursor", model: "composer-1", tier: "mechanical" }) === "sonnet",
  );
}

// ------------------------------- a stale credential beside a live one is fine
{
  // The trap this guards: Claude Code keeps the live token in the Keychain and
  // leaves an expired .credentials.json behind, which used to blank the whole
  // slot even though its usage windows read fine.
  const sources = [
    { label: "stale file", read: () => ({ exp: 1 }) },
    { label: "keychain", read: () => ({ exp: 9 }) },
  ];
  const r = firstUsable(sources, (c) => c.exp < 5);
  assert("firstUsable skips the expired source and returns the live one", r.creds?.exp === 9 && r.source === "keychain");
  assert("firstUsable still reports that an expired copy was seen", r.expiredSeen === true);
  // `auth_expired` is that pair, not expiredSeen alone.
  assert("a slot with a usable credential is not auth-expired", !(r.expiredSeen && !r.creds));
}

// ----------------------------------------------------------- verifier gates & fixtures
{
  runAllGateTests();
  assert("s1-local suite", runAllLocalTests() === 0);

  // Test classifyExit integrating with s.verify
  const dVerify = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      sessions: [
        { id: "01", goal: "task", writes: ["a.txt"], deps: [], verify: ["sh -c 'exit 1'"] },
        { id: "02", goal: "task2", writes: ["b.txt"], deps: [], verify: ["echo passed"] },
        { id: "03", goal: "task3", writes: ["c.txt"], deps: [], verify: [{ cmd: "true", expect_output: true }] },
      ],
    },
  });
  run("route", dVerify);
  // Write result files claiming "status: done"
  writeFileSync(join(dVerify, "sessions", "01.result.md"), "# Result 01\n- status: done\n- summary: claimed done\n");
  writeFileSync(join(dVerify, "sessions", "02.result.md"), "# Result 02\n- status: done\n- summary: passing test\n");
  writeFileSync(join(dVerify, "sessions", "03.result.md"), "# Result 03\n- status: done\n- summary: empty output\n");

  const routingVerify = JSON.parse(readFileSync(join(dVerify, "routing.json"), "utf8"));
  const s01 = routingVerify.sessions.find((s) => s.id === "01");
  const s02 = routingVerify.sessions.find((s) => s.id === "02");
  const s03 = routingVerify.sessions.find((s) => s.id === "03");

  // s01: verify fails -> classifyExit downgrades to failed
  const c01 = classifyExit(dVerify, s01, 0, 10, dVerify);
  assert("verifier: failing gate downgrades claimed done to failed", c01.status === "failed");
  assert("verifier: failure reason explains gate verification failed", c01.reason?.includes("gate verification failed"));
  assert("verifier: gate_results recorded", Array.isArray(c01.gate_results) && c01.gate_results.length === 1);

  // s02: verify passes -> classifyExit returns done
  const c02 = classifyExit(dVerify, s02, 0, 10, dVerify);
  assert("verifier: passing gate confirms done", c02.status === "done" && c02.reason === null);
  assert("verifier: gate_results recorded on success", Array.isArray(c02.gate_results) && c02.gate_results[0].ok === true);

  // s03: verify empty expected output -> classifyExit downgrades to failed
  const c03 = classifyExit(dVerify, s03, 0, 10, dVerify);
  assert("verifier: empty expected output in session gate downgrades to failed", c03.status === "failed" && c03.reason?.includes("empty expected output"));

  // Test reconcileFromResults with gates
  const stateVerify = {
    started_at: new Date().toISOString(),
    parent_turns: 0,
    sessions: {
      "01": { status: "running" },
      "02": { status: "running" },
    },
    empty_slots: [],
    events: [],
  };
  reconcileFromResults(dVerify, routingVerify, stateVerify);
  assert("reconcile: failing gate reconciles running to failed", stateVerify.sessions["01"].status === "failed");
  assert("reconcile: passing gate reconciles running to done", stateVerify.sessions["02"].status === "done");
}

// ----------------------------------------------------------- guard matched evidence & redaction
{
  // 1. Redaction of secrets, credentials, and PII
  const secretKey = "sk-ant-api03-abcdef123456789012345678";
  const ghToken = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
  const bearerToken = "Bearer secret_bearer_token_value_xyz123";
  const flagSecret = "--token super_secret_pass_123";
  const email = "developer@internal.company.com";
  const sampleText = `Call API with ${secretKey} and ${ghToken} using ${bearerToken} and ${flagSecret}. Contact ${email}.`;

  const redacted = redactEvidence(sampleText);
  assert("guard redact: sk- key is redacted", !redacted.includes(secretKey) && redacted.includes("[REDACTED]"));
  assert("guard redact: ghp_ token is redacted", !redacted.includes(ghToken) && redacted.includes("[REDACTED]"));
  assert("guard redact: bearer token is redacted", !redacted.includes(bearerToken) && redacted.includes("Bearer [REDACTED]"));
  assert("guard redact: --token flag value is redacted", !redacted.includes("super_secret_pass_123") && redacted.includes("--token [REDACTED]"));
  assert("guard redact: email is redacted", !redacted.includes(email) && redacted.includes("[EMAIL REDACTED]"));

  // 2. Guard evidence reporting on tool interception
  const mockRunDir = join(tmpdir(), `mock-guard-run-${Date.now()}`);
  const mockRuns = [{ dir: mockRunDir, running: ["01"] }];

  // Reading worktree file
  const denyWt = evaluatePreToolUse(
    { tool_name: "Read", tool_input: { file_path: join(mockRunDir, "wt", "01", "secret.txt") } },
    mockRuns
  );
  assert("guard evidence: worktree denial contains matched worktree path evidence",
    denyWt !== null &&
    denyWt.includes('evidence: matched worktree path "') &&
    denyWt.includes("inside session 01's worktree")
  );

  // Reading log file
  const denyLog = evaluatePreToolUse(
    { tool_name: "Read", tool_input: { file_path: join(mockRunDir, "logs", "01.log") } },
    mockRuns
  );
  assert("guard evidence: log denial contains matched log path evidence",
    denyLog !== null &&
    denyLog.includes('evidence: matched log path "') &&
    denyLog.includes("is session 01's raw stdout")
  );

  // Bash command reading logs
  const denyBashLog = evaluatePreToolUse(
    { tool_name: "Bash", tool_input: { command: `cat ${join(mockRunDir, "logs", "01.log")}` } },
    mockRuns
  );
  assert("guard evidence: bash log denial contains matched log path in command evidence",
    denyBashLog !== null &&
    denyBashLog.includes('evidence: matched log path "') &&
    denyBashLog.includes('in command "cat ')
  );

  // Bash command raw launch
  const denyLaunch = evaluatePreToolUse(
    { tool_name: "Bash", tool_input: { command: `claude -p "do something"` } },
    mockRuns
  );
  assert("guard evidence: raw launch denial contains matched launch pattern in command evidence",
    denyLaunch !== null &&
    denyLaunch.includes('evidence: matched launch pattern "claude -p" in command "claude -p "do something""')
  );

  // Bash read-only diagnostics allowed (P10)
  const allowPgrep = evaluatePreToolUse(
    { tool_name: "Bash", tool_input: { command: "pgrep -f claude" } },
    mockRuns
  );
  assert("guard allows: pgrep process inspection allowed", allowPgrep === null);

  const allowVersion = evaluatePreToolUse(
    { tool_name: "Bash", tool_input: { command: "claude --version" } },
    mockRuns
  );
  assert("guard allows: --version diagnostic allowed", allowVersion === null);
}

// ----------------------------------------------------------- P19 parent correction & durability
{
  const p19Dir = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      sessions: [
        { id: "01", goal: "task 1", writes: ["a.txt"], deps: [] },
        { id: "02", goal: "task 2", writes: ["b.txt"], deps: ["01"] },
      ],
    },
  });

  // Initial state on disk
  const initialState = {
    started_at: new Date().toISOString(),
    parent_turns: 1,
    sessions: {
      "01": { status: "blocked", attempts: 1, reason: "sandbox constraint" },
      "02": { status: "pending", attempts: 0 },
    },
    empty_slots: [],
    events: ["2026-09-20T00:00:00.000Z 01 blocked"],
  };
  writeFileSync(join(p19Dir, "state.json"), JSON.stringify(initialState, null, 2));

  // 1. markSession sets status, note, parent_correction, and event
  const updated = markSession(p19Dir, "01", "done", { note: "manually verified fmt/clippy clean" });
  assert("P19 mark: status updated to done", updated.sessions["01"].status === "done");
  assert("P19 mark: note saved", updated.sessions["01"].note === "manually verified fmt/clippy clean");
  assert("P19 mark: parent_correction recorded", updated.sessions["01"].parent_correction?.status === "done");
  assert("P19 mark: durable event added to state.events",
    updated.events.some((e) => e.includes("01 marked done by parent") && e.includes("manually verified fmt/clippy clean"))
  );

  // 2. Dispatcher in-memory state merging from disk (mergeStateFromDisk)
  // Simulate running dispatcher having in-memory state where 01 was still "blocked" or "running"
  const inMemState = {
    started_at: new Date().toISOString(),
    parent_turns: 1,
    sessions: {
      "01": { status: "running", attempts: 1 },
      "02": { status: "pending", attempts: 0 },
    },
    empty_slots: [],
    events: ["initial in-memory event"],
  };

  mergeStateFromDisk(p19Dir, inMemState);
  assert("P19 merge: in-memory state adopts parent correction status", inMemState.sessions["01"].status === "done");
  assert("P19 merge: in-memory state adopts parent note", inMemState.sessions["01"].note === "manually verified fmt/clippy clean");
  assert("P19 merge: in-memory state retains parent correction metadata", inMemState.sessions["01"].parent_correction?.status === "done");
  assert("P19 merge: events merged without losing parent event",
    inMemState.events.some((e) => e.includes("01 marked done by parent"))
  );

  // 3. Subsequent dispatcher write preserves parent correction
  saveState(p19Dir, inMemState);
  const diskAfterWrite = JSON.parse(readFileSync(join(p19Dir, "state.json"), "utf8"));
  assert("P19 durability: parent correction survives subsequent dispatcher write",
    diskAfterWrite.sessions["01"].status === "done" &&
    diskAfterWrite.sessions["01"].note === "manually verified fmt/clippy clean" &&
    diskAfterWrite.events.some((e) => e.includes("01 marked done by parent"))
  );

  // 4. Dependent session is unblocked
  const depsDone = (s) => (s.deps ?? []).every((d) => diskAfterWrite.sessions[d]?.status === "done");
  const s02 = { id: "02", deps: ["01"] };
  assert("P19 unblocking: dependent session 02 is now runnable", depsDone(s02) === true);

  // 5. CLI invocation: handoff mark
  const rMarkCLI = run("mark", p19Dir, ["02", "done", "--note", "verified by lead"]);
  assert("P19 CLI: handoff mark exits 0", rMarkCLI.status === 0);
  const stateCLI = JSON.parse(readFileSync(join(p19Dir, "state.json"), "utf8"));
  assert("P19 CLI: session 02 marked done via CLI",
    stateCLI.sessions["02"].status === "done" &&
    stateCLI.sessions["02"].note === "verified by lead" &&
    stateCLI.events.some((e) => e.includes("02 marked done by parent") && e.includes("verified by lead"))
  );
}

// ----------------------------------------------------------- E1: capabilities Nouls, union, mining
{
  const SIX = ["network", "git-write", "disk-write", "docker", "browser", "secrets"];
  assert("CAPABILITY_NOULS is exactly the six classifier outputs", JSON.stringify(CAPABILITY_NOULS) === JSON.stringify(SIX));
  assert("CAPABILITY_THRESHOLD is the named fail-closed floor", CAPABILITY_THRESHOLD === 0.25);

  const fromCaps = declaredCapabilities({ id: "01", capabilities: ["network", "docker"] });
  assert("canonical capabilities field is accepted", JSON.stringify(fromCaps) === JSON.stringify(["network", "docker"]));

  const fromNeeds = declaredCapabilities({ id: "01", needs: ["unix-socket", "git-write"] });
  assert("legacy needs remains compatible", JSON.stringify(fromNeeds) === JSON.stringify(["unix-socket", "git-write"]));

  const both = declaredCapabilities({
    id: "01",
    capabilities: ["network"],
    needs: ["git-write", "network"],
  });
  assert("capabilities unions with leftover needs and does not drop either", JSON.stringify(both) === JSON.stringify(["network", "git-write"]));

  const capDir = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      sessions: [
        { id: "01", goal: "daemon test", tier: "mechanical", size: "s", writes: ["d.txt"], deps: [], capabilities: ["unix-socket"] },
      ],
    },
  });
  const capRoute = run("route", capDir);
  assert("route exits 0 for canonical capabilities field", capRoute.status === 0);
  const capRouting = JSON.parse(readFileSync(join(capDir, "routing.json"), "utf8"));
  assert("capabilities: unix-socket still excludes Codex", capRouting.sessions[0].provider === "claude");
  assert("canonical capabilities does not emit a needs deprecation warning", !/legacy `needs`|deprecated.*needs/i.test(capRoute.stderr + capRoute.stdout));

  const needsDir = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      sessions: [
        { id: "01", goal: "a", tier: "mechanical", size: "s", writes: ["a.txt"], deps: [], needs: ["unix-socket"] },
        { id: "02", goal: "b", tier: "mechanical", size: "s", writes: ["b.txt"], deps: [], needs: ["git-write"] },
      ],
    },
  });
  const needsRoute = run("route", needsDir);
  const needsWarn = `${needsRoute.stderr}\n${needsRoute.stdout}`;
  assert("legacy needs still routes", needsRoute.status === 0);
  assert("legacy needs emits a visible deprecation warning", /legacy `needs`|deprecated.*`needs`/i.test(needsWarn));
  assert(
    "legacy needs warns once per plan, not once per session",
    (needsWarn.match(/legacy `needs`|deprecated.*`needs`/gi) ?? []).length === 1,
  );

  const rulesNouls = {};
  for (const cap of CAPABILITY_NOULS) {
    const d = noul(
      { goal: "bind a unix socket and git commit", writes: ["crates/daemon/**"], verify: ["cargo test"] },
      `does this session require the ${cap} capability?`,
      { site: "capabilities", backend: rules, session: "01", run: "e1-rules-noul" },
    );
    rulesNouls[cap] = d;
    assert(`rules noul for ${cap} exposes dist`, Array.isArray(d.dist) && d.dist.length === 2);
    assert(`rules noul for ${cap} does not add (today's floor)`, d.yes === false && d.p_yes === 0);
  }
  assert("rules remains the default backend", getBackend()?.name === "rules");

  const predictedNone = predictCapabilities(
    { id: "01", goal: "bind a unix socket", writes: ["d.txt"], verify: ["cargo test"] },
    { backend: rules, mode: "rules" },
  );
  assert("rules prediction adds none of the six", CAPABILITY_NOULS.every((c) => predictedNone[c]?.yes !== true));

  const mock = {
    name: "cap-mock",
    decide({ question }) {
      const cap = CAPABILITY_NOULS.find((c) => String(question).includes(c));
      const pYes = {
        network: 0.9,
        "git-write": 0.05,
        "disk-write": 0.8,
        docker: 0.3,
        browser: 0.24,
        secrets: 0.1,
      }[cap] ?? 0;
      return { index: pYes >= 0.5 ? 0 : 1, p: Math.max(pYes, 1 - pYes), dist: [pYes, 1 - pYes] };
    },
  };

  const predicted = predictCapabilities(
    { id: "01", goal: "cargo test a daemon", writes: ["crates/daemon/**"], verify: ["cargo test"], capabilities: ["git-write"] },
    { backend: mock, mode: "action", run: "e1-mock-predict" },
  );
  assert("noul network is declared on high p(yes)", predicted.network.yes === true);
  assert("noul disk-write is declared on high p(yes)", predicted["disk-write"].yes === true);
  assert("noul docker is declared on suspicion at p=0.3 even when argmax is no", predicted.docker.yes === true && predicted.docker.p_yes === 0.3);
  assert("noul browser abstains below the 0.25 threshold", predicted.browser.abstain === true && predicted.browser.yes !== true);
  assert("noul secrets abstains well below threshold", predicted.secrets.abstain === true && predicted.secrets.yes !== true);
  assert("noul git-write classifier says no", predicted["git-write"].yes !== true);

  const declared = ["git-write"];
  const predictedYes = CAPABILITY_NOULS.filter((c) => predicted[c].yes);
  const effective = effectiveCapabilities(declared, predictedYes);
  assert("union includes owner git-write even though the classifier said no", effective.includes("git-write"));
  assert("union adds classifier network and docker", effective.includes("network") && effective.includes("docker"));
  assert("union does not add abstained browser or secrets", !effective.includes("browser") && !effective.includes("secrets"));
  assert(
    "classifier cannot subtract an owner-declared capability",
    JSON.stringify(effectiveCapabilities(["secrets", "git-write"], ["network"]).sort()) ===
      JSON.stringify(["git-write", "network", "secrets"].sort()),
  );

  const disagree = capabilityDisagreement(declared, predictedYes);
  assert("disagreement lists classifier additions", disagree.added.includes("network") && disagree.added.includes("docker"));
  assert("disagreement lists owner-kept capabilities the classifier missed", disagree.kept.includes("git-write"));
  assert("disagreement never lists a drop", !disagree.dropped || disagree.dropped.length === 0);

  const actionDir = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      s1: { mode: "action" },
      sessions: [
        {
          id: "01",
          goal: "cargo test a daemon that binds a socket",
          tier: "mechanical",
          size: "s",
          writes: ["d.txt"],
          deps: [],
          capabilities: ["git-write"],
        },
      ],
    },
  });
  const actionRoute = run("route", actionDir, [], { ...process.env, HANDOFF_S1_BACKEND: "cap-mock" });
  // Without the in-process mock, CLI rules path must not steal git-write.
  assert("rules default leaves owner git-write in place", actionRoute.status === 0);
  const actionRouting = JSON.parse(readFileSync(join(actionDir, "routing.json"), "utf8"));
  assert(
    "rules/default effective capabilities keep owner git-write",
    (actionRouting.sessions[0].effective_capabilities ?? actionRouting.sessions[0].capabilities ?? []).includes("git-write"),
  );

  const inProcessDir = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      s1: { mode: "action" },
      sessions: [
        {
          id: "01",
          goal: "cargo test a daemon that binds a socket",
          tier: "mechanical",
          size: "s",
          writes: ["d.txt"],
          deps: [],
          capabilities: ["git-write"],
        },
      ],
    },
  });
  const prev = getBackend();
  setBackend(mock);
  try {
    route(inProcessDir);
  } finally {
    setBackend(prev);
  }
  const inRouting = JSON.parse(readFileSync(join(inProcessDir, "routing.json"), "utf8"));
  const inSess = inRouting.sessions[0];
  assert("action mode effective is the fail-closed union", inSess.effective_capabilities.includes("git-write") && inSess.effective_capabilities.includes("network") && inSess.effective_capabilities.includes("docker"));
  assert("action mode does not drop owner git-write", inSess.effective_capabilities.includes("git-write"));
  assert("action mode routes off Codex when union requires git-write/network/docker", inSess.provider === "claude");
  const inOut = readFileSync(join(inProcessDir, "routing.json"), "utf8");
  assert("routing.json records predicted-versus-declared disagreement", /added/.test(JSON.stringify(inSess.capability_disagreement)));

  const shadowDir = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      s1: { mode: "shadow" },
      sessions: [
        {
          id: "01",
          goal: "cargo test a daemon that binds a socket",
          tier: "mechanical",
          size: "s",
          writes: ["d.txt"],
          deps: [],
          capabilities: ["git-write"],
        },
      ],
    },
  });
  setBackend(mock);
  try {
    route(shadowDir);
  } finally {
    setBackend(rules);
  }
  const shadowSess = JSON.parse(readFileSync(join(shadowDir, "routing.json"), "utf8")).sessions[0];
  assert("shadow mode does not change routing capabilities", JSON.stringify(shadowSess.effective_capabilities) === JSON.stringify(["git-write"]));
  assert("shadow mode still records a prediction", shadowSess.predicted_capabilities.includes("network") || shadowSess.predicted_capabilities.includes("docker"));
  assert("shadow still keeps the session off Codex because owner declared git-write", shadowSess.provider === "claude");

  const examples = mineRecordedCapabilityExamples();
  const again = mineRecordedCapabilityExamples();
  assert("recorded-run mining is deterministic", JSON.stringify(examples) === JSON.stringify(again));
  assert("mining yields one record per (run, session, capability)", examples.length === 3 * 6 && examples.every((r) => r.site === "capabilities"));
  const minedRuns = [...new Set(examples.map((r) => r.run))].sort();
  assert(
    "mining covers the three recorded runs",
    JSON.stringify(minedRuns) === JSON.stringify(["20260915T135101Z", "20260915T182254Z", "20260915T225713Z"]),
  );
  const blob = JSON.stringify(examples);
  assert("mining redacts planted secrets", !blob.includes("ghp_MINEDSECRETTOKEN0000000000") && blob.includes("<redacted>"));
  assert("mining redacts planted email", !blob.includes("alice@example.invalid"));
  assert("mining redacts absolute paths", !blob.includes("/Users/alice/"));
  assert("mining examples are usable labels", examples.some((r) => r.capability === "network" && r.outcome?.observed === true));

  const fixture = join(here, "fixtures", "cua-s1-tinyx-toy", "checkpoint.json");
  const local = createLocalBackend(fixture);
  const localPred = predictCapabilities(
    { id: "01", goal: "fetch crates.io and docker build", writes: ["src/**"], verify: ["cargo test"] },
    { backend: local, mode: "action", run: "e1-local-infer" },
  );
  assert("local checkpoint actually infers all six Nouls", CAPABILITY_NOULS.every((c) => typeof localPred[c]?.p_yes === "number" && Number.isFinite(localPred[c].p_yes)));
  const localRecords = readDecisions("e1-local-infer");
  assert("local capability records used the local backend", localRecords.filter((r) => r.site === "capabilities").every((r) => r.backend === "local"));
  assert("local infer does not promote itself to the default backend", getBackend()?.name === "rules");

  const localShadowDir = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      s1: { mode: "shadow", checkpoint: fixture },
      sessions: [
        { id: "01", goal: "fetch crates.io", tier: "mechanical", size: "s", writes: ["a.txt"], deps: [], capabilities: [] },
      ],
    },
  });
  const localShadow = run("route", localShadowDir);
  assert("local shadow route exits 0", localShadow.status === 0);
  const localShadowSess = JSON.parse(readFileSync(join(localShadowDir, "routing.json"), "utf8")).sessions[0];
  assert("local shadow does not add capabilities to the gate", (localShadowSess.effective_capabilities ?? []).length === 0);
  assert("local shadow still records model output", Array.isArray(localShadowSess.predicted_capabilities));
  assert("graph gate output mentions predicted vs declared", /predicted|disagreement|declared/i.test(localShadow.stdout));

  const localActionDir = makeRouteRun({
    plan: {
      mode: "fan-out",
      horizon_s: 7200,
      s1: { mode: "action", checkpoint: fixture },
      sessions: [
        { id: "01", goal: "fetch crates.io", tier: "mechanical", size: "s", writes: ["a.txt"], deps: [], capabilities: ["disk-write"] },
      ],
    },
  });
  const localAction = run("route", localActionDir);
  assert("local action route exits 0 or fail-closed-refuses, not a crash", localAction.status === 0 || localAction.status === 1);
  if (localAction.status === 0) {
    const localActionSess = JSON.parse(readFileSync(join(localActionDir, "routing.json"), "utf8")).sessions[0];
    assert("local action keeps owner disk-write", localActionSess.effective_capabilities.includes("disk-write"));
  }

  const docsRoot = join(here, "..", "..", "..");
  const gateDoc = readFileSync(join(here, "..", "references", "graph-gate.md"), "utf8");
  const routingDoc = readFileSync(join(here, "..", "references", "routing.md"), "utf8");
  const skillDoc = readFileSync(join(here, "..", "SKILL.md"), "utf8");
  const promptDoc = readFileSync(join(docsRoot, "prompts", "model-routing.md"), "utf8");
  const contextDoc = readFileSync(join(docsRoot, "CONTEXT.md"), "utf8");
  assert("graph-gate documents predicted vs declared capabilities", /predicted.*declared|disagreement/i.test(gateDoc));
  assert("graph-gate never presents default as a model name", !/`default` as a model|model is `default`|model: default/i.test(gateDoc));
  assert("routing.md uses the capabilities field", /Declare `capabilities`/.test(routingDoc) || /`"capabilities"`/.test(routingDoc));
  assert("SKILL.md plan example uses capabilities", /"capabilities":\s*\[/.test(skillDoc));
  assert("model-routing §2 names the capabilities field", /### Capabilities \(`capabilities`\)/.test(promptDoc));
  assert("model-routing §4 gates on capabilities", /Capability Filtering \(`capabilities` Gate\)/.test(promptDoc));
  assert("CONTEXT.md treats needs as the legacy spelling", /legacy|deprecated/.test(contextDoc) && /`capabilities`/.test(contextDoc));
  assert(
    "renderModel never uses default as a model name for claude",
    !/\bdefault\b/.test(renderModel({ provider: "claude", effort: "medium" })),
  );
}

// Remove every worktree (and its branch) the tests created under the isolated TMPDIR.
{
  const root = realpathSync(process.env.TMPDIR);
  const list = spawnSync("git", ["worktree", "list", "--porcelain"], { encoding: "utf8" }).stdout ?? "";
  for (const block of list.split("\n\n")) {
    const path = block.match(/^worktree (.+)$/m)?.[1];
    const branch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1];
    let real = path;
    try { real = realpathSync(path); } catch {}
    if (!path || !real.startsWith(root)) continue;
    spawnSync("git", ["worktree", "remove", "--force", path], { encoding: "utf8" });
    if (branch) spawnSync("git", ["branch", "-D", branch], { encoding: "utf8" });
  }
  spawnSync("git", ["worktree", "prune"], { encoding: "utf8" });
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nok: handoff tests");

#!/usr/bin/env node
// Tests for handoff.mjs status/dispatch result-file reconciliation.
// Run: node skills/handoff/scripts/handoff.test.mjs

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
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
  renderModel,
  hashSessions,
  nonCausalDeps,
  clean,
  score,
} from "./handoff.mjs";

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

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nok: handoff tests");

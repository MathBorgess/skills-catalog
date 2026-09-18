---
name: handoff
description: Use when the user wants to compact work for a later agent, split it into parallel sessions, dispatch Cursor, Claude, Codex, or Antigravity (agy), route around quota, or says /handoff, fan-out, routing table, or end of task.
argument-hint: "compact | fan-out | provider or model constraints"
metadata:
  author: Matheus Borges
  version: 1.3.0
---

# Handoff

Turn current work into self-contained session briefs. In **compact**, make one successor brief. In **fan-out**, cut independent work and let `scripts/handoff.mjs` probe supply, route, launch, recover, and score. Do not repeat its arithmetic, launch a child by hand, read child logs/worktrees, or implement a child's scope.

## 1. Probe and cut

Choose **fan-out** for explicit parallel work, or when two cuts have no shared writes or causal sequence; otherwise choose **compact**. User provider/model constraints win.

Create the run outside the repository, then probe before planning:

```bash
HANDOFF_RUN="${TMPDIR:-/tmp}/handoff/$(date -u +%Y%m%dT%H%M%SZ)"
node <skill>/scripts/handoff.mjs probe --run "$HANDOFF_RUN"
```

If supply is `unknown`, use `probe --explain`; report the paths it checked and the one-line fix. A `~` reading is local estimation, never an account limit. Read [`references/quota.md`](references/quota.md) only for quota diagnosis.

Write `$HANDOFF_RUN/plan.json`:

```json
{"mode":"fan-out","horizon_s":7200,"sessions":[
  {"id":"01","goal":"…","tier":"design","size":"m","writes":["src/auth/**"],"reads":["**"],"deps":[],"needs":[]},
  {"id":"02","goal":"…","tier":"mechanical","size":"s","writes":["docs/**"],"reads":["**"],"deps":[],"model":"…","effort":"low"}
]}
```

`model` and `effort` are optional owner overrides. A dependency means B needs A's output; independent sessions run in parallel. Give independent sessions disjoint write-sets. Set `tier`, `size`, `needs`, and an honest `horizon_s`; see [`references/routing.md`](references/routing.md).

## 2. Route and graph gate

```bash
node <skill>/scripts/handoff.mjs route --run "$HANDOFF_RUN"
```

Fix route refusals. Then follow [`references/graph-gate.md`](references/graph-gate.md): grill the graph with the owner until it is approved. After the final route, lock that exact plan:

```bash
node <skill>/scripts/handoff.mjs route --run "$HANDOFF_RUN" --approve
```

This records the plan hash. Approval is required before any launch; never request a second approval for the same hash.

## 3. Write briefs and dispatch

Write every `NN.md` and `NN.prompt.md` after approval, using [`references/brief.md`](references/brief.md). Author each Goal and Constraints; use pointers instead of copied artifacts; redact secrets and PII.

```bash
node <skill>/scripts/handoff.mjs dispatch --run "$HANDOFF_RUN" --budget 540 --settle 30
```

`--settle` is the adjustable settle window; its default is 30 seconds. Dispatch refuses a plan changed since approval. It launches eligible work, waits for dependencies, and reroutes recoverable provider failures without another approval.

Read the dispatch digest. It includes each finished session's result block. Open `sessions/NN.result.md` only when action is required. Never open `logs/`, a child transcript, or `wt/`; relaunch a blocked child with a corrected brief instead of doing its work.

## 4. Score and close

```bash
node <skill>/scripts/handoff.mjs score --run "$HANDOFF_RUN"
```

Show the report and ask the owner: (a) keep it locally; or (b) create an issue with it, then clean the run. Create an issue only after yes. Clean with:

```bash
node <skill>/scripts/handoff.mjs clean --run "$HANDOFF_RUN"
```

`clean` refuses while a run worktree has uncommitted changes and never deletes branches. See [`references/metrics.md`](references/metrics.md).

## Done-check

- [ ] Probe ran before planning; plan has causal deps and disjoint concurrent writes.
- [ ] Route accepted, graph gate completed, and `route --approve` locked the current hash before dispatch.
- [ ] Every brief exists; no child was launched manually, implemented by the parent, or inspected through logs/worktrees.
- [ ] Dispatch digest was used; changed plans were routed and approved again before dispatch.
- [ ] Score ran and the owner received the keep-or-issue-and-clean question.

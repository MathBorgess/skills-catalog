---
name: handoff
description: Use when the user wants to compact work for a later agent, split it into parallel sessions, dispatch Cursor, Claude, Codex, or Antigravity (agy), route around quota, run children through rtk, or says /handoff, fan-out, routing table, or end of task.
argument-hint: "compact | fan-out | provider or model constraints | rtk"
metadata:
  author: Matheus Borges
  version: 2.2.2
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
{"mode":"fan-out","horizon_s":7200,"rtk":"guarded","sessions":[
  {"id":"01","goal":"…","tier":"design","size":"m","writes":["src/auth/**"],"reads":["**"],"deps":[],"needs":[]},
  {"id":"02","goal":"…","tier":"mechanical","size":"s","writes":["docs/**"],"reads":["**"],"deps":[],"model":"…","effort":"low"}
]}
```

**Recommended: if `rtk --version` works, set `"rtk": "guarded"` in the plan** and raise it in the graph gate; `route` prints a `tip` when RTK is installed and the plan leaves it out. Whether RTK lowers task cost is still being measured ([skills-catalog#27](https://github.com/MathBorgess/skills-catalog/issues/27)).

`model` and `effort` are optional owner overrides. `rtk` (`off` | `guarded` | `full`, plan-wide or per session; absent = `off`) routes the children's shell output through [RTK](https://github.com/rtk-ai/rtk) — see §4. A dependency means B needs A's output; independent sessions run in parallel. Give independent sessions disjoint write-sets. Set `tier`, `size`, `needs`, and an honest `horizon_s`; see [`references/routing.md`](references/routing.md).

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

## 4. RTK in children (`rtk` in plan.json)

The choice lives in `plan.json`, so the graph gate shows it (`RTK` column: `mode/via`) and the hash lock covers it — never a loose `dispatch` flag. `route` refuses it when `rtk` is not on PATH (`brew install rtk`). Nothing is installed globally (no `rtk init -g`).

- **Claude child → `hook`:** it gets a Bash-only PreToolUse via `--settings` for that session only. The hook swaps the command and never approves it; it logs rewrites and recalls to `sessions/NN.rtk.jsonl`.
- **Codex, Cursor, Antigravity → `prompt`:** no hook, so dispatch appends RTK's instruction to the prompt. Their recalls are unknown.
- **`guarded`** keeps `git diff`, `git show`, `cat`, `head`, `tail`, `grep` and `rg` raw — code, diffs and search reach the child whole. **`full`** is an experiment arm.

Judge RTK by the task (tokens, turns, done vs blocked), not by RTK's saved bytes. Compare runs with and without it on the same kind of work.

## 5. Score and close

```bash
node <skill>/scripts/handoff.mjs score --run "$HANDOFF_RUN"
```

Show the report and ask the owner: (a) keep it locally; (b) clean the run; (c) create an issue with the report, then clean. Create an issue only after yes.

```bash
node <skill>/scripts/handoff.mjs clean --run "$HANDOFF_RUN" [--branches]
```

`clean` refuses while a run worktree has uncommitted changes. Add `--branches` once every session is merged into one integration branch and you run it from there: it deletes this run's `handoff/<run-id>-NN` branches already merged into HEAD and names any it kept. See [`references/metrics.md`](references/metrics.md).

## Done-check

- [ ] Probe ran before planning; plan has causal deps and disjoint concurrent writes.
- [ ] Route accepted, graph gate completed, and `route --approve` locked the current hash before dispatch.
- [ ] Every brief exists; no child was launched manually, implemented by the parent, or inspected through logs/worktrees.
- [ ] Dispatch digest was used; changed plans were routed and approved again before dispatch.
- [ ] RTK installed → `rtk` was proposed in the graph gate (on, or off with the owner's reason).
- [ ] `rtk` chosen in `plan.json` (not on the command line) and shown in the graph gate when used.
- [ ] Score ran and the owner received the keep / clean / issue-and-clean question.

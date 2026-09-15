# Handoff — optimization sketchpad

Working backlog for the next optimization round of `skills/handoff`. It is not a spec, and it does not ship with the skill. It holds raw observations from real runs, each with its evidence and a one-line proposed change. The owner decides which items graduate; each one lands as an ordinary PR with a version bump.

Runs recorded here:
- `20260914T030353Z`: daily reports, 18 sessions, Codex parent.
- `20260915T135101Z`: aihub, an 8-crate Rust workspace, 11 sessions, Claude Code parent.

## Run 20260915T135101Z — aihub

**Status: finished.** All 11 sessions ended `done`. The scorecard ran; its numbers, and what they miss, are in the last section.

### Shape

- **Goal:** scaffold a daemon + TUI + six-library Rust workspace from a written plan.
- **Cut:**
  - 01: foundation (contract types, crate skeletons with `todo!()`, dependency prefetch).
  - 02–09: in parallel, one crate each. The probe crate is split in two by file.
  - 10: integration.
  - 11: read-only review.
- **Routing:** a dependency graph, no waves. `route` accepted the plan: no write-set collisions, no admission warning.

### Distribution

| # | Session | Tier/size | Slot (final) | Tries | Wall time | Outcome |
|---|---|---|---|---|---|---|
| 01 | workspace + core contract | design/l | antigravity/third-party (pinned) | 2 | 5m killed + 29m | done |
| 02 | probe: claude, codex | mechanical/m | antigravity/gemini | 1 | 36m | done |
| 03 | probe: cursor, antigravity | mechanical/m | claude → cursor/cursor-models | 2 | 3s + 4m | done |
| 04 | router | mechanical/m | codex | 1 | 8.5m | done |
| 05 | pty | mechanical/m | cursor/cursor-models | 1 | 4.3m | done |
| 06 | git worktrees | mechanical/m | antigravity/gemini | 1 | 54m | done |
| 07 | memory / briefs | mechanical/m | claude → antigravity/gemini → cursor/cursor-models | 3 | 3s + ENOSPC + 3m | done |
| 08 | daemon | design/l | codex | 1 | 12m | blocked by sandbox → done, check moved to 10 |
| 09 | TUI | design/l | claude → antigravity/third-party | 2 | 3s + 39m | done |
| 10 | integration | design/l | antigravity/third-party (pinned after reroute) | 1 | 47m | done |
| 11 | review | review/m | claude → codex (pinned) | 1 | 17m | done |

### Quota movement (percent remaining, from probe snapshots)

| Slot | 13:51Z | 14:05Z | 15:40Z | Reading |
|---|---|---|---|---|
| claude | 5h~ 99 | 96 | 63 | Children spent nothing: they all failed auth. The drop is the parent session plus the owner's other Claude sessions, so it can't be attributed. |
| codex | 5h 86 · 7d 77 | 82 · 77 | 25 · 68 | Two sessions (04 at 8.5m, 08 at 12m) ≈ 57 points of the 5h window and 9 of the 7d. The highest cost per minute. |
| cursor | cycle 55 (cursor-models 57) | 55 (57) | 55 (57) | Two ~4-minute sessions don't show at cycle granularity. |
| antigravity | gemini 5h 100 · 3p 5h 100 | 97 · 100 | 93 · 100 | 01 (34m at high effort) plus 02 and 06 (90m) barely registered. |

**Takeaway.** Per unit of work, Antigravity was by far the cheapest pool and Codex's 5h window the most expensive. The built-in prior (~8% per `m` session) overestimates Antigravity and underestimates Codex's 5h window. These are two-point diffs with other owner activity in the same windows, so treat them as directional only.

### Wall-clock lost

- **~10 min:** agy killed at 5m by its default `--print-timeout`, plus diagnosis. Fixed in PR #8 (1.2.2).
- **~56 min:** 03, 07 and 09 died within 3 s on Claude auth at 14:45Z. `dispatch` reroutes only quota deaths, so they sat `failed` until the rest of the wave finished at 15:39Z, and the parent then rerouted them by hand.
- **Dispatcher crash:** at ~15:45Z the dispatcher died on `ENOSPC`. Nine parallel Rust `target/` dirs held ≈ 8.6 GB, and the disk was down to 154 MB. The children survived and the dispatcher did not. The parent cleaned the disk and wrote a wait → adopt → re-dispatch chain.

### Parent interventions

Each of these cost a parent turn that the skill should have made unnecessary.

1. **Toolchain too old.** Rust was 1.76, and the locked dependencies need ≥ 1.85. The parent found it before cutting, and installing a new one needed owner approval.
2. **Empty repository.** With no HEAD, `git worktree add` can't run, so the parent made an initial commit.
3. **Dependents couldn't see 01's output.** Worktrees fork from HEAD. Every dependent brief had to carry an "rsync from `wt/01`" rule, and the integration brief a copy-by-write-set rule.
4. **Codex sandbox.** Under `workspace-write`: no commit (the worktree's common `.git` sits outside the writable roots), no network, no Unix socket bind. The parent pinned 01 off Codex, set a shared `CARGO_HOME` plus `--offline`, and told every child not to commit. Session 08 still blocked on socket tests.
5. **agy launch flags.** The parent patched them in the plugin cache and shipped the fix as PR #8.
6. **Dead slot routed.** The Claude slot read `ok` despite expired OAuth, so four sessions were assigned to a slot that couldn't authenticate.
7. **Re-route undid a fix.** It moved the pending integration session back onto the dead Claude slot, and the parent had to pin it.
8. **Stale quota.** `dispatch` refused to run on a stale `quota.json` until the parent re-probed.
9. **Disk full.** On `ENOSPC` the parent ran `cargo clean` on finished worktrees and wrote the adopt-and-re-dispatch chain.
10. **Guard false positives.** While the run was live, the guard hook blocked diagnostics: a smoke test of `claude -p`, and `pgrep` on launch strings.

## Proposals

Ordered by wall-clock and quota saved per line of change.

### P1. Auth-aware probe
A slot whose every credential is expired must not read `ok`. Mark it `unknown` with the reason, and have `route` skip it.

**The probe already knows.** It says so in the note it prints ("every credential found is expired") and in the `source` field, which falls back to `local-transcript` for exactly this reason. The rule needs no new probing: a slot that fell back to transcripts *because* every credential expired is unusable, not `ok`. Reserve the transcript fallback's `ok` for slots that have no credential source at all. A short-timeout auth check through the CLI is the belt-and-braces version, worth it only if the fallback reason turns out to be ambiguous.

*Evidence:* 20260915T135101Z, sessions 03/07/09 died in 3 s each with `Failed to authenticate: OAuth session expired and could not be refreshed`, while the probe read the slot at 96% `ok` from `local-transcript`. After the owner logged in again mid-run, the same probe read the slot from `claude-oauth` — the two states are already distinguishable in the snapshot the router receives.

### P2. Reroute launch failures, not only quota deaths
An exit within a few seconds, with no progress file and no result file, should be handled like a quota death: blacklist that slot for the run and relaunch the session on the next eligible one. Add auth language to the death regex (`failed to authenticate|oauth|not logged in|login required`).

*Evidence:* 56 minutes of idle wall-clock.

### P3. Dependents must see their dependencies
Two options:
- `dispatch` commits a finished session's worktree on its branch, and forks each dependent from its dependencies' branches merged together.
- The plan names a base (`"base": ["01"]`).

Today the brief has to carry a copy rule instead.

*Evidence:* every dependent brief in 20260915T135101Z.

### P4. Session capability needs
A plan field such as `"needs": ["network", "unix-socket", "git-write"]`. `route` excludes any slot whose launch sandbox forbids one of them. Codex `workspace-write` forbids all three.

*Evidence:* 01 pinned by hand; 08 blocked.

### P5. Dispatcher resilience
- Catch write errors on `state.json` and keep supervising.
- On start, adopt sessions marked `running` whose pid is still alive, and classify them from `result.md` when they exit. Today a restarted dispatcher abandons their dependents at once.
- Re-probe inside `dispatch` when `quota.json` is stale, instead of refusing.

*Evidence:* the ENOSPC crash; the stale-quota refusal.

### P6. Disk preflight for build-heavy fan-outs
Estimate build size per worktree (≈ 1 GB per Rust worktree here) × concurrency, and compare it against free space. `route` warns the way admission control does. It suggests `cargo clean` on finished sessions, or a shared target dir for phases that don't run concurrently.

*Evidence:* ≈ 8.6 GB of builds; 154 MB left.

### P7. Environment preflight
Extends the quota preflight carried over from 14/09. Before briefs are written, check the workspace itself: the toolchain version against the locked dependencies, and whether the repository has a HEAD.

*Evidence:* Rust 1.76; the empty repository.

### P8. Re-route keeps dead slots dead
`route` on a live run must not move pending sessions onto a slot the run already found dead. Carry `state.empty_slots`, extended to auth deaths, into routing. A plan-level `"avoid": ["claude"]` is the manual escape hatch.

*Evidence:* session 10 was re-routed to Claude.

### P9. `blocked:env` is not `blocked`
A session that finished its code but couldn't run a check inside its sandbox should not stall its dependents; the unrun check goes to the integrator. Keep plain `blocked` for missing context.

*Evidence:* 08.

### P10. Guard allows read-only diagnostics
While a run is live, allow `--version`, auth-status checks and process inspection. The guard exists to stop hand-rolled launches, not diagnosis.

*Evidence:* two blocked diagnostics.

### P11. Per-session cost attribution
Snapshot the session's own slot at launch and at exit, not only at run start and end. That way `session_cost_pct` survives concurrent owner activity and a parent that shares a provider with its children.

*Evidence:* the Claude delta couldn't be attributed.

## Carried from run 20260914T030353Z (still open)

1. **Quota preflight with a fallback recorded on the same line.** P1 and P7 extend it.
2. **Family fallback table before launch.** P2 is its dispatch-time counterpart.
3. **Resume protocol.** A `blocked` result carries HEAD, the dirty paths and the minimal test command, and the relaunch brief resumes from that checkpoint.
4. **Stronger acceptance fields in briefs.** The exact test command, lint on changed files, and "nothing outside owned paths".
5. **PR metadata gate** for integration sessions.
6. **Convergence brief** generated from the manifest, so N results are never re-read by hand.

## Scorecard, and what it misses

`handoff score` on 20260915T135101Z:

| Field | Value |
|---|---|
| sessions | 11, all `done` |
| wall clock | 4h |
| parent turns (as counted) | 5 |
| relaunches | 5 |
| quota_deaths / launch_fails / blocked / failed / abandoned | 0 / 0 / 0 / 0 / 0 |
| quota_delta_pct | claude 0 · codex 5 · cursor 0 · antigravity 0 |

Two of those numbers are wrong in ways the proposals above would fix.

**`launch_fails: 0` is false, and it hides this run's main defect.** Four sessions died in seconds on a slot that couldn't authenticate, and one was killed by a 5-minute CLI timeout. All five were recorded as `failed` and then as `relaunches`, so the counter that exists to make launch breakage visible reads zero. Whatever classifier P2 needs to reroute a launch failure is the same one this counter needs.

**`quota_delta_pct` under-reports by design.** The run's own probes showed Codex's 5h window moving ~57 points and Antigravity's gemini 5h ~50, but the scorecard diffs start against end: the 5h windows reset inside a 4-hour run, so the visible residue is 5 points on Codex and nothing elsewhere. Per-session snapshots (P11) are what make this number real. The weekly windows are the honest survivors here — Codex 7d went 77 → 67, Antigravity gemini 7d 100 → 89.

**Parent turns were far more than 5.** Every intervention in the list above was at least one.

### Outcomes

- **01–09 all done.** The two sessions that blocked finished after a reroute: 08 on the Codex sandbox (its socket tests moved to 10) and 07 on the disk-full crash (Cursor, 3 minutes, on the third try).
- **10, integration:** the whole workspace builds, 89 tests pass and clippy is clean, all offline. Headless e2e covers socket permissions, a `/bin/sh` PTY session, detach/reattach with scrollback replay, and a two-step squash merge. It also wrote the README and a verification matrix.
- **11, review:** 14 findings, 5 high and 9 medium, plus a per-item coverage matrix against the plan. Two of the high ones are work-loss paths in the git finish flow, one is a secret-redaction gap in the handoff brief writer, and the matrix names two plan items as missing outright.
- **Fast wasn't worse.** Cursor's 3–4 minute sessions (03, 05, 07) survived integration with their tests passing, and the review found defects spread evenly across crates, not concentrated in theirs. Wall time per session was a function of the provider, not of quality.

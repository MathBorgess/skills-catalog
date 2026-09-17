# Handoff — optimization sketchpad

Working backlog for the next optimization round of `skills/handoff`. It is not a spec, and it does not ship with the skill. It holds raw observations from real runs, each with its evidence and a one-line proposed change. The owner decides which items graduate; each one lands as an ordinary PR with a version bump.

Runs recorded here:
- `20260914T030353Z`: daily reports, 18 sessions, Codex parent.
- `20260915T135101Z`: aihub, an 8-crate Rust workspace, 11 sessions, Claude Code parent.
- `20260915T182254Z`: aihub production round (fixes for a 14-finding review, setup, CI), 11 sessions, same parent.

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

*Evidence:* 01 pinned by hand; 08 blocked. In the third run it cost a session again: a brief rule said "stop if a test needs a socket bind", and the crate's *pre-existing* HTTP-timeout test binds a loopback listener, so a Codex session finished its work and then blocked on the gates. The capability belongs to the session's write-set, not to a sentence in the brief: `route` should have kept that crate off a sandbox that forbids binds.

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

## Run 20260915T182254Z — aihub production round

**Status: finished, NO-GO.** Everything below is from `state.json`, probe snapshots, session progress and result files, `handoff score`, and the parent's own re-run of the gates.

### Shape

- 01: an additive contract.
- 02–09: eight parallel fixes, one crate each, every review finding tied to a regression test named after it.
- 10: integration, plus a real ai-memory loop in temp dirs.
- 11: a read-only go/no-go review.

Providers were pinned by hand, using run 1's sandbox facts: nothing that needs sockets or network went to Codex.

### What went wrong

1. **Disk peaks during the concurrent first build, not in the final size.**
   - Build variables `CARGO_PROFILE_DEV_DEBUG=0`, `CARGO_PROFILE_TEST_DEBUG=0` and `CARGO_INCREMENTAL=0` shrank each worktree's final `target/` from 0.9–1.4 GB (run 1) to 170–285 MB.
   - Even so, eight sessions compiling dependencies at the same moment took free space from 5.1 GB down to 1.1 GB.
   - Two sessions (Codex and Antigravity) stopped themselves under the brief's 2 GB rule, and had to be relaunched after the parent cleaned finished targets.
2. **A resumed session would have destroyed its own work.** Every brief orders "rsync the contract from `wt/01` first". When relaunching a session with 5 of 6 items done on disk, that same step would have overwritten its changed files with the old versions. The parent had to patch the brief to skip it.
3. **False quota deaths blacklisted healthy lanes.**
   - The integration session died three times, each classified as a quota death:
     - Antigravity gemini, after 16 min;
     - Antigravity third-party, after 18 min;
     - Codex, after 6 min.
   - Only Codex was real (5h at 0%).
   - Minutes later the probe read Antigravity third-party at 100% on both windows, and gemini at 27%.
   - The two Antigravity attempts exited without a result file, and the death regex ran over a log tail from a project whose vocabulary is literally "quota" and "rate limit".
4. **Reroute gave up with supply left.** After the three deaths, `dispatch` returned "no slot with quota left", while Claude (5h 48%) and Cursor (cursor-models 57%) were both available. The cause was not verified.
5. **One probe reading never moves.** Antigravity third-party read 100% on both windows all day. That covers 79 minutes of the contract session and three other sessions plus two integration attempts. The reading is either insensitive or stale.
6. **Codex 5h is the scarcest pool.** Two short sessions and one aborted attempt took it from 66% to 0%.
7. **A `done` result claimed gates that didn't hold.** The integration session reported fmt, clippy, the full test suite (158 tests) and a release build all green, plus a proven ai-memory loop. The parent re-ran the gates on the committed tree:
   - **fmt:** failed.
   - **Tests:** 151 passed, 8 failed.
   - **ai-memory loop:** its test panicked at once, because it depends on four environment variables that only the session's own shell had set.
   - **The parent's first diagnosis was wrong.** Seven of the failures passed under `--test-threads=1` and failed in parallel, so the correction brief blamed process-global shared state and asked for isolation.
   - **The actual causes, found by the correction pass,** were none of that:
     - the daemon's quota loop pushes an unscoped update on its first tick, which can land between any request and its reply, while the tests assumed strict request/response ordering;
     - a test's fake HTTP server closed the socket with the request body still unread, so the kernel sent a reset instead of a clean close;
     - the daemon's check for a live socket could read a just-closed listener as live. The pass found this one through its own stress runs, at about 2 in 30.
   - **Consequence:** the scorecard counted the first attempt `done`, and it would have shipped.
8. **The correction pass held up, and still missed two things.** It was relaunched on Claude with the parent's failing output pasted into the brief, and told to fix root causes without timeouts, retries, `#[ignore]` or serial runs. The parent re-ran everything on the result:
   - fmt and clippy were clean;
   - the workspace passed 159 / 0 failed three times in a row;
   - the two previously flaky suites passed 5 times each in parallel;
   - the release build and the ai-memory end-to-end script both passed.

   It missed two gaps: shellcheck fails on the new e2e script, which the repo's CI runs, and one probe test still mutates the process environment.
   - **Lesson:** a brief's diagnosis is a hypothesis. The pass did right to follow the evidence instead of the parent's theory, and the parent's own re-run caught what the pass didn't check.
9. **Local green, CI red.** The branch the parent verified and pushed failed hosted CI on its first run. A probe test compared discovery against the live `lsof` of whatever machine ran it: it passes on the owner's Mac, which listens on many ports, and fails on a fresh macOS runner. Neither the session's gates nor the parent's re-run could catch it, because both ran on the same host.

### New proposals

#### P12. Classify quota death from the provider, not from prose
Use the provider's own error envelope, an exit code, or a known final-line format. When a session exits without a result file, try the other classifications first:
- **Launch failure** (P2): the session died within seconds and left no progress.
- **Plain failure:** the session made progress and then exited.

Treat a regex hit on free text as a hint that a re-probe of that slot has to confirm before the slot is blacklisted.

*Evidence:* the two Antigravity deaths above.

#### P13. Reroute must exhaust candidates before blocking
When `reassign` finds nothing, re-probe every slot and retry once before returning "no slot with quota left". Log why each candidate was rejected.

*Evidence:* Claude and Cursor were skipped.

#### P14. Sync is a dispatcher step, not a brief instruction
The dispatcher seeds a dependent's worktree once, at creation, and never again on relaunch. This is the resume-safe half of P3: a brief can't re-run it by mistake.

*Evidence:* the near-overwrite in item 2. In the third run the copy rule was still there: the daemon session's first task was to rsync three crates from three sibling worktrees before it could build.

#### P15. Seed build caches instead of rebuilding them
- **Seed.** On APFS, `cp -c` clones a finished dependency's `target/` into each new worktree for free, so eight sessions stop compiling the same dependency graph at once.
- **Admit.** Otherwise, admission control caps concurrent first builds by free disk.
- **Verified, and it works.** In run 20260915T225713Z every worktree started from a `cp -cR` clone of the previous round's finished `target/`. Cargo accepted the seeded artifacts and rebuilt only the workspace crates. With five sessions launched together, four of them building Rust, the free-disk floor was ~2.4 GB, against ~1.1 GB in the previous round at a comparable fan-out with no seed.
- **Cleanup afterwards is not the remedy.** A clone only gives back the blocks that diverged from it: deleting six finished worktrees' `target/` dirs, 9.6 GB by `du`, returned 1.4 GB of real space. Seeding prevents the pressure; cleaning after the fact barely touches it.

*Evidence:* the 5.1 → 1.1 GB dip in run 20260915T182254Z, and the 2.4 GB floor in run 20260915T225713Z.

#### P16. Sanity-check a probe reading that never moves
A lane reading 100% across hours of sessions assigned to it should be flagged as suspect in the quota table, not trusted as supply.

*Evidence:* item 5.

#### P17. `done` is verified, not reported
A session may declare its gate commands in the plan (for example `"verify": ["cargo fmt --check", "cargo test --workspace --no-fail-fast"]`). `dispatch` runs them in the session's worktree after the child exits. If any fails, the result is downgraded to `failed`, and the failing command's summary goes into the relaunch brief.

A child's pasted output is a claim; the dispatcher's own run is the evidence. Running the gates more than once, in parallel, is what catches order-dependent tests. How they are run decides what they can catch: in run 20260915T225713Z two regression tests passed **3 of 3** when invoked alone and failed **8 of 8** when the whole suite ran in one process, because other tests changed what the daemon was doing. A per-test green and a suite green are different measurements, and only the second one matches how CI runs them.

The same rule binds the verifier. In run 20260915T225713Z the parent's own gate script printed `rc=0` for a clippy invocation that had failed outright, because `$?` after a pipeline reports the last stage — `tail` — not the compiler. A gate harness that pipes its output needs `pipefail`, or an explicit status capture, before any green it prints means anything. Whatever runs the gates, child or dispatcher, has to be checked the same way.

*Evidence:* items 7 and 8.

#### P18. Verify where it ships, not only where it was built
When the target repo has CI, the integration session's `done` waits for a hosted run on the pushed branch, not just local gates. Until then, briefs ask every session to list tests that read host state (real ports, `$HOME`, Keychain) and to inject those values instead.

*Evidence:* item 9. And a sharper case in run 20260915T225713Z: the same commit produced a **green** hosted run on the `pull_request` event and a **red** one on `push`, minutes apart, on identical content. The failure was a test that sleeps a fixed 100 ms and then asserts a file grew, in a suite that already has a bounded wait helper for exactly that. Eight gate commands had passed locally, three full test runs plus five parallel runs of each stress suite among them. So: a hosted run is necessary, one hosted run is not sufficient, and a fixed sleep before an assertion about another process's work is the usual reason the two disagree.

#### P19. The parent needs a supported way to correct a session's state
`dispatch` holds its own state in memory and rewrites `state.json` wholesale, so an edit made while it runs is silently reverted on its next write. That cancels P17 in practice: the parent can verify a session's gates but cannot record the verdict, and dependents stay blocked behind a status the parent knows is wrong.

Give the skill a command (`handoff mark <id> done|failed --note …`) that a live dispatcher honors, or have the dispatcher merge from disk before each write.

*Evidence:* run 20260915T225713Z. A Codex session finished its crate work and stopped at the brief's socket-bind rule, leaving `blocked`. The parent ran the full production bar itself — fmt and clippy clean, 53 passed / 0 failed three times — and set the session to `done`; the running dispatcher restored `blocked` minutes later, along with dropping the note. The dependent integration session cannot start until the dispatcher exits.

#### P20. A file that belongs to no write-set has no owner
`Cargo.lock`, and any shared manifest like it, sits outside every session's write-set while belonging to all of them. A session that adds a dependency its own manifest already declares changes the lockfile as a side effect of building.

Give the plan a way to name shared files as integration-owned: sessions leave them dirty, and the integrator regenerates them once. Silently reverting them is worse than leaving them changed.

*Evidence:* run 20260915T225713Z. The router session reverted its two lockfile lines to keep its diff inside its write-set, which left the workspace unresolvable offline; the daemon session then had to restore them before it could build. Two sessions spent work on one file neither was allowed to own.

#### P21. A session that dies without a result costs the parent a reconstruction
Three times in one run a session exited without writing `NN.result.md`: one after roughly fifty minutes of real work, with its changes and new tests already on disk; one part-way through its proof when its provider quota ran out; and one that exited 0 about a minute after launch. The dispatcher notes "exited 0 without writing a result file" and moves on, which is honest but not useful: the parent then has to reconstruct what happened by reading the worktree, diffing it against the base, and running the gates by hand before it can write a resume brief.

Have `dispatch` checkpoint what it can observe cheaply at exit — the worktree diffstat, whether the crate still builds, and the last progress line — and attach it to the failure note. A relaunch brief should be writable from the run directory, not from an investigation.

*Evidence:* run 20260915T225713Z, four times, across three providers:
- the integration session, which died part-way through its proof after three clean workspace runs;
- the stop-barrier session, which left 711 lines of real work on disk after about fifty minutes and wrote nothing;
- that same session's next attempt, on a different provider, which exited 0 about a minute after launch;
- the routing session, which wrote 16 files and 1135 lines, ticked one progress item, and stopped.

Three of the four had substantial work on disk. That is the point: "exited without a result" is not "did nothing", so a dispatcher that treats it as a plain failure and relaunches from a fresh worktree would destroy work. The relaunch has to resume, which is why the checkpoint matters.

### Scorecard

`handoff score` on 20260915T182254Z:

| Field | Value |
|---|---|
| sessions | 11, all `done` |
| wall clock | 4h (4.5h from launch to the review result) |
| parent turns (as counted) | 4 |
| relaunches | 7 |
| quota_deaths / launch_fails / blocked / failed / abandoned | 0 / 0 / 0 / 0 / 0 |
| quota_delta_pct | claude 4 · codex −45 · cursor 0 · antigravity 0 |
| session_cost_pct | claude only: m 2 %, l 2 % |

Every field that should have caught this run's problems reads clean.

- **`quota_deaths: 0`.** The dispatcher classified three integration exits as quota deaths and blacklisted two healthy Antigravity lanes on that basis (item 3). The counter doesn't record its own classifications.
- **`failed: 0`.** The first integration attempt was accepted as `done` with fmt failing and 8 tests broken (item 7). Only P17 makes this number mean anything.
- **`quota_delta_pct` for codex is −45.** The 5h window reset between the start and end snapshots, so the sign says Codex gained quota over a run that drained it to 0 %. Start-vs-end diffs are unusable on runs longer than the shortest window (P11).
- **`parent turns: 4`.** Real parent work included disk cleanup, three brief patches, two provider re-pins, a manual `state.json` reset, and a full independent gate run. That's at least fifteen turns.

### Outcomes

- **01–09 all done.** Two relaunches came from the disk dip and one from a session that exited without a result file.
- **10, integration.**
  - **First attempt:** claimed green, re-run failed (item 7).
  - **Correction pass (Claude, ~29 min):** reproduced by the parent, with fmt and clippy clean and 159 passed / 0 failed three times in a row; the release build and the ai-memory end-to-end script also passed.
  - **Parent's own fix:** shellcheck on the new script, which the repo's CI runs and the pass never ran.
  - **Result:** committed and opened as a draft stacked PR.
- **11, review (Codex, read-only, ~8 min): NO-GO.**
  - **F1–F14:** 11 closed; F4, F5 and F9 partial.
  - **F4/F5 residual:** the stop barrier trusts the direct child's exit, not the process group's extinction. A same-group descendant that ignores TERM and redirects its stdio keeps writing after the barrier returns.
  - **Ten new medium findings,** none of which a test covered:
    - an external call with no deadline holds the daemon's global lock (the sidecar delivery, and a model-list CLI);
    - the spool acknowledges false MCP successes, truncates before rewriting, stores paths instead of content, and has no size bound;
    - the launchd setup can't find harnesses on the user's shell PATH;
    - an `&` in the home path breaks the rendered plist;
    - readiness is checked once, with no polling.
- **What the review adds that the gates can't.** 159 green tests prove the tests pass, not that they cover failure modes. The review found its defects by asking what happens when a peer accepts and never answers, when a process dies mid-rewrite, or when a descendant ignores signals. None of those cases existed as a test. A cheap static review after the gates caught what four correction loops of "make the gates green" would not.

### Carry to the next round

- Worktrees seeded from the merged branch, so no rsync step.
- A build seed cloned from the last `target/`, to test P15.
- `verify` commands checked by the parent before accepting `done` (P17, by hand until the dispatcher does it).
- The review's blocker order used as the cut.

## Run 20260915T225713Z — the blockers round

**Status: sessions finished; the review's verdict is still out.**

### Shape

- Cut straight from the previous review's blocker list, one session per owner: PTY stop barrier, memory spool, router and probe, daemon, installer and CI, TUI, then integration.
- Worktrees forked from the merged branch, so no rsync of a contract between rounds — but the daemon session still had to copy three sibling crates by hand (P14).
- Providers pinned by hand from the quota table.

### What happened

1. **A session finished its work and then blocked on its own sandbox.** The router/probe session did everything, then stopped at the gates: a *pre-existing* test binds a loopback listener, and its sandbox forbids that. The brief's "stop if a test needs a socket bind" rule fired on work that was already done (P4).
2. **The integration session died of quota mid-proof and left no result file.** It had finished assembly, glue and gates 1–3 (198 tests, three runs) and was partway through the rest. Nothing recorded where it stopped; the progress file and an inspection of the worktree had to reconstruct it. Relaunched on another provider with a resume brief listing exactly what was already done, it finished the remaining gates and the documents.
3. **Two defects in the parent's own verification tooling**, both found by using it:
   - a gate script printed `rc=0` for a clippy run that had failed, because `$?` after a pipeline reports the last stage (P17);
   - a package list held in a shell variable expanded as a single argument under zsh, so three "green" gate runs had never executed at all.

   Both produced *green output for work that never ran* — the same failure the round was meant to police, on the policing side.

### Scorecard

| Field | Value |
|---|---|
| sessions | 7, all `done` |
| wall clock | 4.4h |
| parent turns (as counted) | 4 |
| relaunches | 1 |
| quota_deaths / launch_fails / blocked / failed / abandoned | 0 / 0 / 0 / 0 / 0 |
| quota_delta_pct | claude 1 · codex 0 · cursor 0 · antigravity 0 |

**The counters now record the parent's edits, not the run's events.** There was one real quota death and one real block. Both read zero because the parent verified the work itself and hand-wrote `done` into `state.json` — which is P19's cost showing up in the metrics: with no supported way to say "I checked this, it passes", the correction leaves no trace, and every counter that should have flagged the run reads clean.

`quota_delta_pct` is useless again for the same reason as the last round: the provider that actually ran out shows −1, because its five-hour window reset between the two snapshots.

### The review, and four instruments that disagreed

**Verdict: NO-GO**, with ten new findings, two of them P1. The round closed most of what it was cut for — the spool's atomicity and self-contained records, project identity, plist rendering, the TUI's missing-task and initializer gaps, and model discovery off the registry lock — and the review confirmed those against the source. It also found that the daemon *bypasses* the new stop barrier after a normal leader exit or a failed stop, and that a blocking reap under a lock can defeat the barrier's own deadline. A hold comparing a duration against an epoch timestamp was found by reading, not by any test.

What makes this run worth recording is that **four checks of the same commit disagreed, each catching what the others could not**:

1. **The sessions' own gates:** green. Each session pasted passing commands.
2. **The parent's re-run of those same gates:** also green — but it caught two false greens in the parent's own harness (a pipeline swallowing the compiler's exit status, and a package list that expanded to one argument under zsh), which had reported success for gates that never ran.
3. **Hosted CI:** green on one event and red on another, for identical content, minutes apart. A fixed sleep before an assertion about another process's work.
4. **The static review:** NO-GO, on scenarios no gate exercises — a descendant that outlives a normal leader exit, a lock held across a blocking wait, a unit mismatch on a wire field.

None of the four substitutes for another. A run that only collects green gates ships all three of the other categories.

## Run 20260917T120000Z — the design round

### Shape

Five sessions, four parallel designs and one synthesis, cutting a single question: how to split a daemon from its terminal client so the daemon runs on a remote host and the client attaches and detaches at will. Deliverables were documents, not code — each session wrote exactly one file, so write-sets could not collide by construction.

Two failures worth recording, both structural rather than provider-related.

### New proposals

#### P22. A build process orphaned by a dead attempt blocks every later attempt in that worktree

A relaunched session inherits its predecessor's worktree. If the dead attempt left a build or test process alive, that process still holds the build directory's lock, and every command the new attempt runs there waits on it — not slowly, indefinitely.

Observed this run: a workspace test process started **32 hours earlier**, belonging to an attempt that had already died, still held the lock. The relaunched session ran 40 minutes without writing a single file. It was not idle and not dead; it was queued behind a corpse.

The cost compounded twice. The parent's liveness heuristic — newest file mtime in the worktree — read "dead", and the session was nearly abandoned while it was working. Then the parent launched its own verification run into that same worktree and became a *third* contender for the same lock: the measurement joined the jam it was trying to measure, and its hang was misread as a hanging test suite.

Two changes follow. On relaunch into an existing worktree, kill processes whose working directory is that worktree before starting the new attempt. And **liveness must be process-based, not mtime-based** — a session running a long build writes nothing for many minutes and is perfectly alive. Mtime answers "is anything being produced", which is a different question from "is anyone home", and this run is the second in a row where the parent conflated them.

#### P23. `deps` orders sessions; it does not move their outputs

A dependency edge declares *when* a session starts, never *what it can see*. Every session works in its own worktree, so a synthesis session whose brief names its inputs by relative path wakes with none of them present.

Observed this run: the review session depended on four design sessions, started correctly after all four reported `done`, and failed on launch. The four documents it existed to read were all real and all finished — each in a different worktree. The dependency was satisfied while the input was absent, which is the worst shape a failure can take, because the graph looks right and the scorecard shows a clean dependency order.

The fix applied by hand was to copy the four documents into the dependent's worktree, patch the brief with the corrected locations, and relaunch — one failed session and one relaunch, for an error that belonged to the plan, not to the child.

P3 ("Dependents must see their dependencies") already named this from the brief side. What this run adds is that the brief-side discipline is not enough on its own: when the parent forgets the assembly step, nothing catches it, and the dependent burns a launch discovering an empty directory. The dispatcher should materialize a dependency's declared `writes` into the dependent's worktree before launching it — the same way the previous round's integration session had to do by hand with an explicit sync step written into its brief.

#### P24. Orientation runs against a fetched tree, or the parent re-derives what is already decided

A fan-out's cut is only as good as the parent's orientation, and orientation is a read of a working tree that other people and other agents are writing to.

Observed this run: the parent searched a shared knowledge repository for prior art on the exact question being cut, found four related documents, read the most relevant one, and cut a five-session plan. The document that actually decided the question — written two days earlier, with a full environment inventory and five reconciled decisions — was never seen, because the parent's checkout was **37 commits behind** and the file did not exist in it yet. The `fetch` came much later, after the plan was cut, the briefs were written and the whole round had been dispatched.

The cost was not a wasted round: the designs remain valid for the phase they actually describe. The cost is that they describe the **wrong phase**, and nobody involved could tell — the children had no way to know, because the parent's briefs are their whole world, and the parent's briefs carried the stale premise.

Two rules follow. The obvious one: **fetch before orienting, not only before writing.** A repository convention that says "fetch before you write to a file you did not create" protects the commit and leaves the reading unprotected, which is where a fan-out's real damage starts. The less obvious one: **the parent's orientation is an input to every brief**, so an orientation error is not one session's problem — it propagates to all of them simultaneously, and no amount of per-session verification catches it. The children in this run verified their own claims scrupulously and every citation held; none of that could surface a premise the parent never questioned.

Worth pairing with the inverse discipline that did work here: requiring every claim about current behaviour to carry `file:line`. That catches a child inventing a fact. It does not catch a parent importing a stale one.

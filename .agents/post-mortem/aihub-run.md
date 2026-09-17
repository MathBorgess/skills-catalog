# Post-Mortem: Aihub Multi-Harness Fan-Out Run & 26 Optimization Proposals

- **Incident Runs**: `20260915T135101Z` (scaffold) & `20260915T182254Z` (production/fixes)
- **Target System**: `aihub` (8-crate Rust workspace: daemon, PTY, TUI, router, probes, git worktree manager)
- **Harness Environment**: Antigravity (Gemini / 3p), Codex, Cursor, Claude Code
- **Repository Context**: [PR #10](https://github.com/MathBorgess/skills-catalog/pull/10)
- **Author**: Matheus Borges

---

## 1. Executive Summary

During the execution of an 11-session Rust workspace build distributed across four multi-agent providers (Antigravity, Codex, Cursor, and Claude Code), multiple operational breakdowns surfaced. While all sessions eventually completed and produced passing integration builds, the execution consumed excess wall-clock time, crashed the supervisor on disk exhaustion, blacklisted healthy quota lanes due to prose regex false positives, and suffered from five silent-green verification harness failures.

Analysis of these failures yielded **26 actionable optimization proposals (P1–P26)**. This post-mortem documents the empirical failure modes, the root causes, and the phased architectural response implemented in `skills/handoff` and `skills/shunt`.

---

## 2. Key Failure Modes & Empirical Evidence

### A. The 56-Minute Auth Stall (P1, P2)
- **Symptom**: Sessions `03`, `07`, and `09` died within 3 seconds of spawn on Claude Code with `Failed to authenticate: OAuth session expired`.
- **Root Cause**: The probe had detected expired OAuth tokens, but fell back to local transcripts (`local-transcript`) where historical usage was recorded, marking the slot as `ok` (96% remaining). The dispatcher only rerouted quota deaths (`QUOTA_DEATH`), not immediate bootstrap/auth failures. As a result, those sessions sat in a `failed` state for 56 minutes of idle wall-clock while waiting for the rest of the wave to finish, requiring manual parent intervention.
- **Remedy**:
  - **P1**: Auth-aware probe. When every credential found is expired, the slot must read `unknown` (with reason) rather than falling back to transcripts. `route` skips it.
  - **P2**: Reroute launch failures (< 15s exit with code != 0 or auth error signature) immediately to the next candidate slot.

### B. Sandbox Constraint Violations (P4)
- **Symptom**: Session `08` (daemon) and foundational contract session `01` failed or blocked when executing loopback socket bindings or git operations under Codex.
- **Root Cause**: Codex CLI runs under `--sandbox workspace-write`. Under this sandbox, Unix domain sockets/loopback listener bindings, network access, and git commits (since `.git` resides outside the worktree's writable root) are prohibited. The parent had to manually pin session `01` off Codex and defer session `08`'s socket tests to integration.
- **Remedy**:
  - **P4**: Explicit capability declaration (`"needs": ["network", "unix-socket", "git-write"]`). The router checks provider capability matrices and excludes incompatible sandboxes.

### C. Dead Slot Re-Assignment (P8)
- **Symptom**: When re-routing pending work, the router reassigned a blocked session back onto the expired Claude slot that had just failed.
- **Root Cause**: `handoff route` did not consult `state.empty_slots` or the previous session state, operating strictly from the ambient `quota.json`.
- **Remedy**:
  - **P8**: The router reads `state.json` and respects dead slots, keeping dead slots dead across the run.

### D. False Quota Death Blacklisting Healthy Lanes (P12, P13)
- **Symptom**: The integration session died three times and was classified as a quota death on Antigravity Gemini and Antigravity Third-Party, blacklisting them, even though probes moments later showed 100% and 27% quota remaining.
- **Root Cause**: Quota classification used a naive regex matching `quota|rate limit` over raw session logs. Because the project being built was a quota management daemon, its normal compiler diagnostics contained those exact terms.
- **Remedy**:
  - **P12**: Distinguish provider error envelopes/exit codes from codebase prose.
  - **P13**: Exhaust candidate slots and re-probe before declaring run-wide blockage.

### E. Silent-Green Verification Harness (P26)
- **Symptom**: The parent's verification tooling failed five times with code 0 or plausible output instead of catching broken builds:
  1. Piping without `pipefail` masked compiler errors with a succeeding second stage.
  2. Unquoted shell variables expanded as a single argument, causing three test targets to be skipped.
  3. A process guard grepped for a string present in its own heredoc script, terminating valid runs.
  4. Loose regex matched previously fixed temporary paths.
  5. A nonexistent timeout command failed with exit code 127, which was only noticed because of the non-zero code.
- **Remedy**:
  - **P26**: Verification harnesses must enforce `set -euo pipefail`, verify output non-emptiness, and validate the test runner itself before trusting its green signal.

### F. Dependency Output Invisibility Across Worktrees (P3, P23)
- **Symptom**: A dependent review session woke up after all four prerequisite design sessions reported `done`, but found an empty directory.
- **Root Cause**: `deps` in `plan.json` declared temporal ordering (when to start), but did not materialize physical outputs across isolated git worktrees (`wt/01`, `wt/02`, etc.).

---

## 3. The 26 Proposals & Phased Roadmap

| ID | Title | Domain | Phase |
|---|---|---|---|
| **P1** | Auth-aware probe (expired credentials read `unknown`, skipped by route) | Probe & Route | **Phase 1 (Implemented)** |
| **P2** | Reroute launch & auth failures immediately (< 15s exits) | Dispatcher | **Phase 1 (Implemented)** |
| **P3** | Dependents see dependency outputs (worktree materialization) | Graph | Phase 2 |
| **P4** | Session capability needs (`needs`: network, unix-socket, git-write) | Preflight/Route | **Phase 1 (Implemented)** |
| **P5** | Dispatcher resilience (catch write errors, adopt running children on restart) | Dispatcher | Phase 2 |
| **P6** | Disk preflight for build-heavy fan-outs | Preflight | Phase 2 |
| **P7** | Environment preflight (toolchain version, git HEAD presence) | Preflight | Phase 2 |
| **P8** | Re-route keeps dead slots dead (consult `state.empty_slots` & `plan.avoid`) | Route | **Phase 1 (Implemented)** |
| **P9** | `blocked:env` distinct from task blocked | Lifecycle | Phase 2 |
| **P10** | Guard hook permits read-only diagnostics (`pgrep`, smoke tests) | Guard Hook | Phase 3 |
| **P11** | Per-session quota deltas in scorecard (start vs end snapshot) | Metrics | Phase 3 |
| **P12** | Classify quota death from provider envelope, not free prose | Dispatcher | **Phase 1 (Implemented)** |
| **P13** | Reroute exhausts candidate slots before declaring block | Dispatcher | **Phase 1 (Implemented)** |
| **P14** | Sync / materialization as a dispatcher step, not brief prose | Graph | Phase 2 |
| **P15** | Seed build cache across concurrent worktrees | Infrastructure | Phase 2 |
| **P16** | Distrust probe readings that never move (stale/insensitive detection) | Probe | Phase 3 |
| **P17** | Done is verified on disk, not self-reported by child result file | Verification | Phase 3 |
| **P18** | Verify in target delivery environment (CI host differences) | Verification | Phase 3 |
| **P19** | Supported CLI mechanism for supervisor to patch session state | Tooling | Phase 2 |
| **P20** | Unowned files without write-set protected from child mutation | Worktree | Phase 2 |
| **P21** | Session dying without result file requires clean worktree rebuild | Lifecycle | Phase 3 |
| **P22** | Terminate orphaned background build processes on worktree relaunch | Process Mgmt | Phase 2 |
| **P23** | `deps` orders execution; dispatcher must move declared `writes` outputs | Graph | Phase 2 |
| **P24** | Fetch before orienting; orientation errors propagate to all briefs | Supervision | Governance |
| **P25** | Worktree repository resolved at plan acceptance, not from ambient `cwd` | Worktree | Phase 2 |
| **P26** | Verification tooling must not fail silently green (`pipefail`, non-empty checks) | Verification | Phase 3 |

---

## 4. Phase 1 Implementation Achievements

In this iteration:
1. **`prompts/model-routing.md`**: Created a versionable, model-agnostic specification defining `fast_cheap_own` vs `frontier_reasoning`, task tiers, and `needs` capabilities.
2. **`skills/handoff/scripts/handoff.mjs`**:
   - Implemented P1 (auth-aware probe ignoring transcripts when tokens are expired).
   - Implemented P2 (instant reroute of auth and launch failures).
   - Implemented P4 (filtering slots by `needs` against `PROVIDER_CAPABILITIES`).
   - Implemented P8 (dead slots and avoid lists honored in routing).
   - Implemented P12 (isolating auth and launch failures from quota prose).
   - Implemented P13 (reassigning across all capable candidate slots).
3. **`skills/handoff/SKILL.md`**:
   - Mandated transparent reporting of the implementation graph, parallel concurrency, and provider/model pairs.
   - Enforced a strict **Human Approval Gate** prior to running `dispatch`.
4. **`skills/shunt`**:
   - Standardized subagent delegation for summarization and mechanical writes against `prompts/model-routing.md`.

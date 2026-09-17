# Model Routing Specification & Rubric

A versionable, model-agnostic decision guide for allocating tasks to model classes, sizing session scope, declaring environment capabilities, and avoiding wasteful frontier quota consumption.

---

## 1. Core Model Classes

Agents and orchestrators categorize candidate models into two fundamental classes:

| Class | Profile | Archetypal Roles | Typical Models |
|---|---|---|---|
| `fast_cheap_own` | High throughput, minimal token/quota cost, lower reasoning depth, fast execution. | Outlines, summaries, mechanical file generation, lint fixes, repetitive tests, boilerplate, syntactic renames. | Gemini Flash, Claude Haiku, Cursor Composer/Auto, GPT-4o-mini. |
| `frontier_reasoning` | High reasoning capacity, complex constraint satisfaction, expensive token/quota budget. | Architecture design, ambiguous specification analysis, cross-module integration, root-cause debugging, security and logic review. | Gemini Pro, Claude Sonnet/Opus, GPT-4o, o1, o3-mini. |

---

## 2. Task Taxonomy

Every delegated task or session must be classified across three dimensions:

### Tier (Cognitive Demand)
- **`mechanical`**: Clear, unambiguous contract. No architectural decisions left open. Input and output shapes are already defined.
- **`design`**: Involves open choices, API boundary definition, trade-off evaluation, or solving novel structural problems.
- **`review`**: Read-only verification, audit of invariant preservation, finding subtle regressions, or security inspection.

### Size (Scope & Blast Radius)
- **`s`**: Touches 1–2 files, localized edits, fast feedback loop (< 5 min).
- **`m`**: Touches one module or subsystem (3–6 files), established interfaces, standard test suite.
- **`l`**: Cross-cutting subsystem, deep refactoring, or foundational contracts affecting multiple downstream consumers.

### Capabilities (`needs`)
Declared environment requirements that execution slots must guarantee:
- **`network`**: Outbound HTTP/API access (e.g. dependency download, remote API tests).
- **`unix-socket`**: Binding local IPC/Unix domain sockets or loopback servers during tests.
- **`git-write`**: Creating git commits, worktrees, branches, or mutating git state.
- **`pty`**: Interactive terminal / pseudoterminal allocation.
- **`disk-write`**: Standard filesystem mutation permissions.
- **`high-memory`**: Large compilation units or heavy build pipelines (> 4 GB RAM).

---

## 3. Decision Matrix (Agnostic Routing)

| Tier | Size | Primary Model Class | Fallback Rule | Quota / Token Principle |
|---|---|---|---|---|
| `mechanical` | `s` | `fast_cheap_own` | — | Never burn metered frontier quota on localized mechanical tasks. |
| `mechanical` | `m` | `fast_cheap_own` | `frontier_reasoning` (only if own pool is 0%) | Prefer own/cheap model even if multiple turns are needed. |
| `mechanical` | `l` | `fast_cheap_own` | `frontier_reasoning` (downgrade alert) | Keep reasoning effort low; if split is possible, decompose into smaller `mechanical` tasks. |
| `design` | `s` | `frontier_reasoning` | `fast_cheap_own` (with human warning) | High reasoning saves rework. |
| `design` | `m` | `frontier_reasoning` | — | Do not trade down to small model; wait or use secondary frontier slot. |
| `design` | `l` | `frontier_reasoning` | — | Pin highest capability slot available. |
| `review` | Any | `frontier_reasoning` | — | Review requires invariant catching; cheap models produce false confidence. |

---

## 4. Capability Filtering (`needs` Gate)

Before assigning a task to any slot/sandbox, check intersection against known sandbox constraints:

1. If task declares `needs: ["unix-socket"]` or `needs: ["network"]`:
   - Exclude any sandbox running under restricted isolation (e.g. sandboxed workspace-write runners with forbidden loopback/sockets).
2. If task declares `needs: ["git-write"]`:
   - Exclude runners whose working directory cannot mutate parent git state or where `.git` is outside writable roots.
3. If no slot satisfies all `needs`:
   - Fail early during planning. Do **not** dispatch and hope the child ignores the requirement.

---

## 5. Consumption Rules by Skill

### Single-Provider Context (`shunt`)
- **Read Path (Summarization)**: When an outline is insufficient, spawn a subagent with `fast_cheap_own`. The parent large model retains context space for judgment.
- **Write Path (Boilerplate/Tests)**: Always use `fast_cheap_own` for `track-write` tasks. Never compose mechanical blobs in the frontier parent's context.

### Multi-Provider Context (`handoff`)
- Maps the classes above into concrete provider slots, multi-window quotas (5h vs 7d), and lane kinds (`own` vs `frontier`).
- See [`skills/handoff/references/routing.md`](skills/handoff/references/routing.md) for provider-specific slot tables and CLI bindings.

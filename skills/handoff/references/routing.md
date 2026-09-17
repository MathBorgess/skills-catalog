# Cutting and routing

How to cut remaining work into a dependency graph, and what the router does with it. The arithmetic — weights, assignment, admission control — lives in `scripts/handoff.mjs`. This file is the judgment around it.

## Parent provider

Detect from this session's environment. That is the provider whose tokens you are trying not to spend, and the one the router starts the rotation *after*.

| Signal | Parent |
|---|---|
| `CLAUDECODE` or `CLAUDE_CODE_ENTRYPOINT` set | claude |
| `CODEX_HOME` set and this process is `codex` | codex |
| Cursor Task/subagent tools, or `CURSOR_AGENT` | cursor |
| an `agy` session — no environment marker is published, so say so rather than guessing one | antigravity |
| none of the above | unknown — spread across whatever slots the probe finds |

## Cutting

1. List remaining work as atomic jobs: one sentence, plus the paths each would write.
2. Job B needs job A's output → `"deps": ["A"]`. Do not batch them into rounds; the dispatcher starts B the moment A is done, whatever else is still running.
3. Two jobs with no dependency path between them must have **disjoint write-sets**. Read-only overlap is fine and needs no dependency.
4. Prefer more sessions over fewer, until a session would be only glue — merge glue into a neighbour.
5. There is no wave cap. Concurrency is bounded by supply, and the router already accounts for it.

**False independence.** `route` refuses the plan when two concurrent sessions write overlapping paths, so this cannot reach a launch. It compares literal path prefixes and always treats lockfiles as shared, which catches the ordinary cases; it cannot reason about two globs that overlap only in the middle. Still yours to notice: two sessions editing the same barrel file, the same generated snapshot, or the same migration sequence through different paths.

## Sizing, tiering, and capabilities

The core decision matrix and model taxonomy live in [`prompts/model-routing.md`](../../../prompts/model-routing.md).

`size` drives the cost estimate and admission control. `tier` and `needs` drive model choice and sandbox eligibility.

| `size` | A session that… |
|---|---|
| `s` | touches one or two files, mechanical, no design left open |
| `m` | one module, a handful of files, the shape is already decided |
| `l` | a subsystem, or any job where the design is still being made |

| `tier` | Model class to pick | Multi-provider role |
|---|---|---|
| `mechanical` | `fast_cheap_own` | cheaper/faster id (Flash, Haiku, Composer, GPT-4o-mini) — implementation, tests, lint, renames |
| `design` | `frontier_reasoning` | stronger id (Pro, Sonnet, GPT-4o/o3) — architecture, ambiguous spec, judgment calls |
| `review` | `frontier_reasoning` | stronger id, read-only audit, finding subtle edge cases |

### Session capabilities (`needs`)
Sessions can declare environment requirements:
`"needs": ["network", "unix-socket", "git-write", "pty", "disk-write"]`

`route` matches these against provider sandbox limitations:
- **Codex (`workspace-write`)**: Forbids `network`, `unix-socket` (cannot bind loopback/IPC in tests), and `git-write` (common `.git` lies outside the writable root). Any session needing these **must not** be routed to Codex.
- **Claude, Cursor, Antigravity**: Support network, sockets, and git operations under standard permissions flags.

Leave `model` unset unless the user named one or the tier clearly demands a specific id. An unset model means the CLI default, which never goes stale. Never invent a model id from memory; probe the CLI's own list.

## Lanes

A provider that bills **several pools** carries lanes. Two do: Cursor splits one billing cycle into **Cursor Models** (Auto, Composer, the Grok tiers) and **Other Models** (named third-party, at that model's API price); Antigravity splits into **Gemini** and **Claude/GPT**, each with its own five-hour and weekly windows. Lanes are alternatives, not gates — a session draws from exactly one — so a slot is worth its *best* lane, and the model id is what decides which one it spends. Why the splits exist and how they are read: [`references/quota.md`](quota.md).

Every lane declares a **kind**, and that is what tier selection matches on — never the vendor's name for it:

| `tier` | Lane kind it prefers | Cursor | Antigravity | Why |
|---|---|---|---|---|
| `mechanical` | `own` | Cursor Models | Gemini | a rename on a frontier model spends metered credit for nothing |
| `design`, `review` | `frontier` | Other Models | Claude/GPT | a judgment call traded down to a small own-model is a real downgrade |

The preference is steep but not a wall: the other lane still wins when the preferred one is far more loaded, and the routing table marks that session `↓`. A lane with no supply left is not a candidate at all — so a design session is never routed into a pool already at 100%, it goes to another provider instead.

`route` **pins** the lane by taking a model id from the CLI's own list — `cursor-agent --list-models`, `agy models` — never one from memory, and prefers a named own-model over bare `auto` (a vendor's Auto router can land in the other pool). When a CLI publishes no list the lane stays a preference its default model may ignore, and the cell is marked `*`. A model you set yourself always wins, and pins the lane that model belongs to.

On Antigravity the tier also sets `--effort` (`mechanical` → `low`, `review` → `medium`, `design` → `high`): reasoning intensity is the same spend decision as model choice, in that CLI's own vocabulary.

At dispatch, a lane that dies of quota blacklists **that lane**, not the slot: a session that exhausts Other Models is relaunched on Cursor Models with a model from that pool, without a parent turn.

## What the router does with it

In order:

1. **Independence gate.** Overlapping concurrent write-sets → the plan is refused with the colliding paths named. Fix the cut, do not argue with it.
2. **Supply per slot**, measured over `horizon_s`, **per window and then at the minimum**. A slot's worth is a *rate*, not a stock: a five-hour window sitting at 15% that reopens in ten minutes is worth more across a two-hour run than a weekly window at 30% that does not. Because a plan gates on every window at once, the slot is worth the least of them — but each refills on its own clock, so the five-hour window stops binding a long run while a weekly window binds it the whole way. A slot blocked only by a window that reopens inside the horizon is assigned work and **held** until that reset instead of being discarded; the table shows it as `holds 30m`. Which window binds depends on the horizon, which is why `horizon_s` is worth setting honestly.
3. **Admission control.** Estimated demand (per-session cost by provider and size, from this machine's own history once it has three samples, a built-in prior before that) against total supply. Over budget → the table carries a warning naming the shortfall. Act on it: cut fewer and bigger sessions, or dispatch after the soonest reset. Launching into a wall costs a whole session and produces nothing.
4. **Assignment**, minimising projected utilisation per **lane** rather than counting sessions — a five-minute lint job and a subsystem refactor are not one each, and two lanes of the same slot compete for work independently. A user-named provider wins and is marked as an override.
5. **Rerouting**, at dispatch time: a session that dies with quota language is relaunched on the next eligible lane — which may be the other lane of the same provider — up to three attempts, without a parent turn.

## Execution transparency and human approval gate

Before running `dispatch`, the supervisor agent must synthesize the plan for the user:
1. **Implementation Graph**: Present the DAG and dependency order so the human can inspect sequencing.
2. **Parallel Concurrency**: State how many sessions will execute in parallel and the total session count.
3. **Provider and Model Assignment**: Detail which slot, lane, and model were chosen for each session, with `tier` and `needs` justification.
4. **Approval Gate**: Pause and wait for explicit user confirmation before executing `dispatch`.

## Isolation

A session with a non-empty `writes` gets its own git worktree under the run directory, on branch `handoff/<run-id>-<NN>`. A session with an empty `writes` runs read-only in the current checkout. The script creates the worktree and sets the child's working directory — no provider-specific worktree flag is involved, which removes a whole class of launch failure.

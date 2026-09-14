# Cutting and routing

How to cut remaining work into a dependency graph, and what the router does with it. The arithmetic — weights, assignment, admission control — lives in `scripts/handoff.mjs`. This file is the judgment around it.

## Parent provider

Detect from this session's environment. That is the provider whose tokens you are trying not to spend, and the one the router starts the rotation *after*.

| Signal | Parent |
|---|---|
| `CLAUDECODE` or `CLAUDE_CODE_ENTRYPOINT` set | claude |
| `CODEX_HOME` set and this process is `codex` | codex |
| Cursor Task/subagent tools, or `CURSOR_AGENT` | cursor |
| none of the above | unknown — spread across whatever slots the probe finds |

## Cutting

1. List remaining work as atomic jobs: one sentence, plus the paths each would write.
2. Job B needs job A's output → `"deps": ["A"]`. Do not batch them into rounds; the dispatcher starts B the moment A is done, whatever else is still running.
3. Two jobs with no dependency path between them must have **disjoint write-sets**. Read-only overlap is fine and needs no dependency.
4. Prefer more sessions over fewer, until a session would be only glue — merge glue into a neighbour.
5. There is no wave cap. Concurrency is bounded by supply, and the router already accounts for it.

**False independence.** `route` refuses the plan when two concurrent sessions write overlapping paths, so this cannot reach a launch. It compares literal path prefixes and always treats lockfiles as shared, which catches the ordinary cases; it cannot reason about two globs that overlap only in the middle. Still yours to notice: two sessions editing the same barrel file, the same generated snapshot, or the same migration sequence through different paths.

## Sizing and tiering

`size` drives the cost estimate and therefore admission control. `tier` drives the model.

| `size` | A session that… |
|---|---|
| `s` | touches one or two files, mechanical, no design left open |
| `m` | one module, a handful of files, the shape is already decided |
| `l` | a subsystem, or any job where the design is still being made |

| `tier` | Model to pick |
|---|---|
| `mechanical` | the cheaper/faster id the CLI lists — implementation, tests, lint, renames |
| `design` | a stronger id — architecture, ambiguous spec, anything with a judgment call inside |
| `review` | a stronger id, read-only, no worktree |

Leave `model` unset unless the user named one or the tier clearly demands a specific id. An unset model means the CLI default, which never goes stale. Never invent a model id from memory; probe the CLI's own list.

## What the router does with it

In order:

1. **Independence gate.** Overlapping concurrent write-sets → the plan is refused with the colliding paths named. Fix the cut, do not argue with it.
2. **Supply per slot**, measured over `horizon_s`. A slot's worth is a *rate*, not a stock: a five-hour window sitting at 15% that reopens in ten minutes is worth more across a two-hour run than a weekly window at 30% that does not. A slot that is poor now but refills inside the horizon gets assigned work and **held** until its reset instead of being discarded — the table shows it as `holds 9m`.
3. **Admission control.** Estimated demand (per-session cost by provider and size, from this machine's own history once it has three samples, a built-in prior before that) against total supply. Over budget → the table carries a warning naming the shortfall. Act on it: cut fewer and bigger sessions, or dispatch after the soonest reset. Launching into a wall costs a whole session and produces nothing.
4. **Assignment**, minimising projected utilisation per slot rather than counting sessions — a five-minute lint job and a subsystem refactor are not one each. A user-named provider wins and is marked as an override.
5. **Rerouting**, at dispatch time: a session whose provider dies with quota language is relaunched on the next eligible slot, up to three attempts, without a parent turn.

## Isolation

A session with a non-empty `writes` gets its own git worktree under the run directory, on branch `handoff/<run-id>-<NN>`. A session with an empty `writes` runs read-only in the current checkout. The script creates the worktree and sets the child's working directory — no provider-specific worktree flag is involved, which removes a whole class of launch failure.

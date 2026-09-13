# Routing

How to cut work into sessions and how to pick a provider and a model for each. Defaults below lose to any user constraint.

## Parent provider

Detect from the environment of this session, then treat that provider as the one whose tokens you are trying not to spend:

| Signal | Parent |
|---|---|
| `CLAUDECODE` or `CLAUDE_CODE_ENTRYPOINT` set | claude |
| `CODEX_HOME` set and this process is `codex` | codex |
| Cursor Task/subagent tools, or `CURSOR_AGENT` | cursor |
| none of the above | unknown — spread across whatever CLIs exist |

## Cutting

1. List remaining work as atomic jobs (one sentence, the paths it would touch).
2. Two jobs share a write-path, or one needs the other's output → same session, or job B goes in **wave 2**.
3. Each session in a wave has a disjoint write-set. Read-only overlap is allowed.
4. Prefer more sessions over fewer, until a session would be only "glue" (merge that glue into a neighbor).
5. Cap a wave at the number of installed provider CLIs times two. Leftovers become the next wave.

False independence (this is an `independence_miss` if you launch it anyway): two sessions both editing the same module, barrel file, lockfile, or generated snapshot.

## Provider and model

Pool = binaries that `command -v` finds: `agent` or `cursor-agent` → cursor; `claude` → claude; `codex` → codex.

Load [`quota.md`](quota.md) and probe remaining percent **before** this list.

Assignment, in order:

1. User named a provider or model for a session → that session gets it (even if the provider is `low`).
2. Drop `empty` providers. Avoid `low` (`< 20%` remaining, unless the user set another floor).
3. Weighted round-robin over the eligible set (`ok` ∪ `unknown`), `assigned[p] / weight[p]`, tie → next after the parent in `cursor → claude → codex`. Two eligible providers must not all land on one row.
4. One session and compact mode → do not launch unless a provider was named; the brief is the product.
5. Only the parent CLI exists and it is not `empty` → sessions go there (still as separate processes/worktrees).
6. A chosen binary is missing at launch → next eligible provider, note it on the table.

Model, after the provider is set:

- Probe ids as in [`providers.md`](providers.md). Never invent a stale id.
- Mechanical implementation, tests, lint → the cheaper/faster id the probe lists (or the CLI default).
- Design, architecture, review, ambiguous spec → a stronger id from the same probe (or the CLI default).
- If the probe fails, omit `--model` / `-m` and write `default` in the table.

## Isolation

File-writing session → own worktree, named `handoff-<run-id>-<NN>`. Read-only session → current checkout.

## `manifest.md`

Write this before launch. Update status and metrics after the wave.

```markdown
# Handoff <run-id>

- mode: compact | fan-out
- parent_provider: cursor | claude | codex | unknown
- skill_version: <SKILL.md metadata.version>
- workspace: <cwd, not a home path expansion>

## Quota

| Provider | Remaining | Bucket | Source |
|---|---|---|---|
| cursor | | ok \| low \| empty \| unknown | |
| claude | | | |
| codex | | | |

## Routing

| Session | Goal | Provider | Model | Remaining | Isolation | Brief | Pid | Status |
|---|---|---|---|---|---|---|---|---|
| 01 | | | | | | $RUN/sessions/01.md | | launched \| done \| blocked \| failed |

## Waves

- wave 1: 01, 02
- wave 2: 03 (after 01)

## Metrics

See [`metrics.md`](metrics.md). Fill after the run.
```

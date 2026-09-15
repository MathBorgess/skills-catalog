# Provider CLIs

The launch recipes live in `scripts/handoff.mjs` (`launchArgs`), not here — a recipe in prose is a recipe that drifts from the installed binary. This file is what to do when one breaks.

## What every launch does

The dispatcher, for each session:

1. Creates the git worktree itself (`handoff/<run-id>-<NN>` under the run directory) and sets it as the child's working directory. **No provider-specific worktree flag is used.** Those flags differ per CLI and per version, and guessing one wrong is a launch failure that costs a whole session.
2. Passes `sessions/NN.prompt.md` — three lines pointing at the brief — as the prompt argument. Never a long prompt on the command line, never an API key.
3. Redirects stdout and stderr to `logs/NN.log`, detached, so the whole set goes out together and nothing blocks on anything else.
4. On exit, reads `sessions/NN.result.md` for a status. No result file plus quota language in the log tail → the slot — or, on a provider with lanes, the one lane that died — is marked empty and the session is relaunched elsewhere. No result file and no quota language → `failed`.

Read-only sessions (`"writes": []`) skip the worktree and run in the current checkout.

## Model ids

Probe, never remember: `agent --list-models`, `claude --help`, `codex --help`. Put the id in the plan's `model` field, or leave it unset for the CLI default. A stale id from training is a launch failure.

`route` already runs `--list-models` itself on a provider that bills more than one pool, to pin a session's lane to an id that exists (see [`routing.md`](routing.md)). A `model` you set in the plan always wins over that, and pins the lane that model belongs to.

## When a launch fails

`score` counts `launch_fails`. When one happens:

1. Check the installed binary's own `--help`. Believe it over any file in this repository.
2. Fix `launchArgs` in `scripts/handoff.mjs` for that provider, and say in the report which flag changed.
3. Relaunch that session id. Do not fall back to doing its work yourself.

Known incompatibility worth keeping: Codex rejects `--sandbox` together with `--approve-for-me`. Because the dispatcher sets the child's working directory to the worktree, `--sandbox workspace-write` alone is sufficient and `--approve-for-me` is never needed.

## Missing binary

A provider that is not installed never reaches assignment — `probe` reports it `absent` and the router ignores it. If a binary disappears between probe and dispatch, that session fails to launch and is rerouted on the next dispatch tick.

## Parent in-process subagents

Only when no provider CLI is installed at all, or the session is read-only and finishes in seconds. A subagent runs on the parent's own quota, which is the quota this skill exists to protect, and it is invisible to the scorecard.

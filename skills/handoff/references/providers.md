# Provider CLIs

Recipes for launching one child. Probe with `command -v` before using a binary. If flags on the installed binary disagree with this file, believe `--help` and record `launch_fail` so the next review can patch this page.

Cursor binary: `agent`, or `cursor-agent` if `agent` is missing.

Every launch must:

- pass `$RUN/sessions/NN.prompt.md` as the prompt (absolute path inside the prompt text, or stdin)
- be non-interactive
- not block the parent from launching the rest of the wave (background process, `persist`, or `--bg`)
- write pid (or session id) into `manifest.md`

Do not pass API keys on the command line.

## Cursor

File-writing:

```bash
agent -p --trust --force --model <id> -w "handoff-<run-id>-<NN>" "$(cat "$RUN/sessions/NN.prompt.md")"
```

Read-only: drop `-w`. Long-running across disconnects: `agent persist` with the same prompt; poll with `agent persist list`. If `persist` rejects `--trust`/`--force`/`--model`, drop those flags or fall back to a background `agent -p`.

Model ids: `agent --list-models`. Pick from that list. If the list fails, omit `--model` and table it as `default`.

## Claude

File-writing:

```bash
claude -p --dangerously-skip-permissions --output-format text --model <id> -w "handoff-<run-id>-<NN>" "$(cat "$RUN/sessions/NN.prompt.md")"
```

Read-only: drop `-w`. To return immediately: add `--bg` and poll with `claude agents`.

Model: `--model` takes an alias (`sonnet`, `opus`) or a full id from `--help`. If unknown, omit `--model` and table it as `default`.

## Codex

Worktree first, then exec. Worktrees live under the run dir so they are not left in the project:

```bash
git worktree add -b "handoff/<run-id>-<NN>" "$RUN/wt/<NN>" HEAD
codex exec --sandbox workspace-write --model <id> -C "$RUN/wt/<NN>" -o "$RUN/sessions/NN.last.md" "$(cat "$RUN/sessions/NN.prompt.md")"
```

Read-only: skip the worktree and `-C`, use `--sandbox read-only`. If the child blocks on approvals, rerun that session with `--sandbox workspace-write` and `--approve-for-me`; still not `--dangerously-bypass-approvals-and-sandbox` unless the user asked.

Model: `-m` / `--model`. If unknown, omit it and table it as `default`.

## Parallelism

Issue every launch for the current wave in one turn (several background shells). Waiting for session 01 before starting 02 is a sequential dispatch — do not do that inside a wave.

## Fallback when a CLI is missing

Reassign that row to the next **eligible** provider ([`quota.md`](quota.md)), rewrite the prompt, relaunch, and leave the original provider name struck through in the table (`codex → claude`).

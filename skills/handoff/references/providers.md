# Provider CLIs

`scripts/handoff.mjs` owns launch recipes. Probe the installed CLI's help and model list before changing a recipe; never preserve a remembered flag or model id.

| CLI | Model selection | Effort selection |
|---|---|---|
| Claude | `--model <id>` | `--effort <low|medium|high>` |
| Codex | model config | `-c model_reasoning_effort=<low|medium|high>` |
| Cursor | `--model <id>` | model-id suffix (for example, `-low`, `-medium`, `-high`) |
| Antigravity | `--model <id>` | `--effort <low|medium|high>` |

RTK (`rtk` in plan.json): Claude gets `--settings` with a Bash-only PreToolUse (`scripts/rtk-hook.mjs`) for that session; the other CLIs get RTK's instruction appended to the prompt. Every child runs with `RTK_TELEMETRY_DISABLED=1`.

An explicit plan model pins its lane; an explicit effort is an owner override. Route may warn, but does not reroute either. See [`routing.md`](routing.md).

Dispatcher behavior: create an isolated worktree for a writing session, pass the short prompt, redirect output to its private log, and read result files for status. A read-only session stays in the current checkout. Never use provider-specific worktree flags.

When launch fails, inspect that binary's `--help`, fix `launchArgs`, report the changed flag, then relaunch the same id. If quota killed a lane, dispatch may use the next eligible lane; do not do the child's work. Missing binaries are excluded by probe.

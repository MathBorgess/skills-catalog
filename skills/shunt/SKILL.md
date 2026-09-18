---
name: shunt
description: "Use when a large or frontier model is about to read a large file, dump a repo into context, write boilerplate, config, or mechanical tests, or the user says shunt, bulk-read, bulk reader, code writer, don't ingest, cheaper model, save tokens, or keep the large model for reasoning, or mentions rtk. Activates a guard that refuses full-file reads over the threshold and points this model at an outline script or a small/fast subagent. Not for study-wiki, teach-me, or sending work to other CLIs (that is handoff)."
argument-hint: "activate [--rtk[=full]] | inspect <path> | edit <path> | run -- <cmd> | deactivate | clean"
metadata:
  author: Matheus Borges
  version: 1.1.0
---

# Shunt

Keep **this** model's context small. Heavy I/O is absorbed by `scripts/shunt.mjs` or by a small/fast subagent. You keep judgment: architecture, hard debug, security review, and edits from excerpts.

The plugin hook (`scripts/guard.mjs`) enforces the Read rules only while this skill is active. Cursor and Codex have no PreToolUse — this file is the whole enforcement there.

## 1. Policy by output kind

- **Never compress**: Code, diffs, and search results are kept whole. Never wrap `git diff`, `git show`, `cat`, or `grep`/`rg` — run them directly.
- **Compress**: Build, install, test, and lint noise.

## 2. Activate — before any Read or Write

```bash
node <skill>/scripts/shunt.mjs activate [--rtk | --rtk=full]
node <skill>/scripts/shunt.mjs status
```

**Recommended: if `rtk --version` works, activate with `--rtk`.** It filters build, test, lint and git noise through RTK while keeping diffs, code and search raw (§6). `activate` prints a `tip` line when RTK is installed and you left it off — act on it or say why not. Whether RTK lowers task cost is still being measured ([skills-catalog#27](https://github.com/MathBorgess/skills-catalog/issues/27)).

`<skill>` is this folder. `status` prints the run dir (`$TMPDIR/shunt/<id>/`). No marker → the hook is inert. A new `activate` starts a new run: the last run's events are dropped. `--rtk` is §6.

## 3. Before every Read

```bash
node <skill>/scripts/shunt.mjs inspect --file PATH
```

- **Under** threshold → `Read` PATH.
- **Over** → `Read` only the outline inspect wrote. Never `Read` PATH.
- Outline is enough to pick a span → `excerpt --file PATH --start N --end M`, then `Read` the excerpt.
- Outline is not enough → spawn a **small/fast** subagent (class `fast_cheap_own` in [`prompts/model-routing.md`](../../prompts/model-routing.md), e.g. Gemini 3.8 Flash [universal in Agy], Claude Haiku, Cursor Grok 4.6, Composer, GPT-5.6 Luna [minor] / GPT-5.4 Mini) to write a summary into the run dir (cap in [`references/read-path.md`](references/read-path.md)). `Read` only that summary. Do not read the subagent transcript.

Deny-reason from the hook is this same flow. Follow it; do not retry the full `Read`.

## 4. Edits & Edit bypass

You edit; cheap models do not. Use `path:line` from the outline, excerpt that span, then `Edit`.

When a patch target is over the normal threshold:
```bash
node <skill>/scripts/shunt.mjs edit --file PATH
```
The guard permits a full `Read` of PATH up to 2× the line cap (700 lines / 64 KB). Above that ceiling, excerpt as usual.

## 5. Run wrapper — builds, tests, installs

```bash
node <skill>/scripts/shunt.mjs run -- <cmd…>
```

Combined raw output goes to `<run dir>/logs/<slug>.log`. Prints filtered view: ANSI/controls stripped, progress lines collapsed `(×N)`, every error/warning preserved, last 40 lines tail, exit code, and raw log pointer (recovery path).

## 6. RTK (optional, `--rtk`)

[RTK](https://github.com/rtk-ai/rtk) filters command output per command (100+ tools) and keeps the raw output recallable. With `activate --rtk`, while the run is live the guard sends each Bash command through `rtk rewrite` and `run --` delegates to `rtk <cmd>`. Needs `rtk` on PATH (`brew install rtk`). Never `rtk init -g`: the run scopes RTK, so other sessions stay a control group. Telemetry is off in every call.

- `--rtk` = **guarded** (default): `git diff`, `git show`, `cat`, `head`, `tail`, `grep`, `rg` never go through RTK — §1 still holds. `--rtk=full` sends everything; use it only as an experiment arm.
- Commands RTK has no filter for (`npm test`, `node …`) run through §5's own filter.
- The guard only swaps the command. It never approves one; your permission flow decides.

Reading RTK output: treat it as the complete result and batch related commands into one call. A truncated result prints its own recovery command (`rtk recall <hash>`); run `rtk proxy <cmd>` only when output is empty when output was expected, contradicts its exit code, or is garbled. Each `recall`/`proxy` counts as a `recover`.

## 7. Writes — boilerplate, config, mechanical tests

Spawn a **small/fast** subagent (class `fast_cheap_own` in [`prompts/model-routing.md`](../../prompts/model-routing.md)) **before you draft the file**. `track-write --file PATH` → child writes to disk → `write-done --file PATH`. Do not `Read` the result. Do not compose the blob in this context.

When the writer is running, the hook refuses your Read/Edit/Write on those paths. After it finishes, full `Read` stays refused; excerpts are allowed if you later edit. Open measurement: [`references/write-path.md`](references/write-path.md).

## 8. You still do

Small files. Excerpts. Architecture. Ambiguous spec. Security. The subagent's goal and constraints.

## 9. Deactivate & end-of-run question

```bash
node <skill>/scripts/shunt.mjs deactivate
```

Prints the report (inspected, outlines, excerpts, recover, edit bypass, commands, raw vs printed bytes, est. tokens saved labelled estimate; with `--rtk`, rewrites, recalls and RTK's own filtered-token count for this cwd and window) and appends to `$TMPDIR/shunt/metrics.jsonl`.

Show the report to the owner and ask:
(a) keep it locally, do nothing;
(b) clean that run (`node <skill>/scripts/shunt.mjs clean`);
(c) open an issue in MathBorgess/skills-catalog with the report (`gh issue create` only after owner confirms), then clean.

## Done-check

- [ ] `activate` ran before the first Read/Write; `status` showed a live run dir.
- [ ] Code, diffs, and search commands (`git diff`, `git show`, `cat`, `grep`/`rg`) ran unwrapped.
- [ ] Every over-threshold file went through inspect/outline (or `edit --file` within 2× ceiling).
- [ ] Verbose commands ran through `shunt.mjs run -- <cmd>`.
- [ ] RTK installed → activated with `--rtk`, or the reason for leaving it off stated.
- [ ] With `--rtk`: no global `rtk init`; diffs, code and search stayed raw unless the owner chose `full`.
- [ ] Grunt writes were spawned before drafting; results were not read back.
- [ ] No subagent transcript ingested.
- [ ] `deactivate` ran, report shown to owner with the (a)/(b) question.

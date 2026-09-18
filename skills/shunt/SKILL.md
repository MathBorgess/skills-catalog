---
name: shunt
description: "Use when a large or frontier model is about to read a large file, dump a repo into context, write boilerplate, config, or mechanical tests, or the user says shunt, bulk-read, bulk reader, code writer, don't ingest, cheaper model, save tokens, or keep the large model for reasoning. Activates a guard that refuses full-file reads over the threshold and points this model at an outline script or a small/fast subagent. Not for study-wiki, teach-me, or sending work to other CLIs (that is handoff)."
argument-hint: "activate | inspect <path> | edit <path> | run -- <cmd> | deactivate | clean"
metadata:
  author: Matheus Borges
  version: 0.1.0
---

# Shunt

Keep **this** model's context small. Heavy I/O is absorbed by `scripts/shunt.mjs` or by a small/fast subagent. You keep judgment: architecture, hard debug, security review, and edits from excerpts.

The plugin hook (`scripts/guard.mjs`) enforces the Read rules only while this skill is active. Cursor and Codex have no PreToolUse — this file is the whole enforcement there.

## 1. Policy by output kind

- **Never compress**: Code, diffs, and search results are kept whole. Never wrap `git diff`, `git show`, `cat`, or `grep`/`rg` — run them directly.
- **Compress**: Build, install, test, and lint noise.

## 2. Activate — before any Read or Write

```bash
node <skill>/scripts/shunt.mjs activate
node <skill>/scripts/shunt.mjs status
```

`<skill>` is this folder. `status` prints the run dir (`$TMPDIR/shunt/<id>/`). No marker → the hook is inert.

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

## 6. Writes — boilerplate, config, mechanical tests

Spawn a **small/fast** subagent (class `fast_cheap_own` in [`prompts/model-routing.md`](../../prompts/model-routing.md)) **before you draft the file**. `track-write --file PATH` → child writes to disk → `write-done --file PATH`. Do not `Read` the result. Do not compose the blob in this context.

When the writer is running, the hook refuses your Read/Edit/Write on those paths. After it finishes, full `Read` stays refused; excerpts are allowed if you later edit. Open measurement: [`references/write-path.md`](references/write-path.md).

## 7. You still do

Small files. Excerpts. Architecture. Ambiguous spec. Security. The subagent's goal and constraints.

## 8. Deactivate & end-of-run question

```bash
node <skill>/scripts/shunt.mjs deactivate
```

Prints the report (inspected, outlines, excerpts, recover, edit bypass, commands, raw vs printed bytes, est. tokens saved labelled estimate) and appends to `$TMPDIR/shunt/metrics.jsonl`.

Show the report to the owner and ask:
(a) keep it locally, do nothing;
(b) clean that run (`node <skill>/scripts/shunt.mjs clean`);
(c) open an issue in MathBorgess/skills-catalog with the report (`gh issue create` only after owner confirms), then clean.

## Done-check

- [ ] `activate` ran before the first Read/Write; `status` showed a live run dir.
- [ ] Code, diffs, and search commands (`git diff`, `git show`, `cat`, `grep`/`rg`) ran unwrapped.
- [ ] Every over-threshold file went through inspect/outline (or `edit --file` within 2× ceiling).
- [ ] Verbose commands ran through `shunt.mjs run -- <cmd>`.
- [ ] Grunt writes were spawned before drafting; results were not read back.
- [ ] No subagent transcript ingested.
- [ ] `deactivate` ran, report shown to owner with the (a)/(b) question.

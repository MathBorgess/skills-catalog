---
name: shunt
description: "Use when a large or frontier model is about to read a large file, dump a repo into context, write boilerplate, config, or mechanical tests, or the user says shunt, bulk-read, bulk reader, code writer, don't ingest, cheaper model, save tokens, or keep the large model for reasoning. Activates a guard that refuses full-file reads over the threshold and points this model at an outline script or a small/fast subagent. Not for study-wiki, teach-me, or sending work to other CLIs (that is handoff)."
argument-hint: "activate | inspect <path>"
metadata:
  author: Matheus Borges
  version: 0.0.0
---

# Shunt

Keep **this** model's context small. Heavy I/O is absorbed by `scripts/shunt.mjs` or by a small/fast subagent. You keep judgment: architecture, hard debug, security review, and edits from excerpts.

The plugin hook (`scripts/guard.mjs`) enforces the Read rules only while this skill is active. Cursor and Codex have no PreToolUse — this file is the whole enforcement there.

## 1. Activate — before any Read or Write

```bash
node <skill>/scripts/shunt.mjs activate
node <skill>/scripts/shunt.mjs status
```

`<skill>` is this folder. `status` prints the run dir (`$TMPDIR/shunt/<id>/`). No marker → the hook is inert.

## 2. Before every Read

```bash
node <skill>/scripts/shunt.mjs inspect --file PATH
```

- **Under** the threshold (see inspect) → `Read` PATH.
- **Over** → `Read` only the outline inspect wrote. Never `Read` PATH.
- Outline is enough to pick a span → `excerpt --file PATH --start N --end M`, then `Read` the excerpt.
- Outline is not enough → spawn a **small/fast** subagent (class `fast_cheap_own` in [`prompts/model-routing.md`](../../prompts/model-routing.md), e.g. Gemini 3.8 Flash [universal in Agy], Claude Haiku, Cursor Grok 4.6, Composer, GPT-5.6 Luna [minor] / GPT-5.4 Mini) to write a summary into the run dir (cap in [`references/read-path.md`](references/read-path.md)). `Read` only that summary. Do not read the subagent transcript.

Deny-reason from the hook is this same flow. Follow it; do not retry the full `Read`.

## 3. Edits

You edit. Cheap models do not. Use `path:line` from the outline, excerpt that span, then `Edit`. Finding a span is not a reason to open the whole file.

## 4. Writes — boilerplate, config, mechanical tests

Spawn a **small/fast** subagent (class `fast_cheap_own` in [`prompts/model-routing.md`](../../prompts/model-routing.md)) **before you draft the file**. `track-write --file PATH` → child writes to disk → `write-done --file PATH`. Do not `Read` the result. Do not compose the blob in this context.

When the writer is running, the hook refuses your Read/Edit/Write on those paths. After it finishes, full `Read` stays refused; excerpts are allowed if you later edit.

Open measurement (do not hook-refuse a parent `Write` yet): [`references/write-path.md`](references/write-path.md).

## 5. You still do

Small files. Excerpts. Architecture. Ambiguous spec. Security. The subagent's goal and constraints.

## 6. Deactivate

```bash
node <skill>/scripts/shunt.mjs deactivate
```

When the job that needed shunt is done. The hook goes inert.

## Done-check

- [ ] `activate` ran before the first Read/Write; `status` showed a live run dir.
- [ ] Every over-threshold file went through inspect/outline (and a small subagent only when the outline was not enough). No full-file Read of those paths.
- [ ] Edits used excerpts, not whole files.
- [ ] Grunt writes were spawned before this model drafted them; results were not read back.
- [ ] No subagent transcript ingested.
- [ ] `deactivate` ran, or the user asked to keep it armed.

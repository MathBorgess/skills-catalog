# Read path

How a shunted Read is allowed to reach this model. Thresholds and caps live in `scripts/shunt.mjs` — do not copy the numbers into prompts.

## Over vs under

`inspect --file PATH` counts lines and bytes. **Over** either cap → do not `Read` PATH. **Under** both → `Read` PATH, no ceremony.

A one-line minified bundle is over on bytes. A 400-line file is over on lines.

## Outline (no subagent)

`inspect` writes an outline when the file is over. The outline is procedure: path, counts, headings, symbol `path:line` pointers. It is capped. `Read` that file.

If the pointers are enough to pick an edit span, skip the subagent.

## Excerpt

```bash
node <skill>/scripts/shunt.mjs excerpt --file PATH --start N --end M
```

1-indexed, inclusive. The span must itself fit the line cap; the script refuses otherwise. `Read` only the excerpt file it prints.

`Read` of PATH with `offset`/`limit` whose window fits the line cap is also allowed (the hook permits it). Prefer `excerpt` so the span is on disk and the tool call stays small.

## Edit bypass

Mark a file as a patch target:

```bash
node <skill>/scripts/shunt.mjs edit --file PATH
```

The guard allows a full `Read` of PATH when lines and bytes are within 2× the standard cap (`EDIT_LINE_MAX` and `EDIT_BYTE_MAX` in `scripts/shunt.mjs`). Above that ceiling, the normal outline/excerpt flow applies. The guard records an `edit_read` event when the bypass read occurs, and `edit_done` when an `Edit`, `Write`, `NotebookEdit`, or `MultiEdit` tool call is invoked on PATH.

## Summary (small/fast subagent)

Spawn only when the outline is not enough to choose a span or to answer the question.

- **Model selection**: Select the environment's `fast_cheap_own` model per [`prompts/model-routing.md`](../../../prompts/model-routing.md) (e.g. Gemini 3.8 Flash [universal in Agy], Claude Haiku, Cursor Grok 4.6, Composer, GPT-5.6 Luna [minor] / GPT-5.4 Mini). Never spawn a frontier model for ingestion or summaries.
- Working directory: the project, not the shunt run dir.
- Write the summary to the path `inspect` / `status` names under `summaries/`.
- Cap: the same outline cap. Pointers, not pasted bodies. No transcript back to the parent.
- Parent `Read`s only that summary file.

If the summary file is itself over the cap, the hook refuses it. Truncate; do not open PATH to "fix" the summary.

## Recovery vs excerpt

An `excerpt` event is expected usage: retrieving a bounded window of code.

A `recover` event means compression failed and the model had to access raw data:
1. Denied full `Read` on a path where an outline already existed.
2. Reading a run wrapper's raw command log (`<run dir>/logs/<slug>.log`).

`events.jsonl` tracks `recover` separately from `excerpt`.

## Hook

Armed only after `activate`, for this workspace, until `deactivate` or the TTL. Inert otherwise — including in study-wiki / teach-me / handoff sessions that never activated shunt.

Live handoff `wt/` and `logs/` are not this hook's job; the handoff guard owns those.

Denied full `Read` → the deny-reason is step 3 of `SKILL.md`. Do not retry PATH.

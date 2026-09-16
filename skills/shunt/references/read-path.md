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

## Summary (small/fast subagent)

Spawn only when the outline is not enough to choose a span or to answer the question.

- Working directory: the project, not the shunt run dir.
- Write the summary to the path `inspect` / `status` names under `summaries/`.
- Cap: the same outline cap. Pointers, not pasted bodies. No transcript back to the parent.
- Parent `Read`s only that summary file.

If the summary file is itself over the cap, the hook refuses it. Truncate; do not open PATH to "fix" the summary.

## Hook

Armed only after `activate`, for this workspace, until `deactivate` or the TTL. Inert otherwise — including in study-wiki / teach-me / handoff sessions that never activated shunt.

Live handoff `wt/` and `logs/` are not this hook's job; the handoff guard owns those.

Denied full `Read` → the deny-reason is step 2 of `SKILL.md`. Do not retry PATH.

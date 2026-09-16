# Write path

Mechanical generation (boilerplate, config, tests whose shape is already decided) must never be drafted in the large model's context. The child writes straight to disk.

## Sequence

1. Decide the path and the constraints (you). Name a reference file the child may read, not a paste of it.
2. `track-write --file PATH` — marks write-delegate **running**.
3. Spawn a **small/fast** subagent: write PATH, then stop. It may `Read` PATH's reference and the brief; it does not talk back except `write-done` materialised as the file on disk.
4. `write-done --file PATH` — running → done.
5. You do not `Read` PATH. Existence, tests, or `status` are the check.

While **running**, the hook refuses your Read/Edit/Write on PATH (no race with the child). After **done**, full `Read` stays refused; an excerpt is allowed if you later edit.

Edits of existing logic are not this path. Those are read-path excerpts plus your `Edit`.

## Future test — parent-composed write blob

PreToolUse on `Write` fires **after** this model has already generated `contents`. Refusing the tool saves the disk, not the tokens. The saving move is step 3 happening *before* a draft.

**Do not** hook-refuse a parent `Write` of a large blob yet.

Track, later:

| | Behaviour | What it catches | Cost |
|---|---|---|---|
| **A (now)** | Guidance only: spawn the child before drafting. Count how often the parent still composes `contents` (`parent_composed_write`). | Nothing at the hook. | Cheap; the model drops it under pressure, same class of failure handoff used to measure as `parent_implemented`. |
| **B (candidate)** | Hook-refuse `Write` whose `contents` exceed the line/byte cap; deny-reason points at `track-write` + small subagent. | The turn already wasted generating the blob, plus false positives on a real design patch that happens to be long. | One burned turn per miss; may block legitimate frontier writes. |

The test is: log allowed over-cap parent Writes without denying (shadow of B), compare token use against sessions that followed A, then decide. Not implemented. `scripts/shunt.test.mjs` names this case and asserts A — the hook does **not** deny those Writes.

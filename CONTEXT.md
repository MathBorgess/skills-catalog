# skills-catalog

Skills that keep an expensive model on judgment and move I/O, dispatch and measurement into scripts.

## Language

### Shunt

**Outline**:
A capped map of an over-threshold file (headings, symbols with `path:line`) written by a script instead of reading the file.
_Avoid_: summary (a summary is written by a small model; an outline is deterministic)

**Excerpt**:
A line span of a file copied to disk so the model reads only that span. Expected use, not a failure.

**Edit bypass**:
Permission to read a file marked as a patch target in full, up to a ceiling.

**Run wrapper**:
A command run whose raw output goes to disk and whose filtered view reaches the model; the raw log path is its recovery path.

**Recovery path**:
The direct route back to the uncompressed data (an excerpt span, a raw log) without re-running or re-reading everything.

**Recover event**:
The model had to take the recovery path because compression dropped what it needed. The signal that compression failed.
_Avoid_: counting excerpts as recover events

**RTK mode**:
`off`, `guarded` or `full` — whether a run's shell output goes through RTK. **Guarded** never sends diffs, code or search to RTK; **full** sends everything and is an experiment arm.
_Avoid_: "rtk on" (say which mode)

### Handoff

**Session**:
One unit of the cut work, briefed and run by a child agent in its own worktree.

**Slot**:
A provider × account with its quota windows; may hold several **lanes** billed separately.

**Graph gate**:
The single owner approval of the plan — graph, slot/lane, model and effort per session — reached by grilling rounds and locked by the plan's hash.
_Avoid_: approval (alone; there is only one gate)

**Override**:
A model or effort the owner set on a session instead of the derived default.

**Digest**:
The batched per-session outcome `dispatch` returns, carrying each finished session's result block.

**RTK via**:
How a child gets RTK: `hook` (a Claude child's scoped PreToolUse) or `prompt` (the instruction appended for a hookless CLI).

**Settle window**:
Seconds `dispatch` keeps waiting after the first actionable event to coalesce others before returning. A tunable.

### Evaluation

**Metrics line**:
One JSON object per run appended by a skill to its history in the OS temp dir.

**Scope drift**:
A skill doing work its `description` does not claim, or another skill's work.

## Relationships

- **Shunt** produces **recover events** and **excerpts**; the ratio of the first to compressed reads is its failure rate.
- **Handoff** turns a plan into **sessions** on **slots**, gated once by the **graph gate**, reported through the **digest**.
- Every skill writes **metrics lines**; `skills-evaluate` reads them and never the other way round.

## Flagged ambiguities

- "Recovery" meant both expected excerpts and failed compression — resolved: only failures are **recover events**.

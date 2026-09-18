# Session brief

Write `NN.md` and the three-line `NN.prompt.md` for every approved session. The child has no parent context. Write Goal and Constraints yourself; expand scope lists and boilerplate only from the plan. Point to artifacts; never paste them. Redact secrets and PII.

## `NN.md`

```markdown
# Session <NN>: <title>

## Goal
One paragraph. What done looks like. Written by the parent.

## In scope
- paths this session may read
- paths this session may write

## Out of scope
- paths and questions it must not touch
- work that belongs to another session (name the NN)

## Constraints
- user-stated constraints, verbatim where they were specific
- do not expand scope
- write progress after each checklist item; write the result file last

## Done when
Checklist the child ticks. Observable, not vibes.

## Pointers
- path or URL — already-written specs, plans, ADRs, issues, commits, diffs
- do not paste those artifacts here

## Suggested skills
- skill-name — why the child should load it

## Progress and result
After each `## Done when` item, append one line to `$RUN/sessions/<NN>.progress.md`:
`<ISO timestamp> done: <the item>`.
Before exiting, write `$RUN/sessions/<NN>.result.md` using its template. Then stop.
```

## `NN.prompt.md`

```markdown
Read the session brief at `$RUN/sessions/<NN>.md` and execute only that brief.
Append to `$RUN/sessions/<NN>.progress.md` as you finish each item, and write
`$RUN/sessions/<NN>.result.md` before you exit.
Do not read other session briefs. Do not wait for the parent.
```

Substitute absolute paths. This is a pointer, not a copy of the brief.

## `NN.result.md`

```markdown
# Result <NN>

- status: done | blocked | failed
- files changed:
  - path — one-line what
- remaining: none | <what the parent must route next>
- summary: one paragraph
```

Dispatch reads completed result files and puts their result blocks in its digest. Read that digest first; open a result file only to act. On relaunch, read the short progress file, start at the unfinished item, and dispatch the same id.

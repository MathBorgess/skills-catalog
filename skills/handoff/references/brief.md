# Session brief

One file per session: `$RUN/sessions/NN.md`. The matching `$RUN/sessions/NN.prompt.md` is the only prompt passed to the CLI — it points at this brief and at the result path. Do not rely on the child inheriting the parent's conversation.

## `NN.md`

```markdown
# Session <NN>: <title>

## Goal
One paragraph. What done looks like.

## In scope
- paths this session may read
- paths this session may write

## Out of scope
- paths and questions it must not touch
- work that belongs to another session (name the NN)

## Constraints
- user-stated constraints
- do not expand scope
- last action: write the result file

## Done when
Checklist the child ticks. Observable, not vibes.

## Pointers
- path or URL — already-written specs, plans, ADRs, issues, commits, diffs
- do not paste those artifacts here

## Suggested skills
- skill-name — why the child should load it

## Result file
Write `$RUN/sessions/<NN>.result.md` using the result template. Then stop.
```

## `NN.prompt.md`

```markdown
Read the session brief at `$RUN/sessions/<NN>.md` and execute only that brief.
Write `$RUN/sessions/<NN>.result.md` before you exit, using its result template.
Do not read other session briefs. Do not wait for the parent.
```

Substitute the absolute paths. That prompt is the CLI argument (or stdin). Keep it this short.

## `NN.result.md`

The child writes this. The parent reads only this file from the child.

```markdown
# Result <NN>

- status: done | blocked | failed
- files changed:
  - path — one-line what
- remaining: none | <what the parent must route next>
- summary: one paragraph
```

## Rules

- Redact API keys, passwords, tokens, and personally identifiable information.
- If the user described what the next session is for, that description is the Goal.
- Suggested skills are names the child should invoke, not a reading list for the parent.

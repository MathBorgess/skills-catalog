# Session brief

One `NN.md` per session, plus a three-line `NN.prompt.md` that is the only thing the CLI receives. The child does not inherit the parent's conversation, so everything it needs is either in the brief or reachable from a pointer in it.

## Who writes which part

**You write `## Goal` and `## Constraints` yourself.** They carry the knowledge that exists only in this conversation — the decision already made, the approach already rejected, the constraint the user stated three messages ago. A model that was not here cannot reconstruct them, and a brief missing them produces a child that blocks on a fact you had.

Everything else — scope lists from the plan's `writes`/`reads`, pointer paths, the done-when checklist, boilerplate — is expansion. Delegate it to a cheap model with `brief.md` and the plan entry as its input, writing straight to `sessions/NN.md`. **Do not read the expansion back.** If you find yourself reviewing what you dictated, the delegation cost more than it saved.

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

Substitute absolute paths. Keep it this short — it is a pointer, not a copy of the brief.

## `NN.result.md`

The child writes this. It is the only file of the child's the parent reads.

```markdown
# Result <NN>

- status: done | blocked | failed
- files changed:
  - path — one-line what
- remaining: none | <what the parent must route next>
- summary: one paragraph
```

## Why progress is not optional

A session killed by its provider's quota leaves a half-finished worktree. Without a progress file the replacement starts from item one and redoes work that is already on disk — and quota deaths cluster, so this is not the rare case. With one, the relaunch brief opens with *"items 1–3 are done and committed; start at 4"*, and the second attempt costs a fraction of the first.

When you relaunch a session, read its `progress.md` (short, one line per item), patch `## Done when` to start where it stopped, and dispatch the same id.

## Rules

- Redact API keys, passwords, tokens, and personally identifiable information.
- If the user described what the next session is for, that description is the Goal.
- Suggested skills are names the child should invoke, not a reading list for the parent.
- Pointers, never pasted artifacts. A brief that inlines a spec is a brief that goes stale the moment the spec changes.

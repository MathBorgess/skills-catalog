# Reasoning in place of a scorer

The mechanism's decision sites stay. No scorer answers them. The model that already holds the context writes a typed answer, and `handoff.mjs` checks the shape and enforces the floors. A later scorer may fill the same fields. It may not cross a floor, and it is not part of this skill.

## 1. Supervisor, before `route`

For each session, write all of these. Route refuses the plan when any item is missing or when `needs` is not exactly the yeses.

1. **Tier.** `mechanical` when the shape is fixed, `design` when choices stay open, `review` when the session only verifies.
2. **Size.** `s` for one or two local files, `m` for one established module, `l` for a subsystem or an open design.
3. **Capabilities, one yes or no each.** `network`, `unix-socket`, `git-write`, `pty`, `disk-write`, `high-memory`. A yes is a requirement of the work. Write every answer in `capability_answers`, and write `needs` as the list of yeses (`[]` when every answer is no).

Do not leave a question out and do not let a tool pick the answer.

## 2. Child, in the brief

In Constraints, for each file name the read level (`outline`, `excerpt`, or `whole`) and for each command say whether the output must arrive whole. Whole files stay inside the shunt ceiling. Diffs, code, and search stay whole. Those floors are not decisions.

## 3. Supervisor, after a `gated` claim

`done` in `result.md` is the child's claim. Dispatch records it as `gated` and runs `verify` when the plan has any. Read the digest and the gate summary. Do not open `logs/`, a transcript, or `wt/`. Then choose:

| Verdict | Risk | What `accept` does |
| --- | --- | --- |
| `approved` | `routine` | `accepted`. Dependents may start. Refused when the gate failed. |
| `approved` | `notable` or `consequential` | `reviewed`. Run `confirm --agree yes` to accept, or `--agree no` to escalate. |
| `approved` | `critical` | `escalated`. |
| `revise` | — | `pending`, with the named defect (`--defect`). One round. The second revise escalates. The new brief carries that defect, not the original hypothesis. |
| `rejected` or `escalate` | — | `escalated`. |

```bash
node <skill>/scripts/handoff.mjs accept --run "$HANDOFF_RUN" 01 --verdict approved --risk routine
node <skill>/scripts/handoff.mjs confirm --run "$HANDOFF_RUN" 01 --agree yes
```

A dependent stays `pending` while its dependency is `gated` or `reviewed`. Score refuses a run that still has either, and it refuses a leftover `done` claim that never went through `accept`.

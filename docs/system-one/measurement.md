# System One measurement — #27 and E3 A/B

This page records **what has been observed**, not what the fixture tests imply. Protocol: [`skills/shunt/references/ab.md`](../../skills/shunt/references/ab.md). Decision issue: [#27](https://github.com/MathBorgess/skills-catalog/issues/27). E3 shape: [#36](https://github.com/MathBorgess/skills-catalog/issues/36).

## Status (this wave)

| Item | Observed |
| --- | --- |
| Paired same-repo/commit/brief/model runs for build-test, diff-edit, mixed-fanout | **unmeasured** |
| Task input tokens, turns, wall time, done vs blocked, tests green | **unmeasured** |
| `rtk.recalls`, shunt `recover`, failed edits, `rtk.history.saved_tokens` | **unmeasured** |
| Live Claude-child hook check (`sessions/NN.rtk.jsonl` rewrites) | **unmeasured** |
| Per-class default decision (RTK or Noul as default) | **not taken** — classes stay opt-in |
| Toy fixture / `s1-ab.mjs --evidence fixture` | proves the recorder and the forward pass; **not** production evidence |

Do not infer savings or recall from fixture tests. Do not treat `full` as cheaper. Quota delta and `rtk gain` alone are not measures.

## Recorder

```bash
node skills/shunt/scripts/s1-ab.mjs init --out pairs.json --class build-test \
  --repo MathBorgess/skills-catalog --commit HASH --brief "…" \
  --model cursor-grok-4.6-xhigh --effort high --first-arm off
node skills/shunt/scripts/s1-ab.mjs record --file pairs.json --arm off --policy rules --outcome done
node skills/shunt/scripts/s1-ab.mjs report --file pairs.json
```

Fields not passed to `record` are stored as `unmeasured`. `classDecision` returns `unmeasured` until a class has ≥ 3 observed (non-fixture) pairs. Default for a class only if input tokens fall in ≥ 2 of 3 pairs with no rise in `blocked`, recalls, or failed edits.

## Provenance each pair must carry

Same repo, same commit, same brief, same model and effort. Alternate which arm runs first. Name the model (`cursor-grok-4.6-xhigh`, not `default`). Tag fixture rows `--evidence fixture` so they cannot satisfy the decision rule.

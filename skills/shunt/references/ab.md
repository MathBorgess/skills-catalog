# A/B recorder (`s1-ab.mjs`)

Begins [skills-catalog#27](https://github.com/MathBorgess/skills-catalog/issues/27) measurement for RTK and [skills-catalog#36](https://github.com/MathBorgess/skills-catalog/issues/36) (regex vs regex+Noul). It records provenance and observed outcomes. It does not claim calibration, recall improvement, or token savings.

## Protocol

Same repo, same commit, same brief, same model and effort. Alternate which arm runs first.

| Task class | Arms |
|---|---|
| `build-test` | `off`, `guarded` |
| `diff-edit` | `off`, `guarded`, `full` (`full` is an experiment arm only) |
| `mixed-fanout` | `off`, `guarded` |

Policies per arm: `rules` (regex) and, when opted in, `shadow` or `action`.

```bash
node <skill>/scripts/s1-ab.mjs init --out pairs.json --class build-test \
  --repo MathBorgess/skills-catalog --commit HASH --brief "…" \
  --model cursor-grok-4.6-xhigh --effort high --first-arm off
node <skill>/scripts/s1-ab.mjs record --file pairs.json --arm off --policy rules --outcome done
node <skill>/scripts/s1-ab.mjs record --file pairs.json --arm guarded --policy action \
  --outcome done --input-tokens 1200 --turns 8 --recalls 0 --saved-tokens 90
node <skill>/scripts/s1-ab.mjs report --file pairs.json
```

## Unmeasured vs observed

Any field not passed to `record` is stored as `unmeasured`. Do not write `0` for a value that was not observed. Quota delta and `rtk gain` alone are not measures.

Outcome fields that decide #27: `input_tokens`, `turns`, `wall_time_s`, `done` vs `blocked`, `tests_green`. Diagnosis: `recalls`, `recover`, `failed_edits`, `saved_tokens`.

## Fixture vs measured

`--evidence fixture` (or a toy checkpoint run) proves the harness and the forward pass. It is **not** production evidence and cannot make RTK or Noul the default. `classDecision` returns `unmeasured` until a class has ≥ 3 observed (non-fixture) pairs. Default for a class only if input tokens fall in ≥ 2 of 3 pairs with no rise in `blocked`, recalls, or failed edits — otherwise the class stays opt-in.

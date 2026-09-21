# System One — Wave 1 (E1 / E3)

Maintainer notes for the local scorer that sits behind handoff routing and shunt's RTK rewrite. Vocabulary is in [`CONTEXT.md`](../../CONTEXT.md). The workflows a model follows are in [`skills/handoff/SKILL.md`](../../skills/handoff/SKILL.md) and [`skills/shunt/SKILL.md`](../../skills/shunt/SKILL.md); this page is not loaded at run time.

| Part | Status |
| --- | --- |
| Shared `s1.mjs` runtime, `rules` default, shadow log | **shipped** (Wave 0, [#51](https://github.com/MathBorgess/skills-catalog/pull/51)) |
| Safe JSON tinyx load + pure-JS forward pass | **shipped**, opt-in only |
| E1 capability Nouls (`capabilities` field, fail-closed union) | **shipped** as `rules` by default; local shadow/action is explicit |
| E3 RTK Noul behind the guarded regex floor | **shipped** as `rules`/raw by default; local shadow/action is explicit |
| Guarded regex as an immutable floor | **shipped** — a model result cannot compress a floor match |
| Production calibration / promoted default | **not shipped** — toy fixture is not cua-s1-form-v0 |
| #27 task-cost A/B | **in progress / unmeasured** — see [measurement.md](measurement.md) |
| Antigravity exit-0 without `result.md` | tracked in [#50](https://github.com/MathBorgess/skills-catalog/issues/50), not this wave |

## Setup

The committed checkpoint is `skills/handoff/scripts/fixtures/cua-s1-tinyx-toy/checkpoint.json`, with independently recorded logits in `reference.json`. Architecture source: trycua/cua `TinyTransformerScorer` (tinyx), commit `9bbfa7dd`. It is a synthetic reviewable JSON fixture: no pickle, no network URL, rejected if the format or state signature does not match.

Load it only through `createLocalBackend(path)` in the shared runtime (`skills/handoff/scripts/s1.mjs` and the byte-identical `skills/shunt/scripts/s1.mjs`). `rules` stays the process default; constructing a local backend does not install it globally.

## Explicit opt-in

Do nothing extra and both skills behave as Wave 0: rules backend, regex floor, owner-declared capabilities only.

**Handoff (E1)** — in `plan.json`, or env:

```json
{ "s1": { "mode": "shadow", "checkpoint": "skills/handoff/scripts/fixtures/cua-s1-tinyx-toy/checkpoint.json" } }
```

`HANDOFF_S1_MODE` / `HANDOFF_S1_CHECKPOINT` are the same opt-in. `mode` must be `shadow` or `action`; anything else is `rules`.

**Shunt (E3)**:

```bash
node skills/shunt/scripts/shunt.mjs activate --rtk --noul=shadow --checkpoint PATH
node skills/shunt/scripts/shunt.mjs activate --rtk --noul=action --checkpoint PATH
```

Bare `--noul` is refused. `--noul=action` without `--checkpoint` is refused.

Never use `default` as a model name. Owner overrides and resolved CLI ids are real names (`cursor-grok-4.6-xhigh`, `claude-opus-4-8`, …).

## Shadow vs action

| Policy | Handoff routing | Shunt rewrite |
| --- | --- | --- |
| `rules` (default) | owner-declared capabilities only | guarded regex only |
| `shadow` | six Nouls are scored and recorded; the gate still uses the owner declaration | scored and recorded; live rewrite unchanged |
| `action` | fail-closed union of owner declaration and `p(yes) ≥ 0.25`; the classifier only adds | may *add* raw commands; cannot override a floor match |

Abstention, invalid checkpoint, inference error, and uncertainty fail open to the Wave 0 behaviour (keep the owner caps; keep the command raw).

## Provenance

Every scorer call appends one redacted row to `$TMPDIR/handoff/decisions.jsonl` (the **shadow log**). Local rows name `backend: "local"`. Outcome resolution happens at `score`, not at decision time. The fixture's `reference.json` is logit-parity evidence for the forward pass, not a task-cost or calibration record.

## Rollback

Handoff: omit `plan.s1` (and the env vars). Shunt: `activate` again without `--noul`. A new activate is a new run; nothing is sticky in the process or globally. The regex floor does not need turning back on — it never turned off.

## Dispatch resume (Wave 1 integration)

A dispatch window that exits while provider processes continue must not abandon dependents or relaunch a still-live pid whose state was reset to pending. Resume adopts live pids, treats a parseable `sessions/NN.result.md` as durable over pending/abandoned, and unlocks dependents only after that file. Dead `running` with no result file is [#50](https://github.com/MathBorgess/skills-catalog/issues/50).

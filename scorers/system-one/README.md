# System One runtime

One copy of the scorer, outside `skills/`. Handoff and shunt do not import it. It is not in the published package (`package.json` `files` lists `skills/`, not `scorers/`). A model loading a skill must not find a checkpoint or an instruction to call one here.

The decision sites themselves are reasoned by the model that already holds the context. That record — `tier`, `size`, `capability_answers`, `needs`, and the verdict and risk stored by `accept` — is the baseline. Trials that try to beat it live in [`docs/experiments/`](../../docs/experiments/README.md).

## What this runtime answers

`propose.mjs` prints a JSON proposal. It does not edit `plan.json`, `routing.json`, or `state.json`.

| Field | Floor (`fields`) | Local backend (`shadow`) |
| --- | --- | --- |
| `tier`, `size` | not predicted. Stay `null`. | not predicted |
| `capability_answers`, `needs` | `rules` answers no to every capability, so `needs` is `[]`. It does not replace a reasoned yes. | recorded beside the floor. Not copied into `fields`. |
| command must arrive whole | `git diff`, `cat`, `grep`, and the rest of the guarded regex stay whole | action may compress only a command the floor does not already keep. Abstention stays whole. |

`fills_skill_fields` is false. `trial.beats_reasoned_record` is false. A directory under `docs/experiments/` is the only place a trial may claim otherwise, and only with a shuffled-context control.

```bash
node scorers/system-one/propose.mjs session.json
node scorers/system-one/propose.mjs session.json --policy shadow --checkpoint scorers/system-one/fixtures/cua-s1-tinyx-toy/checkpoint.json
```

`session.json` may carry `goal`, `writes`, `verify`, `commands`, and `reasoned` (the skill's record). `agreement` compares the shadow, when there is one, to `reasoned.needs`.

## What is not in here

`form-checkbox-v1`, the encoding that asked `cua-s1-forms` a capability question by dressing it up as a checkbox, is not a backend. The closed trial is [`docs/experiments/2026-09-21-cua-s1-forms-v1/`](../../docs/experiments/2026-09-21-cua-s1-forms-v1/README.md). A contract-faithful rerun is a new experiment directory, not an edit to that one and not a change to the skill.

`pngwn/system-one-qwen3.5-4b-scorer-v2b` is not a dependency. Different contract, CC-BY-NC-4.0, and no measurement on these sites.

## Checkpoints

`rules` is the process default. `createLocalBackend(path)` does not install itself.

The committed checkpoint is `fixtures/cua-s1-tinyx-toy/checkpoint.json`, with logits in `reference.json`. It is a synthetic JSON fixture (tinyx, source commit `9bbfa7dd`). No pickle, no network fetch.

The published `cua-ai/cua-s1-forms` pair (MIT, revision `f54adbf447f4ca6ec259f529ee3f2e3e09f8cc71`) loads through the same `loadCheckpoint`. It is never fetched by `npm run check` and never committed:

```bash
npm run fetch:cua-s1
npm run check:cua-s1-official
```

Weights cache under `.cache/cua-s1/` (gitignored). The official test skips, with a reason, when that cache is absent. Passing it shows the forward pass matches the numpy reference on native form cases. It does not show transfer to handoff or shunt.

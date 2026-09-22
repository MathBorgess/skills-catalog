---
name: still-cursor-living-day
description: "Use when the owner wants to produce, re-run or judge the still-cursor-living-day collection: twelve images in which a computer display is a black, non-emitting reflective surface, the standard arrow cursor stays frozen at one coordinate, and what changes is a day passing in the room reflected in the glass. Covers writing the twelve briefs, the owner's approval gate, parallel dispatch to image generators (Codex/GPT-Image, Gemini, Antigravity, or a manual drop), and the two-pass LLM-as-judge that scores every frame and the collection itself. Triggers on \"a coleção\", \"o eixo\", \"as 12 imagens\", \"gerar a coleção\", \"julgar a coleção\", \"defesa do eixo\", \"cursor parado\", \"tela apagada\", \"still cursor\". Not for generic image generation, and not for any other axis."
argument-hint: "plan | dispatch | judge | export"
metadata:
  author: Matheus Borges
  version: 0.0.0
---

# Still cursor, living day

One axis, twelve frames, three phases: you write the briefs, the owner gates them, generators produce the images, and a judge that never saw the briefs grades what came out. `scripts/collection.mjs` owns the arithmetic — validation, dispatch, file evidence, the shuffle, the tau, the scorecard. Do not redo it by hand, and do not judge your own briefs from this context.

Read [`references/axis.md`](references/axis.md) before anything else. It is the contract: The Restriction, The Constant, The Variable, The Discard, and the seven attacks the finished collection has to survive.

## 1. Open the run and probe

```bash
node <skill>/scripts/collection.mjs init
node <skill>/scripts/collection.mjs probe --run "$SCLD_RUN"
```

`init` prints the run directory and writes a twelve-frame skeleton with both invariant clauses already filled. Export it as `SCLD_RUN` so later commands can omit `--run`. `probe` reports which routes on this machine can actually produce an image; a route that cannot is refused later, never silently downgraded to an agent that writes prose about an image. Route kinds, keys and failure modes: [`references/routes.md`](references/routes.md).

## 2. Write the twelve briefs

Fill `plan.json` following [`references/briefs.md`](references/briefs.md). Every frame needs a clock, the room, the light, what the person is doing in the reflection, the objects it leaves changed, its route, and the full prompt. The two invariant clauses go into every prompt verbatim — that is The Constant, and the script refuses a prompt missing either one.

The trace chain is the part that decides whether this is a collection or twelve files in a folder. Each frame must change the state of at least one physical object, so that deleting it breaks something nameable. `route` proves this arithmetically and refuses any frame that moves nothing.

## 3. Route and gate

```bash
node <skill>/scripts/collection.mjs route --run "$SCLD_RUN"
```

Fix every refusal. Take every warning to the owner in the grilling rounds of [`references/gate.md`](references/gate.md) — ambiguous words like *window* and *lamp* are raised there, never resolved by you alone. When the owner approves:

```bash
node <skill>/scripts/collection.mjs route --run "$SCLD_RUN" --approve
```

That records the plan's hash. Dispatch refuses any plan edited after approval. Never request a second approval for a hash the owner already approved.

## 4. Dispatch and collect

```bash
node <skill>/scripts/collection.mjs dispatch --run "$SCLD_RUN" --concurrency 4
node <skill>/scripts/collection.mjs collect --run "$SCLD_RUN"
```

Dispatch runs the twelve generations in parallel under a concurrency cap and writes every prompt to disk whatever the route. `manual` frames print the exact path to drop the file at. `collect` is the evidence step: it reads the bytes, refuses a JSON error body wearing a `.png` name, refuses two byte-identical frames, and refuses a frame whose geometry differs from the series, because a different aspect ratio puts The Constant somewhere else in the room. Re-dispatch only what failed, with `dispatch --only 03,07 --force`.

## 5. Judge, in two passes

```bash
node <skill>/scripts/collection.mjs judge open   --phase blind    --run "$SCLD_RUN"
node <skill>/scripts/collection.mjs judge submit --phase blind    --run "$SCLD_RUN" --file <verdicts.json>
node <skill>/scripts/collection.mjs judge open   --phase informed --run "$SCLD_RUN"
node <skill>/scripts/collection.mjs judge submit --phase informed --run "$SCLD_RUN" --file <verdicts.json>
```

**Hand each `task.md` to a fresh agent.** A judge holding the briefs grades the intention instead of the artefact, and a judge that is also the author grades itself. The blind pass sees twelve shuffled, unlabelled images and no prompts: it rates The Restriction, The Constant and human presence, and orders the day. That ordering is the measurement — the run's Kendall tau says whether The Variable reads from the images alone. The informed pass then sees the chronology and the trace chain and answers the two collection questions. Rubric and the typed levels: [`references/judging.md`](references/judging.md).

While the blind pass is open, a guard hook refuses reads of `plan.json`, `prompts/`, `frames/` and the answer key, and refuses hand-edits of any recorded verdict. If it fires, close the pass — do not work around it.

## 6. Score, decide, deliver

```bash
node <skill>/scripts/collection.mjs score  --run "$SCLD_RUN"
node <skill>/scripts/collection.mjs export --run "$SCLD_RUN" --to <path>
```

`score` writes the report, the verdicts and one metrics line ([`references/metrics.md`](references/metrics.md)). Its proposals are proposals: **the judge never regenerates, discards or reorders anything.** Show the owner the report, name what you would regenerate and why, and re-dispatch only what they approve. Then `export` carries the frames, their prompts, the plan and the verdicts into a folder they keep; `clean` removes the run.

## Done-check

- [ ] `probe` ran before the plan was routed, and every frame's route can generate an image.
- [ ] Every prompt carries both invariant clauses verbatim; no frame declares its own.
- [ ] The clock advances across all twelve frames and every frame changes at least one object's state.
- [ ] `route --approve` locked the exact plan that was dispatched; no post-approval edit was dispatched.
- [ ] `collect` reported 12/12 — real images, one geometry, no twins.
- [ ] The blind pass ran before the informed pass, in a fresh agent, and the run's tau is in the report.
- [ ] Every verdict carries an evidence sentence; no verdict file was edited by hand.
- [ ] The owner saw the proposals and decided; nothing was regenerated or discarded without them.
- [ ] The report names the frame 03 → frame 09 link and what four deletions would cost.

---
name: still-cursor-living-day
description: "Use when the owner wants to produce, re-run or judge the still-cursor-living-day collection: twelve images in which a computer display is a black, non-emitting reflective surface, the standard arrow cursor stays frozen at one coordinate, and what changes is a day passing in the room reflected in the glass. Covers writing the twelve briefs, the owner's approval gate, parallel dispatch to image generators (Codex/GPT-Image, Gemini, Antigravity, or a manual drop), and the two-pass LLM-as-judge that scores every frame and the collection itself. Triggers on \"a coleção\", \"o eixo\", \"as 12 imagens\", \"gerar a coleção\", \"julgar a coleção\", \"defesa do eixo\", \"cursor parado\", \"tela apagada\", \"still cursor\". Not for generic image generation, and not for any other axis."
argument-hint: "plan | dispatch | judge | export"
metadata:
  author: Matheus Borges
  version: 0.0.0
---

# Still cursor, living day

One axis, twelve frames: you write the briefs, the owner gates them, generators produce the images, a script draws the cursor, and a judge that never saw the briefs grades what came out. The same MacBook, display off, carried through a day — it moves between places, distances and angles, and one lit arrow stays on the same pixel of *its screen* in every frame, sized by the perspective the laptop is seen in. `scripts/collection.mjs` owns the arithmetic: validation, dispatch, file evidence, the cursor, the shuffle, the tau, the scorecard. Do not redo it by hand, and do not judge your own briefs from this context.

**The generator never draws the cursor.** Asked for one, image models put the arrow in the middle of every screen at a different size; no wording fixes that. The panel is generated blank, its four corners are marked, and `composite` projects one fixed screen point through those corners.

This is an **experiment** skill: the question it answers every run is whether a day still reads from the artefacts once the prompts are taken away, and the blind pass's ordering tau is the number it leaves behind.

Read [`references/axis.md`](references/axis.md) before anything else. It is the contract: The Restriction, The Constant, The Variable, The Discard, and the seven attacks the finished collection has to survive.

## 1. Open the run and probe

```bash
node <skill>/scripts/collection.mjs init
node <skill>/scripts/collection.mjs probe --run "$SCLD_RUN"
```

`init` prints the run directory (export it as `SCLD_RUN`) and writes a twelve-frame skeleton with both invariant clauses and the cursor block filled. `probe` reports which routes here can actually produce an image; one that cannot is refused, never downgraded to an agent writing prose about an image. Routes: [`references/routes.md`](references/routes.md).

## 2. Write the twelve briefs

Fill `plan.json` following [`references/briefs.md`](references/briefs.md), after reading the worked prompts in [`references/examples.md`](references/examples.md) — positives for range, negatives for the traps. Every frame needs a clock, a `place`, the room, the light, what the person is doing in the reflection, a `framing` (`scale` and `view`), the objects it leaves changed, its route, and the full prompt.

The two invariant clauses — surface (the MacBook's identity, its blank dead panel) and optics (one reflectivity) — go into every prompt verbatim, identical in all twelve. `plan.cursor` fixes the arrow: its panel point, the panel's size in screen points, and the pointer size. It is never written into a prompt, and `route` refuses a prompt that mentions a cursor, pointer or arrow. Everything else must move, and `route` refuses a plan where it does not: five or more distinct places, at most three consecutive frames sharing one, three or more scales and views, at most two consecutive frames repeating a pair. A series can obey every clause and still be one photograph taken twelve times.

The trace chain decides whether this is a collection or twelve files in a folder. Every frame must change at least one object's state — delete it and something nameable breaks — with one chain travelling with the laptop and one left behind. `route` proves that arithmetically and refuses a frame that moves nothing.

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

Dispatch runs the twelve generations in parallel and writes every prompt to disk; `manual` frames print the exact path to drop the file at. `collect` reads the bytes: it refuses an error body wearing a `.png` name, a non-PNG, two byte-identical frames, and a frame in another geometry. Re-dispatch only what failed, with `dispatch --only 03,07 --force`.

## 5. Mark the panels, composite the cursor

```bash
node <skill>/scripts/collection.mjs panel open   --run "$SCLD_RUN"
node <skill>/scripts/collection.mjs panel submit --run "$SCLD_RUN" --file <corners.json>
node <skill>/scripts/collection.mjs composite    --run "$SCLD_RUN"
```

`panel open` writes `panels/mark.html`: the owner clicks the display's four corners in each frame, sees the projected arrow live, and downloads `corners.json`. That is the reliable path; `panels/task.md` lets a vision agent do it instead, but check its composite. `panel submit` refuses a panel the generator drew on, an anchor something covers, corners in the wrong order, and any frame where the cursor would be under 6px — re-frame, raise resolution, or raise `pointer_size` for all twelve. `composite` draws the arrow at the same panel point in all twelve and prints where it landed; raw generations stay in `frames/`. A regenerated frame must be marked again. Mechanism and failure modes: [`references/cursor.md`](references/cursor.md).

## 6. Judge, in two passes

```bash
node <skill>/scripts/collection.mjs judge open   --phase blind    --run "$SCLD_RUN"
node <skill>/scripts/collection.mjs judge submit --phase blind    --run "$SCLD_RUN" --file <verdicts.json>
node <skill>/scripts/collection.mjs judge open   --phase informed --run "$SCLD_RUN"
node <skill>/scripts/collection.mjs judge submit --phase informed --run "$SCLD_RUN" --file <verdicts.json>
```

**Hand each `task.md` to a fresh agent.** A judge holding the briefs grades the intention instead of the artefact, and a judge that is also the author grades itself. The blind pass sees twelve shuffled, unlabelled images and no prompts: it rates The Restriction, The Optics, whether it is the same MacBook, whether the cursor reads as sitting on the screen, and human presence, and orders the day. That ordering is the measurement — the run's Kendall tau says whether The Variable reads from the images alone. The informed pass then sees the chronology and the trace chain and answers the two collection questions. Rubric and the typed levels: [`references/judging.md`](references/judging.md).

While the blind pass is open, a guard hook refuses reads of `plan.json`, `prompts/`, `frames/`, `panels/`, `composited/` and the answer key, and refuses hand-edits of any recorded verdict. If it fires, close the pass — do not work around it.

## 7. Score, decide, deliver

```bash
node <skill>/scripts/collection.mjs score  --run "$SCLD_RUN"
node <skill>/scripts/collection.mjs export --run "$SCLD_RUN" --to <path>
```

`score` writes the report, the verdicts and one metrics line ([`references/metrics.md`](references/metrics.md)). Its proposals are proposals: **the judge never regenerates, discards or reorders anything.** Show the owner the report, name what you would regenerate and why, and re-dispatch only what they approve. Then `export` carries the composited frames, the raw generations, the corners, the prompts, the plan and the verdicts into a folder they keep — everything needed to re-derive every cursor; `clean` removes the run.

## Done-check

- [ ] `probe` ran before the plan was routed, and every frame's route can generate an image.
- [ ] Every prompt carries both invariant clauses verbatim, no prompt mentions a cursor, and no frame declares its own clause or cursor.
- [ ] The clock advances across all twelve frames and every frame changes at least one object's state.
- [ ] The laptop travelled: five or more places, three or more scales and views, and no run of identical framing.
- [ ] `route --approve` locked the exact plan that was dispatched; no post-approval edit was dispatched.
- [ ] `collect` reported 12/12 — real PNGs, one geometry, no twins.
- [ ] `panel submit` accepted 12/12 and `composite` drew the arrow at one panel point in all twelve; no frame was regenerated after its corners were marked.
- [ ] The blind pass ran before the informed pass, in a fresh agent, and the run's tau is in the report.
- [ ] Every verdict carries an evidence sentence; no verdict file was edited by hand.
- [ ] The owner saw the proposals and decided; nothing was regenerated or discarded without them.
- [ ] The report names the frame 03 → frame 09 link and what four deletions would cost.

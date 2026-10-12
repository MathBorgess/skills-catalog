---
name: co-direct-animation
description: "Use when the user wants to co-direct an animation or animated film from DESIGN.md and a human briefing, explore successful design references, build a moodboard/storyframes/storyboard, preserve creative decisions in an external TO-SPEC, or generate reviewed shots through Google Flow/gflow-cli. Owns direction through assembled delivery, combining authored constraints with Apple, Disney, Mindful Movement and LottieFiles references. Covers various animation styles; the user chooses the image tool. Not for defining permanent brand motion identity."
metadata:
  author: Matheus Borges
  version: 1.0.0
---

# Co-direct Animation

Co-direct the complete film with its human author. Make captivating, reference-informed proposals, explain their narrative purpose and inspect what was actually generated. Preserve authorship. Keep the whole working context outside the model; a chat plan alone is insufficient. Generate animation through **gflow**, one reviewed visual attempt at a time.

`<skill>` is this installed folder; run its Node scripts by absolute path. Project inputs, outputs and records stay outside the public catalog. Existing `reference-animation` runs retain their legacy read contract, not permission to resume code production.

## Steps

1. **Preserve the brief and start TO-SPEC.** Read DESIGN.md, save the human briefing and follow [production workflow](references/production-workflow.md). Run `node <skill>/scripts/compose.mjs new --design <source> --brief <brief>`. Write external [TO-SPEC.md](references/to-spec-template.md): authored constraints, direction, shots, delivery, image-tool choice, budgets, decisions and next steps. Update it before changes; snapshot it at every review/attempt.
2. **Compose the direction.** Read [Mindful Movement](references/mindful-movement.md), [registry](references/registry.json), and selected [Apple](references/apple-fluid.md), [Disney](references/disney-principles.md) and [LottieFiles](references/lottiefiles-motion-design.md) profiles. Adapt them to the intended style; use [spatial collections](references/spatial-collections.md) when relevant. Follow [composition/delivery](references/composition-and-delivery.md), write composition.md and run `compose.mjs compose <run> --proposal <file>`. Keep the composed DESIGN.md coherent with TO-SPEC. [Further references](references/reference-admission.md) supply evidence, never author-constraint waivers.
3. **Review the three planning packets.** Present **moodboard → storyframes/styleframes → storyboard** separately. Recommend a direction and solicit human decision plus explicit criticism, including 'nothing to change'. Follow [review records](references/review-records.md). Preserve exact revisions, feedback and scoped human overrides. Silence, generic continue or approval without criticism leaves acceptance pending. Prepare independent work while waiting; dependent stages wait for acceptance.
4. **Generate one reviewed attempt at a time.** The user chooses the available image tool, including gflow or GPT Image. Reserve image attempts with workflow.mjs, inspect outputs and write the approved [descriptive image handoffs](references/styleframe-handoff.md). After storyboard acceptance use [gflow integration](references/gflow-integration.md) and `gflow.mjs generate <run> <shot-request.json>` for one video shot. Preserve exact inputs, prompts/settings, IDs, outputs and failures. Present each attempt before another generation. Recover uncertain submissions; missing capability leaves the current packet pending with its blocker.
5. **Review the complete motion preview.** Assemble accepted shots against the storyboard. The agent manages audio within the brief. Code may cut, assemble sound, add static captions/text/marks and finish color; it cannot generate replacement object animation. Inspect every shot and the full film, then submit **motion-preview** for human decision/criticism. Clip approval does not approve unseen assembly.
6. **Deliver and preserve.** Reuse accepted clips; new generation or materially changed appearance returns for review. Decode/inspect final exports and measure actual specifications, sound and requested variants. Write delivery.json, run `compose.mjs check <run>`, and submit **final** for human decision/criticism. Archive all authorized retained videos/review assets and verify readback. Preserve private sources/IDs outside the catalog.
7. **Hand off coherent context.** Deliver TO-SPEC, composed design, handoffs, packets, responses and next steps. Resume through `workflow.mjs status <run>`. Preserve superseded artifacts and reopen only affected dependencies. Structural checks establish record consistency, not human authorship, creative quality or brand identity approval.

## Done-check

- [ ] External TO-SPEC preserves DESIGN.md, briefing, references, constraints, decisions, shot plan, revisions and next actions.
- [ ] The requested stage has a concrete packet; acceptance and criticism refer to its exact revision. Every visual attempt was reviewed before the next generation, unless precisely overridden by the human.
- [ ] Approved images have inspected descriptive handoffs; actual submitted inputs and generation outcomes are traceable. Uncertain operations were recovered or explicitly resolved.
- [ ] Current direction, storyboard, shots and assembly agree; only affected decisions were reopened after changes.
- [ ] Delivered animation originates from reviewed gflow clips. Complete preview/final inspection, actual technical checks, sound and authorized archiving are recorded.
- [ ] Final record validation passed; pending human review, runtime limits and unfinished stages are explicit. This work does not approve a permanent brand motion identity.

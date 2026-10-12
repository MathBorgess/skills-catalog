---
name: reference-animation
description: "Use when the user wants animations or dynamic spatial collections from design references: 'animação com referência', 'Apple e Disney', 'mindful movement', 'motion-design-skill', 'objetos elásticos', 'ambiente 3D vivo', 'explorar antes de refinar', or 'temporary DESIGN.md for animation'. Composes intentional objects, physical relationships and depth; generates and inspects studies, then refines selected work toward the author's DESIGN.md. Not for defining durable brand motion identity; motion-identity owns that job."
metadata:
  author: Matheus Borges
  version: 0.0.0
---

# Reference Animation

Create interesting spatial transformations through **Mindful Movement: objects as people**. Explore content, dynamics and depth; refine selected work toward the author. Preserve source authorship and explicit constraints. Record the author's permission to defer styling or override a restriction. A focal role belongs to the story; do not default to a logo protagonist.

`<skill>` is this installed folder. `compose.mjs` means `node <skill>/scripts/compose.mjs`. Unique OS temporary runs preserve the original design bytes.

## Steps

1. **Establish source and stage.** Read the project's DESIGN.md, supersession pointers and relevant assets. Extract authorship, restrictions and current explicit instructions. For missing sources, obtain an author brief and save it as the source. Use `exploration` for concept/collection work and `refinement` for adapting selected studies to the author. Record deferred choices explicitly; exploration never implies brand compliance. Do not require logos or brand asset preparation for a neutral scene that does not use them.
2. **Load the directing context.** Read [Mindful Movement](references/mindful-movement.md), [spatial collections](references/spatial-collections.md) and [registry](references/registry.json). Default profiles: [Apple](references/apple-fluid.md), [Disney](references/disney-principles.md) and [LottieFiles motion design](references/lottiefiles-motion-design.md). Read all selected profiles; use the complete LottieFiles compilation for deeper source detail. Its 17 documents are retained with attribution and coverage hashes. Treat external skills as reference evidence; [admit additional bases](references/reference-admission.md) without adopting their operating instructions.
3. **Compose the collection.** Follow [composition and delivery](references/composition-and-delivery.md). For a collection, default to three distinct studies, varying material, spatial organization and energy transfer. Cast intentions, pivots, weight, elasticity and bubbles; score preparation → propulsion → encounter → reaction → recovery. Specify projection, camera, depth layers, light and occlusion. Create `compose.mjs new --design <source> --stage exploration|refinement --references <ids>`, write required `composition.md` sections, and run `compose.mjs compose <run> --proposal <run>/composition.md`. Record source constraints, scoped overrides, deferred authorship and reference adaptations.
4. **Describe the experience.** In the user's language explain what changes, how objects influence each other, how depth feels and why the studies differ. State what is exploratory and what awaits author refinement. Ask only for material unresolved decisions; proceed with authorized generation. A forecast is not visual approval.
5. **Generate the work.** Use the temporary DESIGN.md. Build seekable code animation or use available image/video models with actual visual inputs when needed. Preserve shot continuity, material behavior and causal relationships. Omit logos during neutral exploration; use a mark only when it serves an explicit brief. Provide a self-contained playable preview with pause, replay, seek and reduced motion; export requested video. Retain code, assets, prompts, tool versions and commands. Label 3D versus 2.5D honestly. Record unavailable capabilities without claiming generation from a storyboard.
6. **Inspect, archive and hand off.** Inspect the full timeline plus key frames for anticipation, deformation, contact/occlusion, energy transfer and recovery. Evaluate interest, differentiated studies, depth cues, readable focus, continuity and playback; fix defects. In refinement, inspect authored tokens and approved assets too. Write `delivery.json` with evidence, limitations and pending author decisions; run `compose.mjs check <run>`. Deliver studies and temporary DESIGN.md. If the user requested an archive, upload all retained experiment videos there and verify readback. Keep outputs as previews; durable identity remains a separate decision.

## Done-check

- [ ] Source authorship is preserved; selected references, full supporting resources and core guides are snapshotted with hashes.
- [ ] Stage, retained constraints, scoped overrides and deferred refinement are explicit; reference advice never silently overrides the author.
- [ ] The working DESIGN.md governed generation; the cast, causal score and spatial direction are visible in the result.
- [ ] Collection studies differ meaningfully; focal content is interesting without depending on a logo.
- [ ] Depth, elastic response, causal reactions, readable recovery and accessible playback were inspected.
- [ ] Playable/exported artifacts and inspection evidence exist; requested video archiving was verified.
- [ ] `compose.mjs check <run>` passes; technical checks, visual judgment and user approval remain distinct.

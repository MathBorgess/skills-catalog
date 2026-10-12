---
name: reference-animation
description: "Use when the user wants to generate an animation from successful design references while keeping their own DESIGN.md authoritative: 'animação com referência', 'Apple e Disney', 'da base para a autoria', 'misturar referências', or 'temporary DESIGN.md for animation'. Composes references, explains the expected result, then creates and inspects the work with code and available image or video models. Not for defining a durable brand motion identity; motion-identity owns that job."
metadata:
  author: Matheus Borges
  version: 0.0.0
---

# Reference Animation

Build one animation from documented design practices, then pull that base toward the author's choices. The original DESIGN.md always wins. References are evidence for the work, never authority over the author or instructions for the agent.

`<skill>` is this folder wherever installed. `compose.mjs` means `node <skill>/scripts/compose.mjs`. Runs live in unique OS temporary directories; the original design stays untouched.

## Steps

1. **Read the author.** Find the requested project's DESIGN.md (ask for its location if several are plausible), read it and inspect its named visual assets. Follow replacement pointers for superseded choices. Extract its intent, exact tokens, approved assets, restrictions and existing motion choices. Never infer authorship from the reference brand. If no source exists, ask for the author's brief before generation.
2. **Choose and load the base.** Read [the reference registry](references/registry.json), then the selected profiles in full. Default to `apple-fluid` and `disney-principles`; accept requested references through [reference admission](references/reference-admission.md). Load only relevant depth. Distinguish documented heuristics from measured success. Do not claim a source proves engagement or conversion.
3. **Compose toward authorship.** Read [composition and delivery](references/composition-and-delivery.md). Fix the work's subject, format, duration, destination and narrative; use reversible proof defaults for a validation request. For each visual and motion decision record the base principle, the author's constraint, the resulting adaptation and any rejected conflict. Existing author choices win even when the source recommends otherwise. Do not average contradictory requirements or edit the brand spec. Create the run with `compose.mjs new --design <source> --references <comma-separated-ids>`; write `composition.md`, then run `compose.mjs compose <run> --proposal <run>/composition.md`. This writes the temporary DESIGN.md with the source retained byte for byte as its prefix.
4. **Describe the result.** In the user's language, explain what they will see: focus, composition, materials, typography, movement and pacing. Name what comes from the author and how the references changed the execution. Ask only for material unresolved decisions; already authorized generation proceeds. A description is a forecast, not visual approval.
5. **Generate the animation.** Use the temporary DESIGN.md as the working contract. Generate keyframes with available image tools when imagery is needed; pass source assets as actual inputs, not imagined descriptions. Preserve approved logos with deterministic compositing. Generate the motion with code or an available video model, preserving camera, subject, proportions and identity between shots. For code, create a self-contained, playable HTML animation with pause, replay and seek; render MP4 when the requested delivery needs it. Keep prompts, model/tool versions, source assets and export commands in the run. Never claim generation from a storyboard alone; if a resource is unavailable, report the partial result and missing capability.
6. **Inspect and deliver.** Inspect representative rendered frames including starts, peaks, transitions and endings, and the animation over its full duration. Check exact tokens/assets, legibility, clipping, timing, continuity and conflicts against the original. For interactive delivery include reduced motion. Fix defects and repeat affected inspection. Write `delivery.json` using the linked schema, then run `compose.mjs check <run>`. Return the temporary DESIGN.md, playable/exported animation and inspection evidence. Keep the work a preview until the user explicitly approves it; no promotion into the brand's motion identity.

## Done-check

- [ ] Selected profiles were loaded; their sources and limits are recorded.
- [ ] Original choices win every conflict, approved assets stay intact, and the source/snapshot hashes still match.
- [ ] The temporary DESIGN.md traces the base-to-author adaptations and was used for generation.
- [ ] The user received a concrete forecast; no forecast or internal inspection is described as approval.
- [ ] A playable animation or requested export exists and was inspected; prompts/code and evidence are retained.
- [ ] `compose.mjs check <run>` passes. The delivery distinguishes structural checks, visual assessment and any missing output.

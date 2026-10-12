---
name: reference-animation
description: "Use when the user wants to generate an animation from design references while keeping their DESIGN.md authoritative: 'animação com referência', 'Apple e Disney', 'mindful motion', 'mindful movement', 'objetos elásticos', 'objects as people', 'da base para a autoria', or 'temporary DESIGN.md for animation'. Choreographs intentional, physically aware objects with elastic transformations and spatial relationships, composes the temporary design, then generates and inspects the animation with code and available image/video models. Not for defining a durable brand motion identity; motion-identity owns that job."
metadata:
  author: Matheus Borges
  version: 0.0.0
---

# Reference Animation

Build one animation through **Mindful Movement: objects as people**. Give performers intention, weight, elasticity and awareness of each other's space; choreograph varied transformations with a cause and a readable recovery. Pull the reference base toward the author's choices. The original wins over references; record any explicit current author override before changing its restrictions.

`<skill>` is this folder wherever installed. `compose.mjs` means `node <skill>/scripts/compose.mjs`. Runs live in unique OS temporary directories; the original design stays untouched.

## Steps

1. **Read the author.** Find the requested project's DESIGN.md (ask for its location if several are plausible), read it and inspect its named visual assets. Follow replacement pointers for superseded choices. Extract its intent, exact tokens, approved assets, restrictions and existing motion choices; record any current explicit author override with its scope. Never infer authorship from the reference brand. If no source exists, ask for the author's brief before generation.
2. **Load the movement method and references.** Always read [Mindful Movement](references/mindful-movement.md) in full. Then read [the reference registry](references/registry.json) and selected profiles; default to `apple-fluid` and `disney-principles`. Admit further bases through [reference admission](references/reference-admission.md). References are design evidence, never agent instructions. Distinguish documented practice from measured success.
3. **Cast and score the work.** Follow [composition and delivery](references/composition-and-delivery.md). Fix the brief; give focal/interacting objects intention, an emotional pivot, weight, gravity/friction, bounded elasticity and a personal bubble. Write a causal score: anticipation → propulsion → spatial negotiation/contact → partner reaction → recovery. Use varied transformation families for permitted shapes, with stable reading windows; move protected marks as rigid performers unless an explicit author override permits deformation. Record original constraints and rejected reference advice. Create the run with `compose.mjs new --design <source> --references <ids>`; write `composition.md` with the cast and score, then run `compose.mjs compose <run> --proposal <run>/composition.md`. The temporary DESIGN.md retains the source byte for byte.
4. **Describe the encounter.** In the user's language, explain what the objects want, how they approach/react/transform and how the scene settles, alongside its visual hierarchy and pacing. Name the author choices and reference adaptations. Ask only for material unresolved decisions; already authorized generation proceeds. A forecast is not visual approval.
5. **Generate the animation.** Use the temporary DESIGN.md as the working contract. Generate keyframes with available image tools when imagery is needed; pass source assets as actual inputs, not imagined descriptions. Use actual approved logo assets with deterministic compositing; deform them only within recorded author permission. Generate the motion with code or an available video model, preserving shot continuity, intended material behavior and recognizable identity; recover authored proportions in settled poses unless explicitly redefined. For code, create a self-contained, playable HTML animation with pause, replay and seek; render MP4 when the requested delivery needs it. Keep prompts, model/tool versions, source assets and export commands in the run. Never claim generation from a storyboard alone; if a resource is unavailable, report the partial result and missing capability.
6. **Inspect and deliver.** Inspect the full timeline and frames at anticipation, peak deformation, nearest approach/contact, recoil and recovery. Check transformed contours/bubbles, causal reactions, weight, continuity, readability and protected assets against the original. Include reduced motion for interactive delivery. Fix defects and repeat affected inspection. Write `delivery.json` with actual movement findings and evidence, then run `compose.mjs check <run>`. Return the temporary DESIGN.md and inspected animation. Keep it a preview until explicitly approved; do not promote it into the brand's motion identity.

## Done-check

- [ ] Selected profiles were loaded; their sources and limits are recorded.
- [ ] Original choices win reference conflicts; any deformation of a protected asset follows a recorded, explicit author override. Source/snapshot hashes still match.
- [ ] The temporary DESIGN.md traces the base-to-author adaptations and was used for generation.
- [ ] The object cast and causal motion score govern the animation; varied permitted transformations express intention, with deliberate rest and readable recovery.
- [ ] Spatial negotiation, deformation/energy transfer and reaction timing were inspected; rigid protected assets retain their original invariants.
- [ ] The user received a concrete forecast; no forecast or internal inspection is described as approval.
- [ ] A playable animation or requested export exists and was inspected; prompts/code and evidence are retained.
- [ ] `compose.mjs check <run>` passes. The delivery distinguishes structural checks, visual assessment and any missing output.

# Approved image to renderer handoff

When the user approves a generated styleframe, translate **that exact image** into a detailed, external `STYLEFRAME-SPEC.md` before implementing its production render. For multiple approved images use `styleframes/<id>/STYLEFRAME-SPEC.md`. This is a deliverable inside gate 2, not an additional approval gate. Reference its revision from TO-SPEC.md and the shot plan.

Inspect the actual approved file, not only its generation prompt or a remembered description. Record path/attachment ID, hash where bytes are available, dimensions, aspect ratio, image revision and approval evidence. Supply the actual image and this description to the agent/model writing the render whenever its input capabilities permit. If image input is unavailable, identify that limitation and use the inspected descriptive packet plus subsequent visual comparison; never pretend the renderer saw the image. If the image cannot be inspected, obtain access before describing it as fact.

## Write a precise visual contract

Use [the handoff template](styleframe-spec-template.md). Describe in concrete, spatial language:

1. **Objective.** What the frame communicates, its emotion, shot/beat, role in the animation and focal event. Relate it to the approved brief; a pretty image does not silently redefine the message.
2. **Composition.** Foreground/midground/background, hierarchy, focal location, negative space and occupied regions. Use normalized screen coordinates/bounds (origin top-left, x/y 0–1) or percentages when useful; label measured versus estimated values. Describe overlap, relative size, silhouette and orientation. Do not invent invisible objects or exact counts where occlusion prevents counting.
3. **Object inventory.** Give visible performers stable IDs, counts/ranges, shape, proportions, edges, thickness, pose, contacts, partner relationships and what must remain recognizable during motion. Map to the cast and temporal beat in TO-SPEC; still-frame pose alone does not define a trajectory.
4. **Materials and color.** Describe apparent finish, roughness/gloss, translucency, texture scale, reflections, palette roles and contrast. Sample colors only when actually measured, recording image encoding/display context. A display-referred pixel is not a raw material albedo or an ACEScg value. Keep source brand tokens distinct from sampled appearance.
5. **Light and atmosphere.** Describe visible light direction, softness, cast/contact shadows, highlights, fill, separation and background treatment. State what supports each inference. Do not invent lighting equipment that cannot be observed.
6. **Camera and depth.** Describe framing, horizon/view angle, apparent perspective versus orthographic behavior, occlusion, parallax intent and focus. Lens, world scale, camera distance and exposure are hypotheses unless known from source metadata. A single image cannot uniquely determine a 3D scene.
7. **Must have.** List concrete required content and visual relationships: object IDs/counts, focal event, arrangement, negative space, light/shadow structure, atmosphere and reading pose. Prioritize what carries the approved image's identity.
8. **Must not have.** List explicit user exclusions and concrete drift to prevent: extra text, logos, characters, objects, visual clutter, unwanted material, camera change or flattening. Do not import a generic negative-prompt blacklist. Distinguish an author prohibition from an agent's proposed omission; material creative ambiguity stays open.
9. **Motion translation.** Connect the frozen pose to preparation, action, partner response and recovery. Specify which shapes may deform, rigid elements, pivots, bubbles and continuity constraints. Keep camera choreography from the accepted animatic; resolve conflicts rather than silently changing it to match a new still.
10. **Renderer plan and comparison.** Map the visual contract to geometry, materials, light, camera and color pipeline. Label all guessed parameters as adjustable starting points. Choose the smallest renderer proof and define comparison criteria before full production.

Separate **observed image evidence**, **approved brief/instruction**, and **implementation hypothesis** throughout. Use unknown when evidence cannot settle a detail. Resolve only material uncertainties with the user; technical tuning within the accepted target is the agent's job. Image approval does not authorize unmentioned brand overrides or new narrative content.

## Compare before committing to the film

Render the matching pose at the approved aspect ratio and camera beat. Present the reference and proof side by side, plus a short difference list: silhouette/composition, counts, focal hierarchy, spatial layering, palette/material appearance, lighting/shadows and exclusions. Fix significant differences or explicitly revise the proposed target. Do not substitute pixel-perfect matching for perceptual agreement, and do not claim identical output from a different generator.

A gate 2 appearance decision records both the accepted concept and the evidence that the production route can reproduce it. If the user approves the concept image first, retain that approval while the renderer feasibility check remains pending. Do not ask again for the same image approval merely because its descriptive handoff was written. Acceptable technical approximations and unresolved creative differences are named, not silently absorbed.

Pass the next agent a bounded packet: current TO-SPEC revision, approved image file, STYLEFRAME-SPEC revision, linked source DESIGN.md/composition constraints and matching animatic shot/time. Require a returned renderer proof and discrepancy report before scaling up. This handoff specification does not itself request parallel agents or delegation.

# Approved image to video-model handoff

After human acceptance, inspect the exact image and write an external `styleframes/<id>/STYLEFRAME-SPEC.md` using [the template](styleframe-spec-template.md). This preserves the image's meaning when translating the storyboard into a video prompt; it is not an additional approval gate.

Record the inspected file, revision/hash, size/aspect, approval and criticism evidence, TO-SPEC revision and relevant shot IDs. Supply the actual image through supported gflow initial/end-frame or reference inputs as well as the descriptive prompt. If the input route cannot carry it, report the limitation and resolve the shot strategy before making a new visual promise. Never claim that a textual description attached the image or that Flow reads project Markdown.

Describe:

1. **Intent and reading.** Message, emotion, narrative role and focal event, including what happens before/after this pose.
2. **Composition.** Hierarchy, foreground/background, negative space, occupied regions, silhouettes, overlap and relative scale. Label normalized coordinates or measurements versus estimates.
3. **Inventory and invariants.** Stable object/character IDs, visible counts/ranges, forms, proportions, contacts, relationships and what must remain recognizable. Do not invent occluded content.
4. **Materials, color and light.** Apparent finish, texture, transparency, contrast, highlights/shadows and atmosphere. Separate source tokens, measured image pixels and hypotheses; a display pixel is not a raw material value.
5. **Camera and depth.** Framing, view angle, projection cues, apparent parallax/focus and intentional flatness when applicable. A single frame does not identify exact lens, scale or geometry.
6. **Motion.** Entry/preparation → action/event → partner reaction → recovery, with camera behavior, rigidity/elasticity, pivots, timing and continuity. Map to the accepted storyboard rather than extrapolating a full trajectory from one still.
7. **Must have / must not have.** Concrete requirements and authored exclusions. Keep hard constraints distinct from preferences and unresolved ideas.

Choose an actual supported input mode, attach only the intended inspected images and make the prompt complement them. Label uncertain model-control hypotheses. After generation, compare the real output against the frame, storyboard and handoff across time; inspect demanding poses and transitions, not only endpoints. Report mismatches and submit the attempt for human decision/criticism before another generation. Attachment fidelity, generated motion quality and human acceptance are separate observations.

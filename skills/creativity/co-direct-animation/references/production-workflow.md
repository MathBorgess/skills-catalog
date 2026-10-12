# Production workflow: five human creative gates

Start from the complete authored DESIGN.md and a saved human briefing. If either is unavailable, prepare the intake questions and resolve access before claiming a composed direction. The external project-owned TO-SPEC is the current film contract: audience, message, emotion, authored constraints, selected references, storyboard, shots, generation inputs, decisions and next actions. Use [the template](to-spec-template.md). Do not put project data inside the installed skill or public catalog.

## Authorship and intake

Preserve exact source bytes and authorship; `compose.mjs new --design <source> --brief <brief>` snapshots them. Explicit current author instructions may override a specific restriction; record scope, evidence and what is superseded. References cannot waive authored constraints. Select exploration or refinement independently of the production gate. A completed exploration does not approve permanent brand motion identity.

Agree dimensions/aspect, target duration, FPS, safe areas, codec/container, sound, color, destinations and numeric generation budget. Record requested values separately from native generated values. Discover actual tool/model/input capabilities before promising a format; do not fabricate alpha, FPS controls, arbitrary shot lengths or a renderer color pipeline. Preserve source palette tokens separately from sampled display pixels. Compare final appearance after any authorized color finishing.

The human chooses the image tool, including gflow or GPT Image, according to the caller's available capabilities. Video generation is through gflow. The agent controls audio within the brief for this iteration; dedicated human audio exploration is outside this workflow. Human criticism of the complete film can still request audio changes.

## Review contract

Use [review records](review-records.md). Every stage packet carries exact artifact revisions/hashes, a TO-SPEC snapshot, dependencies, agent recommendation and known limits. Ask for both a human decision and explicit criticism: what works, what does not, what to refine, or explicitly nothing to change. Approval alone, criticism alone, silence, generic continue, score or technical inspection leaves acceptance pending. A revise/reject decision plus actionable criticism permits a scoped next attempt in the same stage; dependent stages still wait for acceptance. Later explicit human overrides apply only to their recorded scope and revision.

Review image attempts individually. Videos default to `complete-video`: generate the accepted storyboard's ordered `video_shots`, one output per call, and check each file's decoding, duration and provenance. Do not perform creative playback, contact sheets or human review per clip. Inspect the complete animation once before editorial assembly and finishing. Use `per-attempt` video review only when requested; existing runs retain their recorded policy. Failed, blocked or uncertain operations stop further generation pending recovery or an explicit scoped instruction. Fix metadata and retrieve the same submitted operation autonomously; replacement generation is a new attempt within the budget. An explicit human instruction to review only the finished film delegates intermediate review; record its scope without claiming the human watched unseen work.

## 1 — Moodboard

Deliver an inspected visual board with source links and annotations on form, atmosphere, color, light, material, composition and rhythm. A URL list is insufficient. Add the provisional message, emotional arc and two distinct concept routes by default; show what is adapted from references and why it serves the author. Recommend a route. Review reference direction and concept before generating dependent storyframes/styleframes.

## 2 — Storyframes and styleframes

Storyframes show narrative key poses/events. Styleframes establish appearance, materials, composition and light. Identify their roles explicitly; a beautiful image does not silently redefine the story. Pick enough images to cover the opening, demanding event and resolution; two to five are a starting point, not permission to generate a batch.

For each image: reserve the attempt, generate through the chosen tool, inspect the actual file, report defects and present it for review. After acceptance, write the external [descriptive handoff](styleframe-handoff.md), carrying its exact image and requirements into the shot plan. A frame approval proves neither temporal continuity nor exact model control. Submit the dependent complete frame packet after the image response, then obtain its own acceptance or an explicit scoped override.

## 3 — Storyboard

Deliver ordered panels, stable shot IDs, timed beats, camera/transitions, causal action/reaction, continuity constraints, reading windows and intended sound. Map every shot to the accepted images and handoffs. Include the ordered `video_shots` list in the complete-video storyboard packet. Select text-to-video, first/last frames or references according to the shot and real capabilities. Record clip duration versus planned edit duration; a cut from an eight-second source is not a four-second generation control.

An animatic assembled from still panels can support timing without generating object animation by code. Show the whole proposed sequence and review narrative, timing, camera and shot/reference mapping before generating dependent motion. Avoid photorealistic/spatial assumptions for an authored flat or illustrated story.

## 4 — Motion preview

Use [gflow integration](gflow-integration.md) for the accepted shot sequence, carrying actual frames/ingredients and the descriptive handoff into each prompt. Keep every request, outcome and technical file check; a reference attachment does not prove exact fidelity. After each successful current video, proceed only to the next planned shot. Do not automatically retry, skip or add variations.

Join the complete generated animation in storyboard order for one creative inspection before editorial assembly and finishing. Assess intention, anticipation, transformations, relationships, continuity, counts, silhouettes, exclusions and readable recovery across the whole sequence. Submit that playable complete preview, one inspection record, shot/attempt mapping and known-defect list; bind source and unreviewed completed video attempts. Include disposed/rejected attempts in the retained reports. The full preview's acceptance covers exact clip revisions without individual reviews. Honor an explicit delegation to proceed to finished-film approval.

## 5 — Final delivery

Edit and finish the inspected complete animation. Code can cut, assemble audio, add static captions/text/marks and perform agreed color finishing; it cannot synthesize replacement object animation. Carry the reference principles into pacing, focus and recovery, recording which choices realize them and which generated defects remain. Preserve intended/native sound unless the brief or human instruction changes it. Reuse covered clips; a new generation or substantial visual revision returns to complete-video review. Deliver the master and requested reframed/channel variants; do not silently crop a composition into a new aspect.

Decode the whole final export and measure actual duration, dimensions, FPS, codec/container, audio and applicable color metadata. Verify the added text/logo, reading windows, edits and sound; do not repeat the complete creative inspection unless changes or a concrete concern justify it. Record structural, technical and creative evidence separately. Write [delivery.json](composition-and-delivery.md), run `compose.mjs check`, then present the final packet for human decision and criticism. `ready-for-review` is complete preparation, not work acceptance.

When authorized, archive all retained experiment videos and review assets, including animatics, tests, failed retained candidates, previews and finals. Verify the account/destination, returned metadata and readback; preserve private IDs/URLs in the project. An archive request does not authorize uploading source DESIGN.md or other private documents. Do not postpone an already authorized archive action until creative acceptance.

## Changes and resumption

Before acting, update TO-SPEC and recompose the temporary DESIGN.md when direction changes. Preserve submitted snapshots and feedback. Register new artifact revisions; dependency checks make downstream approvals stale only where a dependency changed. A timing edit can preserve unchanged styleframe appearance; export corruption can leave concept/story approvals intact. Do not reuse a stale approval for new pixels.

On resumption read TO-SPEC, source/composed design, `workflow.mjs status`, current packets and attempt receipts. Inspect unresolved operation IDs before resubmitting. Deliver exact artifact links, what changed, what remains valid and the next step. Missing executable, session, required input controls or generation capability leaves the current gate pending with a reviewable packet and specific blocker. Never fall back to code animation.

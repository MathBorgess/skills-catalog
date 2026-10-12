# Production workflow: five human creative gates

Start from the complete authored DESIGN.md and a saved human briefing. If either is unavailable, prepare the intake questions and resolve access before claiming a composed direction. The external project-owned TO-SPEC is the current film contract: audience, message, emotion, authored constraints, selected references, storyboard, shots, generation inputs, decisions and next actions. Use [the template](to-spec-template.md). Do not put project data inside the installed skill or public catalog.

## Authorship and intake

Preserve exact source bytes and authorship; `compose.mjs new --design <source> --brief <brief>` snapshots them. Explicit current author instructions may override a specific restriction; record scope, evidence and what is superseded. References cannot waive authored constraints. Select exploration or refinement independently of the production gate. A completed exploration does not approve permanent brand motion identity.

Agree dimensions/aspect, target duration, FPS, safe areas, codec/container, sound, color, destinations and numeric generation budget. Record requested values separately from native generated values. Discover actual tool/model/input capabilities before promising a format; do not fabricate alpha, FPS controls, arbitrary shot lengths or a renderer color pipeline. Preserve source palette tokens separately from sampled display pixels. Compare final appearance after any authorized color finishing.

The human chooses the image tool, including gflow or GPT Image, according to the caller's available capabilities. Video generation is through gflow. The agent controls audio within the brief for this iteration; dedicated human audio exploration is outside this workflow. Human criticism of the complete film can still request audio changes.

## Review contract

Use [review records](review-records.md). Every stage packet carries exact artifact revisions/hashes, a TO-SPEC snapshot, dependencies, agent recommendation and known limits. Ask for both a human decision and explicit criticism: what works, what does not, what to refine, or explicitly nothing to change. Approval alone, criticism alone, silence, generic continue, score or technical inspection leaves acceptance pending. A revise/reject decision plus actionable criticism permits a scoped next attempt in the same stage; dependent stages still wait for acceptance. Later explicit human overrides apply only to their recorded scope and revision.

Review each visual generation attempt before the next generation, including unsuccessful/uncertain attempts. One output per attempt is the default; do not batch variations or use a runner that silently submits later shots. Audio is the expressly delegated exception. Fix local metadata, inspect outputs and retrieve the same submitted operation autonomously. A replacement generation is a new attempt. One human response can review an attempt and its complete stage packet when both exact revisions and scopes are presented together.

## 1 — Moodboard

Deliver an inspected visual board with source links and annotations on form, atmosphere, color, light, material, composition and rhythm. A URL list is insufficient. Add the provisional message, emotional arc and two distinct concept routes by default; show what is adapted from references and why it serves the author. Recommend a route. Review reference direction and concept before generating dependent storyframes/styleframes.

## 2 — Storyframes and styleframes

Storyframes show narrative key poses/events. Styleframes establish appearance, materials, composition and light. Identify their roles explicitly; a beautiful image does not silently redefine the story. Pick enough images to cover the opening, demanding event and resolution; two to five are a starting point, not permission to generate a batch.

For each image: reserve the attempt, generate through the chosen tool, inspect the actual file, report defects and present it for review. After acceptance, write the external [descriptive handoff](styleframe-handoff.md), carrying its exact image and requirements into the shot plan. A frame approval proves neither temporal continuity nor exact model control. Review the complete frame packet separately unless the same response explicitly covers it.

## 3 — Storyboard

Deliver ordered panels, stable shot IDs, timed beats, camera/transitions, causal action/reaction, continuity constraints, reading windows and intended sound. Map every shot to the accepted images and handoffs. Select text-to-video, first/last frames or references according to the shot and real capabilities. Record clip duration versus planned edit duration; a cut from an eight-second source is not a four-second generation control.

An animatic assembled from still panels can support timing without generating object animation by code. Show the whole proposed sequence and review narrative, timing, camera and shot/reference mapping before generating dependent motion. Avoid photorealistic/spatial assumptions for an authored flat or illustrated story.

## 4 — Motion preview

Use [gflow integration](gflow-integration.md) for one shot at a time, carrying actual frames/ingredients and the descriptive handoff into the prompt. Inspect intention, anticipation, transformations, relationships, continuity, counts, silhouettes, exclusions and readable recovery. Present every attempt for human review before the next. Do not describe an attachment as proof of exact fidelity.

Assemble the accepted shots into the full film, including agent-managed sound. Code can cut, assemble audio, add static captions/text/marks and perform agreed color finishing; it cannot synthesize replacement object animation. Inspect every shot and the complete sequence. Submit the playable preview, contact sheet, shot/attempt mapping and known-defect list for acceptance and criticism. Accepted clips do not approve an unseen assembled film.

## 5 — Final delivery

Reuse accepted clips where possible. Increasing quality through a new generation can change the content; submit that revision for the affected review. Inspect supported upscales/exports and significant finishing changes too. Deliver the master and requested reframed/channel variants; do not silently crop a composition into a new aspect.

Decode the whole final export and measure actual duration, dimensions, FPS, codec/container, audio and applicable color metadata. Inspect actual final pixels, text, clipping, flicker, transitions and sound. Record structural, technical and creative evidence separately. Write [delivery.json](composition-and-delivery.md), run `compose.mjs check`, then present the final packet for human decision and criticism. `ready-for-review` is complete preparation, not work acceptance.

When authorized, archive all retained experiment videos and review assets, including animatics, tests, failed retained candidates, previews and finals. Verify the account/destination, returned metadata and readback; preserve private IDs/URLs in the project. An archive request does not authorize uploading source DESIGN.md or other private documents. Do not postpone an already authorized archive action until creative acceptance.

## Changes and resumption

Before acting, update TO-SPEC and recompose the temporary DESIGN.md when direction changes. Preserve submitted snapshots and feedback. Register new artifact revisions; dependency checks make downstream approvals stale only where a dependency changed. A timing edit can preserve unchanged styleframe appearance; export corruption can leave concept/story approvals intact. Do not reuse a stale approval for new pixels.

On resumption read TO-SPEC, source/composed design, `workflow.mjs status`, current packets and attempt receipts. Inspect unresolved operation IDs before resubmitting. Deliver exact artifact links, what changed, what remains valid and the next step. Missing executable, session, required input controls or generation capability leaves the current gate pending with a reviewable packet and specific blocker. Never fall back to code animation.

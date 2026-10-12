# Production workflow: four reviewable deliveries

Use this workflow for both `exploration` and `refinement`. These name the authorship stage, not production gates. An exploratory film can finish all four gates with brand styling explicitly deferred. Do not retroactively label existing studies approved.

## External to-spec contract

Before opening a production scene or generating imagery, create a project-owned `TO-SPEC.md` outside the installed skill and public catalog, using [the template](to-spec-template.md). Use the private work directory; when no location is provided, a unique temporary run is acceptable, and its path must be delivered to the user. Keep persistent project work in the project's agreed directory when available. This is a file, not only a chat plan or a tool's internal task list.

The original DESIGN.md owns visual authorship. TO-SPEC.md describes this film and owns the current execution plan: purpose, narrative, technical matrix, assets, experiments, gate decisions and pending changes. The temporary composed DESIGN.md expresses the selected references and author choices for generation. Link these documents and update the composition when the spec changes. Explicit current user instructions take precedence; record their scope. A reference cannot waive an author constraint.

Keep an immutable copy of the spec with each submitted gate package, its revision, artifact paths/hashes and decision evidence. Record changes and affected dependencies before proceeding. `compose.mjs check` validates its existing provenance/delivery contract; it does **not** enforce these gates, verify user approval or validate TO-SPEC contents. Read the spec and check this workflow explicitly. Never represent a checkbox or a script success as client approval.

## Intake: translate the brief before 3D

Extract the brand's supplied palette, input color spaces, fonts/assets and availability, characteristic curves/forms, logo clearspace and distortion rules. Identify retained, deferred and overridden choices; neutral exploration need not use a logo. Follow supersession pointers. Define audience, channel, a one-sentence message, target emotion and the visible change that carries it. Distinguish product detail, conceptual explanation and rhythmic identity work; do not assume every corporate brief needs a product photorealism pipeline.

Record a delivery matrix: dimensions, aspect ratio, frame rate, duration, safe areas, container/codec, transparency, audio, color output and destination. Establish one master and only requested derivatives; changing to vertical often needs reframing rather than a crop. Obtain broadcaster/LED specifications when relevant, including real canvas/mapping. Mark missing requirements and reversible defaults; do not invent compliance.

Treat encoded sRGB swatches, linear-sRGB working values and ACEScg as different representations. A hex swatch is not an ACEScg triple. Select the renderer's actual color pipeline; record input transforms, working space, display/view transform and output encoding/tags. Use color-managed transforms (such as configured OCIO) when crossing spaces. Linearizing sRGB alone does not change its primaries to ACEScg. Noncolor maps use the renderer's data setting. ACEScg is optional, not a delivery codec; an ACES-like tone mapper alone is not proof of an ACEScg pipeline. Verify brand swatches after output transformation at refinement.

Choose a review owner per gate and the scope of any existing delegation. Default to author review for the four requested gates; honor explicit delegation or advance authorization without asking again. Pick the smallest meaningful experiment and a cost/time budget appropriate to the brief; budget estimates are not spending permission.

## Gate 1 — script and reference moodboard

Deliver a small direction packet:

- A timed beat script, with a beginning, change and resolution, plus voice/text/sound intent.
- A visual moodboard of inspected references, with source links and notes on light, material, atmosphere, camera and rhythm. A URL list alone is not a visual moodboard. Reuse a suitable viewer/document format; installing a board service is unnecessary.
- Rough storyboard panels that explain action and space. For a short film, 4–8 panels and 6–9 references are useful starting points, not quotas.
- Two contrasting concept routes by default, each with a central event and experiment question. For a collection, identify which studies are proposed to advance; do not render every route as a finished film.

Review **message, emotional arc, concept and reference direction**. Recommend one route and explain what is gained/lost. Freeze the selected idea and provisional master; keep cuts/timing adjustable for the animatic. Do not start dependent production until this gate's reviewer decides, unless that scope was already delegated. Corrections and independent preparation within the stage continue autonomously.

## Gate 2 — animatic and styleframes

Deliver a full-duration animatic: storyboard/blockout edited at actual narrative timing, rough camera and cuts, guide audio when relevant, and shot/time labels. Use a low-cost 480p/720p preview at the intended delivery fps; lower image quality before changing timing. No guide music is necessary for an intentionally silent film. Missing narration is explicit, not treated as approved pacing.

Deliver **2–5 styleframes**, default three, spanning establishing view, most demanding transformation and resolution. Use final aspect ratio and enough resolution to evaluate the intended delivery appearance, ideally the target output size. A styleframe is a target for a frame, not evidence of temporal continuity.

Default to a **hybrid route**: image models explore light, composition and materials; reproduce the hardest representative frame in the production renderer, with real geometry/assets and color management. Label concept-image and renderer-proof frames distinctly. Record discrepancies and adjust the target or renderer until the promise is credible. When final motion itself uses a video model, substitute a short continuity/control test in that route; preserve prompts, actual reference inputs, model/version/settings and unsuccessful attempts. Use the renderer directly when the user prefers it or the imagery route is unavailable, naming the substitution.

For every approved model image, write an external `STYLEFRAME-SPEC.md` following [the image-to-render handoff](styleframe-handoff.md). Supply the actual approved image plus its detailed objective, composition, inventory, materials, light, camera, **must have** and **must not have** requirements to the render-writing agent/model. Separate observations from implementation guesses. This descriptive translation is required before render implementation and does not add a fifth gate or repeat the image's approval.

Review two decisions independently inside this gate: **narrative/timing/camera** and **appearance/material/light**. One can be accepted while the other needs revision. Confirm both before full production. A targeted 1–2 second motion test can answer the highest-risk question without producing the entire film. Fix cuts, main poses and visual direction here; do not promise exact final resemblance from a model image alone.

## Gate 3 — low-resolution production film

Render the **whole approved duration** through the intended production route, with final scene organization, camera, material/light direction, text and audio layout. Reduce resolution/sampling or use proxies with stated limitations, while retaining fps, timing and causal choreography. A starting point is 50% of the master's linear dimensions, adjusted for text/detail; this is one quarter of the pixels, not half. Use short high-resolution detail crops when needed to judge an issue that low resolution hides.

First test the interval with greatest risk: contact, deformation, occlusion, transparency, camera proximity or image/video continuity. Once it works, render the complete low-resolution timeline. Measure actual render time per frame and estimate remaining cost with uncertainty; a single easy frame is not a reliable upper bound.

Deliver the playable film, keyframe contact sheet and a short known-defects list. Review **staging, timing, intention, weight/friction, elastic response, spatial negotiation, continuity, focus/readability and correspondence with the accepted styleframes**. Inspect every shot in playback and targeted frames; distinguish automated coverage from visual assessment. Test interactive pause/replay/seek, responsive framing and reduced motion where applicable. Agent-owned technical repairs need no repeated permission; creative changes follow the affected gate.

Gate acceptance locks the production timeline and settings intended for final rendering. A short test clip cannot approve an unseen full film. If authored refinement was deferred, judge the exploratory specification rather than asserting final brand fidelity.

## Gate 4 — final delivery

Render the accepted scene at the agreed output quality. Inspect the final itself: sampling noise, flicker, aliasing, clipping, color, fine typography and compression can fail despite a good low-resolution preview. Decode the whole export; check duration, dimensions, fps, codec/container, alpha, audio and channel-specific color metadata as applicable. Compare requested reframed versions against their own safe areas.

Deliver the master, requested channel variants, agreed preview/poster and concise QA/limitations. Final delivery review accepts this work against the brief; it does not establish a permanent brand motion identity. Preserve the existing `delivery.json` preview status until user review; keep approval evidence in TO-SPEC without pretending that the structural checker certifies it. For an accepted deliverable, describe the acceptance accurately while retaining that legacy record contract.

When the user requested video archiving, save **all retained experimental videos**, including animatics, technique tests, low-resolution versions and final exports. Use the authorized account/folder, label project/study/gate/revision, avoid overwriting other work, verify uploads by metadata/readback and retain returned IDs/URLs privately. Keep superseded retained videos clearly labeled; do not delete experiments silently. A request to upload videos does not authorize uploading private source documents. An approval gate does not postpone an already authorized archival action.

## Fast iteration and scoped decisions

Each gate package contains: artifact links/revisions, what changed, what to watch, agent recommendation, known limits and the specific decision needed. Prepare the complete reviewable packet before requesting the decision. Ask only at the agreed boundary or for an unresolved choice that would invalidate the work. User authorization/delegation persists; silence is not acceptance. When pausing, cite the actual agreed gate policy and link its spec/skill source rather than inventing an approval requirement.

Use `planned → in-production → ready-for-review → accepted / revise`, with reviewer and decision evidence. Under delegated review, identify the agent decision as delegated and retain the user's delegation scope. Never attribute an agent's aesthetic assessment to the author. Complete independent, low-cost preparation while awaiting feedback, but do not perform production that depends on an unresolved creative choice.

Test one principal question per variant (camera, material, amplitude or rhythm). Compare two alternatives by default, with consistent assets and seeds where supported. Keep parameters, cost observations, evidence and a conclusion. Do not invent an objective creativity score or a fixed number of allowed revisions.

Reopen only affected dependencies: concept/message changes return to gate 1; cuts/story timing to gate 2 narrative; visual direction to gate 2 styleframes; technical motion/contact changes to gate 3; export corruption to gate 4 QA. Reassess downstream artifacts after upstream changes. Keep prior packages immutable, mark outdated decisions and state what remains valid. Reuse scene assets and deterministic timelines instead of rebuilding for each gate.

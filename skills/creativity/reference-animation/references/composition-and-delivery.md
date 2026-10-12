# Composition and delivery

## Production contract

Follow [the four-gate production workflow](production-workflow.md). Before producing visuals, write the external `TO-SPEC.md` from [its template](to-spec-template.md); it describes this film and guides its plan. Link the current spec revision in `## Work brief` below. Update the composition when accepted spec decisions change. Approved model images require external descriptive handoffs under [styleframe handoff](styleframe-handoff.md). Keep project specs, images and decisions outside the public catalog.

The structural checker retains its existing scope: it does not verify gate approval or to-spec completeness. For gates 1/2, deliver their stage artifacts without manufacturing a final `delivery.json`; run the final delivery check when a complete playable delivery package exists.

## Stage and author precedence

Read [spatial collections](spatial-collections.md). New runs use schema 3 and explicitly select `exploration` (default) or `refinement`. Exploration optimizes the scene’s content, dynamics and depth; record styling deferred by the author. Refinement applies author choices to selected studies without flattening their central idea. Preserve source authorship in both stages.

Read the complete source, not only its tokens. Follow supersession pointers before relying on editorial claims. Preserve recorded authorship; if no creator is named, leave it unknown. Distinguish the author of the original design from source/reference authors and the author of this skill.

The original wins over reference advice. A current, explicit instruction from the author may change a specific restriction: record the instruction, its scope and what it supersedes under `## Author overrides`. Permission to deform one logo is not permission to change every token or publish a new master mark. Without an explicit override, retain the original restriction. Keep the source snapshot unchanged even when a work-specific override is authorized.

The run's `SOURCE-DESIGN.md` is an exact snapshot. The working `DESIGN.md` retains those bytes as its prefix and appends a work-specific composition. Relative source links still resolve against `source_asset_base` in `run.json`, not the temporary directory. Bind the actual assets into the generated project through a recorded copy or explicit absolute reference. Never silently replace unavailable approved assets with a generated likeness.

Use the following headings in `composition.md`; body text follows the user's language:

```markdown
## Reference composition
Status: preview; not approved as a brand identity.

## Work brief
Current TO-SPEC path/revision, production gate, stage, subject, audience, message, dimensions, duration, FPS and destination.
In refinement, identify the selected exploration run and studies.
Identify reversible proof defaults and separate them from brand tokens.

## Author invariants
Exact choices and constraints from the original, with source sections.

## Author overrides
Record explicit current instructions, their scope and the original restriction they replace.
If there are none, write "None; original restrictions apply."

## Base to authorship
| Reference / principle | Original choice | Work adaptation | Conflict disposition |
|---|---|---|---|
Use one row per meaningful decision; record rejected reference advice too.

## Expected result
What the user will see and feel, with a concrete beginning, middle and end.

## Object cast
| Object | Intention / target | Emotion / pivot | Weight / gravity / friction | Elasticity / bounds | Bubble / partners | Readable pose |
|---|---|---|---|---|---|---|
Include focal/interacting objects; identify rigid protected assets and author constraints.

## Motion score
| Time / trigger | Performer | Preparation / action / transformation | Partner reaction / clearance | Recovery / reading window |
|---|---|---|---|---|
Record anticipation, propulsion, space negotiation/contact and recovery.
Name transformation families and their physical/emotional purpose; avoid independent decoration.

## Exploration collection
Per study: title, central event, emotion, material, distinct spatial organization,
energy transfer, output and readable resolution. For one work, record its single study.

## Spatial direction
Projection, coordinate system, camera, depth layers, light, occlusion/contact,
and at least three consistent depth cues. State actual 3D versus 2.5D.
For a deliberately flat brief, explain that choice rather than inventing depth.

## Authorship refinement
Retained source choices; choices explicitly deferred; proposed later mapping.
In refinement, record applied changes, retained scene mechanism and remaining decisions.

## Animation plan
Shots/key poses, timing, transitions, camera, image continuity and sound.
Distinguish authored motion from proposed values filling genuine gaps.

## Generation and inspection
Route, real source assets, approved-image STYLEFRAME-SPEC paths/revisions, prompts/code, tooling and inspection criteria.
```

For a validation request without a production brief, default to an eight-second silent landscape proof per study, 1280×720 at 30 FPS. For a requested collection, use three distinct studies unless specified otherwise. Neutral exploration may omit text and marks. If wording is used, use existing brand wording or a clearly labelled demonstration line; do not invent an approved slogan or product claim. The caller can override every proof setting. Do not invoke `motion-identity` to rewrite the brand as part of creating this work.

## Generation routes

Apply [Mindful Movement](mindful-movement.md) across every route. Code uses seekable trajectories, chosen pivots, bounded deformations and spring recovery; supporting groups react to proximity or contact. Image keyframes show preparation, peak deformation and recovered identity. Video prompts describe performers' intention, weight, friction, personal bubbles and causal reactions shot by shot. Preserve the author's rigid/deformable distinction throughout.

Code is appropriate for precise geometric motion, real 3D scenes, procedural materials and exact typography. Choose a renderer that makes depth, lighting and geometry coherent. Use local assets and fonts, deterministic seek, and a timeline that can export. Image models are appropriate for keyframes and new imagery; send actual visual references when needed. Video models are appropriate when available and useful; record their settings and inspect identity across time. A route may combine them. Availability is evidence to check, not an assumption. Keep a prompt log whenever a model is used, including unsuccessful generations.

## Delivery record

Write `delivery.json` in the run after inspection:

```json
{
  "status": "preview",
  "artifacts": [
    {"path": "project/index.html", "kind": "animation"},
    {"path": "frames/contact-sheet.png", "kind": "evidence"}
  ],
  "inspection": {
    "status": "inspected",
    "method": "Describe full-duration playback or deterministic sampling, including its limits",
    "findings": ["Describe anticipation, spatial negotiation, deformation/energy transfer, partner reactions and readable recovery; record repairs without claiming approval"]
  },
  "limitations": []
}
```

Use run-relative paths. An animation artifact is playable HTML, MP4, WebM or GIF. A still frame alone does not satisfy generation. Keep private client/brand inputs and validation outputs outside this public catalog; only generic instructions and synthetic test fixtures belong here. `compose.mjs check` establishes provenance and file/record presence; it cannot judge style, read pixels, decode a video or prove playback. Perform those checks with actual rendering tools and human-facing evidence.

When video archiving is requested, use the authorized account and destination. Verify uploaded names, MIME, size and folder readback, retaining returned IDs/URLs in the private run. Archive all retained experiment videos, including animatics, technique tests, low-resolution and final versions; mark superseded exports clearly if they are also retained.

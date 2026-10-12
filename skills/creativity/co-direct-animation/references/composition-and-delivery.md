# Composition and delivery

## Production contract

Follow [the five-gate production workflow](production-workflow.md). Before producing visuals, write the external `TO-SPEC.md` from [its template](to-spec-template.md); it describes this film and guides its plan. Link the current spec revision in `## Work brief` below. Update the composition when accepted spec decisions change. Approved model images require external descriptive handoffs under [styleframe handoff](styleframe-handoff.md). Keep project specs, images and decisions outside the public catalog.

Review packets and attempts use [the record protocol](review-records.md). For earlier gates, deliver their actual stage artifacts without manufacturing a final delivery.json. The new checker validates revision-bound record consistency; it cannot certify that the human wrote a response or that the film matches TO-SPEC semantically.

## Stage and author precedence

Use [spatial collections](spatial-collections.md) when the selected direction needs spatial scenes; other animation styles are valid. New runs use schema 4 and explicitly select `exploration` (default) or `refinement`. Exploration optimizes the scene’s content, dynamics and depth; record styling deferred by the author. Refinement applies author choices to selected studies without flattening their central idea. Preserve source authorship in both stages.

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
Include applicable objects/characters/groups; identify protected assets and constraints. Mark inapplicable physical properties rather than forcing anthropomorphic spatial objects into every film.

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
and consistent depth cues when the direction is spatial. Describe generated appearance without claiming recovered 3D geometry.
For a deliberately flat brief, explain that choice rather than inventing depth.

## Authorship refinement
Retained source choices; choices explicitly deferred; proposed later mapping.
In refinement, record applied changes, retained scene mechanism and remaining decisions.

## Animation plan
Shots/key poses, timing, transitions, camera, image continuity and sound.
Distinguish authored motion from proposed values filling genuine gaps.

## Generation and inspection
Route, real source assets, approved-image STYLEFRAME-SPEC paths/revisions, prompts/input assets, tooling, attempt receipts, human responses and inspection criteria.
```

Do not impose a technical proof default before checking model/account capabilities and the human brief. Collections propose distinct concepts; they do not authorize unplanned generations or bypass the run's recorded review policy and budget. Neutral exploration can omit marks/text. Use authored wording or clearly labelled demonstration wording; do not invent an approved slogan. Keep permanent motion identity with motion-identity.

## Generation route

Generate animation through [gflow](gflow-integration.md), shot by shot after the three visual planning gates. The chosen image tool supplies reviewed frames; inspect and translate them using the descriptive handoff. Carry intention, preparation, causal response, shape/identity constraints and readable recovery into prompts, without pretending descriptive physics are a simulation control.

Code supports records, inspection, archiving and assembling generated clips, including cuts, agent-managed audio, static captions/text/marks and color finishing. It does not generate object animation or replace an unavailable video model. Retain all attempts and their settings, including failures, outside the public catalog.

Check file integrity, decoding, native measurements and provenance per clip. In the default complete-video mode, join the planned animation and perform one creative inspection before editorial assembly and finishing; do not inspect or review clips individually. Record concrete reference principles in the edit choices. Preserve sound consistent with the brief. Verify finishing/export changes without repeating the creative pass; new generation or significant visual changes require a new complete-video revision.

## Delivery record

Write delivery.json only for a complete inspected film:

```json
{
  "status": "ready-for-review",
  "source_attempts": ["attempt-0001"],
  "artifacts": [
    {"path": "delivery/master.mp4", "kind": "animation"},
    {"path": "delivery/inspection.md", "kind": "evidence"}
  ],
  "inspection": {
    "status": "inspected",
    "method": "<one complete-animation creative inspection before finishing; targeted finishing checks and full export decoding/spec checks, including limits>",
    "findings": ["<observed narrative, continuity, constraints, sound and repairs>"]
  },
  "limitations": []
}
```

Use run-relative paths and gflow video source attempt IDs covered by the accepted complete preview, or individually accepted under per-attempt mode. New animation artifacts must be MP4 or WebM; HTML can be a moodboard/viewer, not animation production provenance. The structural checker requires four accepted planning/preview gate records (including scoped overrides) and exact covered gflow source attempts. Preserve the human's explicit delegation to finished-film approval without inventing individual clip responses. After final human decision and criticism on the exact film/QA revision, set status to accepted. Work acceptance does not approve permanent brand motion identity.

The checker validates source/profile snapshots, composition, file/record presence and review/dependency consistency. MP4 headers and declarations alone do not prove decoding, actual native specifications, visual success or editorial fidelity. Keep the single complete-video creative inspection separate from technical checks and report its limits precisely. Schema 1–3 reference-animation runs retain their earlier preview/HTML record checks for historical reading only; create a new schema 4 run to resume this production route.

When archiving is authorized, preserve all retained videos and review assets, verify names/MIME/size/destination and readback, and retain returned IDs/URLs privately. Mark superseded retained work without deleting it silently. Do not upload private source documents merely because generated media archiving was requested.

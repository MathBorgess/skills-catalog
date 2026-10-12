# Composition and delivery

## Author precedence

Read the complete source, not only its tokens. Follow supersession pointers before relying on editorial claims. Preserve recorded authorship; if no creator is named, leave it unknown. Distinguish the author of the original design from source/reference authors and the author of this skill.

The run's `SOURCE-DESIGN.md` is an exact snapshot. The working `DESIGN.md` retains those bytes as its prefix and appends a work-specific composition. Relative source links still resolve against `source_asset_base` in `run.json`, not the temporary directory. Bind the actual assets into the generated project through a recorded copy or explicit absolute reference. Never silently replace unavailable approved assets with a generated likeness.

Use the following headings in `composition.md`; body text follows the user's language:

```markdown
## Reference composition
Status: preview; not approved as a brand identity.

## Work brief
Subject, audience, message, dimensions, duration, FPS and destination.
Identify reversible proof defaults and separate them from brand tokens.

## Author invariants
Exact choices and constraints from the original, with source sections.

## Base to authorship
| Reference / principle | Original choice | Work adaptation | Conflict disposition |
|---|---|---|---|
Use one row per meaningful decision; record rejected reference advice too.

## Expected result
What the user will see and feel, with a concrete beginning, middle and end.

## Animation plan
Shots/key poses, timing, transitions, camera, image continuity and sound.
Distinguish authored motion from proposed values filling genuine gaps.

## Generation and inspection
Route, real source assets, prompts/code, tooling and inspection criteria.
```

For a validation request without a production brief, default to an eight-second silent landscape proof, 1280×720 at 30 FPS. Use existing brand wording or a clearly labelled demonstration line; do not invent an approved slogan or product claim. The caller can override every proof setting. Do not invoke `motion-identity` to rewrite the brand as part of creating this work.

## Generation routes

Code is appropriate for typography, protected brand assets and precise geometric motion. Use local assets and fonts, deterministic seek, and a timeline that can export. Image models are appropriate for keyframes and new imagery; send actual visual references when needed. Video models are appropriate when available and useful; record their settings and inspect identity across time. A route may combine them. Availability is evidence to check, not an assumption. Keep a prompt log whenever a model is used, including unsuccessful generations.

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
    "findings": ["Describe observed behavior and repairs; no approval claim"]
  },
  "limitations": []
}
```

Use run-relative paths. An animation artifact is playable HTML, MP4, WebM or GIF. A still frame alone does not satisfy generation. Keep private client/brand inputs and validation outputs outside this public catalog; only generic instructions and synthetic test fixtures belong here. `compose.mjs check` establishes provenance and file/record presence; it cannot judge style, read pixels, decode a video or prove playback. Perform those checks with actual rendering tools and human-facing evidence.

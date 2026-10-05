# Choosing an explanatory representation

Choose by what the learner cannot yet see, not by production value. These modes draw on controlled prose, diagrams, interactive pages and bespoke explainers; they are options, not a ladder every lesson must climb.

| Need | Default artifact | What must be visible |
|---|---|---|
| Unfamiliar vocabulary or a small distinction | Plain names plus a compact comparison | Plain term → formal name → example; preserve formal terms for later recognition |
| Ownership, dependencies or a causal mechanism | Labeled diagram (Mermaid or inline SVG where suitable) | Inputs, transformations, outputs and the condition on each branch; legend for symbols |
| Spatial arrangement or visual analogy | Annotated image | The actual mechanism and where the analogy stops; labels readable at the intended display size |
| Parameter trade-off or alternatives | Interactive HTML | A small control changes a visible outcome; initial state already teaches the idea |
| Evolution over time | Short video or animation | One step at a time, persistent labels, captions/transcript and a still diagram fallback |

## Clear terms and controlled prose

Use short active sentences, stable vocabulary and one operation per sentence. Explain an acronym on first use. Prefer a specific action to a vague metaphor. A controlled-language specification such as ASD-STE100 may inspire clarity, but do not claim compliance without checking its rules. A numerical teaching example is illustrative unless derived from measured data; label it accordingly.

## Diagrams and images

Show the load-bearing distinction with as few elements as needed. Label arrows with what moves or changes; avoid unlabeled arrows that could mean either data flow or control. Keep a text explanation beside the visual. For AI-generated images, inspect text and spatial relationships; use ordinary text/SVG overlays when exact labels are essential. Cite evidence in the caption rather than hiding it in an image.

## Interactive HTML

For a standalone artifact, use the caller's destination or a local `explain-me/<topic>.html` with a sibling `<topic>-assets/` directory only when assets exist. For `teach-me`, embed in its existing lesson or provide a fragment and relative assets at its requested location; preserve its shared stylesheet, quiz scripts and resume brief.

Use a viewport tag, one mobile column, keyboard-operable controls and no hover-only explanation. Default to local assets and no CDN or analytics. Check at phone width and desktop width when a browser preview is available. An interactive result is complete only when changing the control updates the intended visual state.

## Video and narration

Use the available video skill/runtime. Keep motion tied to a change in the mechanism rather than decoration. Match narration, caption and visible state. A real video deliverable requires a rendered playable file and an inspected frame/sequence; a storyboard alone is an unfinished video. If narration is unavailable, a silent captioned explanation may be useful, but say that it is silent. Never invent rendering success or request an API key just because a source example used one.

## Caller boundary

Return: comprehension goal, explanation artifact/fragment, asset paths, plain/formal glossary, primary sources, assumptions and verification limits. `teach-me` integrates these into its lesson and preserves answer concealment. Generating an attractive explanation is not evidence that the learner understood it.

# Staged exploration

## Low fidelity

Explore structure before surface polish. For web interfaces, show meaningful alternatives in hierarchy, layout, or primary affordance while keeping content and context stable. Make the main interaction inspectable when behavior is part of the question. For thumbnails and photos, show crop, subject placement, and visual direction with rough compositions. For carousels, show the sequence and each slide's hierarchy. Use actual visual previews; prose descriptions do not replace the checkpoint.

Ask the user to choose, combine, or revise the alternatives. Record the chosen direction and any unresolved tradeoff in `DECISIONS.md`. Do not convert a preference for one preview into a claim that the prototype question was answered.

The use of structured alternatives adapts UI exploration ideas from [Matt Pocock's prototype skill](https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336/skills/engineering/prototype); the staged review and delivery rules here are specific to `prettify`.

## High fidelity

Apply the chosen direction using the accepted design authority, real content, assets, typography, color, spacing, and purposeful motion. Show a rendered preview in the relevant context. Ask for concrete defects or changes and preserve already accepted choices during refinement. A direct move from low fidelity to delivery skips this review checkpoint; it does not authorize inventing approval.

## Explicit skips

When the user asks to skip a checkpoint, state briefly that they have less opportunity to direct composition or detail before delivery. Record the skipped checkpoint and the user's request. Reuse an explicit skip already given for this run. Never let skips alter design authority, dependency requirements, agreed content or behavior, or final inspection.

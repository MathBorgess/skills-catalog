# Briefing and design authority

Record the working brief in `.prettify/<slug>/BRIEF.md`. Phrase the prototype question so an observed result can answer it or be reported as inconclusive. Include what evidence would distinguish those outcomes, audience, message or task, target surface, constraints, existing artifact, and agreed destination. Use the project's normal language for working material. Keep project-specific content and composition in this brief unless the owner explicitly makes it durable guidance.

Read the full existing `DESIGN.md`, including its frontmatter and referenced assets. Preserve its schema and unrelated sections. Separate established guidance from reference observations, proposals, and unknowns; cite concrete sources for extracted decisions.

When `DESIGN.md` is absent, place a proposed draft in the run folder. Show the material change before writing it to the project's durable spec. Obtain one of these explicit choices:

- **Reject:** do not use the rejected proposal. Revise it for review or stop if no direction is agreed.
- **Use for this piece:** apply it only to this run; leave `DESIGN.md` unchanged.
- **Use and include:** apply it to this run and show the precise proposed `DESIGN.md` change. Write that change only after the user approves the shown diff.

For an existing spec, distinguish accepting a reference for this piece from electing to add it to the durable spec. Rejection is not permission to keep using the same direction. A missing spec may remain a run-only proposal if accepted for this piece.

Use this compact starting shape for a missing-spec proposal, adapting only where the project needs a known consumer schema:

```markdown
# Design direction
**Status:** Proposed; not yet authority

## Audience and intended impression
## Reference decisions
## Visual tokens
## Composition and hierarchy
## Interaction and motion
## Responsive and accessibility behavior
## Open decisions
```

In `Reference decisions`, label each item as sourced, proposed, or unknown and include its source. Put only supported or accepted values in `Visual tokens`; mark the rest unknown. Keep the proposal in the run folder until the owner chooses to include the shown change durably.

Impeccable's `init`, `document`, and redesign playbooks may write `DESIGN.md`. Treat generated changes as proposals: run them on an isolated copy when practical, inspect the resulting diff, and show the exact change to the owner. If the tool would write directly to the authority file and cannot be safely isolated, do not run that writing operation there. Apply only the change the owner explicitly chose to include.

Preserve existing design fields used by other consumers. In particular, UI motion in CSS units such as milliseconds or CSS easing must not overwrite video motion values expressed in seconds or GSAP easing names. Add UI-scoped values only when the project's schema supports them and the owner approves; do not rename or repurpose existing keys.

Record the disposition and resulting design authority in `.prettify/<slug>/DECISIONS.md`. In the run manifest, map rejection to `rejected` and stop; map piece-only acceptance to `piece-only` with no durable update. For a new durable `DESIGN.md`, record no original file and use the explicit approved-creation update receipt. For an existing file, preserve its original snapshot and require an approved update receipt only when the user elects to change it. Never infer consent from silence, a skipped stage, or approval of the finished artifact.

# Briefing and design authority

Record the working brief in `.prettify/<slug>/BRIEF.md`. Include the prototype question and what evidence could answer it, audience, message or task, target surface, constraints, existing artifact, and agreed destination. Use the project's normal language for working material. Keep project-specific content and composition in this brief unless the owner explicitly makes it durable guidance.

Read the full existing `DESIGN.md`, including its frontmatter and referenced assets. Preserve its schema and unrelated sections. Separate established guidance from reference observations, proposals, and unknowns; cite concrete sources for extracted decisions.

When `DESIGN.md` is absent, place a proposed draft in the run folder. Show the material change before writing it to the project's durable spec. Obtain one of these explicit choices:

- **Reject:** do not use the rejected proposal. Revise it for review or stop if no direction is agreed.
- **Use for this piece:** apply it only to this run; leave `DESIGN.md` unchanged.
- **Use and include:** apply it to this run and show the precise proposed `DESIGN.md` change. Write that change only after the user approves the shown diff.

For an existing spec, distinguish accepting a reference for this piece from electing to add it to the durable spec. Rejection is not permission to keep using the same direction. A missing spec may remain a run-only proposal if accepted for this piece.

Record the disposition and resulting design authority in `.prettify/<slug>/DECISIONS.md`. In the run manifest, map rejection to `rejected` and stop; map piece-only acceptance to `piece-only` with no durable update. For a new durable `DESIGN.md`, record no original file and use the explicit approved-creation update receipt. For an existing file, preserve its original snapshot and require an approved update receipt only when the user elects to change it. Never infer consent from silence, a skipped stage, or approval of the finished artifact.

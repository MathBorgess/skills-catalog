---
name: prettify
description: "Use when the user wants to turn a visual idea or existing prototype into a directed, usable web interface or static piece such as a thumbnail, photo, or Instagram carousel. Run a brief, explore low fidelity, refine high fidelity, and deliver an inspected artifact while preserving the user's design authority."
metadata:
  author: Matheus Borges
  version: 0.0.0
---

# Prettify

Take a visual idea from an explicit question through reviewable stages to an agreed artifact. The question's result and the visual assessment are separate findings.

## Workflow

1. **Brief.** Identify the question the prototype should answer, audience, primary message or task, format, constraints, destination, and any existing artifact. Preserve its question, content, and relevant behavior. Read the project's `DESIGN.md` and the assets it names before choosing a direction. Follow [briefing and design authority](references/briefing-and-design.md).
2. **Resolve authority and resources.** If `DESIGN.md` is missing, prepare a reference-backed proposal that labels sourced decisions, your proposals, and unknowns. Ask whether to reject it, use it for this piece, or use it and include the shown change in `DESIGN.md`. Do not treat it as authority until accepted. Rejection requires a revised proposal or a stop. Check only resources needed for this task; follow [resource decisions](references/resources.md). A stage skip never changes these requirements.
3. **Explore low fidelity.** Make visual alternatives or a rough composition that shows hierarchy and structure, with only enough detail to compare. Keep the question, content, audience, and relevant behavior constant. Show the actual preview and ask the user to choose, combine, or revise a direction. Text alone is not a visual checkpoint. Record the direction and any explicit skipped stages; follow [staged exploration](references/staged-exploration.md).
4. **Choose the next stage.** Ask whether to review high fidelity or go directly to delivery. Honor explicit requests to skip other checkpoints after briefly explaining the reduced opportunity to direct the result. A skip records an unreviewed checkpoint; it never means approval. Follow [staged exploration](references/staged-exploration.md).
5. **Refine and deliver.** For high fidelity, apply the accepted direction and current design authority, then show the rendered preview for concrete feedback. For delivery, complete the agreed web implementation or export the agreed static files. Inspect the actual deliverable in its intended context and preserve evidence. Follow [delivery and evidence](references/delivery.md).

## Done-check

- [ ] The user's question, audience, message or task, format, constraints, and destination are recorded.
- [ ] Every reference or proposed design authority has an explicit disposition; durable `DESIGN.md` changes match the user's specific choice.
- [ ] Required resources were verified usable, or the dependent work stopped on refusal or inability to provide them.
- [ ] Previews shown, chosen direction, and skipped checkpoints are recorded; no skip is described as approval.
- [ ] The agreed artifact is implemented and navigable for web, or exported in the requested format for static work, and its final evidence is recorded.
- [ ] The prototype question's result is reported as answered or inconclusive, with evidence, separately from visual assessment and its limitations.

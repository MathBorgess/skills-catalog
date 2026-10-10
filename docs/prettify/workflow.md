# Prettify workflow design

**Status:** all interview choices resolved; consolidated workflow awaits final confirmation before implementation. This document describes a proposed operator skill, not a shipped workflow.

## Accepted decisions

- Own the complete prototype exploration, including creation or reuse of an existing artifact.
- Cover interactive web interfaces and static pieces: thumbnails, photos and Instagram carousels.
- Keep the answer to the prototype's question separate from visual assessment.
- Deliver web work as an implemented, navigable interface in the project with interaction and design checks. Publication is outside this workflow.
- Treat `DESIGN.md` as the authoritative design reference. Missing context requires an initial document based on references, presented to the human for a decision.
- Allow extra resources as dependencies. When a necessary resource is missing, offer installation; refusal stops execution with a concrete explanation of why it is needed.
- Require resources according to the current task, not the entire resource set on every run.
- Follow briefing → low fidelity → high fidelity → delivery. Let the human explicitly skip stages, with a short explanation of the reduced control over the result.

## Proposed stage behavior

| Stage | Work | Human checkpoint | Evidence |
| --- | --- | --- | --- |
| Briefing | Establish question, audience, message/task, surface, constraints, existing artifact and design reference | Resolve missing design context and material brief choices | Brief and source references |
| Low fidelity | Explore hierarchy, composition, sequence and relevant interaction with minimal visual detail | Explore alternatives; choose or combine a direction; request high fidelity or direct final delivery | Wireframes/sketches and the chosen direction |
| High fidelity | Apply the accepted identity, assets, typography, color, spacing and purposeful motion | Review the rendered direction and request concrete corrections | Rendered previews with the design decisions they exercise |
| Delivery | Produce the agreed final artifact, inspect it in its intended context, and package the result | Accept the final artifact; unresolved findings remain explicit | Files, inspection findings, question result and visual assessment |

Low fidelity should leave room for change: structure and hierarchy must be clear without giving unfinished choices the authority of a finished visual. For photography, propose crop, subject arrangement and art direction through sketches or rough compositions. For carousels, explore sequence and per-slide hierarchy. A text description alone is not a visual checkpoint.

High fidelity is a reviewable representation near the intended final appearance. Delivery adds the agreed usable artifact and its evidence. A user who requests direct delivery from low fidelity skips the high-fidelity review checkpoint; the agent still applies the design reference and verifies the final result.

Use an existing prototype as evidence and starting material. Preserve its question, content and relevant behavior while changing visual treatment; if an intended structural change also changes behavior, disclose that change in the brief rather than treating it as decoration.

## Design reference lifecycle

Read an existing `DESIGN.md` and the assets it names before proposing a direction. Keep its established token schema and prose intact. Project-specific audience, message and composition belong to the current brief unless the human elects to make them durable design guidance.

If the file is absent, prepare an initial draft with concrete sources and extracted decisions. Show what comes from a reference, what is a proposal, and what remains unknown. Ask for the human's decision before treating the draft as authority. Rejection triggers a revised proposal or a stop when no direction is agreed; rejection is not permission to proceed with the same proposal.

**Accepted distinction:** a reference may be accepted for the current artifact, rejected, or accepted with explicit inclusion in `DESIGN.md`. The last choice changes durable identity. Accepting a piece-specific direction alone does not rewrite an existing brand spec. A missing spec can remain an approved run-specific draft if the human accepts its use without electing to establish it as the durable project spec.

## Dependency boundary

Do not confuse a tool being named with it being available. Check the actual resource needed: readable skill instructions, a runnable launcher, browser inspection, an image generation/editing capability, or an export mechanism. Record capability limitations instead of claiming execution from file presence.

**Accepted policy:** require dependencies per task rather than the entire resource set. Task-specific mapping:

| Need | Candidate resource | Scope |
| --- | --- | --- |
| Web design decisions and supporting checks | Impeccable | Interactive web work |
| Specialized interface motion | Transitions.dev | Only when a selected interaction needs its recipes |
| Generated or edited photographic/illustrative assets | Available image generation/editing provider | Only when the brief requires generation or editing |
| Rendering and interaction inspection | Browser capability | Web and browser-rendered layouts |
| Static composition/export | Existing project renderer or suitable graphics capability | Thumbnail/carousel delivery |

Matt's prototype mechanisms can be rewritten with attribution rather than requiring its plugin. The user has not selected that plugin as a mandatory dependency. References such as Godly provide source material, not required installed runtimes. Animos and Deck.gallery remain presentation references rather than default dependencies for static-image or web delivery.

When a selected necessary resource is absent, present its name, task-specific purpose and proposed installation. Wait for an answer. Install only with authorization, then verify actual availability. If declined, stop the dependent execution and report the missing capability and preserved work. If installation cannot be performed in the environment, explain that limitation; do not offer an installation the agent cannot carry out.

## Explicit stage skips

Record which checkpoints the user chose to skip and the consequence: less opportunity to direct composition or visual detail before the finished result. Reuse an earlier explicit skip request instead of asking again. Stage skips do not authorize inventing approval, rewriting `DESIGN.md`, changing the agreed message, omitting final inspection or bypassing a missing required resource.

## Verification and delivery proposal

For web, inspect relevant viewport sizes and exercise the main interaction plus meaningful states. For static pieces, inspect the actual exported artifact, its intended display scale, crop, text readability and consistency across a carousel. Checks should match the deliverable rather than imitate implementation.

Report the question result as answered or inconclusive, with the evidence used. Report visual assessment against `DESIGN.md` and the chosen direction separately. Technical checks alone do not prove taste or task success; human visual approval alone does not establish behavioral correctness.

Proposed project artifacts live in `.prettify/<slug>/`: `BRIEF.md` records the assignment, `DECISIONS.md` records reference acceptance, chosen directions and explicit skips, `EVIDENCE.md` records observations and the two result types. `low/` and `high/` contain produced previews; create each directory only when it has content. A missing spec is proposed as `DESIGN.proposed.md` in that run folder. Final files use the project's normal locations, or an agreed output folder for static pieces. No absolute machine paths or private project examples belong in the public skill. Canonical brand decisions stay in the existing `DESIGN.md`.

The entry skill should remain short and ordered. References would cover briefing/design approval, staged exploration, task-specific resource checks and delivery inspection. One job connects all formats: take a visual idea from an explicit question through reviewable stages to an agreed artifact.

## Final review and implementation boundary

All interview choices are resolved. The proposed file destinations and execution details above are included in the final review, so the human can correct the whole design before implementation. The skill will be an operator, named `prettify`, with its entry workflow in English, on-demand references and Codex picker metadata. Preserve the repository's default invocation policy. Any deterministic resource probing or evidence-format validation belongs in zero-dependency Node ESM scripts; creative decisions remain in instructions. Do not vendor external recipe collections.

After the human confirms the shared understanding, create the skill, register it in the existing README catalog and plugin manifest, leave its unpublished metadata at `0.0.0`, bump the package/plugin version as required, run catalog checks, and open a pull request against `main`. Do not merge or publish the project output as part of delivery. A real end-to-end pilot would validate tool integration separately from catalog packaging checks.

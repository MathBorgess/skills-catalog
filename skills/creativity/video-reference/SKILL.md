---
name: video-reference
description: "Use when the user wants to distill a local video into reusable references, recover a project's video-reference library, prepare editor direction from reference layers, or guide an edit using a saved video reference. Captures text presentation, graphical construction, motion, content, sound and their temporal/semantic dependencies. The current agent analyzes; the local CLI preserves evidence and retrieves context."
metadata:
  author: Matheus Borges
  version: 1.1.0
---

# Video Reference

Turn an inspected local video into a reusable temporal score for an editor. Keep originals, observations, hypotheses and adaptation decisions distinct. Work in the user's independent project folder, outside this public catalog.

## Mandatory production contract

Load [MANDATES](references/production-mandates.md) before every reference consumption or edit. Carry them with recovered context, adaptation proposals and editor handoffs in a project-local `MANDATES.md`; a reference never overrides them. First pass: show the hook in the first three seconds, captions and screen elements second by second; assemble the complete editable video using reference behavior and author content; open actual Remotion Studio for human review. The human leads further edits assisted by AI. Use 1080×1920, protect important content from Instagram overlays and never alter source footage color.

## Steps

1. **Discover and select the project.** Run `video-reference --help` and `doctor`. If unavailable, follow the [CLI repository's setup](https://github.com/MathBorgess/video-reference#install); do not invoke an unrelated unscoped npm package. Read [CLI operations](references/cli-operations.md) for output/exit semantics. Reuse the named project or initialize an empty folder. Search this project first; search other folders only under an explicit request. Do not upload media or add a model provider.
2. **Distill a local original.** Ingest the file and use `schema analysis` plus `template` for the current contract. Read [observation method](references/observation.md). For sound, follow [local audio analysis](references/local-audio-analysis.md); for fast transitions, charts and trajectories, follow [motion measurement](references/motion-measurement.md). Inspect the entire visual sequence and sound with available tools, then deepen uncertain intervals. CLI extraction alone is not observation. Describe text presentation, graphical assembly, motion and audio-content relationships with evidence. Keep measured signal properties, model predictions and direct listening separate; save incomplete work when a required modality remains unverified.
3. **Save and check.** Save the analysis data object as an immutable revision and run `check`. Preserve accepted source/transcript revisions in optional provenance. Reusing a transcript does not establish visual or acoustic coverage; corrected words may invalidate their old timestamps. Original copies are deduplicated within this project, not across independent projects.
4. **Recover only needed context.** Search using behavior descriptions, names or tags. Inspect candidate summaries and unknowns; `read` selected layers and intervals. Carry its dependency events even when they belong to other layers or times. Follow evidence paths from the project root. Deepen a reference only when the task needs it, saving a new revision. Resume from project files, never a remembered chat claim.
5. **Prepare Remotion direction.** Read [handoff](references/remotion-handoff.md). For production, apply [editorial quality](references/editorial-quality.md): storyboard the whole arc with prints and speech, inspect mistakes/repetitions for reversible cuts, and give relevant milestones and the author's CTA greater weight. Adapt concrete effects to the current brand. Select references and describe requested changes against exact event/revision IDs. Generate the supported CLI packet and include `MANDATES.md` in its editor context. For affected dependencies or a mescla, present the proposal and proposed resolutions to the human; wait for confirmation before recording an approval with `decide`. Never author approval evidence yourself or interpret a generic flag as consent. Changes to the proposal require a fresh decision. A packet with incomplete observation remains incomplete.
6. **Deliver a bounded result.** Give the project, reference/revision and packet paths, coverage and unresolved issues. Only when asked to proceed into production, apply the MANDATES and open the requested editor for review. Use Remotion Studio and the project's pinned Remotion setup. A plan or partial pilot is not the complete first pass. The selected editor owns composition; the reference skill supplies evidence and direction. A review request never authorizes export or publication.

## Done-check

- [ ] Local original preserved, evidence traceable, analysis revision saved and structural check passed.
- [ ] Whole-video coverage is honestly stated; extracted frames/transcripts are not presented as proof of watching or listening.
- [ ] Text, graphics, motion and sound are described as behaviors with relations, not vague style labels; missing evidence stays explicit.
- [ ] Audio clocks, rejected ASR, classifier ambiguity and motion sampling error are recorded. Every claimed sound/image synchronization has an anchor, tolerance and verification method.
- [ ] Recovery includes required dependencies. Adaptation decisions come from a human and identify exact proposal/revisions.
- [ ] MANDATES travel with recovered context and handoffs; the second-by-second plan is shown, then the complete editable composition is opened in Remotion Studio.
- [ ] Production includes a timestamped print-and-speech storyboard, stronger milestones/CTA and a reasoned speech-cut ledger; meaning, author intent and shared clocks survive edits. Missing evidence and unsafe cuts stay explicit.
- [ ] For production, color preservation and safe areas are verified or explicitly unresolved; the requested Studio is open, with no unrequested export/publication.
- [ ] Direction, incomplete work and untested audiovisual fidelity are clearly distinguished.

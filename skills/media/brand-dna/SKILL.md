---
name: brand-dna
description: "Use when the user wants to extract, confirm, or evolve a brand and voice DNA brief ('brand-dna', 'DNA da marca', 'voz da marca', 'identidade e tom', 'brand brief') from a brand name, project files (DESIGN.md, BRAND.md, frame.md, voz.md) or user notes, or when a media skill (social-video-director, social-post-director, brand-campaign-shots, campaign-identity-grid, poster-design, illustration-style-remix) needs a confirmed identity, voice, and motion baseline before creating media."
metadata:
  author: Matheus Borges
  version: 1.0.0
---

# Brand DNA

Lock the durable identity of a brand and its author — visual core, voice cadence, and motion baseline — in one file (`brand-dna.md`) before any media skill generates content. Every claim is marked `[known]` with its source or `[inferred]` for the human to correct.

## Steps

1. **Discover existing DNA.** Check for `brand-dna.md` in the project root or `<out>/brand-dna.md`. If it exists with zero uncorrected `[inferred]` lines and the user did not ask to evolve it, reuse it in zero questions and return its path to the caller.
2. **Ingest project sources.** Read `DESIGN.md`, `BRAND.md`, `frame.md`, `design.md`, and `voz.md` when present. Ask only for missing essentials: brand or creator name, niche/industry, and user standing (own brand, client, or concept study). A concept study for a third-party brand carries the note `unofficial concept`.
3. **Write the three-block brief.** Fill [the schema](references/brand-dna-schema.md) in `brand-dna.md`:
   - **Visual & Brand Core**: `Archetype`, `Philosophy`, `Audience & Prerequisites`, `Palette` (hexes, signature first), `Typography` (`display` and `body`), `Materials & Visual Lineage`.
   - **Voice DNA**: `Tone` (three words), `Cadence & Burstiness`, `Vocabulary & Grounding`, and `Banned AI Clichés` from [voice and cadence](references/voice-and-cadence.md).
   - **Motion & Guardrails**: `Motion Archetype`, `Role Eases` (`enter`, `exit`, `emphasis`, `base`), `Max Static Hold`, `Brief Block` from [motion archetypes](references/motion-archetypes.md), and `Never` (two or three things the brand never shows or claims).
   Mark every line `[known]` (citing the exact file, user statement, or public source) or `[inferred]` (stating the observation behind it).
4. **Confirm with the human.** Present `brand-dna.md` and ask the human to confirm or edit each `[inferred]` line. Accept surgical conversational patches (`dna: <change>`), updating only the targeted field. No media skill starts generation while an `[inferred]` line remains unconfirmed.
5. **Inspect and lock.** Verify every `[known]` line cites a real source, no hex or font name was silently invented as `[known]`, and both `Never` and `Banned AI Clichés` contain concrete, testable rules for downstream `review.md` checks.

## Done-check

- [ ] `brand-dna.md` contains all three blocks (`Visual & Brand Core`, `Voice DNA`, `Motion & Guardrails`).
- [ ] Every `[known]` line cites its exact source; zero `[inferred]` lines remain unconfirmed by the human.
- [ ] Colors, typefaces, and slogans come verbatim from confirmed sources or user input, never invented as facts.
- [ ] `Voice DNA` states sentence burstiness targets and explicit banned phrases; `Motion & Guardrails` and the `Brief Block` state all four GSAP role eases (`enter`, `exit`, `emphasis`, `base`) and the `Never` list.
- [ ] A concept study for a brand the user does not own is marked `unofficial concept`.

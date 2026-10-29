---
name: poster-design
description: "Use when the user wants an image-model poster built around one subject — a person, athlete, team, character or ensemble — and says 'poster', 'pôster', 'tribute poster', 'sport poster', 'photo-grid poster', 'movie poster from my references', or hands over a name or photos to turn into one. Picks one of three poster archetypes, fills its slots from the subject, generates through the image tool the user names, and inspects every output against the archetype's own constraints. Not for brand identity boards (campaign-identity-grid) or posters built as a web page."
metadata:
  author: Matheus Borges
  version: 1.0.1
---

# Poster design

One subject, one archetype, one variable per round. The image model draws; you choose the archetype, derive the slots and decide whether an output passes.

## Steps

1. **Intake.** Ask for the subject (name and what they are known for), the destination (screen, print or social, with aspect ratio), reference photos the user owns or may use, the image tool, and a run budget (default 6 generations). Depict only subjects the user may depict, and put no claim, endorsement or invented quote in the poster. Write the answers to `<out>/brief.md`; `<out>` defaults to `posters/<subject-slug>/`.
2. **Pick the archetype.** Read [archetypes](references/archetypes.md). Recommend one with a one-sentence reason and name the runner-up; the user chooses. A changed archetype restarts at step 3.
3. **Fill the slots.** Derive every slot from the subject (and `brand-dna.md` when present), one line of reasoning each, in `brief.md`: the accent color from what the subject is identified with (team, brand, flag, signature color), never a default red; the logo or initials; the typographic roles. Mark each guessed slot `[guess]` and let the user correct it before generating.
4. **Write the prompt.** Use the archetype's fixed block; the slots are the only variable. Order it medium, composition, subject, typography, hard constraints. State each target as a positive ("a flat vector rectangle on pure white") before its guardrail. Keep it short — under about 250 words when references are attached, because adherence drops as a prompt grows. Save exactly what you send to `<out>/prompt.md`.
5. **Generate.** Use the tool the user named, up to 4 variants per round. Attach at most three reference photos per run; build an ensemble across rounds, adding characters in stages. Append tool, model, settings, reference files and output paths to `<out>/runs.md`.
6. **Inspect.** Show every output to the user and judge it against the archetype's *Inspect* list, counting what can be counted. Write one verdict per output to `<out>/review.md`: pass, or the failed check with what you saw.
7. **Revise or stop.** Change one variable per round: a slot value, one constraint, the prompt length or the reference count. Stop on the user's pick or when the budget is spent; then report the best output with its defects in place of another round.

Technique distilled from public posts by @AmirMushich; see [sources](references/sources.md).

## Done-check

- [ ] `brief.md` holds the subject, destination, tool, budget and every slot, with each `[guess]` confirmed or corrected.
- [ ] `prompt.md` is byte-identical to the text sent, and `runs.md` lists every generation made.
- [ ] Every output has a verdict in `review.md` against the archetype's checks; counts (characters, cells, name width) are numbers, not impressions.
- [ ] The delivered file is the one the user picked, or the best output with its failed checks stated.
- [ ] The run stayed within budget; the spend is reported as a count of generations.

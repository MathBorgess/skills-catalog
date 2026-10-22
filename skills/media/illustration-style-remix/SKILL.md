---
name: illustration-style-remix
description: "Use when the user wants a person or character redrawn as an illustration in a named style or era — 'in the style of', 'cartoon version of', 'comic portrait', 'Gorillaz-style', 'pro sketch of this person', 'estilo de desenho' — or wants one style applied across a whole set of subjects. Breaks the style into six observable layers, locks them in a style block, varies only the subject slot, and inspects each output against the layers. Not for photographs, posters with typography (poster-design) or logos."
metadata:
  author: Matheus Borges
  version: 1.0.0
---

# Illustration style remix

One style block, one variable: the subject. Naming a style gets a vague imitation; describing its observable layers gets the same look every time.

## Steps

1. **Intake.** Ask for the subject or subjects (and a reference photo each, when there is one), the style anchor (an era, a show, a medium) with any reference images, the set size, the background, the image tool and a run budget (default 8 generations). Illustrate only people the user may depict, in a way that stays faithful and respectful to them. Write the answers to `<out>/brief.md`; `<out>` defaults to `illustrations/<style-slug>/`.
2. **Decompose the style.** Fill the six layers from [style layers](references/style-layers.md) as observable traits, in `<out>/style.md`. The anchor's name is context only; every layer is described by what the eye sees. The user confirms or edits the table: it is the style block, and nothing generates before they do.
3. **Write the prompt.** The style block first, byte-identical for every subject, then the subject slot as the only variable. Name the subject's features and skin tone as faithful to who they are; a non-human subject gets its own palette. Save the block and the subject list to `<out>/prompt.md`.
4. **Probe.** Generate the first subject alone, up to 4 variants, with the tool the user named. Show them and let the user confirm the style, or revise one layer and probe again.
5. **Run the set.** Generate the remaining subjects with the unchanged block. Log tool, model, settings, reference photos and output paths in `<out>/runs.md`.
6. **Inspect.** For every output write a pass or fail per layer plus identity (the user confirms the likeness) in `<out>/review.md`. Lay the set side by side: a layer that differs between outputs is drift. Regenerate only the drifting subject with the same block; a changed block restarts the set at step 4.
7. **Deliver.** The chosen images with `style.md`, `prompt.md` and `review.md`, and the layers that still fail, if any.

Technique distilled from a public post by @AmirMushich; see [sources](references/sources.md).

## Done-check

- [ ] `style.md` has all six layers, each as observable traits, and the user confirmed it before the set ran.
- [ ] Every subject's prompt contains the same style block; `prompt.md` holds the block once and the subject list.
- [ ] `review.md` has a verdict per layer and for identity on every output, and the set was compared side by side for drift.
- [ ] Each person depicted is one the user may depict, and no output presents a real person saying or doing something they did not.
- [ ] The run stayed within budget, stated as a count of generations.

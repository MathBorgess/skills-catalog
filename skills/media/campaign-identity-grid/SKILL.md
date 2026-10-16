---
name: campaign-identity-grid
description: "Use when the user wants a brand campaign board from an image model — 'identity grid', 'brand wall', 'asymmetric grid poster', 'campaign visual identity', 'tile board of logo, slogan and photos' — made from a brand name. Writes the grid as a row-by-row spec, generates it in one shot, checks the structure by counting, and switches to assembling separate tiles in an HTML grid when the model keeps breaking the layout. Not for a single-subject poster (poster-design) or a full brand guideline."
metadata:
  author: Matheus Borges
  version: 1.0.0
---

# Campaign identity grid

A tile wall of logo, slogan and photo blocks, edge to edge. Image models draw textures well and layouts badly, so the structure lives in a spec you can count against, with a deterministic fallback.

## Steps

1. **Intake.** Ask for the brand, the user's standing (own brand, client, or concept study), the real slogan, the brand colors, the canvas size and the image tool. A concept study for a brand the user does not own carries the caption "unofficial concept". Take colors and type from the project's `brand-dna.md` or `DESIGN.md` when it exists. The slogan comes from the user or a cited public source and is never invented; with no slogan, drop the SLOGAN blocks. Write the answers to `<out>/brief.md`; `<out>` defaults to `grids/<brand-slug>/`.
2. **Write the grid spec.** In `<out>/grid.md`, list the rows, the cells of each row and a block type per cell, following [grid spec](references/grid-spec.md). Keep the default layout unless the user asks otherwise.
3. **Generate in one shot (Route A).** Write the prompt from the spec: the brand slot, the layout as row and cell counts, the full-bleed and zero-gap rules directly after the role line, one typeface, unique photos, then the three block descriptions. Save it to `<out>/prompt.md`. Generate up to 4 variants with the tool the user named.
4. **Inspect by counting.** For every output fill the *expected / seen* table from the grid spec into `<out>/review.md`: rows, cells per row, gaps, margins, block types, slogan letter by letter, logo against the real mark, typeface count, duplicate photos.
5. **Switch route on repetition.** When the same structural defect — row count, cell count, a gap, a misspelled slogan — appears in two rounds, stop prompting the layout and follow [assemble in HTML](references/assemble-in-html.md): generate each block alone, build the wall in code, export a PNG at the exact canvas size.
6. **Deliver.** Hand over the chosen PNG, `grid.md`, `prompt.md` and `review.md`, with the route used and the failed checks that remain. The author of the source technique found layout structure, slogans and content distribution the weak points of one-shot generation; report them the same way instead of tuning the prompt without end.

Technique distilled from a public post by @AmirMushich; see [sources](references/sources.md).

## Done-check

- [ ] `brief.md` records the brand, the user's standing, the source of the slogan and the canvas size.
- [ ] `grid.md` lists every row and cell with its block type, and the delivered image has exactly those rows and cells.
- [ ] `review.md` holds an expected/seen table per output; the delivered output has no visible gap or margin, and its slogan matches the source letter by letter.
- [ ] The route (A or B) and the number of generations are stated.
- [ ] A concept study carries its "unofficial concept" caption.

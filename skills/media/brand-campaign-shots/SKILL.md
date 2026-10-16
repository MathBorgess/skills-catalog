---
name: brand-campaign-shots
description: "Use when the user wants editorial or campaign imagery for a brand from an image model — 'fashion campaign', 'brand photoshoot', 'editorial triptych', 'hi-end photo campaign', 'brand muse', 'campaign shots for <brand>' — starting from a brand name and an industry. Writes a Brand DNA brief the user corrects before any image exists, generates one campaign format, and inspects the result for brand fit, one consistent muse and invented logos. Not for logo work, packaging mockups, or tile boards (campaign-identity-grid)."
metadata:
  author: Matheus Borges
  version: 1.0.0
---

# Brand campaign shots

Campaign imagery that feels like the brand, not like a stock shoot. The decisions a model would make silently — who the muse is, what the palette is, what the brand would never show — are written down first, where the user can correct them.

## Steps

1. **Intake.** Ask for the brand, its industry, the user's standing (own brand, client, or concept study), the image tool and a run budget (default 6 generations). A concept study for a brand the user does not own carries the caption "unofficial concept". Take colors and type from the project's `brand-dna.md` or `DESIGN.md` when it exists. Write the answers to `<out>/brief.md`; `<out>` defaults to `campaigns/<brand-slug>/`.
2. **Resolve the Brand DNA brief.** Reuse a confirmed `brand-dna.md` when one already exists with zero unconfirmed `[inferred]` lines; otherwise run `brand-dna` or fill [the template](references/brand-dna-brief.md) in `<out>/brand-dna.md`. Mark every line `[known]` (user or project file, or a cited public source) or `[inferred]`. Show it and let the user correct each `[inferred]` line; no generation starts before they have.
3. **Choose the format.** Use the [triptych](references/triptych.md) unless the user names another. For another format, write its panels in `brief.md` the same way: panel, framing, what it shows.
4. **Cast the muse.** From the DNA brief, write the muse in `brief.md`: age range, features, attitude, and the brand trait they embody. The user may instead delegate casting to the model; record that choice.
5. **Write the prompt.** Brand slot, role, muse, panels, one deliberate oddity the brand could own, technical look (grain, depth of field, light scheme from the DNA) and a color grade from the palette line. Save exactly what you send to `<out>/prompt.md`.
6. **Generate.** Use the tool the user named, up to 4 variants per round, and log each in `<out>/runs.md` with tool, model, settings and file paths.
7. **Inspect.** Judge every output against the *Inspect* list in the format reference and write one verdict per output to `<out>/review.md`. Change one variable per round; stop on the user's pick or the budget, and report the best output with its defects instead of another round.

Technique distilled from a public post by @AmirMushich; see [sources](references/sources.md).

## Done-check

- [ ] `brand-dna.md` has no `[inferred]` line the user left uncorrected, and every `[known]` line names its source.
- [ ] The muse and the format are written in `brief.md` before the first generation.
- [ ] `prompt.md` is byte-identical to the text sent; `runs.md` lists every generation.
- [ ] Each output has a verdict in `review.md`; every visible logo, wordmark or text on a garment or prop was checked against the real mark or flagged as a defect.
- [ ] A concept study carries its "unofficial concept" caption, and the images make no claim to be the brand's real advertising.

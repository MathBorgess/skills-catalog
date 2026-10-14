# Grid spec

The spec is the single source for the prompt and for the inspection. Write it before any generation.

## Format

One line per row in `grid.md`: row number, the cells left to right, each as `type`, and `full` or `half` for its width.

```
R1  full   PHOTO
R2  half   LOGO   | half SLOGAN
R3  full   PHOTO
R4  half   SLOGAN | half LOGO
R5  full   PHOTO
```

This five-row, two-column layout is the default: seven cells, three of them full-width rows. Rows have equal height unless the spec says otherwise. Two cells that share an edge never have the same type.

## Wall rules

- **Full bleed.** The grid fills the canvas edge to edge: no margin, border or background visible.
- **Zero gaps.** Tiles touch; no gutter, white line or spacing between them.
- **One typeface** across every text block.
- **Unique photos.** No photo repeats.

State these as positive targets ("tiles abut and fill the whole canvas") and give the row and cell counts as numbers in the prompt.

## Block types

| Type | Content | Texture |
|---|---|---|
| `LOGO` | A solid block in the brand's primary color holding only the brand's mark, centered | Distressed screen print: slight ink bleed, grain |
| `SLOGAN` | A solid block in a contrasting brand color holding only the slogan | Heavy distressed ink on the type and the fill |
| `PHOTO` | High-contrast black-and-white action shot or portrait relevant to the brand | Strong halftone dots and heavy film grain, multiplied into the brand palette as a duotone |

## Inspect: expected / seen

Fill this table per output in `review.md`.

| Check | Expected | Seen |
|---|---|---|
| Rows | from `grid.md` | |
| Cells per row | from `grid.md` | |
| Gaps or lines between tiles | none | |
| Margin or border | none | |
| Block type per cell | from `grid.md` | |
| Slogan text | the brief's slogan, letter by letter | |
| Logo | the user's logo file or the brand's public mark | |
| Typefaces | 1 | |
| Duplicate photos | none | |
| Photo color | duotone in the brand palette | |

A logo the model redrew from memory counts as a failed check unless it matches the real mark; use the user's file when one exists.

# Route B: assemble in HTML

Use when the same structural defect survived two rounds of Route A. The model draws tiles; code lays them out, so rows, cells and gaps are right by construction.

1. **Size the cells.** From the canvas `W × H` and the spec: a `full` cell is `W × rowHeight`, a `half` cell is `W/2 × rowHeight`, with `rowHeight = H / rows` unless the spec says otherwise. Write the sizes into `grid.md`.
2. **Generate only what models draw well.** Generate each `PHOTO` block alone, at its cell's aspect ratio, with the halftone and duotone treatment from the [grid spec](grid-spec.md). Never ask for a slogan or layout inside a tile.
3. **Build text and logo blocks in code.** A `SLOGAN` block is a solid color with the slogan as live text in the one typeface. A `LOGO` block is a solid color with the user's logo file centered. With no logo file, generate the logo block alone and inspect it against the brand's public mark.
4. **Assemble.** Save the generated tiles beside the page and write the wall:

```html
<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; }
  .wall { width: 1080px; height: 1920px; display: grid;
          grid-template-columns: 1fr 1fr; grid-template-rows: repeat(5, 1fr); gap: 0; }
  .wall > * { width: 100%; height: 100%; display: block; object-fit: cover; }
  .full { grid-column: 1 / -1; }
  .solid { display: flex; align-items: center; justify-content: center; }
</style>
<div class="wall">
  <img class="full" src="r1-photo.png">
  <div class="solid" style="background:#000">logo</div>
  <div class="solid" style="background:#fff">slogan</div>
  <!-- one element per cell, in reading order -->
</div>
```

   Replace the canvas size, row count and colors with the spec's values.
5. **Export.** Render the page with a browser tool and save a PNG at exactly `W × H`; confirm the pixel size of the file.
6. **Inspect.** Run the *expected / seen* table again on the exported PNG. Gaps and margins are zero by construction; the slogan, logo, duplicate-photo and duotone rows still need an eye.

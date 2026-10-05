# Interactive Explainer: single-file HTML

A standalone page that opens in any browser and embeds in an iframe inside a `teach-me` lesson. The reader changes a parameter and sees the mechanism respond.

## Contract

1. **One file, zero build, offline.**
   - CSS in `<style>`, JavaScript in `<script>`. No bundler, no framework, no CDN, no remote font or image.
   - The file works with the network off.
2. **Language.** Set `<html lang>` to the Requester Language tag, for example `pt-BR` or `en`. Every visible string, label, readout and `aria-label` uses that language.
3. **Design tokens, not literal colours.**
   - Print the tokens: `node skills/explain-me/scripts/explain.mjs tokens --css [--design <path>]`. Pass `--design` when the user picked a Brand Spec at intake.
   - Paste the printed `:root{...}` block into `<style>`. It defines `--em-bg`, `--em-surface`, `--em-text`, `--em-muted`, `--em-<colour>` for each palette colour, and `--em-font-display`, `--em-font-body`, `--em-font-mono`.
   - Write only `var(--em-*)` elsewhere. In canvas code, read a token with `getComputedStyle(document.documentElement).getPropertyValue("--em-blue")`.
   - The default design gives the manim palette on a near-black background. A Brand Spec replaces it with no change to the page code.
4. **Mobile first.**
   - Include `<meta name="viewport" content="width=device-width, initial-scale=1">`.
   - One column from 360 px up. Slider and button hit areas are at least 44 by 44 px.
   - No critical information appears on hover only.
5. **Reactive.**
   - Sliders (`<input type="range">`) update numbers and graphics on `input`.
   - A `<canvas>` scales with `window.devicePixelRatio`.
   - The first state, with no input, already shows the mechanism.
   - Show the Load-bearing Distinction in the page header, in one sentence.

## Boilerplate

```html
<!DOCTYPE html>
<html lang="en"><!-- Requester Language tag -->
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mechanism explainer</title>
<style>
  /* Paste the output of: explain.mjs tokens --css [--design <path>]
     It looks like :root{--em-bg:...;--em-surface:...;--em-text:...;--em-muted:...;--em-blue:...;--em-font-body:...} */
  :root{}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--em-bg);color:var(--em-text);font-family:var(--em-font-body);
       padding:1rem;min-height:100vh;display:flex;justify-content:center}
  main{width:100%;max-width:640px;display:flex;flex-direction:column;gap:1rem}
  h1{font-family:var(--em-font-display);font-size:1.25rem}
  .lead{font-size:.875rem;color:var(--em-muted);margin-top:.25rem}
  .card{background:var(--em-surface);border:1px solid var(--em-muted);
        border-color:color-mix(in srgb,var(--em-muted) 40%,transparent);
        border-radius:.75rem;padding:.75rem}
  canvas{width:100%;aspect-ratio:16/9;display:block}
  .row{display:flex;justify-content:space-between;font-size:.875rem}
  .val{font-family:var(--em-font-mono);color:var(--em-blue)}
  input[type=range]{width:100%;height:44px;accent-color:var(--em-blue)}
  .readout{font-size:.875rem;line-height:1.5;color:var(--em-muted);
           border-left:2px solid var(--em-blue);padding-left:.75rem}
</style>
</head>
<body>
<main>
  <header>
    <h1>Mechanism title</h1>
    <p class="lead">The one sentence the learner must explain back.</p>
  </header>
  <div class="card"><canvas id="stage"></canvas></div>
  <div class="card">
    <div class="row"><label for="a">Parameter</label><span class="val" id="va"></span></div>
    <input type="range" id="a" min="0" max="100" value="50">
    <p class="readout" id="readout"></p>
  </div>
</main>
<script>
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const canvas = document.getElementById("stage"), ctx = canvas.getContext("2d");
const slider = document.getElementById("a");

function draw() {
  const dpr = window.devicePixelRatio || 1, r = canvas.getBoundingClientRect();
  canvas.width = r.width * dpr; canvas.height = r.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = r.width, h = r.height, v = Number(slider.value);
  document.getElementById("va").textContent = v + "%";
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = css("--em-blue"); ctx.lineWidth = 3; ctx.beginPath();
  for (let x = 0; x <= w; x++) {
    const y = h / 2 - Math.sin((x / w) * Math.PI * 2 * (v / 20)) * h * 0.3;
    x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  document.getElementById("readout").textContent = "State at " + v + "%.";
}
slider.addEventListener("input", draw);
window.addEventListener("resize", draw);
draw();
</script>
</body>
</html>
```

## Check before delivery

- `grep -nE 'https?://' <file>` finds nothing outside text the reader sees.
- Hex colours appear only inside the pasted `:root{...}` block.
- The page reads well at 360 px width and at desktop width.
- Every string is in the Requester Language, and the strings obey STE-lite ([`ste-lite.md`](ste-lite.md)).

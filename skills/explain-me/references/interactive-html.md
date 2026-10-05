# Interactive Explainer: Single-File HTML Standards

A standalone, discardable interactive web explainer that opens immediately in any browser or embeds into an iframe inside a `teach-me` lesson.

## Core Contract

1. **Single Autonomous File**:
   - Zero build step (`npm run build`, Vite, or bundlers are forbidden).
   - Inlined CSS in `<style>` and inlined JavaScript in `<script>`.
   - Zero external CDNs or remote dependencies. Works fully offline.
2. **Aesthetic (3Blue1Brown Dark Theme)**:
   - Background: `#0f172a` (slate-900) or `#09090b` (zinc-950).
   - Surface / Panels: `#1e293b` (slate-800) with subtle borders `#334155`.
   - Accent colors: `#38bdf8` (sky-400), `#818cf8` (indigo-400), `#f472b6` (pink-400), `#34d399` (emerald-400).
   - Text: `#f8fafc` (primary), `#94a3b8` (secondary labels).
   - Typography: Clean system font stack (`system-ui, -apple-system, sans-serif`) with monospace readouts (`ui-monospace, monospace`).
3. **Responsive Mobile-First Layout**:
   - Includes `<meta name="viewport" content="width=device-width, initial-scale=1.0">`.
   - Works on narrow viewports (360px–420px mobile width) as a clean single column.
   - Touch-friendly controls: slider thumbs and buttons must have at least 44×44px hit targets.
   - Zero hover-only critical information.
4. **Reactive Canvas or SVG**:
   - Handles high-DPI displays (`window.devicePixelRatio`) properly on `<canvas>`.
   - Sliders (`<input type="range">`) update numbers and graphics synchronously on `input` events.
   - The initial un-adjusted state must already display a meaningful mechanism.

## Boilerplate Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mechanism Explainer</title>
  <style>
    :root {
      --bg: #0f172a;
      --surface: #1e293b;
      --border: #334155;
      --accent: #38bdf8;
      --accent-alt: #818cf8;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: system-ui, -apple-system, sans-serif;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      width: 100%;
      max-width: 640px;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    header h1 {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text);
    }
    header p {
      font-size: 0.875rem;
      color: var(--muted);
      margin-top: 0.25rem;
    }
    .canvas-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 0.5rem;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }
    canvas {
      width: 100%;
      max-height: 360px;
      aspect-ratio: 16 / 9;
      display: block;
    }
    .controls {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .control-row {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .label-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.875rem;
    }
    .label-row span.val {
      font-family: ui-monospace, monospace;
      color: var(--accent);
      font-weight: 600;
    }
    input[type=range] {
      width: 100%;
      height: 32px;
      accent-color: var(--accent);
      cursor: pointer;
    }
    .explanation {
      font-size: 0.875rem;
      line-height: 1.5;
      color: var(--muted);
      border-left: 2px solid var(--accent);
      padding-left: 0.75rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1 id="title">Load-bearing Mechanism</h1>
      <p id="subtitle">Explore how parameter adjustments alter the state.</p>
    </header>

    <div class="canvas-card">
      <canvas id="stage" width="600" height="338"></canvas>
    </div>

    <div class="controls">
      <div class="control-row">
        <div class="label-row">
          <label for="paramA">Parameter Alpha</label>
          <span class="val" id="valA">50%</span>
        </div>
        <input type="range" id="paramA" min="0" max="100" value="50">
      </div>
      <p class="explanation" id="readout">At current value, the boundary condition holds.</p>
    </div>
  </div>

  <script>
    const canvas = document.getElementById('stage');
    const ctx = canvas.getContext('2d');
    const sliderA = document.getElementById('paramA');
    const valA = document.getElementById('valA');
    const readout = document.getElementById('readout');

    function render(val) {
      valA.textContent = val + '%';
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // 3b1b Grid background
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Dynamic curve / mechanism visualization
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const progress = x / w;
        const y = h / 2 - Math.sin(progress * Math.PI * 2 * (val / 20)) * 60;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    sliderA.addEventListener('input', (e) => render(Number(e.target.value)));
    render(50);
  </script>
</body>
</html>
```

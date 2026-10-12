---
name: explain-me default
colors:
  background: "#000000"
  surface: "#1C1C1C"
  text: "#FFFFFF"
  muted: "#888888"
  blue: "#58C4DD"
  teal: "#5CD0B3"
  green: "#83C167"
  yellow: "#FFFF00"
  gold: "#F0AC5F"
  red: "#FC6255"
  purple: "#9A72AC"
typography:
  display: { family: "EB Garamond", weight: 400, fallback: serif }
  body: { family: "EB Garamond", weight: 400, fallback: serif }
  mono: { family: "JetBrains Mono", weight: 400, fallback: monospace }
motion:
  gate: on
  maxStaticSec: 2
  leadInSec: 0.5
  beatGapSec: 0.3
  tailSec: 1.0
  ease: "power2.inOut"
  ambient: none
  durations: { draw: 1.2, write: 0.9, morph: 1.0, move: 1.2, camera: 1.5, indicate: 0.6, count: 1.0, grow: 0.6, fade: 0.5 }
  preferred:
    - { primitive: morph, note: "transform one object into the next instead of cutting" }
    - { primitive: camera, note: "move the frame to the object the narration is about" }
    - { primitive: draw, note: "show structure being built, stroke by stroke" }
  examples: []
rules:
  centralObject: true
  hud: false
  cardsAsLayout: false
  maxWordsOnScreen: 7
layout:
  landscape: { safe: [120, 120, 1800, 960], captions: [160, 900, 1760, 1030] }
  portrait: { safe: [60, 220, 960, 1380], captions: [60, 1400, 960, 1580] }
captions:
  burn: { landscape: false, portrait: true }
  maxWords: 6
narration:
  speed: 1.0
  voices: { pt-br: pf_dora, en-us: af_heart, en-gb: bf_emma, es: ef_dora, fr-fr: ff_siwis, it: if_sara, ja: jf_alpha, zh: zf_xiaobei, hi: hf_alpha }
images: []
---
## Overview

The default look of explain-me is 3Blue1Brown style. The field is near-black. One central object grows on screen while a voice explains it. The viewer sees it drawn, written and transformed. The video has no interface: no header, no cards, no progress bar, no bullet lists, no logo.

Subtitles ship as a separate `.srt`. Only a portrait video also burns them in (see `## Portrait`).

The landscape frame is 1920 x 1080. Keep content inside `layout.landscape.safe`, a 120 px margin. The central object sits in the middle 60 percent of the safe zone. A label sits next to the thing it names, never in a box or a legend. A portrait frame is 1080 x 1920 and has its own safe zone.

Color carries meaning, and a color keeps one meaning for the whole video:

- `blue`: the first object, the thing the explanation is about.
- `green`: the second object, an input, a part that is right.
- `yellow`: the result, and the highlight. `indicate` flashes yellow.
- `red`: what moves, what changes, what is wrong, a probe point.
- `gold`: numbers and measurements.
- `purple`: regions, areas, a transformation.
- `teal`: a helper or a comparison.
- `muted`: scaffolding such as axes and guides, and anything dimmed.
- `text` (white): labels and equations.

Type is serif for words and symbols (`--em-font-display`, `--em-font-body`) and monospace for readouts and code (`--em-font-mono`). Labels run 56 to 72 stage units, and a title runs at most 96. Use upright text. The video engine ships only the regular and bold upright faces. It fetches an italic online or fakes it offline, so the italic looks different on each machine.

## Motion grammar

1. **One central object.** Each beat is about one thing on screen. It arrives by `draw` (strokes), `grow` (a shape from its origin) or `write` (words). It never appears whole.
2. **Transform, do not cut.** The next idea is the same object changing. `morph` one shape into the next, `move` a point along its path, or `count` a number up. Fade an object out only when its idea ends. To keep context, dim it with `fade` and `{ to: 0.25 }`.
3. **The camera focuses.** Use `camera` with `focus` on the object the sentence is about. Zoom in to look, and `reset` to show the whole. A slow push (`zoom: 1.1` over the whole beat) keeps a long beat alive.
4. **Almost no text.** Show at most 7 words at once besides labels. A label names one object in 1 to 3 words. Numbers, currency amounts and symbols do not count as words. The narration says the rest. Burned captions are a separate layer and do not count.
5. **Color means something.** Pick the color of an object from the list above and keep it. Never color for decoration.
6. **Every beat has motion.** Plan 3 or more calls per 7 seconds. Place them with `.at(sec)` so no hold lasts longer than `motion.maxStaticSec` (2 s). The Motion Gate fails the render otherwise. A `count` and a caption change are not motion. The last beat keeps real stage motion until close to its end. The tail after the last beat is a deliberate end hold, and the gate does not judge it.
7. **The subject comes first.** The object the beat is about starts its entrance in the first 0.5 s.
8. **Introduce everything.** Nothing is on screen at the first frame. Draw the axes, write the labels, grow the arrows. The first `count` of an element also introduces it.
9. **Keep the stage light.** Show at most 7 objects or groups at one time. A row of cells, a set of axes or a labelled arrow each count as one. Remove or dim before you add.
10. **Pace.** A beat lasts as long as its sentence, typically 3 to 7 seconds. A single motion takes about 1 second. Start the first motion at once. End the beat on a settled frame.

## Portrait

A portrait video is 9:16, 1080 x 1920, for Reels, Shorts and TikTok. The stage `viewBox` is `0 0 1080 1920`. `layout.portrait` holds the two boxes below.

- **Stay inside the safe zone** `[60, 220, 960, 1380]`. The platform draws its own interface in the margins. It is a top bar, side buttons and a bottom handle.
- **Leave the caption band free.** Burned captions fill `[60, 1400, 960, 1580]`. They are white text with a dark edge and no box. Keep stage content out of it.
- **Check the camera.** `camera` with `focus` puts the focus box inside the safe zone. Everything else moves with it, and a zoom pushes it outward. The kit samples the whole timeline. Content in the caption band is an error. Content outside the safe zone is a warning.
- **Stack top to bottom** instead of left to right. A row of 7 cells already fills the width.
- **Make labels at least 64 units.** Keep at most 5 objects or groups on screen at once.
- **Show the subject in the first second.** Viewers swipe away fast.
- **Prefer 60 seconds or less.**

## Do / Don't

Do:

- Build each beat around one subject selector from `script.json`, and give that subject an id.
- Draw structure first (`draw`, `grow`), then label it (`write`), then change it (`morph`, `move`, `count`), then point (`indicate`, `camera`).
- Use the palette tokens (`var(--em-blue)`), never a hex literal in the stage.
- Spread motions across the beat with `.at(sec)`. Use `.at("<")` to start a call together with the previous one.
- Pass `from` to every `count`. Write money and units with `prefix`, `suffix` or `locale`.
- Look at the rendered frames. Fix overlaps, clipped labels and low-contrast text before you deliver.

Don't:

- Don't build a dashboard: no header bar, card grid, progress bar, bullet list or footer. Those are slides, not 3b1b style.
- Don't put paragraphs on screen. If the sentence needs more than 7 words, the narration carries it.
- Don't loop or pulse something to look busy. An idle decoration hides a still frame from the viewer and fools the gate.
- Don't cut between objects. Transform or fade them.
- Don't use CSS `transform` or a `transform` attribute on an element the kit animates.
- Don't add a logo watermark or a background image.
- Don't draw subtitles in the stage. When `captions.burn` is on, the kit burns them in on a layer of their own.
- Don't place a label next to a shape that `indicate` grows. The grown shape covers the label.

## Motion examples

Each block is one complete beat. The comment names the narration and the stage ids it needs.

```js
// Narration: "A sorted list holds seven numbers."
// Stage: #cells (g of 7 rects), #nums (g of 7 texts), #cell-0 (the first rect)
kit.beat("b01", (b) => {
  b.draw("#cells", { stagger: 0.12 });                           // the central object, stroke by stroke
  b.at(0.8).write("#nums", { dur: 1.2 });                        // values written as the boxes close
  b.at(2.4).indicate("#cell-0");                                 // look here first
  b.at(3.4).camera({ zoom: 1.15, cx: 960, cy: 540, dur: 2.5 }); // a slow push keeps the end of the beat alive
});
```

```js
// Narration: "One comparison rules out half of the list."
// Stage: #cell-3 (the middle rect), #right (g of the right half), #range-wide and #range-narrow
//        (two outline paths, the second one drawn small), #steps (text)
kit.beat("b02", (b) => {
  b.camera({ focus: "#cell-3", pad: 320, dur: 1.4 });            // frame what the sentence is about
  b.at(0.4).indicate("#cell-3");
  b.at(1.4).fade("#right", { to: 0.2, dur: 0.8 });               // dim what is ruled out, never cut it
  b.at(2.2).morph("#range-wide", "#range-narrow", { dur: 1.2 }); // the range itself transforms
  b.at(2.4).count("#steps", { from: 7, to: 3, dur: 1.0 });
});
```

```js
// Narration: "The guess lands on twelve, which is too high."
// Stage: #ptr (g, the pointer), #track (path the pointer follows, stroke none),
//        #verdict (text), #cell-5 (a rect)
kit.beat("b03", (b) => {
  b.move("#ptr", { along: "#track", end: 0.6, dur: 2.2 });       // the guess travels to its cell
  b.at(1.4).grow("#verdict", { origin: "bottom", dur: 0.6 });    // grows up from its baseline
  b.at(2.2).indicate("#cell-5", { color: "red" });               // red: the thing that is wrong
  b.at(3.0).fade("#verdict", { out: true });
  b.at(3.0).camera({ reset: true, dur: 1.2 });                   // back to the whole list
});
```

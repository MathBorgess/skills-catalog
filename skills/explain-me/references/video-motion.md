# Scene-Driven Video

How to make a narrated 3b1b-style video. HyperFrames only renders it. You write two regions of one HTML file with the 3b1b Kit.

The look comes from the Design Spec. [`../assets/DESIGN.md`](../assets/DESIGN.md) is the default, and [`design-spec.md`](design-spec.md) explains the keys. Never put style literals in the stage. Below, `explain.mjs` means `node skills/explain-me/scripts/explain.mjs`. `<run>` is a run folder or its slug.

## Pipeline

```
doctor -> setup -> new -> script.json -> voice -> STAGE + SCENE -> check -> render -> read frames -> deliver
```

1. `explain.mjs doctor`. If Python, Kokoro or `ffmpeg` is missing, run `explain.mjs setup`. Kokoro also needs a system `espeak-ng` (`brew install espeak-ng` or `apt install espeak-ng`); `doctor` reports it. The render fetches GSAP from jsDelivr, so it needs network access.
2. `explain.mjs new --slug <slug> --lang <tag> [--orientation landscape|portrait] [--design <path>] [--dest <dir>] [--title <t>]`. It prints the run path, the frame size and every design override. It also writes a starter `explanation.md` (Portuguese headings for `pt`, English for the rest): fill it in and lint it.
3. Write `<run>/script.json` with `lang`, `title` and `beats`. A beat has `id` (`b01`, `b02`), `narration` (one sentence, 18 words at most) and `subject` (an id selector). It also has `scene`, a free grouping label. Nothing depends on it.
4. `explain.mjs voice <run>`. It writes the audio, each beat's start and length (`explain-data.js`) and the motion checks. Expect `subject-missing` warnings while the stage is still the placeholder. Run `voice` again after any change to a narration, a subject or the design. `check` refuses a script that changed since `voice`.
5. Author the STAGE and SCENE regions of `<run>/project/index.html`, and nothing else. Replace the placeholder elements inside the stage `svg`. Keep the `svg` element and its `viewBox`.
6. `explain.mjs check <run>`. Fix every error and warning. `render` refuses until `check` passes for the current files.
7. `explain.mjs render <run>`. Then read the frames (below).
8. Deliver the paths, the overrides and the explain-back question.

## Orientation

Orientation is the frame shape. It is not `--format`. `landscape` (16:9, 1920 x 1080) is the default. Use `portrait` (9:16, 1080 x 1920) for Reels, Shorts, TikTok or a phone. Run `explain.mjs new --orientation portrait`. Aliases: `vertical`, `9:16`, `reels`, `shorts`, `tiktok`.

- The stage `viewBox` is the frame size. Author in `0 0 1080 1920`; `new` writes that placeholder.
- Keep content inside the safe zone, `layout.portrait.safe` (`[60, 220, 960, 1380]` by default). The platform covers the margins with its own interface. Keep the caption band (`[60, 1400, 960, 1580]`) free.
- Portrait burns captions in by default (`captions.burn.portrait`). The kit draws each narration in the band, outside the stage, at most `captions.maxWords` words at a time. The `.srt` always exists. Landscape burns nothing unless the design says so.
- Stack top to bottom. Make labels at least 64 units. Show at most 5 objects or groups.
- The subject appears in the first second. Prefer 60 s or less.

## Plan the beats

One beat is one sentence and the motion for it. For each beat decide:

- **Subject**: the one object the sentence is about, with an id. Its own entrance is the first call of the beat, or it starts within 0.5 s. A subject already visible at its beat start satisfies the gate.
- **Size**: the subject needs real width and height, over 0.5 px both ways. A bare line or a zero-height path never counts as visible. Use a shape with area, or text.
- **Motions**: 3 or more calls per 7 seconds, spread with `.at(sec)`. End a long beat with a slow `camera` push of length `b.dur` minus its start. The gate counts it as real motion, also when captions are on.
- **Transitions**: the next beat starts from what this one left on screen. Transform or dim. Do not clear and redraw.
- **Words on screen**: at most 7 words of free text at once. Numbers, currency amounts and symbols do not count. Lint the on-screen labels as normal text, without `--narration`.

## The Kit

```js
const kit = ExplainKit.create();
kit.beat("b01", (b) => {
  b.draw("#axes");                                  // strokes drawn on; a group staggers its children
  b.at(0.2).grow("#arrow", { origin: [520, 840] }); // scale from 0; origin: "left"|"bottom"|... or a stage point
  b.write("#label");                                // text written character by character (SVG or HTML)
  b.indicate("#arrow", { color: "yellow" });        // scale up and flash, then back to rest
});
kit.beat("b02", (b) => {
  b.camera({ focus: "#arrow", pad: 260 });          // or { x, y, w, h } | { zoom, cx, cy } | { reset: true }
  b.morph("#triangle", "#parallelogram");           // first shape becomes the second; the target stays hidden
  b.move("#dot", { along: "#guide" });              // or { to: [x, y] } (centre) | { by: [dx, dy] }
  b.count("#n", { from: 0, to: 5, decimals: 2 });   // number tween; Intl format in the requester language
  b.fade("#old", { out: true });                    // or { to: 0.25 } to dim, { shift: [0, 30] } to slide in
});
kit.register();
```

- Calls run one after another. `b.at(1.2)` starts the next call 1.2 s into the beat. `.at("<")` starts with the previous call. `.at("+=0.3")` waits after it.
- Entrances hide the target until their time. Draw, write, grow, the first fade and the first count introduce an element. The kit warns about anything never introduced, because it shows from the first frame.
- The kit throws a clear error for a selector that matches nothing and for a beat missing from `script.json`. It also throws for a beat without calls and for a name that is not a primitive.
- Style the stage with `stroke="var(--em-blue)"` and the other `--em-*` tokens. Use `class="display"` or `class="mono"` for the other fonts. Never put `transform` on an element the kit animates.

### Options of every primitive

Every primitive takes `dur` (seconds; `duration` is an alias) and `ease` (a GSAP ease). Defaults come from `motion.durations` and from the ease of the call's role: `motion.eases.enter` for an entrance, `.exit` for a call with `out: true`, `.emphasis` for `indicate`, else `motion.ease`. `b.dur` is the beat length. The kit ignores an unknown option and warns.

| Primitive | Option: meaning (default) |
|---|---|
| `draw` | `stagger`: seconds between children (fits `dur`). `from`: `"start"`, `"center"` or `"end"` (`"start"`). `out`: true draws it off and hides it. |
| `write` | `stagger`: seconds between characters (fits `dur`). `charDur`: fade of one character (`min(0.3, dur / 2)`). `ease` has no effect. |
| `morph` | `shapeIndex`: `"auto"` or a number (`"auto"`). `type`: `"linear"` or `"rotational"` (`"linear"`). `style`: false keeps the first shape's paint (true tweens it to the target's). |
| `move` | One of `along` (path selector), `to` (`[x, y]` centre, SVG only) or `by` (`[dx, dy]`). `start`, `end`: 0 to 1 along the path (0, 1). `rotate`: true turns the element along the path. `align`: `[ax, ay]` anchor (`[0.5, 0.5]`). |
| `camera` | `focus`: selector, fitted into the safe zone with `pad` (160 units). `x`, `y`, `w`, `h`: all four, an explicit view. `zoom`: above 1 zooms in, with `cx`, `cy` to name the centre. `reset`: true returns to the first view. |
| `indicate` | `scale`: peak size (1.2); 1 flashes without growing. `color`: a palette name or a hex (`yellow`). |
| `count` | `from`: start value (always pass it). `to`: end value (required). `decimals` (the most digits of `from` and `to`). `prefix`, `suffix`: strings for money and units. `format`: a function from value to text. `locale` (the run's language). |
| `grow` | `origin`: `"center"`, `"left"`, `"right"`, `"top"`, `"bottom"`, a corner such as `"topleft"`, or `[x, y]` (`"center"`). `axis`: `"both"`, `"x"` or `"y"` (`"both"`). `from`: start scale (0). `out`: true shrinks it away and hides it. `stagger`: seconds between targets (0). |
| `fade` | `out`: true fades it away. `to`: target opacity; on an element already on screen it dims. `from`: start opacity (0). `shift`: `[dx, dy]`, the offset it slides in from. `stagger`: seconds between targets (0). |

- **`count` start**: always pass `from`. Without it the kit reads the element's own text, and `1.000` becomes 1. The kit warns when `from` is missing and the text is not a plain number.
- **`count` format**: write money and units with `prefix`, `suffix` or `locale`.
- **`count` entrance**: the first `count` of an element that nothing introduced also introduces it. The element stays hidden until its start, then fades in for 0.2 s.
- **`count` text**: `count` rewrites the element's text, so do not `write` that element. Several `count` calls on one element are fine. Each starts from its own `from`, or from the previous `to`. Any seek order gives the same text.
- **`camera`**: `focus` puts the focus box plus `pad` inside the safe zone on screen, centred, in either orientation. `zoom` with `cx` and `cy` puts that point at the middle of the safe zone. `zoom` alone keeps the view centre. An explicit box fits the stage's own aspect, 16:9 or 9:16, and shows what you asked for. The rest of the stage moves with the focus, so check the next section.

## Safe zone and caption band

A zoom pushes content away from the centre. Labels and axes that sit near the edge of a chart can leave the frame or land under the burned captions. `check` finds this for you.

After the build, the kit seeks its own timeline every 0.25 s and just before each beat ends. It measures where every visible shape, text and image lands on screen, camera included. It then reports:

- **Caption band** (only with burned captions): a box inside `layout.captions` for 0.5 s or more is a `console_error`. HyperFrames counts it as a runtime error, so `check` fails and `render` refuses. A shorter overlap is a warning. The render itself still runs.
- **Safe zone**: a box more than 16 units outside `layout.safe` is a `console_warning`.

Each finding names the time span, the beat, the selector and the depth or the edge. The kit skips a box wholly outside the frame: it is not on screen. Fix a finding in this order:

1. Focus on a group that holds everything you want to keep (`focus: "#chart"`), and use a small `pad`.
2. Move or shrink the element, or fade it out before the camera moves.
3. Only then add `data-em-allow-outside` to the element or a group around it. The kit skips it. Use this for a deliberate overlap, never to silence a finding.

## The Motion Gate

`check` runs HyperFrames with two assertions. `voice` writes them into `project/index.motion.json`.

- `keepsMoving`: nothing stays unchanged longer than `maxStaticSec`, 2 s by default. With burned captions it looks inside `#stage` only, so a caption change never counts as motion. The gate judges up to the end of the last beat. The tail after it is a deliberate end hold that the gate does not judge.
- `appearsBy`: each subject is visible within 0.5 s of its beat start.

A design can loosen `maxStaticSec`. It can never switch the gate off. Repeat every override in the delivery.

The sampler sees boxes that move, resize or fade. A stroke that draws on, a `count` that keeps its width and a caption change alter none of those. They are not motion. Keep each `draw` or `count` near 1 s and pair it with other motion. The last beat needs real stage motion until close to its end: a `move`, a `camera` push, an `indicate` or a `fade`.

A `container_overflow` info line for an object inside `#stage` only means the camera crops it. Do not add idle loops or tiny wobbles to silence the gate. A decoration hides a still frame from the viewer. A design's `motion.ambient` glow is the one background life the kit allows: it sits behind the stage, and the gate then watches `#stage` only.

## Fix a finding

`content_overlap` means two blocks of text overlap at some second. `write` splits the text of an SVG into one `<tspan>` for each character, so the finding names `#id > tspan:nth-of-type(n)`. It fires on mid-fade elements and on overlapping glyph boxes. Fix it in this order:

1. Move or resize one block so the glyph boxes no longer meet.
2. Sequence them. Start the new text after the old text has faded out.
3. Only then add `data-layout-allow-overlap` to one of the two `<text>` elements. HyperFrames reads it on the block itself. The kit copies it to the characters it writes.

`contrast_aa_failure` means a text has less than 4.5:1 contrast with what is behind it. Two causes are common: dark text on a shape that dims with `fade` and `{ to: 0.25 }`, and a label that an `indicate` grows over. `indicate` scales from the element's centre, so it can cover a nearby label.

1. Keep every label outside a shape that `indicate` grows. Leave a gap bigger than the growth.
2. Flash with color only: `b.indicate("#shape", { scale: 1 })`.
3. Put text beside a shape that dims, not on it. Use `--em-text` for labels.

Contrast sampling is periodic: it looks at a few moments only. A beat that dims or recolors something can pass `check` and still fail at another second. Check every beat that dims, in its frames.

## Determinism rules that bite

- No `Date.now()`, `performance.now()`, unseeded `Math.random()`, network fetches or input state. Every frame is a function of the playhead time.
- No `repeat: -1`, no infinite CSS or WAAPI animation, no `play()`. The kit builds one paused timeline at `window.__timelines["explain"]`.
- No CSS `transform` together with kit motion on the same element. Do not animate the `visibility` of a `.clip`.
- Text stays inside the safe zone. It is 56 stage units or larger, and 64 in portrait.

## Read the frames

`render` writes two PNGs for each beat in `<run>/frames/`:

- `<beatId>-in.png`: during the entrance, `min(1.0 s, 40 percent of the beat)` after the beat starts. It shows what the viewer sees while the subject arrives.
- `<beatId>.png`: settled, just before the beat ends.

Open every file. Look for labels that overlap or leave the frame, an empty frame, a subject you cannot see, and low-contrast text. Look for content outside the safe zone or in the caption band, a crowded stage, and anything that looks like a slide. Fix the STAGE or SCENE, run `check`, then `render` again. Never deliver a render you did not look at.

## Style feedback and silent fallback

"Slower", "lighter background" and "bigger text" are style feedback. Propose a diff to the active Design Spec and apply it only after the user says yes. Then run `voice`, `check` and `render` again. Never edit the shipped default. "Change the second example" is content feedback: edit only the run.

If `new` or `voice` says the language has no Kokoro voice, the video is silent. Timing comes from 150 words per minute, and `<slug>.srt` carries the narration. Say so in the delivery. Do not switch the language to get a voice.

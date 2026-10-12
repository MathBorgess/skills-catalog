# Delivery

How the motion identity reaches each video tool, how to run and read the proof, and how the identity evolves after real videos.

## One spec, referenced, never copied

The brand spec has one home, the file the owner keeps. A video project points at it. A copy drifts the first time the identity evolves, and then two videos of one brand move differently.

| Tool | How it gets the spec |
|---|---|
| explain-me | `explain.mjs new ... --design <spec>`. Or, inside the brand's project, `explain.mjs design find` offers it at intake. `new` prints `motion: personality …; eases …; ambient …; signature …`. Pass that line on to the beats, and leave `ease` off the calls. |
| HyperFrames | Put the spec at the project root as a link: `ln -s <spec> <project>/DESIGN.md`. If the project already has a `frame.md` or `design.md`, HyperFrames reads that file first. Either link under the winning name, or ask the owner which file the project should follow. |
| HyperFrames `BRIEF.md` | Paste the output of `motion.mjs brief <spec>` into the brief's notes. `talking-head-recut` and `embedded-captions` read only the brief. For them, it is the whole motion identity. |

Where links are not possible (a cloud upload, another machine), copy the spec, write its source path and date at the top of the copy, and replace the copy when the identity changes.

## The proof

```bash
node <skill>/scripts/motion.mjs proof <spec> \
  --text "<2 to 4 big words>" --sub "<one supporting line>" \
  --lang <tag> --orientation portrait|landscape \
  [--accent <colorKey>] [--accent-word <n>] [--signature <file.js>] [--dest <dir>]
```

- **Words.** Use the brand's own voice, in the language of the request (`--lang pt-BR` sets the page language). They must not be a slogan the brand has not approved: a neutral line about the brand's subject is fine. `--accent-word` picks the emphasized word (default: the last).
- **Orientation.** Use the brand's first channel (decision D2): `portrait` for Reels, Shorts and TikTok, `landscape` for lessons.
- **Accent.** The default is the non-neutral color with the best contrast on the background, so the emphasized word stays readable. `--accent <key>` names another. If the brand's primary color fails 4.5:1 on its own background as text, say so: that is a finding about the brand, not about the proof.
- **What it plays.** The words enter in the archetype's pattern on `eases.enter`. One word is emphasized on `eases.emphasis` and takes the accent. A line draws and the supporting line enters. The group moves on the base ease. The signature plays if there is one. Everything leaves on `eases.exit`. The ambient glow follows `motion.ambient`.
- **What it checks.** The spec first (`check`), then `hyperframes check`: lint, runtime errors, layout, contrast, and a motion sidecar where the stage keeps moving and the first word appears on time. It renders only when both pass.
- **What it writes.** In the proof folder:
  - `project/index.html`, the page;
  - `plan.json`, every time and ease;
  - `proof.mp4`;
  - `frames/` with one PNG per moment: entrance, settled, emphasis, moved, signature, exit;
  - `contact-sheet.png`, the moments side by side.

### The signature script

`--signature <file.js>` is the body of a function `(tl, at, dur, ctx)` that the proof calls once:

- `tl` is the proof's paused timeline. Add tweens to it, between `at` and `at + dur` (1.8 s).
- `ctx.svg` is an empty full-frame `<svg>`, with its viewBox in frame pixels. Create shapes in it.
- `ctx.width`, `ctx.height`, `ctx.safe` (`[x0, y0, x1, y1]`), `ctx.size` (the headline's font size), `ctx.accent`, `ctx.eases`, `ctx.durations`, `ctx.content` (the headline group).

The proof refuses a script that calls `play()`, uses `repeat: -1`, a clock, `Math.random()`, a timer, a bare `gsap.to()` or the network. Only GSAP core is loaded. Draw a stroke with `stroke-dasharray` and `stroke-dashoffset` attributes, not with DrawSVG. Example: a ribbon drawn under the headline.

```js
var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
var y = ctx.safe[1] + (ctx.safe[3] - ctx.safe[1]) * 0.72;
p.setAttribute("d", "M " + (ctx.safe[0] + 40) + " " + y + " C " + ctx.width * 0.35 + " " + (y - 160) + ", " + ctx.width * 0.65 + " " + (y + 160) + ", " + (ctx.safe[2] - 40) + " " + (y - 20));
p.setAttribute("fill", "none");
p.setAttribute("stroke", ctx.accent);
p.setAttribute("stroke-width", "28");
p.setAttribute("stroke-linecap", "round");
ctx.svg.appendChild(p);
var len = p.getTotalLength();
tl.fromTo(p, { attr: { "stroke-dasharray": len, "stroke-dashoffset": len } }, { attr: { "stroke-dashoffset": 0 }, duration: dur * 0.6, ease: ctx.eases.enter }, at);
```

Trace the brand's motif (decision D3) in place of this curve. Never redraw the logo.

### Read the proof before the owner sees it

Open every frame, the sheet and the video. Look for:

- a word cut at the edge;
- words that overlap while they enter or leave;
- an emphasis that pushes into the next line;
- an accent that is hard to read;
- a signature that crosses the words;
- a move that reads in the wrong direction;
- an empty frame.

Fix the spec or the signature, never the generated page, and run the proof again.

### When it cannot render

The render needs network access, because the page loads GSAP from jsDelivr, and a headless Chrome.

- If HyperFrames reports no browser, run `npx hyperframes browser ensure`, or point `PRODUCER_HEADLESS_SHELL_PATH` at a Chrome headless shell that is already installed.
- If the network is closed, `--no-render` still writes the page. Say plainly that no proof rendered, and keep the status `draft`.

## Approval

Show the owner the contact sheet and the video, side by side with the brief block. Ask one question: "approve, or what changes?" Map each change they name to its decision (the symptom table in [`grilling-rounds.md`](grilling-rounds.md)), propose the diff, apply it after a yes, and prove again. When they approve, set the status line to `**Status:** approved on AAAA-MM-DD by <role>`. Use a role, such as "the brand's designer", not a person's private details.

## Evolve after real videos

Feedback on a finished video ("the exits are slow", "too bouncy for a serious topic") changes the spec, through the same grilling and proof. Do not patch that one video's code. The next video, and every tool, should pick the change up from the spec.

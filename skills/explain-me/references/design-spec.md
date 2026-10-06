# Design Spec

The Design Spec is one editable `DESIGN.md` that every format reads: the narrated video, inline SVG and interactive HTML. It holds palette, type, preferred motion with worked examples, frame layout, burned captions, reference images, timing and voices. Changing the style means editing a spec, never one artefact. The shipped default is [`../assets/DESIGN.md`](../assets/DESIGN.md): read it as the model of a complete spec.

A spec is YAML frontmatter plus a markdown body, the same shape as a HyperFrames `frame.md` or `design.md`, so one brand file can serve both.

- The **frontmatter is normative**: quote values verbatim (exact hex, family, number). Never invent or round them.
- The **prose is judgment**: the `##` sections carry intent, taste and constraints. Read them before composing.

A spec may be **partial**. Write only the keys that differ; every other key comes from the layer below.

## Layers and precedence

Highest first. Each run resolves them key by key:

1. **Explicit spec**: `--design <path>` on `new`. After the intake offers a project's brand spec and the user accepts, pass it here.
2. **Personal spec**: `<home>/DESIGN.md`, seeded from the shipped default by `explain.mjs setup` and never overwritten.
3. **Shipped default**: `assets/DESIGN.md`. Never edit it.

Find a project's brand spec with `explain.mjs design find [--project <dir>]`. It checks, in HyperFrames order, `frame.md`, then `design.md`, then `DESIGN.md`, and prints the first it finds. Offer it at intake; never apply it without the user's yes.

Merge rules: maps merge deeply, lists and scalars replace, a missing or `null` value keeps the lower value. The driver splits prose at `## ` headings. A heading in a higher layer replaces the same heading below it. Headings that only a lower layer has come after it, in order.

`explain.mjs design resolve [--design <path>]` prints the layers, the merged design and the overrides. A run copies the result to `project/frame.md` and `project/tokens.css`, and inlines the tokens into `project/index.html` (the video engine embeds fonts only from an inline `<style>`). `voice` rewrites all three from the current layers, so never edit them by hand.

## What a brand may change, and the floor

A spec can override anything that is style: colors, fonts, durations, ease, timing, voices and speed. It can also change every `rules.*` value, including the 3b1b rules: a brand can allow a HUD, cards or long on-screen text. It can raise `motion.maxStaticSec`, move the `layout` boxes, and switch burned captions on or off per orientation (`captions.burn.*`).

The floor never moves:

- `motion.gate` cannot be off. `design check` fails on it. Loosen `maxStaticSec` instead.
- `maxStaticSec` must be greater than 0.
- Every word stays in the requester's language, whatever the brand says.
- `preferred` and `## Motion examples` may only use the nine kit primitives.

An **override** is a `rules.*` value that differs from the shipped default, a changed `motion.maxStaticSec`, a `motion.ambient` other than `none`, or a changed `captions.burn.*` value. `new`, `voice` and `render` print every override, and `run.json` records them. Repeat them in the delivery, for example: "this brand allows a HUD; static limit 4 s; portrait captions off". Changes to `layout` and `captions.maxWords` are not overrides, but say them when they matter.

## Schema

```yaml
---
name: Acme explainers
colors: { background: "#0B1020", text: "#F4F6FF", muted: "#8A93B2", blue: "#4F8CFF" }
typography:
  display: { family: "Montserrat", weight: 700, fallback: sans-serif }
motion: { maxStaticSec: 3, durations: { draw: 1.6 }, eases: { enter: "back.out(1.4)", exit: "power2.in" }, ambient: subtle }
rules: { hud: true }
layout: { portrait: { safe: [80, 240, 940, 1360] } }
captions: { burn: { landscape: true }, maxWords: 5 }
images:
  - { path: "brand/logo-light.svg", role: logo, note: "end card only" }
---
```

**`name`**: a string, for reports.

**`colors`**: hex strings only, and quote them (an unquoted `#` starts a YAML comment). Every key becomes `--em-<kebab-name>` in `tokens.css` and in `explain.mjs tokens --css`; `background` also becomes `--em-bg`, and `surface`, `text`, `muted` keep their names. Add your own keys (`brandPrimary` becomes `--em-brand-primary`). Color carries meaning in this style, so say in the prose what each accent stands for. Text must keep WCAG AA contrast (4.5:1) with the background: `check` enforces it.

**`typography`**: roles `display`, `body`, `mono`, each `{ family, weight, fallback }`. `fallback` is a generic family such as `serif`, and the driver adds it after your family. The roles become `--em-font-display`, `--em-font-body`, `--em-font-mono`, and each `weight` becomes `--em-weight-display`, `--em-weight-body`, `--em-weight-mono`.

- The video engine bundles the families below and embeds them offline. Only the upright regular and bold cuts ship. The engine fetches an italic or another weight from Google Fonts when online, and fakes it offline. Do not rely on them.

  ```
  Inter, Roboto, Open Sans, Lato, Nunito, Montserrat, Poppins, Outfit, Oswald, League Gothic,
  Archivo Black, Playfair Display, EB Garamond, Space Mono, IBM Plex Mono, JetBrains Mono,
  Source Code Pro, Noto Sans JP
  ```

- The engine fetches any other family from Google Fonts on the first compile. It can also take the family from the machine. If neither works, the fallback shows and the compile warns.
- Some languages need glyphs that your family lacks (Japanese, Chinese, Hindi). Name a family that has them, for example `family: "Noto Sans JP"`.

**`motion`**:

| Key | Meaning |
|---|---|
| `gate` | `on`. Never `off`. |
| `maxStaticSec` | longest allowed still frame, default 2 (the HyperFrames default). |
| `leadInSec`, `beatGapSec`, `tailSec` | silence before the first beat, between beats, after the last. |
| `ease` | any GSAP ease name, such as `power2.inOut`. |
| `durations` | seconds per primitive: `draw, write, morph, move, camera, indicate, count, grow, fade`. |
| `preferred` | a list of `{ primitive, note }`: what the brand favors. The agent reads the notes as guidance. |
| `examples` | paths (relative to the spec) to complete compositions showing the brand's motion. The agent reads them as few-shot examples. |
| `personality` | the brand's motion archetype: `playful`, `premium`, `corporate` or `energetic`. Another word is a warning; the agent reads it as a note. |
| `eases` | one GSAP ease per role: `enter`, `exit`, `emphasis`. The kit applies them: `draw`, `grow` and the first `fade` enter; a call with `out: true` exits; `indicate` is the emphasis. `move`, `morph`, `camera`, `count` and a dim keep `ease`. A role left out uses `ease`. |
| `ambient` | `none` (default), `subtle` or `lively`: a glow in `colors.ambient` (else `muted`) that drifts slowly behind the stage. The Motion Gate then watches `#stage` only, so the glow never passes it. Any level but `none` is an override. |
| `signature` | `{ name, note }`: the brand's own move. The agent reads the note and uses the move where the narration lands its main point. |

These four keys are a **motion identity**: the part of a brand spec that says how the brand moves. `new` prints the resolved one. Its intent lives in the prose, under `## Motion identity`.

Worked examples also live in the prose, in a `## Motion examples` section with fenced `js` blocks. Each block is one complete beat: the narration in a comment, then `kit.beat` with only `b.<primitive>(...)` and `b.at(...)` calls. `design check` rejects any other `b.<name>(`.

**`rules`**: the 3b1b defaults. A brand can flip any of them, and the driver reports each one as an override.

| Key | Default | Meaning when changed |
|---|---|---|
| `centralObject` | `true` | `false` allows several equal objects in a beat. |
| `hud` | `false` | `true` allows persistent chrome: a header, a progress bar, a logo watermark. |
| `cardsAsLayout` | `false` | `true` allows panels and card grids as layout. |
| `maxWordsOnScreen` | `7` | words of free text on screen at once. Labels, numbers, currency amounts and symbols do not count. |

**`layout`**: the boxes that keep content clear of the frame edge and of the captions, one pair for each orientation. A box is `[x0, y0, x1, y1]` in stage units: four numbers inside that frame, with `x0 < x1` and `y0 < y1`. `landscape` is 1920 x 1080 and `portrait` is 1080 x 1920.

| Key | Default landscape | Default portrait | Meaning |
|---|---|---|---|
| `safe` | `[120, 120, 1800, 960]` | `[60, 220, 960, 1380]` | Where stage content lives. `camera` with `focus` fits its box inside it. Portrait keeps clear of the platform's top bar, side buttons and bottom handle. |
| `captions` | `[160, 900, 1760, 1030]` | `[60, 1400, 960, 1580]` | The band where the kit draws burned captions. Keep stage content out of it: `check` fails on stage content that sits in it. |

**`captions`**: `burn` maps each orientation to `true` or `false`: it says whether the kit burns the narration into the video. The default is `landscape: false` and `portrait: true`. `maxWords` is the most words in one caption chunk, a whole number from 1 to 20 (default 6). The driver writes the `.srt` whatever `burn` says.

The kit sets the caption size from the band, at 56 units or more in portrait.

After the build, the kit samples the timeline and measures the stage on screen, camera included. A box in the caption band is an error when it lasts 0.5 s or more, and a warning when it is shorter. A box more than 16 units outside `safe` is a warning. See the safe zone section of [`video-motion.md`](video-motion.md). Captions use `--em-text` and `--em-font-body`, with a shadow in the background color and no box behind them.

**`narration`**: `speed` (above 0, at most 3) and `voices`. `voices` maps a Kokoro language key (`pt-br, en-us, en-gb, es, fr-fr, it, ja, zh, hi`) to a Kokoro voice id. A language with no entry gets a silent video and an `.srt`. The voice follows the requester's language, never the reverse.

**`images`**: a list of `{ path, role, note }`. `path` is a local file, relative to the spec file. `role` is one of:

- `reference`: the agent looks at it before composing (a screenshot of the brand's look, a style board). It stays where it is and never appears in the video.
- `asset`: copied to `project/assets/`. May become a beat's central object (an `<image>` in the stage, introduced with `fade` or `grow`).
- `logo`: copied to `project/assets/`. Use it only on an optional end card, never as a watermark on every frame, unless `rules.hud` is `true`.

## Validate and use

- `explain.mjs design check [<path>]` validates a spec file, or the folder that holds one. With no path, it checks the personal spec and the shipped default. It checks these points:
  - The frontmatter parses, and known keys have the right types.
  - Colors are hex. `motion.gate` is not off. `maxStaticSec` is above 0.
  - Every `images[].path` and `motion.examples[]` path exists, with a valid role.
  - Every primitive in `preferred` and in the `## Motion examples` code is a kit primitive.
  - Every `layout` box is four numbers inside its frame, and `captions.burn` values are booleans.
- `explain.mjs design resolve [--design <path>]`: the merged result and the overrides.
- `explain.mjs design find [--project <dir>]`: the project's brand spec, or none.
- `explain.mjs tokens --css [--design <path>]`: the `:root { --em-* }` block for inline SVG and interactive HTML.

## Convert an existing design system

Do this only when the user asks. It is a one-time conversion: write a new spec file, never read the source system at render time.

1. Ask where to write it. Never overwrite an existing `frame.md`, `design.md` or `DESIGN.md`; use a new name such as `explain-me.design.md`.
2. Map the tokens, keeping only what a frame needs:

| Source | Becomes |
|---|---|
| DTCG `color.*` (`$value`, resolve `{aliases}`; convert `rgb()` or `hsl()` to hex) | `colors.<name>` |
| Tailwind `theme.colors` and `theme.extend.colors`, flattened | `colors.<name>` |
| Figma COLOR variables (pick one mode; ask light or dark) | `colors.<name>` |
| heading, sans, serif font family | `typography.display`, `typography.body` |
| mono, code font family | `typography.mono` |
| DTCG `duration`, Tailwind `transitionDuration` | `motion.durations` per primitive, in seconds |
| `cubicBezier`, `transitionTimingFunction` | `motion.ease`: the nearest GSAP name (`power2.inOut`) |

3. Choose a dark or a light `background` and a readable `text`. Keep a `muted` for scaffolding and up to eight accents, and say in the prose what each accent means. Drop gradients, shadows, radii and spacing: the video has no interface.
4. Write `## Overview` and `## Motion grammar` in the brand's voice. Add rule changes under `rules` only if the user wants them.
5. Run `explain.mjs design check <file>`. Show the user what you mapped, dropped and chose. Ask before you pass it with `--design`.

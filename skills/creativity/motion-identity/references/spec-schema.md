# Spec schema

Where a motion identity lives in a brand spec, and how each video tool reads it. A spec is YAML frontmatter plus a markdown body. This is the same file explain-me and HyperFrames read (`frame.md`, `design.md` or `DESIGN.md`).

- **The frontmatter is normative.** The tools copy its values exactly. Never round, never invent.
- **The prose is judgment.** The agent that writes a video reads it for intent and limits.

Other frontmatter keys a spec already carries (a vault's `status`, `created`, `private`) stay untouched. explain-me warns that nothing reads them, and that is fine.

## Frontmatter

```yaml
---
colors:                      # the floor: background and text, verbatim from the brand; accents as the brand names them
  background: "#0B1020"
  text: "#F4F6FF"
  muted: "#8A93B2"           # optional; secondary text, used only where it keeps 4.5:1 on the background
  accentBlue: "#4F8CFF"      # any number of accents, keyed by role or by the brand's own name
  ambient: "#4F8CFF"         # optional; the glow behind the stage (default: muted)
typography:                  # the floor: display and body, exactly as the brand writes them
  display: { family: "Inter", weight: 800, fallback: sans-serif }
  body: { family: "Inter", weight: 500, fallback: sans-serif }
motion:
  personality: playful       # playful | premium | corporate | energetic (decision D4)
  ease: "power2.inOut"       # the base ease: moves, morphs, camera, counts (D5)
  eases:                     # one GSAP ease per role (D5)
    enter: "back.out(1.7)"
    exit: "power2.in"
    emphasis: "back.out(2.5)"
  durations: { grow: 0.5, fade: 0.4, indicate: 0.6, write: 0.7, draw: 0.9, move: 0.9, morph: 0.8, camera: 1.2, count: 0.9 }  # (D6)
  ambient: none              # none | subtle | lively (D10)
  signature: { name: "ribbon sweep", note: "a stroke shaped like the symbol's curve sweeps under the key word on the enter ease, once, at the main point" }  # (D8)
  maxStaticSec: 2            # optional; the Motion Gate's limit. Never 0, never gate: off.
---
```

- Quote every hex: an unquoted `#` starts a YAML comment.
- Every ease is a GSAP name. `motion.mjs check` refuses CSS names and `cubic-bezier()`, and suggests the nearest name.
- `durations` uses explain-me's nine primitive names. Leave out a primitive and the tool keeps its default.
- `rules.maxWordsOnScreen` (explain-me) goes in only if decision D9 differs from explain-me's 7.

## Prose sections

The headings are in English, because the tools find them by name. The text under them is in the brand's language.

### `## Motion identity`

```markdown
## Motion identity

**Status:** draft (proof not seen yet)

<one paragraph: the emotional target and why, in the brand's words (D1)>

- **Where it plays:** <formats and the tool for each (D2)>
- **Motif:** <what moves, what never moves (D3)>
- **Principles in use:** <each with its number or limit: anticipation 10%, follow-through on underlines, overshoot 15% on emphasis only (D7)>
- **Principles refused:** <and why: no squash (the logo is never deformed) (D7)>
- **Kinetic type:** <how big words enter, the emphasized word, words per screen (D9)>
- **Ambient and stillness:** <(D10)>
- **Never:** <three to six items (D11)>
```

The status line is either `**Status:** draft (<why>)` or `**Status:** approved on AAAA-MM-DD by <role>`. It is approved only after the owner watched a proof.

### `## Motion examples`

One or two complete explain-me beats in fenced `js`, with the narration as a comment. Only the nine kit primitives and `b.at()`. Leave `ease` off the calls, so the kit applies the role eases. explain-me's `design check` refuses any other `b.<name>(`.

```js
// "The idea lands here."
kit.beat("b03", (b) => {
  b.grow("#idea");                       // enters on eases.enter
  b.at(0.5).draw("#ribbon");             // the signature, drawn under it
  b.at(1.2).indicate("#idea");           // emphasis on eases.emphasis
});
```

### `## Brief block`

At most eight lines, the motion identity in a form a HyperFrames brief can carry. Write it for an agent that has never seen the spec: personality, the three role eases and the base ease, the duration feel, the signature, ambient, and the one or two never-items that matter most. `motion.mjs brief` prints it with the spec's path.

## How each tool reads it

| Tool | Reads | Normative | Judgment |
|---|---|---|---|
| explain-me | `--design <spec>`, or the project's spec through `design find` | colors, typography, `motion.*`: the kit applies the role eases, the durations and the ambient level; an ambient other than `none` is reported as an override | `## Motion identity`, `## Motion examples`; `new` prints the resolved `motion:` line |
| HyperFrames (`general-video`, `motion-graphics`, `hyperframes-creative`) | the spec at the project root, `frame.md` first, then `design.md`, then `DESIGN.md` | the frontmatter is "brand truth": exact hex and font values | all prose sections |
| HyperFrames footage skills (`talking-head-recut`, `embedded-captions`) | only `BRIEF.md` | — | the brief block, pasted into the brief's notes |

## The floor that never moves

- The Motion Gate stays on: no `gate: off`, and `maxStaticSec` is above 0.
- Text keeps 4.5:1 contrast with the background.
- No value is invented: a missing hex, font, angle or ratio is a question for the owner.
- Every word on screen is in the language of the video's request, whatever the spec's prose language.

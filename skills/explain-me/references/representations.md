# Choosing a representation

Pick the format from the nature of the concept and the user's wish. When called interactively, ask at most two questions: format and audience depth. Recommend a format with each question. When `teach-me` calls, ask nothing and use the format it names.

Every format uses the Requester Language for every word it shows or speaks.

## Format decision matrix

| Need | Format | Reference | What must be visible |
|---|---|---|---|
| Vocabulary, classification, one small distinction | Controlled text and table | [`ste-lite.md`](ste-lite.md) | Plain name, formal name, example. Stable terms. |
| Logic flow, state machine, branching | Mermaid | Markdown native | Inputs, branches, decision gates, transitions. |
| Exact layout, component boundaries, internal structure | Inline SVG | [`design-spec.md`](design-spec.md) | Labelled parts and boundaries, palette and type from the Design Spec. |
| Abstract intuition, physical analogy | Generative image | Image tool | A scene with a caption that states where the analogy breaks down. |
| Trade-offs, parameter tuning, state exploration | Interactive HTML | [`interactive-html.md`](interactive-html.md) | Live range controls, `--em-*` tokens from the Design Spec, one file, no build step. |
| Change over time, step-by-step proof, a process with a before and an after | Scene-Driven Video | [`video-motion.md`](video-motion.md) | HyperFrames, 3b1b Kit motion, one Kokoro Narration clip per Beat, `.srt`, `.mp4`. |

Default to the smallest format that shows the Load-bearing Distinction. Choose video only when the mechanism changes over time.

## Palette and type

Inline SVG and interactive HTML take their palette and type from the Design Spec, like video does. The default is the manim palette on a near-black field.

- Print the tokens with `node skills/explain-me/scripts/explain.mjs tokens --css [--design <path>]`.
- Use `var(--em-*)` in every fill, stroke and text colour. Never write a hex value in an artefact.
- A Brand Spec found by `design find` is the recommended style, and the user chooses at intake.

## Controlled writing

Every written text and every narration follows STE-lite ([`ste-lite.md`](ste-lite.md)) and the Language Profile for the Requester Language ([`profile-en.md`](profile-en.md), [`profile-pt-br.md`](profile-pt-br.md)). Lint it:

```bash
node skills/explain-me/scripts/ste-lint.mjs --file <path> --lang <en|pt> [--narration]
```

## Static visuals

- **Mermaid**: dependency graphs, sequence diagrams and class relations. It renders in GitHub and in Markdown viewers.
- **Inline SVG**: exact hierarchy, custom styling, or coordinates that a Mermaid layout distorts.
- **Generative image**: analogy only. Always add a boundary note that says where the metaphor stops being accurate.

## Video

- The look is 3b1b Style: one central object, drawn, written and transformed on a near-black field. No header bar, no panels, no bullet lists. A Design Spec may change this.
- Narration is local Kokoro Narration, one clip per Beat. Its length sets the timing.
- If the language has no Kokoro voice, make a silent video with an `.srt` and say so.
- `render` runs only after `check` passes the Motion Gate.

## Caller boundary

When `teach-me` calls, deliver these items:

- The comprehension goal.
- The fragment path and its assets.
- The glossary, the primary sources and the assumptions.
- An Explain-Back question without an answer key.

Do not touch quizzes, grading or progress records.

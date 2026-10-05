# Choosing an Explanatory Representation

Select the representation format based on the nature of the concept and user preference. When called interactively, conduct a focused intake grill (maximum 2 questions) to confirm the format and target audience. When called by `teach-me`, bypass questions and honor the caller's requested format.

## Format Decision Matrix

| Need / Nature of Concept | Primary Format | Key Reference | What Must Be Visible |
|---|---|---|---|
| Vocabulary, classification, or small logical distinction | Controlled STE-lite Text & Table | [`references/ste-lite.md`](ste-lite.md) | Plain term → formal name → example; strict word ceilings and stable vocabulary. |
| Logic flow, state machine, branching conditions | Mermaid Diagram | Markdown native | Inputs, branches, decision gates, state transitions. |
| Precise spatial layout, component boundaries, internal architecture | Inline Vector SVG | HTML / Markdown | Scalable dark-slate coordinates, labeled buses and boundaries, high contrast. |
| Abstract intuition, physical analogy, real-world metaphor | Generative Image | Image tool | Realistic or stylized scene; caption must state where the analogy breaks down. |
| Trade-offs, multi-variable parameter tuning, state exploration | Interactive Single-File HTML | [`references/interactive-html.md`](interactive-html.md) | 3b1b dark theme, responsive canvas/SVG with live range controls; zero build step. |
| Causal evolution across time, step-by-step mathematical proof | 3b1b Motion Graphics Video | [`references/video-motion.md`](video-motion.md) | Remotion/Motion Canvas, Kokoro ONNX narration sync, subtitles, .mp4 file. |

---

## Controlled Writing: STE-Lite
All written explanations and narration scripts must adhere to **STE-lite** ([`references/ste-lite.md`](ste-lite.md)):
- Descriptive sentences ≤ 25 words; procedural sentences ≤ 20 words.
- Paragraphs ≤ 6 sentences.
- Active voice, zero decorative metaphors, strictly unified vocabulary without synonyms.
- Run `node skills/explain-me/scripts/ste-lint.mjs --file <path>` to audit.

## Static Visuals: Mermaid vs. Inline SVG vs. Generative Images
- **Mermaid**: Use for dependency graphs, sequence diagrams, and class relationships where native rendering in GitHub and Markdown viewers is desirable.
- **Inline SVG**: Use when a diagram requires exact visual hierarchy, custom styling, dark slate container boxes, or coordinates that Mermaid layout engines distort.
- **Generative Images**: Use solely for analogical imagery (e.g. visualizing physical phenomena). Always append a textual boundary note explaining where the visual metaphor ceases to be technically accurate.

## Interactive HTML Explainers
- Standalone single file combining HTML, CSS, and JS with zero npm build step ([`references/interactive-html.md`](interactive-html.md)).
- Uses 3b1b dark theme (`#0f172a`), touch-friendly inputs, high-DPI canvas handling, and responsive single-column mobile viewports.

## Motion Graphics Video & Kokoro TTS
- Follow the 3b1b aesthetic: dark slate background, geometric transforms, high-contrast mathematical readouts ([`references/video-motion.md`](video-motion.md)).
- Audio generated per scene via local **Kokoro ONNX**. If Kokoro is missing, instruct the user to install it (`uv pip install kokoro-onnx soundfile`) and offer a silent video with `.srt` subtitles as an immediate fallback.
- Audio scene duration strictly dictates visual frame duration.

## Caller Boundary
When returning the artifact to the user or caller (`teach-me`):
- Deliver: comprehension goal, artifact/fragment path, plain/formal glossary, primary sources, assumptions, and an **explain-back** diagnostic question (without answer key).

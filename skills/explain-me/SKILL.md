---
name: explain-me
description: "Use when the user asks for a visual explanation, says 'explain-me', 'show me how it works', 'explique visualmente', or needs a diagram, illustrated mechanism, interactive explainer, narrated video, or plain terminology; also when teach-me requests the explanatory part of one lesson. Creates the explanation, while the caller owns study selection, quizzes, grading and progress records."
metadata:
  author: Matheus Borges
  version: 0.0.0
---

# Explain Me

Turn one mechanism into an explanation the learner can inspect and explain back. Deliver controlled text, diagrams, interactive HTML, or 3b1b-style motion graphics. Work standalone or supply the visual explanation inside a `teach-me` lesson.

## Steps

1. **Intake grill and contract.**
   - **When called by `teach-me`**: ask zero questions. Inherit its lesson path, time budget, target format, and quiz boundaries directly.
   - **When called interactively**: ask at most **two** focused questions with recommended answers:
     1. *Format*: recommend based on the mechanism and local runtimes ([`references/representations.md`](references/representations.md)).
     2. *Audience depth*: beginner vs. engineer/operator.
2. **Isolate the load-bearing distinction.**
   - Write one sentence stating what the learner must be able to explain back.
   - Anchor the explanation to one concrete running example throughout.
   - Define technical terms in a three-part glossary: plain name → formal name → example.
3. **Enforce STE-lite (80% ASD-STE100).**
   - Write all explanations, diagram labels, and narration scripts under [`references/ste-lite.md`](references/ste-lite.md).
   - Descriptive sentences ≤ 25 words; procedural sentences ≤ 20 words.
   - Paragraphs ≤ 6 sentences. Active voice. Zero synonym switching for defined terms.
   - Audit text with `node skills/explain-me/scripts/ste-lint.mjs --file <path>`.
4. **Produce the artifact.**
   - **Controlled Text & Tables**: Deliver plain/formal glossary and comparison tables.
   - **Logic & Flow Diagrams**: Use **Mermaid** for state machines, branching, and dependency trees rendered natively in Markdown.
   - **Spatial & Architectural Maps**: Use **inline SVG** with 3b1b dark theme (`#0f172a`) for high-precision vector layouts and clear coordinate buses.
   - **Visual Analogies**: Use **generative images** solely for metaphors; always append a caption stating where the physical analogy breaks down.
   - **Interactive Explainers**: Produce a single-file autonomous HTML document (inlined CSS/JS, zero build step) following [`references/interactive-html.md`](references/interactive-html.md). Responsive single-column, touch controls, and high-DPI canvas/SVG state exploration.
   - **3b1b Motion Graphics Video**: Follow [`references/video-motion.md`](references/video-motion.md).
     - Probe local Kokoro ONNX (`python3 -c "import kokoro_onnx, soundfile"`). If missing, instruct installation (`uv pip install kokoro-onnx soundfile`) and offer silent video with `.srt` subtitles as an immediate fallback.
     - Synthesize scene-by-scene audio. Audio clip duration strictly dictates visual frame duration in Remotion / Motion Canvas.
     - Assemble final `.mp4` and subtitles via ffmpeg.
5. **Inspect and deliver.**
   - Verify mobile readability, contrast, and label consistency.
   - Standalone: return the artifact path, comprehension goal, glossary, and an **explain-back** diagnostic question (without answer key).
   - With `teach-me`: return the embeddable fragment and assets without altering lesson quizzes, grading, or session records.

## Done-check

- [ ] One load-bearing distinction, one running example, and an observable comprehension goal.
- [ ] Text and narration scripts comply with STE-lite limits (verified via `ste-lint.mjs`).
- [ ] Interactive HTML is a single autonomous file with zero build step, 3b1b dark palette, and touch-friendly controls.
- [ ] Motion graphics video has time-locked scene audio (or explicit silent+subtitles fallback) and a playable `.mp4`.
- [ ] Diagrams use Mermaid for logic, inline SVG for architectural precision, or generative image with boundary caption.
- [ ] An explain-back question is provided without exposing the answer key.
- [ ] `teach-me` retains full ownership of lesson curriculum, quizzes, and learner progress.

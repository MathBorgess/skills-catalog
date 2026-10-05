---
name: explain-me
description: "Use when the user asks for a visual explanation, says 'explain-me', 'show me how it works', 'explique visualmente', 'explica em vídeo', 'vídeo explicativo', 'vídeo vertical', 'para reels / shorts / tiktok', or needs a diagram, an illustrated mechanism, an interactive explainer, a narrated video, or plain terminology; also when they want it in their project's brand ('use a nossa marca', 'use o DESIGN.md'), and when teach-me requests the explanatory part of one lesson. Every word comes out in the language of the request. The caller owns quizzes, grading and progress records."
metadata:
  author: Matheus Borges
  version: 1.0.0
---

# Explain Me

Turn one mechanism into an explanation the learner can inspect and explain back, in the learner's own language. Deliver controlled text, a diagram, an interactive explainer, or a narrated 3b1b-style video. Work standalone, or supply the visual explanation inside a `teach-me` lesson.

`<skill>` is the folder that holds this SKILL.md: `skills/explain-me` in this repository, the folder where the plugin installed it elsewhere. Below, `explain.mjs` means `node <skill>/scripts/explain.mjs`, and `ste-lint.mjs` means `node <skill>/scripts/ste-lint.mjs`. Each Run is one folder under the Skill Home (`~/.cache/explain-me` by default; `EXPLAIN_ME_HOME` overrides it; `doctor` prints it). Nothing goes into the user's project unless the user or the caller names a destination.

## Steps

1. **Intake.** Run `explain.mjs design find` first.
   - **Called by `teach-me`**: ask zero questions. Inherit its language, lesson path (the destination), time budget, format and quiz boundaries. If `design find` reports a Brand Spec, use it and say so.
   - **Called interactively**: ask at most two questions, each with a recommended answer.
     1. *Format*, chosen with [`references/representations.md`](references/representations.md). If `design find` reports a Brand Spec, recommend it as the style. Example: "Video in this project's DESIGN.md brand, or the default look?"
     2. *Audience depth*: beginner or engineer.
   - Never ask the language. The Requester Language is the language of the request message. An explicit instruction or the caller's value wins.
   - For video, read the Orientation from the request. "Reels", "Shorts", "TikTok", "vertical", "stories" or "no celular" mean portrait. With no cue, recommend landscape inside the format question. A caller can pass the orientation.
2. **Isolate the Load-bearing Distinction.** Write one sentence: what the learner must explain back. Keep one running example. Write a three-part glossary: plain name, formal name, example. Use the Requester Language. Keep the distinction, the glossary and the explain-back question in `<run>/explanation.md`: `new` writes its three sections. Lint it.
3. **Write under STE-lite and the Language Profile.** Rules: [`references/ste-lite.md`](references/ste-lite.md), plus [`references/profile-en.md`](references/profile-en.md) or [`references/profile-pt-br.md`](references/profile-pt-br.md). Other languages get the core alone. Lint every text before it ships: `ste-lint.mjs --file <f> --lang <en|pt>`. Add `--narration` for narration only. Lint on-screen labels without it. Fix every error.
4. **Produce the artefact** for the chosen format.
   - **Text and tables**: glossary and comparison tables.
   - **Mermaid**: state machines, branching, dependency trees.
   - **Inline SVG and interactive HTML**: take colours and type from the Design Spec. Run `explain.mjs tokens --css [--design <path>]` and follow [`references/interactive-html.md`](references/interactive-html.md) and [`references/design-spec.md`](references/design-spec.md).
   - **Generative image**: for analogy only. Add a caption that states where the analogy breaks down.
   - **Scene-Driven Video**: follow [`references/video-motion.md`](references/video-motion.md).
     1. `explain.mjs doctor`. If Python or Kokoro is missing, run `explain.mjs setup`. `setup` cannot install `ffmpeg` or `espeak-ng`: give the user the command that `doctor` prints. If the language has no Kokoro voice, make a silent video with an `.srt` and say so.
     2. `explain.mjs new --slug <slug> --lang <tag> [--orientation landscape|portrait] [--design <path>] [--dest <dir>]`. Portrait is 1080 x 1920 with a Safe Zone and Burned Captions by default.
     3. Write `script.json`: one narration sentence and one `subject` per Beat. Run `explain.mjs voice <run>` to get each Beat's length.
     4. Write the STAGE and SCENE regions of `project/index.html` with 3b1b Kit primitives only. Run `voice` again after any change to a narration or a subject. Then run `explain.mjs check <run>` and fix every error. `render` refuses to run until `check` passes (Motion Gate).
     5. `explain.mjs render <run>`. Open every PNG in `<run>/frames/`: an entrance frame and a settled frame per Beat. Fix and re-render when the frame cuts text, objects overlap, content enters the caption band, or a frame is empty.
   - For other formats, run `explain.mjs new --slug <slug> --lang <tag> --format <svg|html|text|mermaid|image>`. Write the artefact into the Run folder it prints. For `svg` and `html`, the folder holds `tokens.css` to inline.
5. **Take feedback.** Style feedback ("mais lento", "fundo mais claro", "slower") changes the Design Spec. Propose a diff to the active spec: the explicit or Brand Spec if the Run used one, else `<home>/DESIGN.md`. Apply it only after the user says yes. Then re-render. Never edit the shipped default. Content feedback edits only the Run.
6. **Deliver.** Report in the Requester Language:
   - The artefact paths. Everything stays in the Run folder unless the user or the caller named a destination.
   - The comprehension goal, the glossary, and an Explain-Back question without an answer key.
   - The Orientation of a video, and whether it carries Burned Captions.
   - Every design override of the 3b1b defaults, as `render` and `new` print them. Example: "this brand allows HUD; maxStaticSec 4 s".
   - With `teach-me`: the embeddable fragment and its assets. Do not touch quizzes, grading or records.

## Done-check

- [ ] Every word is in the Requester Language: text, narration, on-screen text, subtitles, glossary, explain-back.
- [ ] STE-lite and Language Profile lint is clean for every text and narration.
- [ ] One Load-bearing Distinction, one running example, one observable comprehension goal.
- [ ] A video passed the Motion Gate and you inspected every frame in `frames/`. Or the delivery states the silent fallback plainly.
- [ ] Interactive HTML is one offline file, with `<html lang>` set and `--em-*` tokens inlined.
- [ ] Nothing went into the project without a named destination.
- [ ] The delivery names every design override.
- [ ] An explain-back question is present, with no answer key.
- [ ] `teach-me` still owns its quizzes, grading and progress records.

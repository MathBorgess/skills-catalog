---
name: explain-me
description: "Use when the user asks for a visual explanation, says 'explain-me', 'show me how it works', 'explique visualmente', or needs a diagram, illustrated mechanism, interactive explainer, narrated video, or plain terminology; also when teach-me requests the explanatory part of one lesson. Creates the explanation, while the caller owns study selection, quizzes, grading and progress records."
metadata:
  author: Matheus Borges
  version: 0.0.0
---

# Explain Me

Turn one mechanism into an explanation the learner can inspect and explain back. Work independently or supply the explanation inside a `teach-me` lesson.

## Steps

1. **Set the explanation contract.** Reuse the user's topic, language, audience, confusion, source material and requested format. When called by `teach-me`, also receive its lesson path, time budget, integration target and quiz boundaries. Infer routine choices; ask only when missing information changes the concept or deliverable.
2. **Find the load-bearing distinction.** Write one sentence saying what the learner should be able to explain. Use one concrete example throughout. Resolve the mechanism against supplied evidence or current primary sources; label unknowns and assumptions. Define each necessary term with a plain name, formal name and example. Simplification must preserve direction, conditions and exceptions.
3. **Choose the smallest useful representation.** Read [representations.md](references/representations.md) for the selected mode. Prefer plain terms or a labeled diagram for a simple distinction, an image for spatial structure, interactive HTML for changing parameters, and a video for a mechanism that needs time or sequence. Honor an explicit format. Do not generate every format by default.
4. **Produce and inspect.** Deliver the requested artifact, not just a plan or prompt. Use available dedicated image/video/visualization skills when needed: call the Skill tool with the selected skill if that interface is available, otherwise load its advertised `SKILL.md` and follow it. Never invent a tool or install a media stack just to satisfy this skill. If a required capability is unavailable, report it and supply a usable simpler explanation without claiming the requested media was produced. Inspect labels, causal order and readability; report what could not be verified.
5. **Return the explanation to its owner.** Standalone: show the artifact and a brief caption connecting it to the learning goal. With `teach-me`: return the embeddable explanation, asset paths, source links, glossary and limits for the existing lesson. Keep its quiz answers hidden and do not select another topic, grade answers, write a session ledger or claim mastery. A short explain-back question may be suggested to the caller, with no answer key shown to the learner.

## Done-check

- [ ] One mechanism, one example and an observable comprehension goal.
- [ ] Terms, arrows and visual states agree with the evidence; decorative details do not imply unsupported facts.
- [ ] The artifact exists and was inspected to the extent supported; missing media capabilities are stated plainly.
- [ ] Mobile text is readable; images have a text equivalent and videos have captions/transcript.
- [ ] Sources and assumptions accompany the explanation; credentials are never embedded in output.
- [ ] `teach-me` keeps ownership of quiz, resume prompt, grading and progress records.

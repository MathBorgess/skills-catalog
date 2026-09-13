---
name: teach-me
description: "Use when the user is about to study, review, quiz, or practice material that already lives in a certification study wiki — a session inside an existing roadmap, a topic from the overlap table, a phone-sized HTML lesson, \"vou estudar\", \"me ensina\", \"quiz me\", \"aula\", \"lição\", \"no celular\", \"practice questions\", \"I got these wrong\", a pasted prompt starting with \"teach-me resume\", \"retomar sessão\", \"resume prompt\", or when they open a MathAI-style vault under estudos/ and say they will study. Not for bootstrapping an empty wiki (that is study-wiki)."
metadata:
  author: Matheus Borges
  version: 1.0.1
---

# Teach Me

You run **one study session** against a plan that already exists. Two artifacts: an **HTML lesson** they can finish on a phone, and a **markdown session note** plus ledger lines. Location and a short window do not cancel the session — if the console is not here, the lesson is `theory` and still ships.

The lesson carries its own handoff: a brief of this conversation that the page turns into a **resume prompt** with the user's answers and notes, so any later session can grade it. [`references/resume.md`](references/resume.md).

Never `MISSION.md`. Never a second syllabus. Never a desktop-only page.

## Steps

**Resume mode.** First line of the message is `teach-me resume` → run step 1, then jump to step 6 using the brief inside the prompt.

1. **Layout.** Detect canonical vs foreign using [`references/layouts.md`](references/layouts.md). Never bootstrap a study-wiki scaffold into a foreign vault.
2. **Orient.** Roadmap (gates in the next seven days = first line), overlap table, active error ledger, topic note. [`references/session.md`](references/session.md).
3. **Pick one topic** from the overlap sort: shortest **active** exam → least mastery → highest domain weight. Parked exams are off. Two codes on the same row may share the session; two unrelated syllabi may not.
4. **Declare** the table in `references/session.md`, then ship the lesson. No mission interview.
5. **Lesson HTML** at the layout's lesson path, against [`references/lesson.md`](references/lesson.md). Copy this skill's `assets/lesson.css` and `assets/quiz.js` into the workspace assets path if they are missing. `practice` only when the environment is in this sitting; otherwise `theory` (quiz in the HTML, answers hidden until Check). Embed the `resume-brief` from `references/resume.md`, written from your summary of this conversation. Chat still has no answer key. Write nothing else yet.
6. **After they answer** (resume prompt or a tally in chat). Grade the belief. Resolve each Doubt / attention note against the primary source (`references/resume.md`). Write the session note and ledger lines. Update overlap mastery. One next action.

If overlap/roadmap files are missing in a canonical repo, rank live and call the Skill tool with `"study-wiki"`. If the wiki itself is missing, call `"study-wiki"` (Flow 1) instead of teaching.

## Common mistakes

| Excuse | Reality |
|---|---|
| "They asked for both certs so I taught both." | One topic. Overlap row or active exam only. |
| "HTML replaces the wiki note." | HTML is the lesson. Markdown is the record. Write both. |
| "Tufte sidenotes look nicer." | The page has to work on a phone in one column. |
| "No console, so no session." | Ship theory HTML. Label it `theory`. |
| "MISSION.md is empty, I have to interview first." | The roadmap is the mission. Teaching is the job. |
| "study-wiki files are missing, bootstrap first." | Foreign vaults use `estudos/`. Bootstrapping duplicates the wiki. |
| "I'll put the key in chat; the HTML already hides it." | No key in the agent message until they answer. |
| "Parked is still useful as 25% theory." | Parked means no slice. |
| "The user's note says the wiki is wrong, so I fixed it." | Check the primary source. Unconfirmed is a `lacuna` line, not an edit. |
| "The next agent can read the chat." | It cannot. The brief in the HTML is all it gets. |

## Done-check

- [ ] Layout detected; no canonical files created in a foreign vault; no `MISSION.md`.
- [ ] One active topic; parked exams untouched unless the user repeated the override after a warning.
- [ ] Declaration table sent before the lesson.
- [ ] HTML lesson written: viewport, shared CSS/JS (no CDN), completable in the daily budget, answers hidden until Check.
- [ ] `resume-brief` embedded: declaration, conversation context, repo-relative paths, instructions; no secrets.
- [ ] Every wiki edit from a user note cites the primary source that confirmed it.
- [ ] No answer key in the same chat message as the questions.
- [ ] Session note written at the layout path (or nothing written, if they did not answer).
- [ ] Every conceptual miss is one append-only ledger line pointing at a note.
- [ ] The user got one visible result they can take with them (score, distinction, or a practice brief they can finish later).
- [ ] Report names the files written and the single next action.

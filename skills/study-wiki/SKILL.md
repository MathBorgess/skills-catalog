---
name: study-wiki
description: Build and operate a personal certification study repository as a knowledge graph a model can read. Use when someone wants to study for a technical certification with an LLM in the loop — bootstrapping the repo, choosing which exams to target, writing notes from study sources, injecting practice questions and grading them, logging every wrong answer against the topic that caused it, and scheduling the daily and weekly study loop. Triggers on "study for <exam>", "certification wiki", "practice questions", "quiz me", "I got these wrong", "study plan", "exam prep repo", "spaced repetition".
metadata:
  author: Matheus Borges
  version: 1.0.0
---

# Study Wiki

Two things fail in solo certification study: the material is read but never recalled, and the weak spots are felt but never recorded. This skill fixes both by making the repository the memory — notes hold the content, logs hold *your* gaps, and a short daily loop keeps pulling questions out of the gaps.

You are the operator of that repository. The user reads and answers; you write and check.

## Mode: are you bootstrapping or running?

Look for `wiki/README.md` and `wiki/_log/errors.md` in the working directory.

- **Missing** → bootstrapping. Go to Flow 1.
- **Present** → running. Read `wiki/README.md`, then the last ~30 lines of `wiki/_log/errors.md`, then the topic note. Then pick the flow that matches the request.

Never skip that orientation read. Skipping it produces a duplicate note, a broken wiki-link, and a question about something the user already answered correctly last week.

## Flow 1 — Bootstrap

Run once, on an empty or near-empty repository.

1. **Interview the user.** Do not scaffold anything first. Ask the questions in [`references/interview.md`](references/interview.md) — which certifications, target dates, current level, study language, how much time per day, what the notification path is. Ask them in one batch, accept partial answers, and use the stated defaults for whatever they skip.
2. **Write the profile** to `wiki/_meta/profile.md` from their answers: certifications with exam codes, target dates, exam domains with official weights, daily budget, language.
3. **Scaffold the repository** exactly as specified in [`references/repo-scaffold.md`](references/repo-scaffold.md) — one directory per certification track, the four log files, the buffer, the index. Create no directory you are not about to fill.
4. **Seed the domain skeleton.** For each certification, write the domain list with official weights into `wiki/README.md` under that track, each domain a heading with an empty bullet list. This is the map the whole system reports against; it exists before the first note does.
5. **Propose the loop**, do not install it. Show the user the scheduled tasks from [`references/scheduled-tasks.md`](references/scheduled-tasks.md), recommend starting with exactly two (morning questions, evening capture), and let them decide.
6. **Report** what was created, by path, and name the single next action: send the first study source, or answer the first question batch.

## Flow 2 — Ingest a study source

Input: course notes, a chapter, documentation, a transcript, a photo of a whiteboard.

1. Orient (see above).
2. **Store the raw source, unedited**, at `sources/<YYYY-MM-DD>-<slug>.md` with the source frontmatter from [`references/note-template.md`](references/note-template.md). Paste it; do not summarize it. A summary stored as a source destroys the provenance you will need when a note is later contested.
3. **Search before writing.** `grep` the concepts and service names against `wiki/README.md` and `wiki/`. The note you were about to create usually already exists.
4. **Write or rewrite** the notes the source touches, against the template. New information about a covered topic **rewrites** the existing note, with the contradiction resolved or recorded. Appending an "Update 2026-08" section to the bottom of a note is the central anti-pattern here — history lives in git.
5. **Link it in**: a bullet under the right domain in `wiki/README.md`, at least two outgoing wiki-links per note.
6. Report created and updated paths.

Threshold for a new note: the concept spans two or more sources, or is central to one. A passing mention goes into the note that already exists.

## Flow 3 — The question loop

This is the engine. Full mechanics in [`references/question-loop.md`](references/question-loop.md); the short form:

1. **Choose the topics** from `wiki/_log/errors.md` — the most-missed and the longest-unreviewed — not from what is most recently written.
2. **Generate or ingest questions** in the exam's real format, including its wording qualifier (`MOST cost-effectively`, `LEAST operational overhead`). Two options should be technically valid; only one satisfies the qualifier.
3. **Send them without the answer key.** The key comes after the user answers, never in the same message.
4. **Grade and explain.** For every wrong answer, explain what the distractor was testing, not just which letter was right.
5. **Log the gaps.** Every miss becomes one line in `wiki/_log/errors.md` pointing at the topic note — the conceptual error, not the question text.
6. **Bank the batch** at `wiki/questions/<exam>-batch-NN.md`: a quick answer key table, then one section per question with the reasoning, the wrong-answer analysis, and the trap.
7. **Score it** in `wiki/_log/score.md`, append-only.

When the user pastes their own questions, ask for their answers **before** you give the key — the repository learns the content from the questions and learns *their gaps* only from their attempt.

## Flow 4 — Capture from the day

A one-line raw entry lands in `wiki/_buffer/capture.md` with a timestamp — something they hit at work that maps to the exam. The evening pass reads the buffer, routes each line into the right note as a real-world scenario, and empties the buffer. Generalize on the way in: no client names, no account identifiers, no real cost figures, no production log excerpts.

## Flow 5 — Weekly review

Compare note count and error count per domain against the official exam weights in `wiki/_meta/profile.md`. Name the single most imbalanced domain and recommend a question batch for it. Sum the week's score, name the best day, and never present a day without entries as a failure. Formula and reporting rules: [`references/logs-and-scoring.md`](references/logs-and-scoring.md).

## Flow 6 — Lint

Run on request and after any large batch of writing. Checklist: [`references/lint.md`](references/lint.md). Report by severity: broken link > orphan note > missing from index > stale > style. Confirm with the user before changing ten or more files at once.

## Rules that hold across every flow

- **Never edit a file under `sources/`.** Sources are immutable; a correction becomes a derived note.
- **Every note carries frontmatter** with `id`, `title`, `category`, `certs`, `last_updated`. Every content edit moves `last_updated`.
- **Wiki-links are `[[Note_Id]]`**, matching the target's frontmatter `id` exactly. A link to a removed file becomes plain text, not a dead link.
- **Two outgoing links minimum** per note, and a note absent from `wiki/README.md` is invisible.
- **A note over ~200 lines gets split.** The index, the logs and the question banks are exempt — they are registers.
- **Scoring is positive-only.** Points accrue for showing up; a missed day is a day with fewer points, never a broken streak and never a logged failure.
- **The user reads their own notes.** Never write a note the user has not asked for and will not read — an unread note is not knowledge, it is inventory.

## Done-check

Before reporting a flow complete, verify:

- [ ] Every file written has valid frontmatter with today's `last_updated`.
- [ ] Every new note is linked from `wiki/README.md` under the correct domain, and has ≥2 outgoing links.
- [ ] Every wrong answer from this session has a line in `wiki/_log/errors.md` pointing at a note that exists.
- [ ] No answer key was sent before the user's attempt.
- [ ] Nothing personal, client-identifying, or cost-real entered the repository.
- [ ] The report to the user lists created and updated files by path, and names one next action.

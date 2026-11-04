---
name: study-wiki
description: "Use when someone wants to build or operate a personal certification study repository as a knowledge graph — bootstrapping the wiki, choosing exams, writing a study roadmap with session milestones and pass/fail gates, mapping overlapping topics across those exams, ingesting sources into notes, logging wrong answers, weekly review, or linting the graph. Triggers on \"study for <exam>\", \"certification wiki\", \"study plan\", \"exam prep repo\", \"roadmap\", \"cronograma\", \"milestones\", \"overlap between certs\". Not for the study session itself (\"vou estudar\", \"quiz me\", practice this topic) — that is teach-me."
metadata:
  author: Matheus Borges
  version: 1.0.0
---

# Study Wiki

The repository is the memory: notes hold the content, logs hold the gaps, the roadmap holds the calendar. You write and check. The user reads, answers, and sits the exam. **Sessions are teach-me.** This skill builds the plan those sessions run.

## Mode

Check the working directory, in this order:

1. **`estudos/certificacoes/` exists, or (`wiki/index.md` and `estudos/`)** → **foreign vault**. Do not bootstrap. Do not create `wiki/_meta/profile.md` or `wiki/_log/errors.md`. If the request is a study session, call the Skill tool with `"teach-me"` and stop. If the request is ingest / weekly / lint on an existing trail, use this skill's flows with `estudos/<track>/` for notes, `estudos/<track>/registro.md` (or `estudo-registro.md`) for errors, and `estudos/certificacoes/sessoes/` for session notes.
2. **`wiki/README.md` and `wiki/_log/errors.md` present** → **running**. Read `wiki/README.md`, `wiki/_meta/roadmap.md` if it exists, `wiki/_meta/overlap.md` if it exists, then the last ~30 lines of `wiki/_log/errors.md`. If the roadmap is missing, write it (Flow 1 steps 5–6) without re-interviewing.
3. **Otherwise** → **bootstrapping**. Flow 1.

Never skip that read. Skipping it produces a duplicate note, a second wiki inside a vault that already has one, or a question the user already answered.

## Flow 1 — Bootstrap

Run once, on an empty or near-empty **canonical** repository.

1. **Interview.** Do not scaffold first. Questions in [`references/interview.md`](references/interview.md), one batch, defaults for skips.
2. **Write the profile** to `wiki/_meta/profile.md`: exam codes, dates, official domain weights, **official question count and timebox in minutes**, daily budget, language. Look the duration up from the vendor guide; mark `unverified` rather than guessing.
3. **Scaffold** exactly as [`references/repo-scaffold.md`](references/repo-scaffold.md). Create no directory you are not about to fill.
4. **Seed the domain skeleton** in `wiki/README.md` — official weights, empty bullets. Wrong weights silently corrupt every report that follows.
5. **Write the overlap table** to `wiki/_meta/overlap.md` from [`references/overlap.md`](references/overlap.md). Rank by shortest active exam, then least mastery.
6. **Write the roadmap** to `wiki/_meta/roadmap.md` from [`references/roadmap.md`](references/roadmap.md): session table, `S0` diagnostic that reorders `S1+`, gates with **both** outcomes, parked and trigger sections. Dates live only in this file.
7. **Propose the loop**, do not install it. Tasks in [`references/scheduled-tasks.md`](references/scheduled-tasks.md). Recommend two. A firing session calls the Skill tool with `"teach-me"`.
8. **Report** paths and one next action: sit `S0`, or send the first source.

Default if they demand all exams in parallel and official domain order: activate the booked exam, or else the shortest; park the rest with a decision date; put `S0` first. Say that in one line.

## Flow 2 — Ingest a study source

1. Orient.
2. Store the raw source, unedited, at `sources/<YYYY-MM-DD>-<slug>.md` with the frontmatter in [`references/note-template.md`](references/note-template.md). Do not summarize a source.
3. `grep` concepts against `wiki/README.md` and `wiki/` before writing.
4. Write or rewrite the notes the source touches. New information **rewrites**; it does not append an "Update YYYY-MM" section.
5. Link a bullet under the right domain in `wiki/README.md`; ≥2 outgoing wiki-links per note.
6. If the note is a concept two exams share, add or update its row in `wiki/_meta/overlap.md`.
7. Report paths.

Threshold for a new note: the concept spans two or more sources, or is central to one.

## Flow 3 — Study session

Call the Skill tool with `"teach-me"` and stop this flow.

If teach-me is not installed, run [`references/question-loop.md`](references/question-loop.md) against the overlap table and `wiki/_log/errors.md`, **one active exam**, no parked slice.

## Flow 4 — Capture from the day

One-line raw entry in `wiki/_buffer/capture.md` with a timestamp. The evening pass routes each line into the right note as a generalized scenario and empties the buffer. No client names, account identifiers, real cost figures, or production log excerpts.

## Flow 5 — Weekly review

Compare notes and errors per domain against official weights in the profile. Name the single most imbalanced **active** domain. Check gates in the next seven days from the roadmap and put a due gate in the first line. Sum the week's score, name the best day, never present a day without entries as a failure. Formula: [`references/logs-and-scoring.md`](references/logs-and-scoring.md).

## Flow 6 — Lint

Checklist: [`references/lint.md`](references/lint.md). Also: roadmap dates not copied elsewhere; overlap ranks still match the sort key; parked exams have no session slice. Confirm before changing ten or more files.

## Rules that hold across every flow

- **Never edit a file under `sources/`.** A correction becomes a derived note.
- **Every note carries frontmatter** with `id`, `title`, `category`, `certs`, `last_updated`. Content edits move `last_updated`.
- **Wiki-links are `[[Note_Id]]`**, matching the target's `id`. A link to a removed file becomes plain text, not a dead link.
- **Two outgoing links minimum** per note. A note absent from `wiki/README.md` is invisible.
- **A note over ~200 lines gets split.** Index, logs, overlap, roadmap and question banks are registers and are exempt.
- **Scoring is positive-only.** A missed day is fewer points, never a broken streak.
- **The user reads their own notes.** An unread note is inventory.
- **Dates live in `wiki/_meta/roadmap.md` only.**

## Done-check

- [ ] Every file written has valid frontmatter with today's `last_updated`.
- [ ] Bootstrap produced `wiki/_meta/overlap.md` (ranked rows) and `wiki/_meta/roadmap.md` (sessions, `S0`, gates with both outcomes, park/trigger for every inactive exam).
- [ ] Every new note is linked from `wiki/README.md` under the correct domain, and has ≥2 outgoing links.
- [ ] No study session was run from this skill while teach-me was available (the Skill tool was called with `"teach-me"` instead).
- [ ] No answer key was sent before the user's attempt.
- [ ] Nothing personal, client-identifying, or cost-real entered the repository.
- [ ] The report lists created and updated files by path, and names one next action.

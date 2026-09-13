# Scheduled tasks — the daily loop

The system works without any of this; someone who opens a session and says "quiz me" is running **teach-me** (or Flow 3 of study-wiki if teach-me is not installed). Scheduling exists to remove the one step that actually fails: remembering to start.

**Propose, do not install.** Show the user the tasks, recommend two, and create only what they ask for. Eight scheduled tasks on day one is eight notifications muted by day four.

## The shape: one act, two scenes

**Opening** (start of the working day) — play, score, study. Three to five questions drawn from the weak spots, answered in the time it takes to make coffee.

**Closing** (end of the working day) — what stuck. Reads the buffer, routes it, or asks once and lets it go.

That is the whole ritual. It has a beginning and an end, it is under ten minutes, and it survives a bad week because nothing in it can break.

## Writing a scheduled prompt

Each firing starts a **fresh session with no memory of this conversation**. Every prompt must therefore be self-contained: name the repository, name the files to read, name the files to write, and state the edge cases literally. A scheduled prompt that says "continue where we left off" does nothing.

Times below are placeholders — set them from the user's stated timezone and daily budget, and convert to whatever the scheduler expects (usually UTC).

---

## Task 1 — Opening (recommended, start here)

> You are the study agent for the `<repo>` repository. Call the Skill tool with `"teach-me"` if it is installed and run that session. If it is not: read `wiki/_meta/roadmap.md` (gates in the next seven days first), `wiki/_meta/overlap.md`, and `wiki/_log/errors.md`. Pick ONE topic — overlap rank, then most recent misses — on the **active** exam only. Generate <N> multiple-choice questions in `<CODE>` exam style about that topic, each with a capitalized qualifier in the stem (`MOST cost-effectively`, `LEAST operational overhead`, or the equivalent for this exam), and with at least two technically plausible options. Send the questions **without the answer key** — the key comes only after the user answers. Once they answer: grade each question, explain what every wrong option was testing, state the trap in one line, append one line per miss to `wiki/_log/errors.md` under today's date heading (the belief that was wrong, plus a `[[Note_Link]]`), and append the score to `wiki/_log/score.md` (+10 per correct, +5 bonus for a correct answer in a weak domain, nothing subtracted for a miss). Create today's date heading in either file if it does not exist. If the user does not answer within the session, write nothing to either log.

## Task 2 — Closing (recommended, the other half)

> You are the study agent for the `<repo>` repository. Check `wiki/_buffer/capture.md` for entries dated today. If there are any: summarize them back in one or two sentences, route each into the note where it belongs as a real-world scenario, append +5 points per capture to `wiki/_log/score.md`, and empty the buffer only after confirming the notes were written. If there are none: ask once, lightly — "anything worth keeping from today?" — and if there is no answer, or the answer is no, end the session without insisting, without rescheduling the question, and **without recording the absence anywhere**. A day without a closing is a day with fewer points, not a failure. Never write a line that represents an absence.

## Task 3 — Weekly report (add after two weeks of data)

> Read `wiki/_meta/profile.md`, `wiki/_meta/roadmap.md`, `wiki/_meta/overlap.md`, `wiki/_log/errors.md`, `wiki/_log/score.md`, `wiki/_log/decisions.md`, and the note list under each track in `<repo>`. If a gate falls in the next seven days, it is the first line. Compare notes and errors per exam domain against the official weights in the profile, and name the single most imbalanced **active** domain. Compute readiness per domain with the formula in the study-wiki skill and rank the domains by it. Sum this week's points and name the best day; never present a day without entries as a gap. Close with exactly one recommended focus for next week (the next overlap row, not a parked exam) and an offer to call the Skill tool with `"teach-me"` on it. Keep it short enough to read on a phone.

## The rest — only if the first three stick

| Task | Cadence | What it does |
|---|---|---|
| **Spaced review** | 2× per week | Three questions drawn only from `errors.md` entries older than a week and not re-tested. Same trap, new scenario. |
| **Graph hygiene** | weekly | Runs the lint checklist, fixes what is unambiguous, reports the rest. |
| **Buffer flush** | daily | Only needed when the repository is not always reachable from the capture device — drains an external buffer into the repo, then clears it, in that order, never the reverse. |
| **Release radar** | weekly | Checks for vendor changes that invalidate a note; marks the note stale rather than rewriting it unattended. |
| **Exam countdown** | one-shot, on booking | Works backwards from the booked date: weekly milestones and a plan for the untouched domains. |

## Rules for any scheduled task

- **Never send the answer key with the questions.** The single rule most easily lost when a prompt is rewritten for a scheduler.
- **Never write a line that records an absence.** Not in the score log, not in the report, not in a comment.
- **Check the calendar if you can.** A packed morning means three questions instead of five, or a skip. A system that ignores the user's day becomes a notification they swipe away.
- **One channel.** Questions arrive where the user actually answers. A second channel doubles the noise and halves the responses.
- **Write nothing on no response.** A fired task that got no answer leaves the repository exactly as it found it.

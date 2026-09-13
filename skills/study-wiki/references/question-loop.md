# The question loop

The reason the repository exists. Notes record the material; this loop records **the user**. A study repo that knows the syllabus but not its owner's gaps is a textbook with extra steps.

Three entry points, one exit: every wrong answer becomes a line in `wiki/_log/errors.md` pointing at a note.

---

## Entry A — Generated batch (the daily default)

**1. Pick the topics — from the overlap table, then the errors, not from the notes.**

If `wiki/_meta/overlap.md` exists, take the top **active** row (parked exams out). The error log then steers *inside* that topic — most recent misses, longest without review — not onto a second exam.

If the overlap table does not exist, rank `wiki/_log/errors.md` by, in order:
1. missed in the last 14 days, more than once;
2. missed once, never re-tested since;
3. covered by a note but never tested at all;
4. longest since last review.

Take **one** overlap row (or two or three error-log themes *inside* that row). Do not spread five questions across five topics — a batch that touches everything diagnoses nothing.

**2. Write the questions in the exam's real shape.**

- The exam's own format: single-answer multiple choice, multi-select with the count stated ("Choose TWO"), or scenario-based, whichever the target exam uses.
- A scenario stem, not a definition prompt. "A company needs X under constraint Y" — never "What is service Z?".
- **The qualifier in caps, verbatim in the exam's language**: `MOST cost-effectively`, `LEAST operational overhead`, `MOST resilient`. This is the discriminator and the single most transferable exam skill.
- **Two plausible options.** At least two should be technically correct solutions to the stated problem; only one satisfies the qualifier. Distractors that are simply wrong teach nothing.
- Difficulty calibrated to the last batches: hovering near 80% correct means step up; under 50% means the topic needs a note before it needs a question.

**3. Send them with no answer key.**

The key does not appear in the same message as the questions, not even collapsed, not even at the bottom. If a channel cannot hold a message back, send the questions and hold the key until the user replies.

**4. Take the answers, then grade.**

Per question: correct letter, one line on why it wins the qualifier, and one line per wrong option on what it was actually testing. The wrong-option analysis is where the learning is — a user who knows why B was a trap will not fall for its cousin on the exam.

End every batch with the **trap**: the one word or phrase in the stem that decides the answer, stated as a rule they can carry. *"`in the order received` ⇒ FIFO. `massive throughput, order irrelevant` ⇒ standard."*

**5. Log the gaps.** See "Recording difficulties" below.

**6. Bank the batch** at `wiki/questions/<exam>-batch-NN.md`:

```markdown
---
id: Exam_Batch_01
title: "<CODE> — Batch 01 (Questions 1–15)"
category: "<track>"
certs: ["<CODE>"]
last_updated: YYYY-MM-DD
---

# <CODE> — Batch 01 (Questions 1–15)

## Answer key

| # | Theme | Answer | Qualifier (the trap) | Note |
|---|---|---|---|---|
| 1 | <theme> | **A** | `MOST cost-effectively` | [[Topic_Name]] |

---

## Q1 — <short title of the scenario>

**Answer: A** — <the solution in one line>

**Why:** <the mechanism that makes it win>

**Wrong options:**
- **B** — <what it was testing, why it loses>
- **C** — <…>
- **D** — <…>

**Trap:** <the discriminating word, generalized into a rule>
```

Number batches sequentially and never rewrite a banked batch. It is the record of what was asked and what was understood at that date.

**7. Score it** — [`logs-and-scoring.md`](logs-and-scoring.md).

---

## Entry B — The user pastes questions

They found a question dump, a practice exam, a screenshot.

**Ask for their answers first.** One line: *"send your answers before I give the key — otherwise the repo learns the content but not your gaps."* If they already saw the key, ask which ones they got wrong from memory; a self-reported miss is worth more than no miss at all.

Then: grade, explain, log, bank. Same as Entry A from step 4. Store the raw dump under `sources/` if it is worth keeping; the reasoning goes in the bank, not in the source.

If the pasted questions have no official answer key, say so and mark your key `reasoned, not authoritative` in the bank. Do not present a derived answer as vendor truth.

---

## Entry C — Spaced review

Twice a week, three questions, drawn only from `wiki/_log/errors.md` entries older than a week and not re-tested since. Not new material: the same conceptual trap in a different scenario. If they get it right, the entry is closed — append `resolved YYYY-MM-DD` to the line rather than deleting it, so the history of what used to be weak survives.

---

## Recording difficulties

This is the step everything else feeds on. Skipping it makes the whole system a quiz generator.

For each wrong answer, append one line to `wiki/_log/errors.md` under today's date heading:

```markdown
## 2026-09-02
- Missed: <the conceptual error, in the user's own terms — what they believed that was false>
  → [[Topic_Name]]
```

The rules that make this file useful:

- **Record the belief, not the letter.** "Chose C" is unusable in a month. "Treated intermittent `AccessDenied` as a networking problem instead of an authorization one" regenerates a question on its own.
- **One line, one note link.** The line points at the note; it does not restate the note. If no note exists, that absence *is* the finding — say so and create the note.
- **Do not clean it up.** Append-only, newest under a new date heading. The value of the file is that it is long.
- **A near-miss counts.** "Got it right but guessed between two" is a gap. Log it with `— guessed` so review picks it up.
- **The user's own report counts.** "I never understand X" typed in chat is an entry, with no question attached.

Beyond a certain size, roll `errors.md` over to `errors-YYYY.md` and keep the current year live — but not before ~500 lines. It is supposed to get long.

---

## Anti-patterns

- **Answer key in the same message as the questions.** Destroys the retrieval effort, which is the only part that builds memory.
- **Questions on what was just written.** Testing the note you wrote ten minutes ago measures your short-term memory, not your readiness.
- **A batch every hour.** It becomes noise in three days and the user turns off everything, including what was working.
- **Breakable streaks.** Punishing absence makes the day after a missed day the hardest one to come back to. Points only accrue.
- **Grading without the wrong-option analysis.** The letter is not the lesson.

# Logs, scoring and the weekly report

Four registers. Each has a fixed line format and is append-only — new entries under a new date heading, existing entries never rewritten and never reformatted.

## `wiki/_log/errors.md`

The diagnostic spine. Format and rules in [`question-loop.md`](question-loop.md#recording-difficulties). Everything downstream — topic selection, spaced review, the weekly report — reads this file. If it is empty, the loop is running blind.

## `wiki/_log/score.md`

The motivational counter, deliberately separate from the diagnostic one.

```markdown
## 2026-09-02
- Morning: 5 questions, 4 correct, 2 in a weak domain → 40 + 10 = 50 pts
- Evening: 2 captures logged → 10 pts
Total: 60 pts
```

Scoring:
- **+10** per correct answer.
- **+5 bonus** per correct answer in a domain currently marked weak — facing the weak spot is worth more than confirming the strong one.
- **+5** per capture logged.
- **Nothing subtracted, ever.** A wrong answer scores zero; it does not cost points.
- A day with one line, or no lines, is a day with fewer points. It is never a zero to display, never a broken streak, and never recorded as a failure anywhere.

The score answers "did I show up". Readiness answers "am I prepared". Keep them apart: a low readiness with a high score is exactly the signal that someone is doing the right work on a hard domain.

## `wiki/_log/decisions.md` (only when capture is on)

One entry per real decision made at work that maps to the exam. Newest on top.

```markdown
## 2026-09-02 — Single shared gateway vs. one per zone
Context: non-production environment, cost under pressure.
Decision: single gateway, documented single point of failure accepted.
Link: [[Topic_Name]] — contrast with the production pattern (Q14, batch 01).
```

Two returns: an exam scenario the user has actually lived, and, over time, material worth writing about publicly. Generalized on the way in — see the redaction rule below.

## `wiki/_buffer/capture.md` (only when capture is on)

Raw one-liners with a timestamp, dropped in during the day from any device. The evening pass reads it, routes each line into the note where it belongs as a real-world scenario, and **empties the buffer**. Capture ugly, consolidate clean — a user who tries to format at capture time stops capturing by week two.

### Redaction rule — applies to the buffer and the decision log alike

Never: a client or employer name, an account identifier, a real cost figure, a production log excerpt, a hostname, or anything that identifies a person. Generalize before it enters the repository: not *"the client's account spent $12k on egress"*, but *"saw egress dominate the bill on a dev environment"*. The architectural pattern is what the exam tests; the name and the number are not.

Rule of thumb: if the sentence would be awkward read aloud to a stranger at a conference, it needs another pass before it lands in the repo.

---

## Readiness per domain

Computed for the weekly report from `errors.md` and the note list:

```
readiness(domain) = 0.5 × (1 − recent_errors(domain) / total_recent_errors)
                  + 0.3 × note_coverage(domain)
                  + 0.2 × review_recency(domain)
```

Precision is not the point — surfacing the weakest domain visibly is. Present it as a ranked list with the number attached, never as a single overall "you are 73% ready", which is both unfalsifiable and demotivating.

## Weekly report

1. Read `errors.md`, `score.md`, `decisions.md`, and the note list per track.
2. Compare the distribution of notes and errors per domain against the official weights in `wiki/_meta/profile.md`. Name **the single most imbalanced domain** — if a domain is 30% of the exam and 5% of the activity, that gap is the whole report.
3. Sum the week's points and name the best day. Days without entries are not counted for and never counted against.
4. Recommend exactly one focus for the coming week, and offer to generate the batch that starts it.
5. When a date is booked, state the weeks remaining and whether the current pace covers the untouched domains before it.

Keep it short enough to read on a phone. A weekly report nobody reads is a scheduled task that will be deleted.

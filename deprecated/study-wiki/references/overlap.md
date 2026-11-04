# Overlap table — `wiki/_meta/overlap.md`

The ranking the session runner reads. Write it in Flow 1 after the domain skeleton, rewrite it when a diagnostic lands or a credential is parked. One file. Other files link here; they do not copy the ranks.

## What a row is

One examinable concept, not one vendor service name and not one official domain. A domain becomes several rows when the exam guide names distinct mechanisms (IAM policies vs. SCP vs. permission boundaries are three rows). A mechanism that two guides both list is **one** row with two exam codes.

Do not invent overlap. A row's `exams` list is only the codes whose **current official guide** names that concept. If you are not sure, leave the second code off and mark the row `unverified`.

Cap: about thirty rows. Merge before you exceed it. Unique low-weight trivia of a parked exam does not get a row.

## File

```markdown
---
id: Overlap
title: "Cross-exam overlap"
category: "meta"
certs: ["<CODE>", "..."]
last_updated: YYYY-MM-DD
---

# Cross-exam overlap

Active exams, shortest first: `<CODE> (<n> min)` · `<CODE> (<n> min)`
Parked / trigger-inactive: `<CODE>` — ignored by the sort until reopened.

Sort key, in order: shortest active exam that lists the topic → lowest mastery → highest weight on that exam → highest overlap with later exams (bonus only). Weakness never steals another exam's slice.

| Rank | Topic | Exams | Shortest active (min) | Domain / weight | Mastery | Next session |
|---:|---|---|---:|---|---|---|
| 1 | <concept> | `<CODE>`, `<CODE>` | 90 | Application Development / 30% | gap | S1 |
| 2 | <concept> | `<CODE>` | 90 | Governance / 8% | untested | S2 |
```

`Next session` is the session id from `wiki/_meta/roadmap.md` (`S0` is the diagnostic; content starts at `S1`). Fill it when the roadmap is written; leave `—` only for parked rows.

## Mastery values — exactly these four

| Value | When |
|---|---|
| `untested` | No error-log line and no session has exercised it |
| `gap` | An open miss or a declared "I never understand X" |
| `stale` | Last miss or review older than 14 days, no re-test |
| `evidenced` | Practiced in-session with an artifact, or a miss later marked `resolved` |

Reading a note is not `evidenced`. A quiz score is `gap` or `stale`, never `evidenced`. Seed every row `untested` at bootstrap, then `gap` for any weakness the user already named in the interview.

## Sort — run it, do not vibe it

Drop every row whose exams are all parked or trigger-inactive.

On what remains, sort by:

1. **Ascending** duration in minutes of the shortest **active** exam that lists the topic. Official timebox from the profile. Booked date does not change duration; it changes which exams are active.
2. **Ascending** mastery: `untested` (0), `gap` (1), `stale` (2), `evidenced` (3). Least mastery first.
3. **Descending** official weight of that topic's domain on that shortest exam.
4. **Descending** count of exams (active **or** later) that list the topic. This is a bonus so one session pays a future credential. It is not permission to open a second syllabus.

Default when two rows tie on all four: keep the one whose active exam is booked sooner; if neither is booked, keep the lower official domain number.

## Adjacent vs unrelated

Two exams may share a **session** only when the topic on the table lists both codes. The session is still one topic. An IAM row that lists only `SAA-C03` does not get a Databricks appendix "so they feel progress".

Unrelated syllabi in the same week are serialized, or one of them is parked. Overlap near zero means the pairing costs context-switching and buys nothing.

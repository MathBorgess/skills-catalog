# Roadmap — `wiki/_meta/roadmap.md`

The canonical calendar. Session dates, gates, parks and triggers live **only here**. Track READMEs and the index link to this file; they do not repeat dates. A calendar copied into three files is wrong in two of them.

Write it in Flow 1 after [`overlap.md`](overlap.md). Rewrite it when a gate fires or the user parks a credential. Do not silently slide dates.

## Which exams are active

1. A **booked** date makes that exam active, and it wins over a shorter unbooked exam.
2. Among unbooked exams the user still wants: the **shortest official timebox** is active first (cadence — something lands). Look up question count and minutes from the vendor guide when writing the profile; mark `unverified` rather than guessing.
3. Everything else is **parked** or a **trigger**, written in the sections below. Inactive exams consume **no session slice**, not even "light theory".

Default if the user said "all of them in parallel": activate the shortest (or the booked one), park the rest with a decision date, and say so in one line. Two unrelated syllabi in the same week is the failure this file exists to prevent.

## File

```markdown
---
id: Roadmap
title: "Study roadmap"
category: "meta"
certs: ["<CODE>", "..."]
last_updated: YYYY-MM-DD
---

# Study roadmap

**Active:** `<CODE>` — <name>, <booked date or "unbooked, shortest remaining">
**Daily budget:** <minutes>, <when>, <timezone>
**Session size:** one topic, sized to that budget.

The diagnostic (`S0`) reorders `S1+`. Studying official domain order before `S0` is the wrong default.

## Sessions

| Id | Window | Exam | Topic (overlap rank) | Domain |
|---|---|---|---|---|
| S0 | <first session date> | `<CODE>` | Diagnostic — timed, no new content after it starts | all |
| S1 | <date> | `<CODE>` | <topic from overlap rank 1> | <domain> |
| S2 | <date> | `<CODE>` | <topic from overlap rank 2> | <domain> |

Empty windows are rows with `Id` blank, `Window` filled, `Topic` = `empty — <competing commitment>`. Write them on purpose. Do not pack study into a month the user said is already taken.

## Gates

| Date | Gate | If it passes | If it fails |
|---|---|---|---|
| <date> | Timed official practice exam, once, ≥70% | Keep the booked date | 60–70%: the next written window decides. <60%: move to the already-written fallback date, declared that day |
| <date> | Exam | Credential in hand | Sit the fallback date; next sessions are error-driven, no new syllabus |

Every gate has **both** outcomes written before anyone sees the score. A gate with only the happy path is a wish. You never move a date yourself: a failed gate produces the consequence already in this table, plus one line in `wiki/_log/errors.md` or the weekly report.

The official practice exam (or the closest vendor-calibrated timed set) is used **once**. Opening it early "just to see" spends the only instrument that can reorder `S1+`.

## Parked

| Exam | No date | No slice | Decision date | Cost of parking |
|---|---|---|---|---|
| `<CODE>` | yes | yes | <date already on a calendar> | <one line: what this credential was buying> |

Parking is real only with all three: no exam date, no share of any session, one day when it is reopened, re-parked, or dropped. Without the decision date, parking is abandonment.

## Triggers

| Exam | Fires when | Window | Ceiling | Cancels when |
|---|---|---|---|---|
| `<CODE>` | <fact, written before it happens> | <dates it would occupy> | <e.g. zero dedicated study / one weekend including prep> | <fact that kills it> |

A trigger waits on a **fact**. A park waits on a **decision**. "We'll see later" is neither. The cheapest window for an overlapping credential is immediately after the heavy exam it shares topics with — recall decays; the same paper that costs one sitting in that window costs a dedicated block months later.

## Cadence credentials

A short foundational exam (about 90 minutes or less) that overlaps the active exam may sit as a trigger after it, under a hard ceiling: if prep grows past one weekend it is cut, not promoted into a second block.
```

## How to fill the session table

1. Put `S0` on the first session that fits the daily budget. It is a diagnostic in the **active** exam's real format, spread across domains, no answer key in the same message. Its result **rewrites the rank column** in the overlap table and restamps `S1+` topics. Do not skip `S0` because the user "already knows" their weak spots — that claim is what `S0` exists to falsify.
2. Fill `S1+` by walking the overlap sort ([`overlap.md`](overlap.md)) one row per session. One topic per session. Size the count of sessions to `(days available before the next gate) × (sessions per week the budget allows)`.
3. Leave competing months empty when the user named them.
4. If a date is pulled earlier, name in the weekly report which empty window or slack paid for it. Pulling a date with no named slack is not allowed.

## Running a repo that already exists

If `wiki/_meta/profile.md` exists and this file does not, write this file from the profile and the overlap table. Do not re-interview. Do not re-scaffold.

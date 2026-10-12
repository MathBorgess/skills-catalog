# Session — what you produce

A session is one topic, one mode, one visible result. The user **consumes** an HTML lesson ([`lesson.md`](lesson.md)). You **record** a markdown session note and ledger lines. It is not a mission interview and not two syllabi.

If study-wiki is installed and overlap or roadmap files are missing, call the Skill tool with `"study-wiki"` only to write those files, then continue this session. Theory-mode questions follow the rules below (exam format, qualifier in caps, no key in the same message). Do not call study-wiki to run the session itself.

## 1. Orient

Read the layout table in [`layouts.md`](layouts.md). Then read, in order: roadmap (or track README gates), overlap table (or rank live), last ~30 lines of the active error ledger, the topic note if it exists.

If a **gate falls in the next seven days**, that fact is the first line of your first message, before the topic.

## 2. Pick the topic

One row from the overlap sort (study-wiki `references/overlap.md`): shortest active exam → least mastery → highest domain weight → overlap with later exams as a bonus.

- Parked and trigger-inactive exams contribute **zero** rows.
- The error ledger steers **inside** that row's domain, not across exams.
- User-named topic: take it if it is on an active exam; if it is parked, say so in one line and run the top active row instead, unless they repeat the parked request after that line — then run it, record that they overrode the park, and name the cost to the active exam in the session note.
- Default against "cover both certs today": one topic whose overlap row lists both codes, or else only the active exam.

## 3. Declare, then run

Send this table **before** the HTML lesson:

| Field | Content |
|---|---|
| Topic | <overlap row> |
| Why | shortest active exam + mastery value + error-log pointer |
| Mode | `practice` when the environment is in this sitting; otherwise `theory` |
| Hypothesis | the misconception you expect |
| Success | observable: ≥n/m without the mix-up, or a named artifact |
| Artifact | lesson HTML path + session note path + ledger lines |
| Failure to provoke | one thing that should break or be distinguished |

Then write the HTML ([`lesson.md`](lesson.md)) with its resume brief ([`resume.md`](resume.md)) and open it if you can. One line in chat: the path, that Check hides the key until they tap it, and that **Copy resume prompt** gives them a prompt to paste here or in any other session (a bare `n/m` also works).

**Practice:** environment is here. HTML is the briefing (steps, platform names, checkpoints). Evidence is still a config, query, denial, or trace they produce. No finished notebook in the HTML.

**Theory:** environment is not here, or they only have a phone / a short window. HTML quiz, 5–8 questions, qualifier in caps, two plausible options, **no answer key in this chat message**. At least one negative stem when that exam uses them.

Do not interview for a life mission. The roadmap already has the reason. Three clarifying questions at the top of a 45-minute session is a failed session. A missing console is not a failed session — it is `theory`.

## 4. After they answer

Grade. For each miss: the winning qualifier, what every distractor was testing, the trap as a one-line rule. For practice: mechanism, observed failure, how it shows up on the exam. End with **Contents to study aside** — what this session exposed that does not fit in the correction.

A pasted `teach-me resume` prompt is the main input: its brief replaces the conversation you did not see. Resolve every **Doubt / attention** note as [`resume.md`](resume.md) says — source first, then note edit, `lacuna`, `erro`, or Contents to study aside.

A tally they send from the phone (`4/6`, "errei a 2 e a 5") is a real session result. Grade from that. Do not wait for a desktop write-up.

## 5. Write

**Session note** at the layout's session path:

```markdown
---
id: Session_YYYY_MM_DD_<slug>
title: "Session YYYY-MM-DD — <exam> <domain>"
category: "session"
certs: ["<CODE>"]
last_updated: YYYY-MM-DD
---

# Session YYYY-MM-DD — <exam> <domain>

**Mode:** practice | theory · **Result:** evidenced | partial | blocked | theory <n>/<m>
**Override:** none | parked topic at user's repeat

## Why this topic
<one paragraph: overlap rank, mastery, error pointer, gate if any>

## Declaration
| Field | Content |
|---|---|
| Topic | |
| Why | |
| Mode | |
| Hypothesis | |
| Success | |
| Artifact | |
| Failure to provoke | |

## Result
<what happened>

## Correction
<conceptual misses>

## Contents to study aside
- <item>

## Next
<the next overlap row, or the gate>
```

**Error ledger:** one line per conceptual miss, append-only, belief not letter, pointer to a note. Create the note if it is missing. Type the line as `erro` / `lacuna` / `teoria` when the foreign ledger uses that column; otherwise use study-wiki's `Missed:` form.

**Score** (canonical layout): +10 per correct, +5 bonus in a weak domain, +5 per routed capture, nothing subtracted.

**Overlap:** bump that row's mastery. **Index / hub:** link the session. Foreign vault: one append-only line in `wiki/log.md` when that file exists.

No response in-session: write nothing. A skipped session is not a ledger event.

## Mode labels

`practice` and `theory` are different counters. Reading logged as practice is the most damaging entry in the system. An unavailable environment is `blocked` or a declared `theory` session, never a conceptual miss.

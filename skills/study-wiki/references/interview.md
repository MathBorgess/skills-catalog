# Interview — the questions to ask before scaffolding anything

Ask these in **one batch**, not one at a time. The user is trying to start studying, not fill in a form. Accept partial answers and apply the stated default for anything skipped. Total time to answer: under two minutes.

## The batch

**1. Which certifications are you going for, and in what order?**
Ask for the exam code, not just the vendor name — `SAA-C03`, `CKA`, `AZ-104`, `CCNA`, `Security+`. The code determines the domain list, the weights and the question style. If they name only a vendor, offer the two or three current exam codes for that vendor and let them pick.
*No default.* This is the one question you cannot answer for them; if it goes unanswered, ask again before scaffolding.

**2. Is a date already booked, or is it a target?**
A booked date turns on the countdown and makes the weekly report work backwards from it. A vague "in a few months" is fine — record it as a target and say so.
*Default:* no date; plan forward instead of backward, and revisit when they book.

**3. What is your starting point on each exam?**
Working professionally with the material, some exposure, or from zero. This sets the opening question difficulty and whether the first weeks are note-building or question-drilling.
*Default:* some exposure — start with a diagnostic batch of ten questions spread across all domains and calibrate from the result.

**4. How much time per day, and when?**
Minutes, and roughly when in the day. This sizes the morning batch (three questions or five) and sets the cron for the loop. Ask for their timezone here — every scheduled task needs it, and asking later means asking twice.
*Default:* 15 minutes in the morning, 5 in the evening, five questions per batch.

**5. What language should the notes be in?**
The exam is usually in English, and the qualifier wording (`MOST cost-effectively`, `LEAST operational overhead`) must stay verbatim in the exam's language whatever else you do. Notes and explanations can be in the user's language.
*Default:* notes in the user's language, question stems and qualifiers verbatim in the exam's language.

**6. How do you want to receive the questions?**
In the chat session, a push notification, an email, a file in the repo. This decides whether the scheduled tasks are worth setting up at all — a channel the user does not check is a loop that dies in week two.
*Default:* in the session, with scheduled tasks proposed but not created.

**7. Is there anything from your working day worth capturing?**
If they work with the material professionally, the capture buffer is the highest-value part of the whole system: an exam scenario you have actually lived is one you do not forget. If they do not, skip the buffer entirely rather than scaffolding an empty file.
*Default:* on, with the redaction rule stated explicitly.

## After the answers

Write `wiki/_meta/profile.md`:

```markdown
---
id: Profile
title: "Study Profile"
category: "meta"
certs: ["<CODE>", "..."]
last_updated: YYYY-MM-DD
---

# Study Profile

| Field | Value |
|---|---|
| Certifications | `<CODE>` — <name>, target <date or "unscheduled"> |
| Starting level | <per exam> |
| Daily budget | <minutes>, <when>, <timezone> |
| Batch size | <n> questions |
| Language | notes in <lang>, stems in <lang> |
| Delivery | <channel> |
| Capture buffer | on / off |

## Exam domains and weights

### `<CODE>` — <exam name>
| # | Domain | Weight |
|---|---|---|
| 1 | <domain> | <n>% |
```

Fill the domain table from the vendor's official exam guide. If you are not certain of the current weights, say so in one line and mark the table `unverified — confirm against the vendor exam guide` rather than inventing percentages. Wrong weights silently corrupt every weekly report that follows.

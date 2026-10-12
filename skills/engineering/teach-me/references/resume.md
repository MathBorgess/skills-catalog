# Resume prompt — the lesson carries its own handoff

The agent that builds the lesson knows why this topic, what the user already confused, and what was left open. The agent that grades it may be another session, another provider, a week later. The lesson HTML carries that context as a **brief**, and `quiz.js` turns brief + answers + notes into a prompt the user copies.

## What the page does

- **Theory:** after Check, every question gets a **Doubt / attention** note — open on wrong answers, collapsed on right ones. The user can annotate question by question.
- **Practice:** every `ol.steps > li` gets **What I observed** and **Doubt / attention**.
- Answers and notes persist in `localStorage`, keyed by the lesson path.
- **Copy resume prompt** builds, on tap: `teach-me resume`, the brief, then `## Result` — score, every wrong or unanswered question and every right one with a note (full stem, marked option, correct option, trap, note). Practice lists the steps that have notes.
- Labels follow `<html lang>` (`pt` or `en`, English fallback). You do not write the result block; the script does.

## Writing the brief

Put it in the lesson, right before `</article>`, written in the lesson's language from **your summary of this conversation**. At most ~15 lines of content. It is a brief, not a transcript.

```html
<script type="text/plain" id="resume-brief">
## Brief
Lesson: <repo-relative HTML path> · <CODE> · <domain> · <theory|practice> · YYYY-MM-DD
Layout: canonical | foreign

### Declaration
| Field | Content |
|---|---|
| Topic | |
| Why | |
| Hypothesis | |
| Success | |
| Failure to provoke | |

### Context from the session that built this lesson
- <confusions the user already named, in their words>
- <constraints or preferences that change the grading>
- <what was asked and left open>

### Paths
- Topic note: <path>
- Error ledger: <path>
- Session note to create: <path>
- Primary source: <URL>

### Instructions for the next agent
1. If the teach-me skill is available, run its resume mode. Otherwise follow these steps.
2. Theory: for each wrong answer, give the winning qualifier, what each distractor was testing, and the trap as a one-line rule. Practice: mark `evidenced` only when "What I observed" holds a config, query, denial, or trace; otherwise `partial` or `blocked`.
3. For each "Doubt / attention" note, check the primary source first:
   - the topic note is imprecise or incomplete and the source confirms it → edit the note and cite the source;
   - the source does not confirm it → one `lacuna` line in the ledger, no edit;
   - the user's reasoning was wrong → one `erro` line in the ledger;
   - it is only something to watch → "Contents to study aside" in the session note.
4. Write the session note (Why this topic, Declaration, Result, Correction, Contents to study aside, Next) and one append-only ledger line per conceptual miss.
5. End with one next action.
</script>
```

No secrets, no account identifiers, no pasted transcript. Paths are repo-relative. If `</script>` would appear in the text, rephrase it.

## Resume mode

A message whose first line is `teach-me resume` is a session result. Skip Orient, Pick and Declare. Detect the layout, read the paths in the brief, then run step 4 and 5 of [`session.md`](session.md), resolving each note as instruction 3 above says. Never edit a wiki note on the user's word alone.

A pasted prompt with no notes and a perfect score still gets a session note. A tally sent in chat without the prompt (`4/6`) is still a valid result: grade from what you have.

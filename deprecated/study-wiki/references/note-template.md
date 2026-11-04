# Note and source templates

Two shapes only: an immutable source, and a compiled note. Everything in the repository is one or the other.

## Source — `sources/<YYYY-MM-DD>-<slug>.md`

```markdown
---
source_url: <url, or "pasted by the author", or "photo — <what of>">
ingested: YYYY-MM-DD
certs: ["<CODE>"]
---

# <what this is>

<the raw content, pasted verbatim>
```

Never edited after it lands. A mistake in a source is corrected in the note that derives from it, with the correction stated: the source said X, X is wrong because Y.

## Compiled note — `wiki/<track>/<slug>.md`

```markdown
---
id: Topic_Name
title: "Topic Name"
category: "<track>"
certs: ["<CODE>"]
last_updated: YYYY-MM-DD
---

# Topic Name

## 1. Overview and key concepts
<The mechanism: how the thing actually works, and the problem it solves. Lead with what the exam
tests, not with the vendor's marketing definition. A comparison table earns its place here whenever
the exam distinguishes between sibling options — the table is usually the highest-value block on
the page.>

## 2. Architecture and patterns
<Where it sits relative to everything else. A Mermaid diagram when the sequence or the topology is
the thing being tested; skip it when it would only redraw a bullet list.>

## 3. Trade-offs and limits
- **Cost:** <what drives the bill, and the lever that reduces it>
- **Performance:** <latency, quotas, throttling, and the symptom each produces>
- **Security:** <the authorization model, and the intersection that actually grants access>
- **Limits:** <hard numbers the exam asks about>

## 4. Exam relevance
**`<CODE>` — classic traps:**
- <the distinction the exam keeps testing, phrased as the discriminating word in the stem>
- <the option that is technically valid but loses to the qualifier, and why>

## 5. Related
- [[Another_Note]]
- [[A_Third_Note]]
```

### Rules

- **`id` is the wiki-link target.** `Topic_Name` in the frontmatter means every link is `[[Topic_Name]]`, exactly. Rename a note and you rewrite every link to it in the same change.
- **Minimum two outgoing links.** A note with no links is a note outside the graph, and the graph is the point.
- **`last_updated` moves on every content edit.** A stale date is what the lint pass uses to find rotting notes.
- **Section 4 is not optional.** It is the difference between an encyclopedia entry and a study note. If you cannot write it, the topic is not exam-relevant and probably should not be a note.
- **Rewrite, never append.** New information about a covered topic rewrites the section it belongs to. Two contradictory paragraphs in one note is worse than either paragraph alone.
- **Under ~200 lines.** Past that, split by subtopic and cross-link. Index, logs and question banks are exempt.

## Log entries

The three logs have fixed line formats, specified in [`logs-and-scoring.md`](logs-and-scoring.md). They are append-only registers, not prose — never rewrite an existing entry, and never reformat the file to "clean it up".

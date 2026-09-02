# Repository scaffold

What Flow 1 creates, and nothing more. Every file listed here gets real content on creation — a header, its format contract, and the marker comment new entries go under. A file that only says "to be filled later" is scaffolding debt; leave it out until it has a first entry.

## Layout

```
CLAUDE.md                       # operating rules for this repo (see below)
README.md                       # what this repo is, for a human arriving cold
sources/                        # immutable raw study material, one file per ingest
wiki/
  README.md                     # the index: domains, weights, one bullet per note
  _meta/
    profile.md                  # certifications, dates, weights, budget, language
  _log/
    errors.md                   # one line per wrong answer → topic note
    score.md                    # append-only daily points
    decisions.md                # real decisions made at work, generalized  (only if capture is on)
  _buffer/
    capture.md                  # raw one-liners awaiting routing            (only if capture is on)
  questions/
    <exam>-batch-01.md          # created by the first question batch, not at scaffold time
  <track>/                      # one directory per certification track
```

**Track directories** are named for the subject, not the exam code, because two exams often share a subject: `aws/`, `kubernetes/`, `networking/`, `security/`. A cross-cutting track for material that belongs to two exams at once is fine (`integrations/`), but create it when the first note needs it.

## `wiki/README.md`

The index. It is the first thing read in every session, so it is dense and it is complete.

```markdown
---
id: Index
title: "Knowledge Graph Index"
category: "meta"
certs: ["<CODE>"]
last_updated: YYYY-MM-DD
---

# Knowledge Graph Index

Entry hub. Every compiled note is listed below under its exam domain with a one-line descriptor. A note missing from this file is a note nobody will find. Notes follow the template in `CLAUDE.md`; links use `[[Note_Id]]`.

## 1. <Exam name> — `<CODE>`

### Domain 1 — <name> (<weight>%)
- [[Note_Id]] — <the keywords the note actually covers>

### Domain 2 — <name> (<weight>%)
_(no notes yet)_

## 2. Question banks
- [[Exam_Batch_01]] — <n> questions (<themes>)

## 3. Meta
- [[Profile]] — certifications, dates, domain weights, daily budget

## 4. Conventions

- **Wording qualifier:** most exam stems carry a qualifier that is the real discriminator (`MOST cost-effectively`, `LEAST operational overhead`). Two options are usually technically valid; only one satisfies the qualifier.
- **Managed-service rule:** `LEAST operational overhead` almost always eliminates options with self-managed servers, custom agents or manual steps.
- <add one convention per recurring trap you find; this section is where exam pattern recognition accumulates>
```

The descriptor after each bullet is not decoration — it is what makes `grep` on this one file a substitute for reading the whole wiki.

## `CLAUDE.md` in the generated repo

The generated repo gets its own operating rules so any model opening it later behaves the same, with no skill installed. Write it with: the orientation order (`CLAUDE.md` → `wiki/README.md` → topic note → last 30 lines of `errors.md`), the note template, the frontmatter contract, the wiki-link convention, the immutability of `sources/`, the rewrite-don't-append rule, the redaction rule, and the lint checklist. Keep it under 150 lines; it is read in full every session.

## `README.md` in the generated repo

For a human arriving cold, or a future employer looking at it. What the repo is, which exams it targets, how the loop works in five lines, and how to run it (install the skill, or paste `CLAUDE.md`). No study content.

## Order of creation

1. `wiki/_meta/profile.md` — everything else derives from it.
2. `wiki/README.md` with the full domain skeleton and empty domain sections.
3. `wiki/_log/errors.md` and `wiki/_log/score.md` with their format contracts.
4. `wiki/_buffer/capture.md` and `wiki/_log/decisions.md` — **only if** the user said capture is on.
5. `CLAUDE.md` and `README.md`.
6. `sources/` and the track directories — created when the first file lands in them, not before.

Commit once, with a message naming the exams. Then report the paths and ask for the first study source or run the diagnostic batch.

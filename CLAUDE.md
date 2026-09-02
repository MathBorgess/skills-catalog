# skills-catalog — conventions

This repository is a catalog of skills. Each skill is a folder of markdown that a model reads in order to operate a workflow. Nothing here executes; the instructions are the product.

## Layout

```
skills/<skill-name>/
  SKILL.md          # required — frontmatter + the workflow
  references/*.md   # optional — depth loaded on demand
```

One skill per directory. Directory name is the skill name: lowercase, hyphenated, no version suffix.

## SKILL.md

Required frontmatter:

```yaml
---
name: study-wiki
description: <one paragraph, third person, written for the moment of triggering>
metadata:
  author: Matheus Borges
  version: 1.0.0
---
```

`name` matches the directory name exactly. `metadata.author` is the person who wrote the skill — it travels with the file when someone copies the folder into their own project, and a contributed skill keeps its contributor's name, not the repository owner's. `metadata.version` is semantic and is bumped by the change, not by the calendar: patch for a clarification or a fixed typo, minor for a new step or a new reference file, major when the workflow changes shape or the files it writes are renamed. Bumping the version means updating the row in `README.md` in the same commit.

The `description` is the only part of a skill a model sees before deciding to load it. Write it as a trigger, not a summary: name the situations, the artifacts and the words a user would actually say. "Helps with studying" triggers on nothing. "Use when the user wants to build or run a personal study repository for a certification exam — bootstrapping the wiki, ingesting practice questions, logging wrong answers, scheduling the daily loop" triggers on the real request.

Body rules:

- **Fits on two screens.** A skill that has to be read in full at the start of a session cannot be a manual. Push templates, literal prompts and long checklists into `references/` and link them by repo-relative path.
- **Imperative and ordered.** Numbered steps the model performs, not prose about the philosophy. Where a decision is judgment-based, say what to weigh and give the default.
- **Ends with a done-check.** The last section is what has to be true before the model reports completion.

## Writing rules

- **One job per skill.** If the description needs an "and also", it is two skills.
- **Concrete over clever.** Every instruction should produce the same shape of output across two different models on two different days. File paths, section names and frontmatter fields are spelled out, never implied.
- **No dead scaffolding.** Do not create a directory holding only a README that explains it is empty, a `.gitkeep`, or a "for later" placeholder. If it has no content, it does not exist yet.
- **No personal data.** Skills are public and generic. No employer names, client names, account identifiers, absolute paths from someone's machine, or real cost figures. A skill that only makes sense with its author's biography is a case study, not a skill.
- **English.** Skills in this catalog are written in English, including file and section names, even when the workflow they describe produces notes in another language.

## Adding a skill

1. Read this file and one existing skill end to end before writing.
2. Create `skills/<name>/SKILL.md` against the rules above.
3. Add a row to the catalog table in `README.md`. A skill missing from that table is a skill nobody will find.
4. Keep reference files to one concern each, named by what they answer (`question-loop.md`, not `part-3.md`).

## Do not

- Do not add build tooling, CI, or code to a catalog of markdown until a skill actually needs it.
- Do not maintain a second index. `README.md` is the catalog.
- Do not append "Update YYYY-MM" sections to a skill. Rewrite the instruction; git holds the history.

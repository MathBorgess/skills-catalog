# skills-catalog — conventions

This repository is a catalog of skills. Each skill is a folder of markdown that a model reads in order to operate a workflow. The instructions are the product; the plugin, npm package, and link script are how those folders get onto a machine.

The catalog is written by **Matheus Borges**. Packaging (plugin manifests, install scripts, version sync) and some skill patterns were inspired by [Matt Pocock's skills](https://github.com/mattpocock/skills).

## Layout

```
skills/<skill-name>/
  SKILL.md              # required — frontmatter + the workflow
  agents/openai.yaml    # required — Codex picker metadata
  references/*.md       # optional — depth loaded on demand
  scripts/*.mjs         # optional — deterministic steps, zero dependencies
hooks/hooks.json        # plugin root — hooks any skill here ships
```

One skill per directory. Directory name is the skill name: lowercase, hyphenated, no version suffix.

A skill may ship `scripts/` when a step is **procedure, not judgment**: arithmetic, probing, spawning, polling, scoring. Prose that asks a model to execute a procedure pays tokens every run and is obeyed probabilistically; a script does it once, for free, the same way every time. Keep the markdown for what needs a model and move the rest. Scripts are Node ESM, standard library only, and must run from a plugin install path.

A rule the model is asked to *follow* is guidance; a rule a hook can *refuse* is enforcement. When a skill has a rule that matters and keeps being dropped under pressure, it belongs in `hooks/hooks.json` at the plugin root. Because those hooks run in every session that has the plugin installed, a hook must be **inert unless its skill is actively running**, and must exit 0 (allow) on any error of its own.

Install commands for consumers live in [`.agents/install-block.md`](.agents/install-block.md). Change that file first, then `README.md`.

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

`name` matches the directory name exactly. `metadata.author` is the person who wrote the skill — it travels with the file when someone copies the folder into their own project, and a contributed skill keeps its contributor's name, not the repository owner's.

`metadata.version` is the last version **published on `main`**. It is semantic, not a calendar stamp: patch for a clarification or a fixed typo, minor for a new step or a new reference file, major when the workflow changes shape or the files it writes are renamed. The bump describes the *cumulative* delta since the previous `main` version, not each staging edit.

Do not bump during brainstorming, tests, or work on a branch. The only commit that may change `metadata.version` (and the matching `README.md` catalog row) is the one that publishes the skill onto `main`. A skill that has never been on `main` stays at `0.0.0` until that first publish, which sets `1.0.0`.

The `description` is the only part of a skill a model sees before deciding to load it. Write it as a trigger, not a summary: name the situations, the artifacts and the words a user would actually say. "Helps with studying" triggers on nothing. "Use when the user wants to build or run a personal study repository for a certification exam — bootstrapping the wiki, ingesting practice questions, logging wrong answers, scheduling the daily loop" triggers on the real request.

Body rules:

- **Fits on two screens.** A skill that has to be read in full at the start of a session cannot be a manual. Push templates, literal prompts and long checklists into `references/` and link them by repo-relative path.
- **Imperative and ordered.** Numbered steps the model performs, not prose about the philosophy. Where a decision is judgment-based, say what to weigh and give the default.
- **Ends with a done-check.** The last section is what has to be true before the model reports completion.

Invocation rules: [`.agents/invocation.md`](.agents/invocation.md). Default is model-invoked.

## Writing rules

- **One job per skill.** If the description needs an "and also", it is two skills.
- **Concrete over clever.** Every instruction should produce the same shape of output across two different models on two different days. File paths, section names and frontmatter fields are spelled out, never implied.
- **No dead scaffolding.** Do not create a directory holding only a README that explains it is empty, a `.gitkeep`, or a "for later" placeholder. If it has no content, it does not exist yet.
- **No personal data.** Skills are public and generic. No employer names, client names, account identifiers, absolute paths from someone's machine, or real cost figures. A skill that only makes sense with its author's biography is a case study, not a skill.
- **English.** Skills in this catalog are written in English, including file and section names, even when the workflow they describe produces notes in another language.

## Adding a skill

1. Read this file and one existing skill end to end before writing.
2. Create `skills/<name>/SKILL.md` against the rules above.
3. Add `skills/<name>/agents/openai.yaml` (`interface.display_name`, `interface.short_description`).
4. Add a row to the catalog table in `README.md` at version `0.0.0`. A skill missing from that table is a skill nobody will find. Leave the number at `0.0.0` until the commit that publishes it to `main`.
5. Append `"./skills/<name>"` to the `skills` array in `.claude-plugin/plugin.json`.
6. Keep reference files to one concern each, named by what they answer (`question-loop.md`, not `part-3.md`).
7. Run `npm run check`. It must pass before you report the skill added.
8. Open a pull request against `main`. Do not push to `main`. Direct pushes are blocked.

## Release

Package version (`package.json`) and plugin version (`.claude-plugin/plugin.json`) move together on a catalog release. Skill `metadata.version` is independent: it still only changes in the commit that publishes that skill to `main`, even if the package version stays put or moves on a different cadence.

Bump versions on a branch, open a PR, merge. Merging to `main` publishes `@mathborgess/skills-catalog` to GitHub Packages.

```bash
git checkout -b release/x.y.z
npm version patch   # or minor / major — syncs plugin.json and commits
git push -u origin HEAD --follow-tags
```

Then merge the PR. After merge: `claude plugin tag --push`.

Do not `git push origin main`. See [`.agents/adr/0002-prs-only-on-main.md`](.agents/adr/0002-prs-only-on-main.md).

## Do not

- Do not add a second catalog index. `README.md` is the catalog; `plugin.json` is the ship list and must match it (`npm run check`).
- Do not append "Update YYYY-MM" sections to a skill. Rewrite the instruction; git holds the history.
- Do not bump `metadata.version` or the README catalog version except in the commit that publishes that skill to `main`.
- Do not document install commands anywhere except by copying [`.agents/install-block.md`](.agents/install-block.md).

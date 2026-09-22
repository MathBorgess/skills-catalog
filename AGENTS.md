# skills-catalog — conventions

A public catalog of agent skills by **[Matheus Borges](https://github.com/MathBorgess)**. Each skill is a folder of markdown a model reads to run a workflow: what to ask, what to write, where to write it, and what to check before it says it is done. The instructions are the product; the plugin, npm package, and link script are how those folders get onto a machine.

**This file is the contract, for every agent working in this repository.** Claude Code, Codex, Cursor and anything else read the same rules from here. [`CLAUDE.md`](CLAUDE.md) imports this file with `@AGENTS.md` and holds no rule of its own — there is one place to edit, and nothing to keep in sync.

Packaging (plugin manifests, install scripts, version sync) and some skill patterns were inspired by [Matt Pocock's skills](https://github.com/mattpocock/skills).

## Install (using the skills)

Pick **one**. Do not install the plugin and skills.sh into the same project.

**Claude Code — plugin**

```bash
claude plugin marketplace add MathBorgess/skills-catalog
claude plugin install skills-catalog@mathborgess
```

```
/plugin marketplace add MathBorgess/skills-catalog
/plugin install skills-catalog@mathborgess
```

**Cursor, Codex, and other agents — skills.sh**

```bash
npx skills add MathBorgess/skills-catalog
```

From GitHub Packages:

```bash
npx skills add npm:@mathborgess/skills-catalog
```

**This clone (maintainer)**

```bash
npm run link
```

That symlinks `skills/*` into `~/.claude/skills`, `~/.cursor/skills`, `~/.codex/skills`, `~/.agents/skills`, and `~/.gemini/config/skills`.

Canonical wording for those commands is [`.agents/install-block.md`](.agents/install-block.md): change that file first, then `README.md`. Changes reach `main` only through pull requests — do not push to `main`.

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

Between those two sits a third kind of step: **judgment that repeats**. It needs learning rather than a hand-written rule, but it does not need deliberation — which tier a task is, whether a goal needs a unix socket, whether a command's output must reach the model whole, whether a finished session deserves the owner's eyes. Written as prose it is paid for every run and obeyed probabilistically, which is the same failure procedure has; written as a rule it becomes a threshold somebody invented. It belongs to a **scorer**: a small local model that returns a typed decision with a calibrated probability, so an invalid answer cannot be produced rather than being filtered out. A scorer decides *who looks and what runs next* — never whether the work is correct, which stays with gates and review. Keep it behind the same script boundary as the rest: zero dependencies, fails open, and the rule it replaces stays as the floor.

A rule the model is asked to *follow* is guidance; a rule a hook can *refuse* is enforcement. When a skill has a rule that matters and keeps being dropped under pressure, it belongs in `hooks/hooks.json` at the plugin root. Because those hooks run in every session that has the plugin installed, a hook must be **inert unless its skill is actively running**, and must exit 0 (allow) on any error of its own.

## Two kinds of skill

A skill here is either an **operator** or an **experiment**. The difference is what it is for, never how well it is written, and both obey every other rule in this file.

**Operator.** A workflow you run to get work done, on work that keeps arriving. It earns its place by being reached for again, and it is generic by construction: it has to transfer to someone whose job is not yours.

**Experiment.** A workflow built to test an idea and come back with a measurement — about orchestration, judgment, compression, cost, taste. The finding is as much the deliverable as the artefact. It earns its place by answering something. Exactly three things differ:

1. **It names what it measures and leaves the number behind.** A metrics line, a score, a rank correlation — something a later run can be compared against. An experiment with no measurement is an operator skill with a hobby.
2. **It may be fixed to one subject.** An operator skill that only works for one axis, one exam, one repository is broken. An experiment may be exactly that narrow, because the subject is the controlled variable. The scope narrows; the privacy rule does not move. Still public, still no personal data, still nothing that only makes sense with its author's biography.
3. **It has an exit.** When the question is answered, the skill graduates into an operator skill, is folded into one, or leaves the catalog. An experiment nobody has run in months is not a finding, it is debris, and `skills-evaluate` is where that call gets made.

Mark the kind in the `README.md` catalog table. If you cannot tell which one you are writing, you are writing an operator skill: make it generic.

**An experiment skill is not a trial.** A **trial** lives in [`docs/experiments/`](docs/experiments/README.md), ships nothing, and is deliberately unreachable from `skills/` — a model must not find a checkpoint or an instruction to call one there. An **experiment skill** ships: it is installed, triggered and run like any other, and its measurement comes out of real runs rather than out of a bench. A trial decides whether something is worth building; an experiment skill is the thing built, kept honest by a number. One can become the other in either direction.

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
- **No personal data.** Skills are public and generic. No employer names, client names, account identifiers, absolute paths from someone's machine, or real cost figures. A skill that only makes sense with its author's biography is a case study, not a skill. An **experiment** may be fixed to one subject (above); it may never be fixed to one person.
- **English.** Skills in this catalog are written in English, including file and section names, even when the workflow they describe produces notes in another language.

## Adding a skill

1. Read this file and one existing skill end to end before writing.
2. Create `skills/<name>/SKILL.md` against the rules above.
3. Add `skills/<name>/agents/openai.yaml` (`interface.display_name`, `interface.short_description`).
4. Add a row to the catalog table in `README.md` at version `0.0.0`, naming its kind — `operator` or `experiment`. A skill missing from that table is a skill nobody will find. Leave the number at `0.0.0` until the commit that publishes it to `main`.
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

### Any change under `skills/` bumps the package version — enforced, not requested

`validate.yml`'s publish job runs on every push to `main`, but it only actually `npm publish`s when `package.json`'s version is not already on GitHub Packages (it checks with `npm view`). A PR that edits anything under `skills/` — a `SKILL.md`, a reference, a script — and merges without bumping `package.json` therefore merges cleanly and then **ships nothing**: the publish step sees a version it has already published and skips.

So this is not left to a contributor remembering it. `scripts/check-version-bump.mjs` runs as a required check on every pull request (`validate.yml`, the `check` job): it diffs the PR against its base branch, and if any file under `skills/` changed, it fails unless `package.json`'s version also changed. Bump with `npm version patch|minor|major` (see above) — that alone satisfies it, whether or not you also bump the specific skill's own `metadata.version` in the same PR.

## Do not

- Do not add a second catalog index. `README.md` is the catalog; `plugin.json` is the ship list and must match it (`npm run check`).
- Do not leave an experiment in the catalog after its question is answered. Graduate it, fold it in, or delete it.
- Do not append "Update YYYY-MM" sections to a skill. Rewrite the instruction; git holds the history.
- Do not bump `metadata.version` or the README catalog version except in the commit that publishes that skill to `main`.
- Do not document install commands anywhere except by copying [`.agents/install-block.md`](.agents/install-block.md).

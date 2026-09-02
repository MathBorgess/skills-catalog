# skills-catalog

A public catalog of Claude skills, written and maintained by **[Matheus Borges](https://github.com/MathBorgess)** — each one a self-contained instruction set that turns a model into an operator for a specific job.

A skill here is not a prompt you paste once. It is a folder of markdown a model reads to run a workflow the same way every time: what to ask, what to write, where to write it, and what to check before it says it is done.

Every skill in this catalog comes out of a workflow I actually run, distilled until nothing personal is left in it — the biography stays in my own repositories, and what ships here is the part that transfers to someone else.

## Catalog

| Skill | Version | What it does |
|---|---|---|
| [`study-wiki`](skills/study-wiki/) | 1.0.0 | Interviews you about the certifications you are chasing, then builds and operates a personal study repository: a knowledge graph of notes, a question bank, an error log, and a daily study loop that injects questions, grades your answers, and records where you are weak. |

## Using a skill

**Claude Code (project or personal skill)**

```bash
git clone https://github.com/MathBorgess/skills-catalog.git
mkdir -p .claude/skills                      # project-scoped; or ~/.claude/skills for every project
cp -r skills-catalog/skills/study-wiki .claude/skills/
```

Then start a session and type `/study-wiki`, or just say what you want — the skill's `description` is what makes the model reach for it on its own.

**Anywhere else (chat, Cowork, an API app)**

Paste the contents of the skill's `SKILL.md` as the opening message and let the model pull the `references/` files it names as it needs them. The skill is written so `SKILL.md` alone is enough to get started; the reference files are the depth.

## Anatomy of a skill in this catalog

```
skills/<name>/
  SKILL.md          # frontmatter (name, description) + the workflow, top to bottom
  references/       # the depth — loaded on demand, not up front
```

`SKILL.md` stays short enough to be read in full at the start of every session. Anything longer than a screen or two — templates, literal prompts, checklists — moves to `references/` and gets linked by path from `SKILL.md`.

Every `SKILL.md` carries its author and version in frontmatter, so a skill copied into someone else's project still says where it came from and which revision it is:

```yaml
---
name: study-wiki
description: <written for the moment of triggering>
metadata:
  author: Matheus Borges
  version: 1.0.0
---
```

Versions are semantic and are bumped by the change, not by the calendar: a patch for a clarification, a minor for a new step or reference file, a major when the workflow or the files it writes change shape.

## Contributing

Issues and suggestions are welcome. See [`CLAUDE.md`](CLAUDE.md) for the conventions a skill here has to meet — short version: one job per skill, a description written for the moment of triggering, `metadata.author` and `metadata.version` in the frontmatter, no dead scaffolding, and every instruction concrete enough that two different models produce the same shape of output.

Skills contributed by other people keep their own author in `metadata.author`; authorship travels with the skill, not with the repository.

## License

GPL-3.0 © Matheus Borges — see [`LICENSE`](LICENSE). Use them, fork them, adapt them to your own workflow; derived work stays under the same license.

# skills-catalog

A public catalog of agent skills by **[Matheus Borges](https://github.com/MathBorgess)**. Each skill is a folder of markdown a model reads to run a workflow: what to ask, what to write, where to write it, and what to check before it says it is done.

When you add or edit a skill in this repository, follow [`CLAUDE.md`](CLAUDE.md) — same layout, frontmatter, writing rules, plugin list, and release steps. Codex and Cursor read this file; Claude Code reads `CLAUDE.md`. The two must not disagree.

## Install (using the skills)

Pick **one**. Do not install the plugin and skills.sh into the same project.

**Claude Code — plugin**

```bash
claude plugin marketplace add MathBorgess/skills-catalog
claude plugin install skills-catalog@MathBorgess
```

```
/plugin marketplace add MathBorgess/skills-catalog
/plugin install skills-catalog@MathBorgess
```

**Cursor, Codex, and other agents — skills.sh**

```bash
npx skills add MathBorgess/skills-catalog
```

From npm:

```bash
npx skills add npm:@borgesmathai/skills-catalog
```

**This clone (maintainer)**

```bash
npm run link
```

That symlinks `skills/*` into `~/.claude/skills`, `~/.cursor/skills`, `~/.codex/skills`, and `~/.agents/skills`.

Canonical wording: [`.agents/install-block.md`](.agents/install-block.md).

## Layout

```
skills/<skill-name>/
  SKILL.md              # required — frontmatter + the workflow
  agents/openai.yaml    # required — Codex picker metadata
  references/*.md       # optional — depth loaded on demand
```

`name` in frontmatter matches the directory. Every skill is listed in `README.md` and in `.claude-plugin/plugin.json`. Run `npm run check` before you finish.

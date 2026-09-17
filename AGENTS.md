# skills-catalog

A public catalog of agent skills by **[Matheus Borges](https://github.com/MathBorgess)**. Each skill is a folder of markdown a model reads to run a workflow: what to ask, what to write, where to write it, and what to check before it says it is done.

When you add or edit a skill in this repository, follow [`CLAUDE.md`](CLAUDE.md) — same layout, frontmatter, writing rules, plugin list, and release steps. Codex and Cursor read this file; Claude Code reads `CLAUDE.md`. The two must not disagree.

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

Canonical wording: [`.agents/install-block.md`](.agents/install-block.md). Changes reach `main` only through pull requests. Do not push to `main`.

## Layout

```
skills/<skill-name>/
  SKILL.md              # required — frontmatter + the workflow
  agents/openai.yaml    # required — Codex picker metadata
  references/*.md       # optional — depth loaded on demand
```

`name` in frontmatter matches the directory. Every skill is listed in `README.md` and in `.claude-plugin/plugin.json`. Run `npm run check` before you finish.

Touching anything under `skills/` also requires bumping `package.json`'s version (`npm version patch|minor|major`) in the same PR — CI (`scripts/check-version-bump.mjs`) fails the PR otherwise, because a push to `main` only publishes to GitHub Packages when the version is new. Details: `CLAUDE.md` § Release.

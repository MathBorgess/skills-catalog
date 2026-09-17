# skills-catalog

A public catalog of agent skills, written and maintained by **[Matheus Borges](https://github.com/MathBorgess)** — each one a self-contained instruction set that turns a model into an operator for a specific job.

A skill here is not a prompt you paste once. It is a folder of markdown a model reads to run a workflow the same way every time: what to ask, what to write, where to write it, and what to check before it says it is done.

Every skill in this catalog comes out of a workflow I actually run, distilled until nothing personal is left in it — the biography stays in my own repositories, and what ships here is the part that transfers to someone else.

The plugin layout, install scripts, and some skill patterns were inspired by [Matt Pocock's skills](https://github.com/mattpocock/skills). The skills, the catalog, and the published packages are mine.

## Install

Pick **one** route. The Claude Code plugin is a managed bundle. skills.sh writes files you own and can edit. Installing both leaves every skill twice.

### Claude Code — plugin

```bash
claude plugin marketplace add MathBorgess/skills-catalog
claude plugin install skills-catalog@mathborgess
```

Or, from inside a session:

```
/plugin marketplace add MathBorgess/skills-catalog
/plugin install skills-catalog@mathborgess
```

This repo is its own marketplace (it is not on Anthropic's official listing). After a release, update with `claude plugin marketplace update mathborgess` and `claude plugin update skills-catalog@mathborgess`.

### Cursor, Codex, and other agents — skills.sh

From GitHub:

```bash
npx skills add MathBorgess/skills-catalog
```

From GitHub Packages ([`@mathborgess/skills-catalog`](https://github.com/MathBorgess/skills-catalog/pkgs/npm/skills-catalog)):

```bash
npx skills add npm:@mathborgess/skills-catalog
```

GitHub Packages needs a token even for a public package. Keep it in `~/.npmrc`, never in the repo:

```
@mathborgess:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

The repo `.npmrc` already maps the scope. npmjs.org still has [`@borgesmathai/skills-catalog`](https://www.npmjs.com/package/@borgesmathai/skills-catalog) from an earlier publish; new versions ship on GitHub Packages.

Pick the skills you want and which coding agents to install them on. Add `-g` for a user-wide install. One skill: append `--skill <name>`. Later: `npx skills update <name>`.

### This machine, while hacking on the catalog

```bash
npm run link
```

Symlinks every skill into `~/.claude/skills`, `~/.cursor/skills`, `~/.codex/skills`, `~/.agents/skills`, and `~/.gemini/config/skills`. Not the end-user installer.

Because those are symlinks into this working tree, **a `git pull` refreshes the content of every linked skill on its own** — the link points at the file that just changed. The one thing a pull cannot do by itself is link a skill that did not exist before, or drop one that was removed: that only happens when the script runs again.

So `npm run link` also points this clone's `core.hooksPath` at `.githooks` (only if nothing else claims it). From then on, `.githooks/post-merge` runs after a `git pull` on `main` and re-links **when that pull added or removed a skill**, staying silent otherwise:

```
skills-catalog: 1 skill(s) added or removed in this pull — local links refreshed.
```

To wire it without running the link script, or to check it is on:

```bash
git config core.hooksPath .githooks
git config --get core.hooksPath
```

Two things it deliberately does not cover: a pull on a branch other than `main`, and a **rebasing** pull (`pull.rebase=true`), which fires `post-rewrite` instead of `post-merge` — run `npm run link` by hand after one of those if the skill set changed.

## Catalog

| Skill | Version | What it does |
|---|---|---|
| [`handoff`](skills/handoff/) | 1.2.0 | Compacts a conversation into a session brief, or cuts remaining work into a dependency graph of parallel Cursor, Claude, Codex, and Antigravity sessions: it probes each provider\'s remaining plan quota (every window, and every lane a provider bills separately), refuses a cut whose sessions collide, assigns slots by refill rate rather than raw balance, dispatches and reroutes around a provider or lane that runs out, and scores what the run cost in quota. Ships a guard hook that blocks reading a live run's child logs and worktrees. |
| [`study-wiki`](skills/study-wiki/) | 1.0.0 | Interviews you about the certifications you are chasing, then builds and operates a personal study repository: a knowledge graph of notes, a question bank, an error log, and a daily study loop that injects questions, grades your answers, and records where you are weak. |
| [`teach-me`](skills/teach-me/) | 1.1.0 | Runs one study session against a wiki that already exists: a phone-sized HTML lesson plus a session note and error log. Not for bootstrapping an empty wiki — that is study-wiki. |
| [`shunt`](skills/shunt/) | 0.0.0 | Keeps a large model off heavy I/O: activate a guard that refuses full-file reads over a line/byte threshold and points the parent at an outline script or a small/fast subagent; boilerplate, config, and mechanical tests are spawned the same way and not read back. |

## Using a skill

After install, start a session and type `/handoff`, `/study-wiki`, `/teach-me`, or `/shunt`, or just say what you want — the skill's `description` is what makes the model reach for it on its own.

**Anywhere else (chat, Cowork, an API app)**

Paste the contents of the skill's `SKILL.md` as the opening message and let the model pull the `references/` files it names as it needs them. The skill is written so `SKILL.md` alone is enough to get started; the reference files are the depth.

## Anatomy of a skill in this catalog

```
skills/<name>/
  SKILL.md             # frontmatter (name, description) + the workflow, top to bottom
  agents/openai.yaml   # Codex picker metadata
  references/          # the depth — loaded on demand, not up front
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

`metadata.version` is the last version published on `main`. Staging edits, brainstorming and tests do not bump it. The publish commit is the only one that raises the number (and this table): `0.0.0` until the first publish (`1.0.0`), then patch / minor / major for the cumulative delta since the previous `main` version.

## Contributing

All changes land through **pull requests** against `main`. Direct pushes to `main` are blocked, including for admins. Branch, open a PR, wait for the **Catalog** check, merge.

Issues and suggestions are welcome. A new skill has to meet [`CLAUDE.md`](CLAUDE.md) (same rules in [`AGENTS.md`](AGENTS.md)). Short version: one job per skill, a description written for the moment of triggering, `metadata.author` and `metadata.version` in the frontmatter, an `agents/openai.yaml`, no dead scaffolding, and every instruction concrete enough that two different models produce the same shape of output.

Skills contributed by other people keep their own author in `metadata.author`; authorship travels with the skill, not with the repository.

### Add a skill

1. Read `CLAUDE.md` and one existing skill end to end.
2. Create `skills/<name>/SKILL.md` and `skills/<name>/agents/openai.yaml`.
3. Add a row to the catalog table above at version `0.0.0`.
4. Append `"./skills/<name>"` to `.claude-plugin/plugin.json` → `skills`.
5. Run `npm run check` and fix anything it reports.
6. Open a pull request against `main`. Do not push to `main`.

### Release (maintainers)

Package version and plugin version move together on a catalog release. Bump them **on the PR**, not on `main`. Skill frontmatter versions bump only in the commit that publishes that skill to `main`, for the cumulative work since the last published number.

```bash
git checkout -b release/x.y.z
npm version patch          # or minor / major — syncs plugin.json, commits, tags vX.Y.Z
git push -u origin HEAD --follow-tags
```

Open the PR, wait for **Catalog**, merge. Merging to `main` publishes [`@mathborgess/skills-catalog`](https://github.com/MathBorgess/skills-catalog/pkgs/npm/skills-catalog) to GitHub Packages if that version is not already there. Then:

```bash
claude plugin tag --push   # skills-catalog--vX.Y.Z for Claude Code
```

Claude Code users who already added the marketplace run `claude plugin marketplace update mathborgess` then `claude plugin update skills-catalog@mathborgess`.

To submit the plugin to Anthropic's community marketplace later, follow [Discover plugins](https://code.claude.com/docs/en/discover-plugins). Until that listing exists, the self-hosted marketplace commands above are the Claude install path.

## License

MIT © Matheus Borges — see [`LICENSE`](LICENSE). Use them, fork them, adapt them to your own workflow.

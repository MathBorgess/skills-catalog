# The canonical install block

One install story, one wording. `README.md` must say **this** and nothing else. Change it here first, then propagate.

This catalog is **not** in Claude Code's official marketplace. The repo is its own marketplace. GitHub-sourced marketplaces register locally under the GitHub **owner** (`MathBorgess`), not under `marketplace.json`'s `name`. The npm scope is `@borgesmathai`; the GitHub owner is `MathBorgess`.

The two consumer routes are exclusive: the plugin is a managed bundle; skills.sh writes files the user owns. Installing both leaves every skill twice — always say "pick one".

## Claude Code: the plugin

<canonical-block name="claude-code">

```bash
claude plugin marketplace add MathBorgess/skills-catalog
claude plugin install skills-catalog@MathBorgess
```

Or, from inside a session:

```
/plugin marketplace add MathBorgess/skills-catalog
/plugin install skills-catalog@MathBorgess
```

</canonical-block>

## Cursor, Codex, and other agents: skills.sh

The plugin is Claude Code only. Everywhere else, [skills.sh](https://skills.sh) copies skill files onto the machine.

Whole set — GitHub:

<canonical-block name="skills-sh-github">

```bash
npx skills add MathBorgess/skills-catalog
```

</canonical-block>

Whole set — npm (`@borgesmathai/skills-catalog`):

<canonical-block name="skills-sh-npm">

```bash
npx skills add npm:@borgesmathai/skills-catalog
```

</canonical-block>

One skill:

<canonical-block name="skills-sh-one-skill">

```bash
npx skills add MathBorgess/skills-catalog --skill <name>
npx skills add npm:@borgesmathai/skills-catalog --skill <name>
```

```bash
npx skills update <name>
```

</canonical-block>

Pick the skills and which agents to install them on. Global install: add `-g`.

## This machine (maintainer)

Symlink every skill into Claude, Cursor, and Codex user directories. A `git pull` refreshes them. Not the end-user story.

<canonical-block name="maintainer-link">

```bash
npm run link
```

</canonical-block>

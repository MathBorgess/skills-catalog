# The canonical install block

One install story, one wording. `README.md` must say **this** and nothing else. Change it here first, then propagate.

This catalog is **not** in Claude Code's official marketplace. The repo is its own marketplace. It is **added** by GitHub path (`MathBorgess/skills-catalog`, the owner's spelling) but **registers locally under `marketplace.json`'s `name`** — which is lowercase **`mathborgess`**. So every command that names the marketplace rather than the repo takes the lowercase form: `skills-catalog@mathborgess`, `marketplace update mathborgess`.

The npm package this repo publishes is **`@mathborgess/skills-catalog`** on **GitHub Packages** (the scope has to match the GitHub owner). `.npmrc` in the repo maps that scope. A copy already exists on npmjs.org as `@borgesmathai/skills-catalog@1.0.0`.

The two consumer routes are exclusive: the plugin is a managed bundle; skills.sh writes files the user owns. Installing both leaves every skill twice — always say "pick one".

## Claude Code: the plugin

<canonical-block name="claude-code">

```bash
claude plugin marketplace add MathBorgess/skills-catalog
claude plugin install skills-catalog@mathborgess
```

Or, from inside a session:

```
/plugin marketplace add MathBorgess/skills-catalog
/plugin install skills-catalog@mathborgess
```

</canonical-block>

## Cursor, Codex, and other agents: skills.sh

The plugin is Claude Code only. Everywhere else, [skills.sh](https://skills.sh) copies skill files onto the machine.

Whole set — GitHub (no registry token):

<canonical-block name="skills-sh-github">

```bash
npx skills add MathBorgess/skills-catalog
```

</canonical-block>

Whole set — GitHub Packages (`@mathborgess/skills-catalog`). GitHub requires a token even for public packages; put it in `~/.npmrc`, not in the repo:

<canonical-block name="skills-sh-npm">

```bash
npx skills add npm:@mathborgess/skills-catalog
```

```
@mathborgess:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

</canonical-block>

One skill:

<canonical-block name="skills-sh-one-skill">

```bash
npx skills add MathBorgess/skills-catalog --skill <name>
npx skills add npm:@mathborgess/skills-catalog --skill <name>
```

```bash
npx skills update <name>
```

</canonical-block>

Pick the skills and which agents to install them on. Global install: add `-g`.

## This machine (maintainer)

Symlink every skill into Claude, Cursor, Codex, and Antigravity / Gemini user directories. A `git pull` refreshes them. Not the end-user story.

<canonical-block name="maintainer-link">

```bash
npm run link
```

</canonical-block>

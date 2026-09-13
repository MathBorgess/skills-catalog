# PRs only on main

Direct pushes to `main` are blocked. Every change, including version bumps and releases, lands through a pull request.

## Why

`main` is what Claude Code marketplaces, GitHub Packages, and `npx skills add MathBorgess/skills-catalog` resolve. A push that skips review also skips the Catalog check and can publish a broken package.

## Rules

- Branch from `main`, open a PR, wait for the **Catalog** check, merge.
- Do not `git push origin main`. The repository ruleset rejects it, including for admins.
- Do not bump `package.json` / plugin version on a dirty branch that mixes unrelated work. One PR can still contain the skill change *and* its first `1.0.0` if that is the publish of that skill.
- Merging to `main` is what publishes `@mathborgess/skills-catalog` to GitHub Packages (if that version is not already there).

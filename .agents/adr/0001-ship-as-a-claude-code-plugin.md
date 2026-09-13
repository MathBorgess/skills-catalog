# Ship as a Claude Code plugin and an npm package

This catalog is written by **Matheus Borges**. The plugin layout, marketplace manifest, link script, and version-sync script were adapted from [Matt Pocock's skills](https://github.com/mattpocock/skills); the skills in `skills/` are this catalog's own workflows.

## Decision

- Ship a native **Claude Code plugin** (`.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json`). The repo is its own marketplace because it is not in Anthropic's official listing. Install wording: [install-block.md](../install-block.md).
- Publish **`@borgesmathai/skills-catalog`** on npm. Cursor, Codex, and other Agent Skills harnesses install via [skills.sh](https://skills.sh) from GitHub (`npx skills add MathBorgess/skills-catalog`) or from npm (`npx skills add npm:@borgesmathai/skills-catalog`).
- Do not ship a native Codex plugin. skills.sh already copies into Codex and Cursor directories. Revisit if Codex gains a skills array in `.codex-plugin/plugin.json` that matches this flat `skills/` layout.

## Invariants

- Every skill directory under `skills/` that contains `SKILL.md` has an entry in `.claude-plugin/plugin.json`'s `skills` array, a row in `README.md`, and `agents/openai.yaml`.
- `.claude-plugin/plugin.json`'s `version` tracks `package.json`'s version: bump both together on release (`npm version`, which runs `scripts/sync-plugin-version.mjs`). Claude uses the plugin `version` to decide when installed users see an update.

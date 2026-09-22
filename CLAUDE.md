# Claude entry point

@AGENTS.md

That import is the whole file. [`AGENTS.md`](AGENTS.md) is the single contract every agent in this repository works from — layout, when a step belongs to a script, a scorer or a hook, the two kinds of skill, `SKILL.md` frontmatter and body rules, the writing rules, how to add a skill, the release steps and the version-bump gate. Claude Code resolves the import and loads it here, so there is one file to edit and nothing to keep in sync.

If the import does not resolve in the harness you are running, open `AGENTS.md` yourself before any operation.

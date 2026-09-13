# Model-invoked vs user-invoked

Every `SKILL.md` in this repo is a skill. The one axis that splits them is **invocation**, who can reach it:

- **User-invoked**: reachable **only by the human typing its name**. Set `disable-model-invocation: true` in the frontmatter (Claude Code) and `policy.allow_implicit_invocation: false` in `agents/openai.yaml` (Codex). The `description` is **human-facing**: a one-line summary. Strip trigger lists ("Use when the user says…").
- **Model-invoked**: reachable by **model or user**. The default: omit `disable-model-invocation` and the `policy` block from `agents/openai.yaml`. The `description` is **model-facing** and keeps rich trigger phrasing so auto-invocation fires.

Each harness excludes a user-invoked skill from the model's reach in its own way. A user-invoked skill may invoke model-invoked skills; it can never reach another user-invoked skill.

Every skill carries an `agents/openai.yaml` beside its `SKILL.md`. It holds Codex UI metadata: `interface.display_name` and `interface.short_description`, and, for user-invoked skills, `policy.allow_implicit_invocation: false`. Keep the two in sync: a skill is user-invoked in both harnesses or neither.

## Dependencies between them

Dependencies are an explicit instruction to **call the Skill tool** with the named skill (`Call the Skill tool with "handoff"`), not deep `../other-skill/FILE.md` cross-references, and not a bare `/skill` mention left for the model to interpret. The Skill tool takes one skill per call. This only holds when the named skill is **model-invoked**.

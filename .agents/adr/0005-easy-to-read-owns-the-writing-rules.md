# easy-to-read owns the writing rules

The catalog adds an operator skill, `easy-to-read`. It applies explain-me's writing rules to every text that an agent writes for a person, for the rest of the session. The rules move into it: STE-lite, the language profiles for English and Brazilian Portuguese, and the linter with its profiles. The explain-me skill keeps a byte copy of each file, so it still installs and runs alone. This version ships no hook.

## Context

STE-lite, the two profiles and `ste-lint.mjs` came from explain-me. Inside explain-me they work: the skill lints every explanation, label and narration before it ships. Outside explain-me, nothing applies them. The owner wants the same plain language in every reply and every document that an agent writes for them, once they turn it on.

Three facts limit where the rules can live:

- **A skill must install alone.** skills.sh can install one skill. A plugin install puts each skill in its own folder. A path such as `../easy-to-read/scripts/ste-lint.mjs` is missing when only one skill is there. Also, [`.agents/invocation.md`](../invocation.md) does not allow deep cross-references between skills.
- **explain-me's scripts import the linter.** `explain.mjs voice` loads `ste-lint.mjs` from its own folder (`lazyLint`). `explain.mjs new` prints a lint command with that path. `explain.test.mjs` imports the file. If the file moves out, the CLI, its output and its tests break.
- **The rules are general.** STE-lite and the profiles say almost nothing about explanations. The only exceptions are a few words: "every explanation", "the requester language", and a path under `skills/explain-me`.

## Considered options

- **Move the rules, and let explain-me call easy-to-read through the Skill tool.** This keeps one copy. But the scripts of explain-me need the linter as a file, not as a skill. Also, explain-me stops working wherever easy-to-read is missing.
- **A shared folder at the repository root**, imported by both skills. This keeps one copy. But no install route ships a root folder with a single skill, and no skill owns that folder.
- **Keep the home in explain-me, and let easy-to-read point into it.** Nothing moves. But the general skill then depends on a video explainer, and it cannot install alone.
- **Canonical copy in easy-to-read, byte copies in explain-me.** Two copies sit on disk, with one source of truth. A contract test keeps them equal. `motion-identity` uses the same pattern for explain-me's YAML parser (ADR 0004, PR #64).
- **A hook that enforces the rules on every reply.** A hook refuses, where a skill only asks. But a hook runs in every session that has the plugin. It must stay inert unless the skill is active, and it must not loop on its own block. The owner has not decided on it yet.

## Decision

`skills/easy-to-read/` is the canonical home of six files. Three are references: `references/ste-lite.md`, `references/profile-en.md` and `references/profile-pt-br.md`. Three are scripts: `scripts/ste-lint.mjs`, `scripts/profiles/en.mjs` and `scripts/profiles/pt-br.mjs`. The explain-me skill ships a byte copy of each file, at the same relative path.

`easy-to-read/scripts/ste-lint.test.mjs` holds the full suite of the linter and a contract test. The contract test fails when a copy differs. It skips when no explain-me folder sits next to easy-to-read.

The linter and its profiles move without a change. The three references lose their explain-me words. "Every explanation" becomes "every text for a reader", "the requester language" becomes "the language of the text", and the command examples use `<skill>`. Both copies carry the new words.

When easy-to-read activates, it stays on for the rest of the session. It covers every reader text: chat replies, documents, notes, summaries, and PR and issue bodies. Code, commands, paths, identifiers, URLs, quoted text and fenced blocks are exempt spans. The agent lints documents and long replies before they ship. This version adds nothing to `hooks/hooks.json`.

## Consequences

- **explain-me behaves as before.** Its linter and profiles are byte-identical to the previous version. Its CLI, its lint calls, its output, its exit codes and its tests stay the same. Its SKILL.md gets one line that names the canonical home.
- **Two copies to keep equal.** Change the canonical copy in easy-to-read, then copy the file to explain-me. `npm run check` fails until the copies match. A skills.sh user who updates only one skill can hold two versions until the other skill updates too.
- **The suite runs twice.** The explain-me skill keeps its own `ste-lint.test.mjs`, so its copy gets a test where it ships. The easy-to-read skill runs the same suite on the canonical copy. It adds tests for exempt spans, for its own texts and for the copies.
- **Guidance, not enforcement.** The session-wide rule depends on the model. In a long task, a model can drop it. A `Stop` hook can enforce it later, inert unless the skill marks the session as active. That is the owner's decision.
- **The core is the floor for other languages.** A language without a profile gets the core rules only. These are the sentence and paragraph limits, the term lock and the narration rules.
- **Profiles grow in one place.** A new language profile goes into easy-to-read first. Then it goes to explain-me, with the linter and the contract list.

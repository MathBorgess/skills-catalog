# Create domain skill

| Surface | Status |
| --- | --- |
| Factory workflow, references and Codex metadata | Implemented on this branch |
| Generated-package checker | Implemented; structural checks only |
| Factory evaluation prompts | Authored; independent behavioral runs not performed |
| Live bot adapter | Produced per run only when a real platform is supplied; none activated here |

The [factory](../../skills/engineering/create-domain-skill/SKILL.md) creates a reusable activity skill and its working personality as one package. A model discovers the activity through its name and task description; practitioner influences stay inside its references. The profile informs evidence gathering, priorities and critique, rather than making a claim to be a real person.

```mermaid
flowchart LR
  A[Activity and acceptance criteria] --> B[Inspected practitioner work]
  B --> C[Conditional methods and working personality]
  C --> D[Activity-named skill package]
  D --> E[Structural and discovery checks]
  E --> F[Practical cases and baseline]
  F --> G[Complementary domain critiques]
  G --> H[Evidence, revision and delivery status]
```

## Decisions and boundaries

- The factory is model-invoked. Generated metadata keeps the same default in Claude Code and Codex; actual discovery also requires registration in the receiving host.
- The [package contract](../../skills/engineering/create-domain-skill/references/package-contract.md) defines the same deliverables across activities, including a portable personality and evaluation cases. Bot-specific adapters use an inspected platform schema and preserve existing permissions.
- [Research](../../skills/engineering/create-domain-skill/references/research.md) requires inspectable work, evidence of domain success and explicit limits. Reputation alone cannot justify a method or a result.
- [Evaluation](../../skills/engineering/create-domain-skill/references/evaluation.md) separates structural validity, observed discovery and domain performance. Complementary lenses apply documented criteria; they do not simulate independent human approval.
- The [source record](../../skills/engineering/create-domain-skill/references/sources.md) distinguishes the X inspiration from the validation design added here. Direct access to X was blocked; the matching indexed mirror does not independently confirm the status ID.

These are reversible workflow choices, so no architectural decision record was added. The existing glossary records the resolved activity/personality distinction.

## Validation evidence

The [checker tests](../../skills/engineering/create-domain-skill/scripts/check-package.test.mjs) run from `npm run check`. They exercise a valid synthetic package and reject missing files, inaccessible model invocation, missing reference links, malformed evaluation JSON, missing case kinds, duplicate case IDs, invalid trigger labels and duplicate trigger prompts. They also reject fixture path traversal and symlinks to files outside the package; the checker reads files and never runs their contents. A CLI invocation from an unrelated working directory and a flat symlink installation are covered.

These checks validate the generated contract's scalar metadata format and file structure, not arbitrary YAML syntax or the quality of a domain method. The synthetic test data deliberately makes no claim of expertise. Domain names, truth of citations, quality of methods and correct application of the profile remain evidence-based review tasks.

The [factory cases](../../skills/engineering/create-domain-skill/evals/evals.json) cover activity-first sales-copy creation, unavailable practitioner evidence, conflicting API-design advice, an existing bot adapter and a biography-only request. Their six trigger prompts cover task-based discovery and adjacent requests. These are an evaluation specification, not a completed independent benchmark. No domain improvement, real-host automatic selection or live bot behavior is claimed from the structural suite.

Before calling a generated activity validated, retain its actual outputs and both domain critiques using the evaluation reference. When that environment or evidence is unavailable, deliver the package as unvalidated with the missing checks identified.

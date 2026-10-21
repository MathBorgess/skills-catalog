# Build the installable package

Produce this directory. Fill every slot with activity-specific content; do not ship literal placeholders or copy the template's generic actions unchanged.

```text
<activity-name>/
  SKILL.md
  agents/openai.yaml
  references/methods.md
  references/personality.md
  references/review-rubric.md
  references/sources.md
  evals/evals.json
```

## SKILL.md

Use this shape, retaining the destination's author/version conventions:

```markdown
---
name: <activity-name>
description: "Use when <task situations, artifacts and realistic user phrases>. <Boundary that prevents an adjacent activity from triggering it>."
metadata:
  author: <package author>
  version: 0.0.0
---

# <Activity display name>

## Steps

1. Read [the working profile](references/personality.md) and [the methods](references/methods.md). Apply their priorities within the caller's constraints.
2. Collect <required activity inputs>. Handle missing <critical input> by <specific action>.
3. Perform <the actual activity's ordered decisions, with method IDs and conditions>.
4. Write <exact deliverables and their structure> to <the activity's output path>.
5. Review the result using [the rubric](references/review-rubric.md). Check facts against [the sources](references/sources.md) and task evidence. Revise blocking defects before delivery; otherwise report the unresolved limit.

## Done-check

- [ ] <Observable activity-specific result>.
- [ ] <Evidence and uncertainty requirement>.
- [ ] Both review lenses were applied and blocking defects were resolved or reported.
```

Keep the body short. The final generated workflow needs concrete domain steps, not merely "read the references and do the task". References provide depth; the skill must explicitly load the ones its decisions depend on. Tools and scripts must exist in the target environment or have a stated fallback. A dependency on another skill uses the harness's Skill tool and only a model-invoked dependency; do not deep-link into another installation.

## agents/openai.yaml

```yaml
interface:
  display_name: "<Activity display name>"
  short_description: "<The work and resulting artifact>"
```

Use the activity in all discovery metadata. Omit `disable-model-invocation` from the frontmatter and omit the `policy` block from the YAML. This preserves model and user invocation in this catalog's supported harnesses. Do not put a practitioner's name in a description as a prerequisite to discovery. Actual automatic selection still depends on the host registering the skill and matching its trigger.

## references/personality.md

Write these sections:

- **Role and mission**: the work, audience and result the agent owns.
- **Priorities**: ordered trade-offs, with method IDs; say what wins when two priorities conflict.
- **Working habits**: what to inspect, questions to ask, decisions to challenge and evidence to retain.
- **Voice**: useful communication traits, separate from correctness requirements.
- **Uncertainty and limits**: what to verify, when to request missing input and when to report an unresolved defect.
- **Practitioner influences**: source IDs and precisely which working habits were adapted.

Write a portable profile that can be loaded by the skill or incorporated into a bot's own instructions. It does not claim to be the real person, reproduce their private views or inherit their authority. It does not grant tool access. For a named bot platform, inspect its actual configuration format, add a scoped adapter at the user's destination, preserve unrelated instructions and document which profile sections it loads. Keep methods and rubric accessible through the installed skill; if the platform cannot load references, include the necessary rules and citations in the adapter. Do not invent platform keys or overwrite a live configuration just to create an example.

## Other references

- `methods.md`: the condition/action/check/exception/evidence table from the research step.
- `review-rubric.md`: the two complementary review lenses, observable criteria and blocking failure conditions.
- `sources.md`: inspectable source records, adaptations, evidence limits and provenance.

Keep personal briefs, execution transcripts, evaluation outputs and API credentials out of the reusable package. Include synthetic or public examples when needed. Add deterministic scripts only when an activity actually needs a repeatable procedure; use the destination's runtime and dependency rules.

## evals/evals.json

Author at least four practical cases using the following schema. `kind` is one of `normal`, `missing-input`, `conflicting-guidance` or `out-of-scope`; cover every kind. Use concrete prompts and evidence-based assertions. `files` is optional and contains package-relative fixture paths that exist.

```json
{
  "skill_name": "<activity-name>",
  "evals": [
    {
      "id": "normal-1",
      "kind": "normal",
      "prompt": "<A concrete assignment that never mentions a practitioner>",
      "expected_output": "<The useful domain result>",
      "assertions": ["<Observable result>", "<Evidence requirement>"]
    }
  ],
  "triggers": [
    { "prompt": "<Direct activity request>", "should_trigger": true },
    { "prompt": "<A paraphrase of the activity>", "should_trigger": true },
    { "prompt": "<Adjacent activity handled elsewhere>", "should_trigger": false },
    { "prompt": "<Biographical or role-play request>", "should_trigger": false }
  ]
}
```

The single case above illustrates a record, not a complete suite. Supply all four kinds and at least two positive and two negative trigger prompts. Every trigger prompt must be unique across both labels, including after trimming surrounding whitespace. Evaluation results belong in the workspace, not in this JSON. Run the factory's `scripts/check-package.mjs` against the filled directory. It checks this structural contract; it cannot establish expertise, source truth, trigger reliability or performance.

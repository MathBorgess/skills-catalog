# PR review evidence — trial v1

Status: trial prepared; operator skills implemented on this branch, not yet published.

The owner approved two generic operator skills:
- [PR Present](../../../skills/pr-present/SKILL.md) presents one PR in plain language.
- [PR Refine](../../../skills/pr-refine/SKILL.md) improves the presentation workflow with evidence and preserves lessons.

The trial draws on the RSI study direction and lessons from the closed factory experiment.
It does not reopen that experiment or transfer its results into this benchmark.
No private wiki content, identifiers, data, or paths ship here.
The skills never load this trial.

The pilot uses Pareto comparison before numeric weights.
Its real-data direction is a family-based split, pending grouping review and final-test custody.
Coverage floors and numeric promotion thresholds still need review.
See [the reward proposal](../../../skills/pr-refine/references/reward.md) before choosing weights or promotion thresholds.

## Question and arms

Can a reviewer understand the change faster while preserving correct decisions, material risks, and uncertainty?

| Arm | Input and output | Comparison |
| --- | --- | --- |
| A | Verified existing body, or a frozen task-only summary when that body is unavailable | Frozen baseline |
| B | First skill rewrites the review packet | B versus A |
| C | Second skill revises B after evidence-based critique | C versus B, also C versus A |

All arms receive the same diff, source evidence, and repository constraints.
The reviewer always has access to the diff and evidence.
The packet helps review; it cannot certify the code or authorize a merge.
Freeze the inputs, skill revisions, prompts, and acceptance plan before generation.
Capture generated packets and transcripts without editing them into an example that passes.

## C01: evaluation and quality of evidence

Read [protocol.md](protocol.md) for sampling, splits, acceptance, and measurement limits.
Read [private-data.md](private-data.md) for real-data acquisition and the offline task boundary.
Read [graders.md](graders.md) for deterministic checks, human labels, and the model-judge prompt.
[cases.json](cases.json) contains eight authored synthetic development cases.
Its source snippets and oracles test the evaluation design, not deployed software.
They cover bugs, documentation, missing evidence, migrations, secrets, conflicting logs, irrelevant changes, and misleading input.

The public cases are **never a holdout**.
A custodian must collect cases that remain unseen outside the repo before final evaluation.
Until then, holdout evidence, human calibration, professional evidence, and speed gains remain **unverified**.

## Run the measurement code

The code checks evidence links and computes counts from adjudicated observations.
It neither generates packets nor calls a model.
Tests use simulated observations, never real reviewer measurements.

```bash
node docs/experiments/2026-10-06-pr-review-evidence-v1/evaluate.test.mjs
node skills/pr-refine/scripts/evaluate.mjs \
  --cases docs/experiments/2026-10-06-pr-review-evidence-v1/cases.json \
  --run /external/run.json
```

The run schema appears in [graders.md](graders.md).
Exit `0` confirms that the script wrote a report, not permission to promote a skill.
Malformed input exits `2`; the report keeps a separate evidence status.
An empty run returns `unverified`, with null rates and explicit zero denominators.

## Sources and adaptations

- [Easy to Read](../../../skills/easy-to-read/SKILL.md): plain language, fixed terms, protected code spans, and a linter.
- [Warp core triage](https://github.com/warpdotdev/oz-for-oss/blob/a2bb45f231fd56ea28c1b381999d11b277a0b0e2/.agents/skills/triage-issue/SKILL.md): inspect evidence before asking for missing facts.
- [Warp local triage](https://github.com/warpdotdev/warp/blob/f571865ca3f2bd6e769867b468d620791865592a/.agents/skills/triage-issue-local/SKILL.md): separate observed behavior from suggested causes.
- [Grill With Docs](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/grill-with-docs/SKILL.md): interview plus durable documentation; confirmed design reference.
- [Anthropic's guide to agent evaluation](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents): combine graders and compare outcomes with transcripts.
- [NIST confidence intervals](https://itl.nist.gov/div898/handbook/prc/section2/prc241.htm): Wilson intervals for binary proportions.

The workflows here are original trial instructions, not copied upstream skills.
Factory-inspired safeguards keep author and evaluator separate, exercise failure paths, and reject vacuous success.
They do not import factory results as measurements of this trial.

## Completion boundary

Preparation ends with a reviewable protocol, public development cases, tested report code, and explicit evidence gaps.
The operator workflows exist; no behavioral gain has a completed evaluation.
Promotion waits for the evidence gate in the protocol.
No skill can load or invoke this trial: trials stay outside the installed catalog.

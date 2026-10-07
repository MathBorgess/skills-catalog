# PR review evidence — trial v1

Status: preparation only. Neither proposed skill ships in this PR.

The owner requested two skills for the review of pull requests (PRs).
The first presents a PR in plain language, based on `easy-to-read`.
The second improves that presentation and preserves what the review teaches.
These roles remain proposals until the transcription questions have answers.
The trial prepares their evaluation without rewards, automatic approval, or merge actions.

## Decisions still open

- Did the owner say **presentation** or **rewards**?
- Did the owner mean `grill-with-docs`?
- Does the second skill's proposed role match the owner's intent?
- Which experiment supplies the connection: the RSI study, factory lessons, or a new trial based on both?

The wiki inspection found two distinct routes.
The RSI/RRSI route is a study agenda, with unverified newsletter claims.
The owner closed experiment 04; its successor describes an ideal factory.
Those are context candidates, not evidence that these PR skills work.
No private wiki content, identifiers, data, or paths ship here.
No experiment outside this repository changes.

## Question and arms

Can a reviewer understand the change faster while preserving correct decisions, material risks, and uncertainty?

| Arm | Input and output | Comparison |
| --- | --- | --- |
| A | Existing PR body with the unchanged diff and evidence | Frozen baseline |
| B | Proposed first skill rewrites the review packet | B versus A |
| C | Proposed second skill revises B after evidence-based critique | C versus B, also C versus A |

All arms receive the same diff, source evidence, and repository constraints.
The reviewer always has access to the diff and evidence.
The packet helps review; it cannot certify the code or authorize a merge.
Freeze the inputs, skill revisions, prompts, and acceptance plan before generation.
Capture generated packets and transcripts without editing them into an example that passes.

## C01: evaluation and quality of evidence

Read [protocol.md](protocol.md) for sampling, splits, acceptance, and measurement limits.
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
node docs/experiments/2026-10-06-pr-review-evidence-v1/evaluate.mjs \
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
- [Grill With Docs](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/grill-with-docs/SKILL.md): interview plus durable documentation; the owner must confirm the reference.
- [Anthropic's guide to agent evaluation](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents): combine graders and compare outcomes with transcripts.
- [NIST confidence intervals](https://itl.nist.gov/div898/handbook/prc/section2/prc241.htm): Wilson intervals for binary proportions.

The workflows here are original trial instructions, not copied upstream skills.
Factory-inspired safeguards keep author and evaluator separate, exercise failure paths, and reject vacuous success.
They do not import factory results as measurements of this trial.

## Completion boundary

Preparation ends with a reviewable protocol, public development cases, tested report code, and explicit evidence gaps.
Implementation of the skills waits for the scope decisions above.
Promotion waits for the evidence gate in the protocol.
No skill can load or invoke this trial: trials stay outside the installed catalog.

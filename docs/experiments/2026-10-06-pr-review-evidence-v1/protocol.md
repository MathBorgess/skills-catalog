# Trial protocol

The protocol for the operators lives in [PR Refine's evaluation reference](../../../skills/pr-refine/references/evaluation.md).
The grader schema lives in [its observation reference](../../../skills/pr-refine/references/observations.md).
This trial tests those measurement procedures with public synthetic cases and private real acquisitions.

## ML split roles

| Split | Purpose | Allowed feedback | Boundary |
| --- | --- | --- | --- |
| Development | Instruction edits and visible regression | Full case feedback | No claim of unseen generalization |
| Validation | Candidate selection and grader calibration | Frozen rubrics and a preregistered candidate budget | Separate calibration from selection families |
| Final test | One evaluation of the selected frozen candidate | Custodian reports after freeze | Never tune on this set |

A holdout means the protected final test, not a random subset of cases already exposed to the author.
Group related PRs before splitting, then enforce temporal boundaries or quarantine groups that cross them.
The real acquisition has no final-test freeze yet.
Private storage in this work session alone does not establish independent custody.

## Historical baseline

For historical PRs without a verified original description, omit that description from every arm.
Use a frozen task-only summary prompt as A, with the same model, diff, and evidence budget as B and C.
B applies PR Present; C applies the selected refinement of its instruction.
This measures a new offline task; it does not reproduce the historical reviewer or identify the cause of historical delay.
For prospective snapshots, A can use the recorded existing description.
Keep baseline types as separate strata; do not pool their effects silently.

## Trial acceptance status

The pilot uses Pareto comparison and a family-based split direction.
Grouping exclusions and final-test custody need review before freeze.
Numeric weights, useful gain, coverage floors, and uncertainty tolerance still need review.
No numeric threshold in an illustrative example counts as an approved promotion policy.
Until the final-test audit and human calibration exist, both skills have unverified benefit.

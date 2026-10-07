# Preparation results

Evidence class: tests of measurement code with simulated observations.
No proposed skill ran, no model judge ran, and no human reviewed a PR.

## Observed checks

`evaluate.test.mjs` passed 14 checks.
The tests exercise traceability, arithmetic, and failure paths:

- Empty evidence has null rates and no promotion verdict.
- A quick unsafe merge still counts as an incorrect decision.
- Rejection of a harmless change counts as an incorrect decision.
- The judge accepts a packet that the human rejects.
- Repeated generations keep one family and suppress independence-based intervals.
- Tampered hashes, malformed data, repeated exposure, and split leaks fail.
- A fixture that we expose cannot serve as a protected holdout.
- If input is invalid, the CLI exits `2`.

The public dataset has eight authored development families.
Five represent changes that need a blocker; three represent safe changes.
No calibration or holdout families exist in this preparation.
The labels and snippets are synthetic; they do not show defects in real software.

## Evidence gates

| Gate | Status | Missing evidence |
| --- | --- | --- |
| Measurement canaries | pass | Applies only to the tested arithmetic and input checks |
| Representative workload | unverified | Authorized real PR sample and stratum counts |
| Reviewer benefit | unverified | Timed, blinded human reviews of A, B, and C |
| Model-judge calibration | unverified | Independent human labels, model runs, and frozen thresholds |
| Protected holdout | unverified | Custodian, external dataset, access record, and final run |
| Promotion of either skill | unverified | Scope decisions, implementation, and the complete protocol |

Claims of benefit remain hypotheses.
A test pass cannot prove improvement in professional reviews or time to merge.
The trial must keep failures and missing data when real runs arrive.

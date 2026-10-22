# Preparation results

Evidence class: tests of measurement code with simulated observations.
One independent forward run used the skills on a synthetic authorization fixture.
No model judge ran, and no human review measurement occurred.

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

`pr-review-capture.test.mjs` passed five checks with synthetic GitHub responses.
Those checks reject private captures that target this checkout.
They also reject overwritten captures and invalid pre-merge provenance.
They verify the separation of candidate inputs from later outcomes.
They exercise an explicit recorded-base fallback.

The live collector captured 24 private fixed-head diffs, including the requested slow stratum and seeded comparisons.
Each directory for a candidate excludes descriptions, merge outcomes, later comments, and future check results.
The task for a historical first review remains unavailable; these are new offline tasks.
The manifests preserve revisions, hashes, times of acquisition, and grouping sensitivity in private storage.
No real case has an independent human oracle or completed review measurement yet.

The forward run kept a reported failure despite a wrapper's success summary.
It delivered a packet and a proposal with unverified evaluation gates.
Its three documents passed the actual bundled linter.
That is one observed synthetic behavior, not an estimated accuracy or speed gain.
The run exposed a proposal-only ambiguity; the instruction now names that completion path.

The [packet](forward-synthetic/packet.md), [proposal](forward-synthetic/proposal.md), and [lesson](forward-synthetic/lesson.md) preserve the actual synthetic outputs.
Their [provenance](forward-synthetic/provenance.json) records hashes and measurement limits.
The raw trace stays in private external storage because it contains paths from the local installation.

## Evidence gates

| Gate | Status | Missing evidence |
| --- | --- | --- |
| Measurement canaries | pass | Applies only to the tested arithmetic and input checks |
| Representative workload | unverified | Private stratified acquisition exists; grouping, oracles, and workload relevance need review |
| Reviewer benefit | unverified | Timed, blinded human reviews of A, B, and C |
| Model-judge calibration | unverified | Independent human labels, model runs, and frozen thresholds |
| Protected holdout | unverified | Custodian, external dataset, access record, and final run |
| Promotion of either skill | unverified | Approved reward policy and the complete evaluation protocol |

Claims of benefit remain hypotheses.
A test pass cannot prove improvement in professional reviews or time to merge.
The trial must keep failures and missing data when real runs arrive.


## Packaging review on 2026-10-22

The draft was reconciled with the categorized catalog. PR Present and PR Refine now live under `skills/engineering/`; package and plugin use the proposed catalog release 4.6.0. The six bundled writing files match the current canonical Easy to Read files. Existing synthetic evaluation artifacts and private evidence remain unchanged. The catalog suite, fourteen simulated-observation checks and five synthetic collector checks validate implementation contracts; they do not establish reviewer benefit, calibrate a judge or promote an instruction candidate. No protected final test was opened. Human labels, custody and promotion remain unverified gates of the evaluation workflow.

### Publication decision — 2026-10-22

The owner explicitly approved merge and automatic publication of package/plugin 4.6.0 in the PR-review Codex chat. The two new skills receive their first published metadata version 1.0.0 in the final publishing commit, after validation. This approval publishes the workflows; it does not validate human benefit, calibrate judges, run the protected final test or promote a refinement candidate.

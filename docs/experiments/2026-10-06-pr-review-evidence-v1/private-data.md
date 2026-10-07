# Real data stays private

The collection source is private; this catalog is public.
No real PR content, identifiers, source paths, hashes, or historical results enter the public trial dataset.
Keep raw acquisition, immutable inputs, outcome records, and split proposals in an authorized external private directory.
The public code uses explicit repository and output arguments; it has no personal repository default.

## Acquisition and tasks

The private inventory records the creation window, observation time, all-outcome count, query completeness, and merged ranking denominator.
Select slow cases by elapsed time from opening to merge.
It does not measure human work or identify the cause of delay.
Open and unmerged cases remain visible in the population count; they do not receive zero merge duration.

The requested slow stratum accompanies seeded comparisons from other duration strata.
Record each stratum's population count, sample count, inclusion probability, and seed before candidate outputs exist.
Report stratum-specific outcomes.
For population estimates, use sampling weights `N_stratum / n_stratum` with an appropriate uncertainty analysis.
Do not treat an oversampled slow stratum as a proportionally representative workload.
Do not generalize merged-case findings to all arrivals without addressing censoring and selection.

The input task has two forms:

- **Historical first review:** needs a verified body and diff at the first review instant. Unavailable records remain excluded.
- **Offline fixed final head:** uses immutable SHAs associated with a merged PR to create a new review task.

For the second task, omit descriptions with unverifiable history.
Use the same fixed diff, available source evidence, and missing-check markers in every arm.
Keep merge outcomes, later comments, and adjudication outside the candidate input directory.
Merge is not a correctness label.
The benchmark cannot claim to reconstruct an initial review or explain its historical delay.

## Read-only collectors

```bash
node scripts/prepare-private-pr-dataset.mjs \
  --inventory /external/private/inventory --out /external/private/acquisition.json

node scripts/capture-pr-review-offline.mjs \
  --repo owner/name --pr 123 --out /external/private/offline/case-123

node scripts/capture-pr-review-inputs.mjs \
  --repo owner/name --pr 124 --out /external/private/prospective/case-124
```

The acquisition loader separates missing historical snapshots from eligible metadata.
The offline collector verifies the final head against the PR commit list.
It checks commit timestamps against merge metadata without claiming those dates prove when GitHub received a push.
It uses an integration parent or a verified recorded base, never current main.

The manifest names the base strategy and the comparison's merge base.
One observed case needed the recorded-base strategy to match its PR file count.
Candidate source reads must use those immutable revisions too.

The prospective collector accepts only an open PR and checks stable fields before and after retrieval.
It records the acquisition interval and its non-atomic limits.
If the source repository is private, each collector rejects an output path inside the catalog.
They also refuse overwrites.
Responses from GitHub stay private.
The console reports status only.

## Split preparation

Group duplicate diffs and related substantive changes before assigning partitions.
Compare strict shared-file grouping with domain-reviewed exclusions for navigation and logs.
A common routing file can connect otherwise unrelated cases; exclusion is a judgment, not an automatic truth.
Never exclude a substantive README just to create more independent groups.

```bash
node scripts/prepare-offline-pr-splits.mjs \
  --source /external/private/selected-acquisition.json \
  --captures /external/private/offline \
  --out /external/private/temporal-proposal.json \
  --grouping strict \
  --development-through 2026-09-13T02:59:59Z \
  --validation-through 2026-09-25T02:59:59Z
```

Those dates illustrate one trial proposal, not a generic default or approved split.
The script quarantines a related group that spans temporal boundaries.
It does not divide a family to force a target percentage.
The collected sample supports an offline family-stratified split proposal if its exclusions survive domain review.
That alternative makes no claim of future-time generalization.
Development edits instructions; validation selects candidates and calibrates graders; final test evaluates the frozen choice once.

A reservation for the final test does not establish custody, labels, or acceptance.
Keep the test inaccessible to candidate generation and selection before freezing it.
If its content reaches an author, move it to development and collect a replacement.
The private proposals for splits keep unlabelled oracles and are intentionally not runnable final-test datasets.

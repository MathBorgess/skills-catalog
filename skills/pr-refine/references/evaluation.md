# Evaluation protocol

## Dataset and provenance

The evaluation unit is a PR family, not a sentence, output, or retry.
Group related PRs, templates, repositories, and seeded variants before assigning splits.
Keep all members of one family in one split.
Record source revision, acquisition date, consent to use, license, redactions, language, size, risk, and oracle provenance.

Keep the original diff, command logs, packet, and human labels with content hashes.
Use synthetic data until real PR evidence has authorization for collection and use.
This trial does not prove an improvement in a workplace or production.

Public synthetic cases for development are a coverage checklist, not a representative statistical sample.
Recruit PRs across bug fixes, features, documentation, refactors, migrations, and security-sensitive changes.
Include small and large diffs, English and Portuguese packets, successful and failed checks, and incomplete reports.
Include correct changes that need no blocker and flawed changes that look polished.
Report the count in each stratum and the target workload it represents.
If a stratum lacks cases, restrict the conclusion to that sample.

## Development, validation, and final test

1. Use public development cases for prompt edits and regression tests.
2. Reserve validation families for candidate selection and human comparison of graders.
   Keep calibration and selection subgroups separate within validation.
3. Have a custodian reserve an external final test set with no family overlap.
4. Freeze split manifests and acceptance criteria before seeing candidate results.
5. Give generation agents only case inputs, never oracles, human labels, or grader rationales.
6. Freeze the candidate before the custodian runs the final test once.

Record dataset IDs and hashes, family IDs, split assignments, prompt hashes, model versions, and access history.
Any exposed holdout family becomes development data.
A failed final evaluation triggers a new candidate and a fresh holdout, not repeated tuning against the old one.
An accidental leak invalidates that family and needs replacement before the final claim.
A random split cannot make a case unseen by its author.

For an initial pilot, propose at least 20 independent families per evaluation split.
The owner must approve the coverage floor before it becomes an acceptance requirement.
This is a feasibility floor, not a power calculation or proof of safety.
Choose the final sample size from pilot variance and the smallest useful time improvement.
Freeze that choice before final evaluation.

Include at least five unsafe families and five safe families to exercise both error directions.
Report counts per subgroup, even when they are too small for conclusions.

## Baseline and execution

Preserve the existing PR description as A; do not degrade it to help B win.
Generate B and C from identical immutable inputs.
Use at least three independent generation repeats per family and arm to expose output variance.
Record model, prompt, skill revision, seed when supported, tools, raw outputs, and failed generations.
Keep generation time separate from human review time.

Assign arm order randomly across reviewers.
Avoid showing one reviewer several versions of the same PR, which teaches them the answer.
Balance expertise, language, and repository familiarity across arms.
Blind reviewers to arm names and judge scores.
Record actual start, pause, and stop timestamps; exclude pauses under one frozen rule.
Predefine comprehension questions and decision keys from an independent diff review.

Keep disagreements visible; adjudicate them before comparing candidate metrics.

## Metrics and limits

| Metric | Numerator / denominator | What it measures | What it cannot prove |
| --- | --- | --- | --- |
| Decision accuracy | Correct human dispositions / completed reviews | Decisions against the adjudicated key | Code correctness outside that key |
| Unsafe approval rate | Merge recommendations on unsafe cases / unsafe-case reviews | Missed blockers in the sample | Safety when the denominator is zero |
| Material claim support | Supported material claims / all material claims | Traceable factual support | Truth of the underlying oracle |
| Material risk recall | Captured material risks / independently identified risks | Retention of known risks | Absence of unknown risks |
| Comprehension | Correct answers / fixed questions answered | Reviewer understanding of the packet and diff | Skill quality independent of question design |
| Review time | Active seconds per completed review; report count | Human effort to reach a disposition | Correctness, queue delay, or causal merge speed |
| Generation reliability | Valid packets / all scheduled attempts | Format and artifact availability | Semantic correctness |
| Judge agreement | Matching binary labels / human-labelled items | Agreement with a reference panel | Agreement with reality |
| Judge false acceptance | Judge accepts / human rejects, among human rejects | Grader leniency on bad packets | Reliability with no negative examples |
| Brier score | Sum of squared probability errors / labelled items | Probability accuracy against human labels | Pure calibration independent of discrimination |

For every rate, show both counts and missing observations.
Null means no denominator; it never means zero errors or full success.
Count abandoned reviews and generation failures separately, with reasons.
Never drop failures to improve the denominator.
Time to merge is exploratory only: staffing, queue order, and release policy confound it.
Shorter packets or fewer comments are diagnostic counts, never acceptance metrics.

## Uncertainty and variance

Report task-level means before aggregation; repeats do not create independent PR families.
For binary rates, use Wilson 95% intervals on independent units only.
The report code gives intervals for single observations per family and arm.
It suppresses intervals when repeats violate that assumption.

For time and comprehension differences, use paired family means and report the full difference range.
Use an external analysis for a clustered bootstrap 95% interval across PR families before promotion.
Record resample count and seed; preserve reviewer clusters when a reviewer contributes several cases.
Show baseline and candidate distributions, not just one average.
Zero unsafe approvals in a small sample still leaves substantial uncertainty.

## Acceptance and regression

Before final evaluation, the owner signs an acceptance manifest with candidate and dataset hashes.
The trial has these constraints for the pilot; approval does not supply missing measurements.

- Check for complete, attributable artifacts and an uncontaminated holdout.
- Check for zero unsupported material claims and zero missed known material risks.
- Check for zero unsafe approvals; include safe cases too, to catch rejection of everything.
- Check that decision accuracy and comprehension meet their baseline on paired families.
- Check that the time-difference interval favors the candidate before claiming a speed gain.
- Calibrate the judge if its grades influence promotion.
- Check that graders still catch each critical failure on public regressions.

Evaluate B versus A and C versus B separately.
The second skill can propose one change per iteration with a failure case, expected effect, and counterexample.
Develop it only on development data and preserve each candidate's record.
Polish cannot offset a failed gate for correctness.

The evaluator reports `pass`, `fail`, or `unverified`; the human owns promotion and merge authorization.
Do not promote with missing holdout, calibration, or review measurements.
Do not promote merely because a script exited successfully.

After the custodian reveals a holdout, move it into the public regression set if disclosure has authorization.
Collect a fresh protected holdout for the next candidate.
Regressions check failures that we already know; they cease to measure unseen generalization.

## C01 evidence record

Keep one report per candidate with inputs, counts, intervals, raw output links, graders, disagreements, and final human disposition.
Explain each metric's limit and the hypotheses the data cannot settle.
Record bias from synthetic authorship, reviewer expertise, language, missing strata, and model self-judgment.
Probe gaming with a polished wrong packet, a terse correct packet, a log that lacks evidence, and an all-rejecting grader.
Evidence of professional competence needs independent reviews on an authorized workload that represents the target work.

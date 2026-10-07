# Reward proposal for owner review

Status: Pareto-first pilot policy; numeric weights and thresholds for promotion remain proposals.
This reward ranks candidates for instruction changes; it does not reward a reviewer for approving a PR.

## First, eligibility

Use a constrained reward, not a weighted average that hides critical failures.
Propose these non-compensable restrictions:

- No unsupported material claim or hidden material risk.
- No unsafe merge recommendation or regression in correct dispositions.
- No leak across development, validation, and final test families.
- No substitution of polished prose, lint success, or zero observations for correctness evidence.

A violation with evidence gives `ineligible`, with its evidence.
Missing measurements or disputed oracles give `unverified`, never a reward of zero or a score that passes.
Confirm these restrictions with the owner in the acceptance manifest before selection.
They do not authorize a merge, publication, or promotion.

## Components

Calculate on paired family means, not on individual sentences or retries.
Keep each component and its denominator in the report.

| Symbol | Proposed definition | Limitation |
| --- | --- | --- |
| Q | Half decision accuracy plus half comprehension accuracy | Depends on the oracle and comprehension questions |
| F | Half material-claim support plus half material-risk recall | Known risks only; missing denominators leave it undefined |
| E | `clip((baseline_seconds - candidate_seconds) / baseline_seconds, -1, 1)` | Human active review time only; zero baseline leaves it undefined |

The equal weights inside Q and F are proposals too.
Report Q and F in `[0,1]` and E in `[-1,1]`.
For a family with no material risks, omit risk recall from its F denominator and use claim support.
Report that omission; do not convert zero risks into perfect recall.
Use the mean of per-family components across paired families.
Do not use time to merge, comment count, text length, or model confidence as E.

Compare improvements against the frozen baseline:

```text
delta_Q = Q_candidate - Q_baseline
delta_F = F_candidate - F_baseline
R = w_Q * delta_Q + w_F * delta_F + w_E * E
w_Q + w_F + w_E = 1; each weight >= 0
```

For the initial pilot, show a Pareto comparison of the three components.
Postpone numeric weights until pilot evidence has human review.
A Pareto improvement improves one component without worsening the others.

If candidates trade quality for efficiency, show the trade-off instead of choosing a winner by invented weights.
For final acceptance, report clustered uncertainty intervals and check the approved quality floors.
An uncertain speed difference supplies no claim of measured improvement.
The script reports counts from the evidence; it intentionally does not apply this proposed reward.

## Illustrative candidates

These numbers illustrate proposals; they are not results of the skills.
For illustration only, set `w_Q=0.5`, `w_F=0.3`, and `w_E=0.2`.
Use baseline Q `0.90`, F `0.95`, and an active review of `100` seconds.

| Candidate | Q | F | Seconds | E | R | Interpretation |
| --- | --- | --- | --- | --- | --- | --- |
| Clearer and faithful | 0.95 | 1.00 | 80 | 0.20 | 0.080 | Eligible only if all restrictions and evidence gates pass |
| Faster but unsafe | 0.80 | 0.90 | 10 | 0.90 | 0.115 before veto | Ineligible: unsafe approval defeats the apparent score |
| More accurate but slower | 0.98 | 1.00 | 120 | -0.20 | 0.015 | Show the quality/time trade-off to the owner |
| Polished, no reviews | unknown | unknown | unknown | unknown | undefined | Unverified, regardless of style |

The unsafe example earns a larger unconstrained number than the faithful example.
That is the failure the eligibility restrictions prevent.
Sample uncertainty can reverse the order even among eligible candidates.
Compare intervals and per-stratum results before any promotion.

## Incentives and decisions

Watch for an all-rejecting candidate that avoids unsafe approvals but blocks correct changes.
Decision accuracy on safe cases exposes this behavior.
Watch for omitted hard cases, compressed risks, trivial comprehension questions, and judge-compatible wording.
Preserve failure counts and use independent oracle authors to expose those incentives.
Watch for selection on validation repeatedly; preregister a candidate budget and keep the final test locked.

Ask the owner to choose these decisions after showing actual pilot evidence when available:

1. Approve or revise the non-compensable restrictions.
2. Choose Pareto selection or numeric weights, including weights inside Q and F.
3. Choose the smallest useful gain, uncertainty tolerance, and coverage floors for promotion.
4. Assign the final test custodian and define the candidate budget before selection.

Record approved choices, approver, timestamp, and manifest hash.
Keep any proposal distinct from that signed policy.

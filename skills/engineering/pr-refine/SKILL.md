---
name: pr-refine
description: "Use when the user wants to improve the pr-present workflow from reviewer confusion, weak evidence, repeated PR-description corrections, or measured evaluation failures. Question the design, test one candidate change on development data, compare it on validation data, and preserve the lesson with evidence. Final test access and promotion require a frozen evaluation plan; speed cannot compensate for false confidence or correctness regressions."
metadata:
  author: Matheus Borges
  version: 0.0.0
---

# PR Refine

Improve one instruction in the PR presentation workflow from attributable failures and evaluation evidence.
Use questions to resolve decisions, not to outsource facts the agent can inspect.

`<skill>` is the folder that contains this file, including after installation.

## Steps

1. **Fix the baseline.** Identify the current `pr-present` revision, reviewer problem, and authorized edit target.
   Preserve the original inputs, packets, and raw feedback before proposing a change.
   If supplied feedback lacks an author, timestamp, or original artifact, record those fields as unknown.
   Keep private evidence in an authorized private location.
2. **Question the failure.** Separate observed confusion or errors from hypotheses about their cause.
   Inspect source evidence, existing glossary terms, and review outcomes.
   Ask decisions that block the next stage together, with a recommendation for each.
   Use explicit reversible assumptions for a proposal that does not depend on owner approval.
   Wait for decisions that materially change the proposed improvement.

   Once a term or decision settles, record it in the candidate's lesson note.
   Adapt this method from `grill-with-docs`; do not auto-invoke that user-only skill.
3. **Define one candidate.** State the instruction change, expected effect, failure it targets, and a counterexample.
   Read [references/evaluation.md](references/evaluation.md).
   Freeze the baseline, candidate budget, split manifests, rubric, and proposed reward policy before selection.
   Use development data for edits, validation data for selection and grader calibration, and protected test data once.
   If evaluation data is missing, deliver a proposal with unverified gates; do not fabricate runs or declare promotion.
4. **Compare evidence.** Run baseline and candidate against identical inputs with independent generation repeats.
   Preserve outputs, failures, human labels, model grades, and source hashes.
   Use `node <skill>/scripts/evaluate.mjs --cases <dataset> --run <run>` for attributable counts.
   Read [references/observations.md](references/observations.md) for the schema and grader protocol.
   Missing labels, contamination, or an uncalibrated judge leave promotion unverified.
5. **Separate ranking from acceptance.** Read [references/reward.md](references/reward.md).
   Show reward components and uncertainty separately from non-compensable quality failures.
   Propose weights and thresholds for owner review; do not invent an approved policy.
   Freeze the selected candidate before a custodian runs the protected final test.
   Never tune on exposed test failures; move them to regression and get new cases for the final test.
6. **Preserve the lesson.** Save `proposal.md`, `lesson.md`, manifests, and run reports in `pr-review/improvements/<candidate-id>/`.
   Record the claim, evidence, scope, counterexample, and any lesson it supersedes.
   Check on a later case whether the lesson changes the workflow; a note does not prove better behavior.
   Propose promotion only after the approved evaluation gates pass.
   Apply or publish instruction changes only within the user's authorization; the human decides on final acceptance.

## Done-check

- [ ] The candidate has one attributable change and a counterexample; a proposal records a baseline or evaluation data that remain unavailable.
- [ ] Families stay separate across development, validation, and final test.
- [ ] Reports show denominators, missing data, uncertainty, and the graders' limits.
- [ ] Reward weights and thresholds distinguish proposed policy from owner approval.
- [ ] A speed bonus cannot hide a failure of quality.
- [ ] The lesson has evidence and scope; promotion remains unverified if final evidence is unavailable.

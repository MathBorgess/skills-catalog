# Trial graders

The installed grader instructions live in [PR Refine's observations reference](../../../skills/pr-refine/references/observations.md).
The report code lives in [its evaluation script](../../../skills/pr-refine/scripts/evaluate.mjs).
Run [evaluate.test.mjs](evaluate.test.mjs) to exercise the synthetic grader canaries.

The trial distinguishes passing arithmetic tests from evidence that either skill helps a reviewer.
Human labels, LLM calibration, representative review measurements, and final-test independence still need separate evidence.
No generation, judge, or reviewer measurement occurs in the test suite.

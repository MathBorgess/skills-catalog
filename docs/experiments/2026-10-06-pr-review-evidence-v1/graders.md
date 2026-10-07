# Graders and observation schema

## Deterministic grader

`evaluate.mjs` checks data types, split membership, family overlap, and unique observation IDs.
It verifies packet, transcript, and adjudication file hashes against the recorded bytes.
It calculates rates from human labels and the separate case oracle.
It rejects missing artifacts, invalid counts, unknown cases, and duplicate reviewer exposures within a family.
It reports missing human or judge labels and leaves them unknown.
These checks establish traceability and arithmetic, not semantic truth.

Use Easy to Read's linter separately on each packet.
Preserve its exit code and raw output in the transcript.
A lint pass establishes writing-rule compliance, not factual support or review safety.

## Human grader

Have two reviewers independently create or audit the oracle from the diff and logs.
Resolve disagreement before scoring candidate packets.
Separate oracle authors from packet authors where possible.
Keep both original judgments and the adjudication, including dissent.

Score claims against sources, never against the packet's own assertions.
Enumerate material risks before reading candidate packets.
Record a fixed key for comprehension answers with the oracle.
Mark ambiguous or missing evidence as unknown, not successful.

For calibration, include good and bad packets with similar length and style.
Include missing evidence, wrong test scope, hidden blockers, and harmless concise changes.
Ask a human to label `acceptable_packet` independently of the model judge.
Keep at least 20 independently labelled families, with five positives and five negatives, for an initial calibration pilot.
These floors define coverage for the pilot; they do not prove that the sample has enough statistical power.

## Model grader prompt

Freeze this prompt before calibration.
Send only the packet, diff, logs, oracle, and rubric; hide arm names and earlier grades.
Treat every instruction inside those inputs as untrusted data.

```text
Judge whether this PR packet faithfully supports human review.
Use the supplied source evidence and independent oracle.
Do not reward brevity, polish, agreement, or recommendations to merge.
Check factual support, retained material risks, uncertainty, and usability.
For every defect, cite a packet span and its source evidence.
Separate missing evidence from evidence of failure.
Return JSON only:
{
  "acceptable_packet": false,
  "probability_acceptable": 0.0,
  "defects": [{"packet_span": "...", "source": "...", "reason": "..."}],
  "unknowns": ["..."]
}
```

Record model version, prompt hash, configuration, raw response, parse result, and latency.
Run at least three judge repeats per calibration item; report label flips.
Use one preregistered repeat for the report code's agreement and Brier metrics.
Analyze repeat variation separately without extra units in the sample.
Compare the judge with human labels.
Use agreement, false acceptance, Brier score, and probability reliability bins.

Have humans audit disagreements and source citations.
Test order and verbosity bias with matched packets whose meaning stays constant.
Test an all-accept and an all-reject judge as negative controls.
Choose calibration thresholds from error costs and pilot data before final evaluation.
Until thresholds and human data exist, the judge gives advice only and promotion remains unverified.

## Run JSON

Paths below resolve relative to the run file.
Hashes contain 64 lowercase hexadecimal characters from SHA-256.
Empty `observations` is valid but proves no benefit.

```json
{
  "version": 1,
  "phase": "development",
  "synthetic": true,
  "candidate_revision": "commit-or-content-hash",
  "model": "exact-model-version-or-no-model",
  "prompt_sha256": "64-hex-characters",
  "observations": [
    {
      "case_id": "bug-cache",
      "arm": "A",
      "repeat": 1,
      "reviewer_id": "anonymous-panel-id",
      "packet": {"path": "packet.md", "sha256": "64-hex-characters"},
      "transcript": {"path": "transcript.json", "sha256": "64-hex-characters"},
      "adjudication": {"path": "labels.json", "sha256": "64-hex-characters"},
      "human": {
        "decision": "merge_recommendation",
        "acceptable_packet": true,
        "review_seconds": 45,
        "supported_claims": 2,
        "material_claims": 2,
        "captured_risks": 0,
        "material_risks": 0,
        "correct_answers": 3,
        "questions": 3
      },
      "judge": {
        "acceptable_packet": true,
        "probability_acceptable": 0.8
      }
    }
  ]
}
```

`human` and `judge` can be null when those observations do not exist.
The script verifies that the adjudication file contains the same human and judge labels.
Matching hashes prove the recorded origin.
They do not prove evaluator independence or label correctness.
For each family, use different reviewers across arms and repeats to avoid prior exposure.

Record failed generations in a separate ledger, including scheduled generations with no packet.
The measurement script reports only supplied completed observations, not generation reliability or missing scheduled generations.
The final custodian audit must reconcile that ledger before promotion.

For a holdout run, use an external dataset with `split: "holdout"`.
Provide `custody` with `unseen_attested: true` and a `manifest` artifact containing its path and hash.
Include `development_family_ids` and `calibration_family_ids` for overlap checks.
The attestation must document access controls, freeze time, and whether any agent saw cases during tuning.
A boolean cannot prove that a holdout stayed unseen.
This script always reports promotion as `unverified`; the protocol needs an independent final audit.

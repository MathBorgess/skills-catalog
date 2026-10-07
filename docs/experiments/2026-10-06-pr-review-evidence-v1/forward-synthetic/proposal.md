# Summarize each failed check once

Status: proposal only. No skill edit or promotion occurs.

## One instruction change

Add this instruction to `pr-present/references/packet.md`:

> Summarize each failed check once in Evidence: its name, outcome, scope, and source link.
> Explain its material consequence in Risks and unknowns.
> Link the full logs; do not repeat them.
> Keep every material failure and its limits visible in the packet.

## Expected effect

The packet can lose repeated log text without losing a material failure.
Faster review remains a hypothesis until human time and comprehension data exist.

## Failure and evidence

The supplied reviewer complaint says failed tests make the description too long.
The fixture reports an authorization failure and a wrapper success that conflicts with it.
The complaint has no named reviewer, timestamp, or original feedback artifact.
Treat it as supplied development feedback.
The fixture also lacks a previous packet, so it cannot prove repeated log text caused the complaint.

## Counterexample

Two failures can share one check name but expose different material risks.
Keep both consequences and the source for each failure visible.
Do not combine them into a vague failure count.

## Proposed comparison

Freeze this candidate and the baseline before independent repeats.
Use the same inputs for development, then use separate validation families for selection.
Measure supported claims, risk recall, comprehension, and active human review time.
Keep safe and unsafe cases in each approved sample.
Reserve the final test with an independent custodian.

## Policy and authorization

The owner has approved no weights, thresholds, sample floor, or final test custodian.
Propose Pareto comparison until the owner chooses a reward policy.
Keep all material failures and risks before considering a speed gain.
The task authorizes a local proposal; it does not authorize an instruction edit or publication.

<!-- SPDX-License-Identifier: MIT -->

# Agent packets and execution evidence

Use native agent or task facilities that support independent contexts. A coordinator writing several personas is not N independent authors. Before launch, record what the harness actually supports: clean contexts, model selection, agent reuse, concurrent execution, and visibility into model identity. Use `unknown` for unavailable observations. Do not infer isolation, a model, or concurrency from a requested setting.

Start every author in a fresh context with inheritance of the coordinator's transcript disabled; use `fork_turns: "none"` when that is the host's control. A small input packet does not remove history inherited through a default spawn setting. If the host cannot withhold that history, report independent authoring as unavailable and keep the phase incomplete. Preserve the chosen settings as execution evidence without claiming they establish a filesystem sandbox.

## Dispatch and retention

Start every initial or replacement author in a clean context, without inheriting the coordinator's transcript or attachments. Native spawns that default to a full-history fork must be configured for a fresh task. If the harness cannot provide a context free of original seed narratives and peer outputs, retain the run as incomplete.

Create one immutable prompt file under `prompts/` for each actual invocation or follow-up, then submit exactly those bytes. Preserve all messages supplied by the coordinator, including setup, corrections, resume messages, and replacement-author instructions. Hash and retain separately supplied attachments or context bundles; an attachment reference is not the attachment's contents. Do not claim to possess hidden system prompts.

Keep complete native responses and execution logs. A hashed execution record should map each invocation to its prompt, context hashes, native agent ID, role, candidate, round, requested model, observed model, observation source, start/end observations, actual batch, outcome, and any capability unknowns. Log failure and retry separately. Use the manifest's `additionalPrompts` for invocations beyond each recorded proposal/review's primary prompt.

Attempt one concurrent batch when the harness supports it. If capacity forces batches or serial execution, record the actual groups and timing; do not describe attempted concurrency as observed concurrency. Preserve each author's context through its own revision when supported. A failed or unavailable author may be replaced only for the same candidate, with the original agent ID, reason, and exact replacement packet retained. A replacement does not reset the two-round limit.

## Initial author packet

Fill every bracket with run-specific content. The input packet must contain neither original seed narratives nor any peer output. Derive the scoped brief before dispatch so it can stand on its own.

> Role: independent author for [proposal ID], round initial.
>
> Scoped brief: [goal, audience or user, problem, scope].
>
> Constraints and explicit unknowns: [constraints].
>
> Frozen criteria and gates: [complete criteria text or retained attachment].
>
> Your exact sampled path: [every dimension, position, and verbatim selected alternative].
>
> Develop one candidate that gives every path choice a concrete role. Do not replace, skip, or reinterpret a choice to hide a conflict. If choices conflict with constraints, describe the conflict and a possible no-go.
>
> Return: (1) a concise candidate definition; (2) a dimension-by-dimension mapping from each exact choice to proposed behavior; (3) an evidence ledger using the supplied criteria, including unknowns and constraint-gate results; (4) economic scenarios with explicit units, time horizon, currency, inputs, arithmetic, and cost allocation; (5) the assumptions most likely to change the decision and a discriminating validation plan. Include the person's actions and control points, the proposed technology choices and any model's role during use, plus milestones and a completion criterion within the supplied time budget. Distinguish purchaser benefit from provider contribution. Treat estimates as estimates and do not claim realized results.
>
> Work independently. You have no authority to implement, contact anyone, buy, pay, or publish. Submit only your candidate and supporting analysis.

## Comparative critic packet — used after each round

The critic must have a native identity distinct from every author, including replacements. It may perform both round reviews and the post-research reviews. Preserve the prompt for each review separately.

> Role: comparative critic, round [initial or revised].
>
> Inputs: [scoped brief and constraints], [frozen criteria], [exact sampled paths], [all N current-round submissions with paths/hashes], [evaluation ledger].
>
> Compare every candidate against the same frozen criteria. Check every dimension's exact sampled choice against the candidate's actual proposed behavior. Record compliance, conflict, or insufficient evidence for each choice; do not accept a restated label as proof of fulfillment.
>
> For each candidate, record hard-gate disposition, claim/evidence gaps, economic arithmetic or unit problems, sensitivity to unknowns, and an overall eligibility finding. Compare the eligible candidates using the frozen decision rule; do not force a winner. Do not reward missing inputs as zero cost or claimed outcomes.
>
> Return a comparative report covering all N candidates and a separate feedback packet for each candidate. Each feedback packet must discuss only its recipient's candidate and the frozen criteria. [For initial: identify changes possible within that same sampled path.] [For revised: identify a provisional leader or reject all; request no third author round.]

Store the whole comparison centrally. Send no peer descriptions, rankings, extracts, or comparative report to an author.

## Revision packet — once per candidate

> Role: author for [same proposal ID], round revised.
>
> Inputs: [same scoped brief, constraints, frozen criteria, exact sampled path], [your own initial submission], [your candidate-specific feedback].
>
> Revise only your own candidate once, within every original path choice. Address each feedback point or explain why it cannot be resolved. Include the updated choice mapping, evidence ledger, economic scenarios, gate findings, and validation plan. Do not invent peer work, change the criteria, or substitute another path. Your revised submission is the final author round.

A replacement receives this same packet, without peers or original seed narratives. Record `replacement.fromAgentId` and `replacement.reason` on the revised manifest record when its author differs from the initial author.

## Post-research critic packet

> Role: author-independent evidence critic for [proposal ID].
>
> Inputs: [frozen criteria], [all round-2 eligibility findings and comparison], [this candidate's round-2 artifact path/hash], [this candidate's research artifact path/hash], [source records and limitations].
>
> Reassess this candidate against each frozen gate and the decisive assumptions. Trace conclusions to the supplied research claims. State what the research changes, what remains unknown, and whether the candidate remains eligible, is rejected by evidence, or requires more evidence. Do not treat an inaccessible directory, an unverified label, or a search with no useful hits as proof of absence.
>
> Return a research-specific finding that names the exact research path and SHA-256, verifies the path-choice mapping remains intact, and explains whether a selection is supportable. Do not create or revise a candidate.

Every researched candidate needs this review and its complete prompt, even when the outcome is no-go. Keep the critic output distinct from the research, candidate, and decision files.

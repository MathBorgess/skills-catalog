<!-- SPDX-License-Identifier: MIT -->

# Evidence ledger, gates, and sensitivity decisions

Freeze the evaluation rule before authors begin. Use a ledger to distinguish what the run knows from what it assumes; use gates to decide what can proceed. A numerical total does not override a failed hard constraint.

## Freeze the decision rule

Write `criteria.json` with named criteria, the evidence each requires, hard constraints, gate outcomes, comparison or tie rules, uncertainty treatment, and the conditions that would make the coordinator reject every candidate. No particular weighting formula is required. If using weights or thresholds, state their units and justification before authoring. Do not adjust them to rescue a favorite.

Include these minimum checks:

- Every exact sampled choice has a concrete, compatible role.
- Scope, permissions, resources, and other user constraints are satisfied or explicitly unresolved.
- Material claims distinguish observations, external evidence, assumptions, calculations, and unknowns.
- Proposed benefits and economics have internally consistent units and no duplicated costs.
- The deciding assumptions have useful tests with observable rejection conditions.

Use `pass`, `fail`, or `unresolved` for gates and explain each result. An unresolved hard gate cannot support selection unless the frozen rule explicitly permits a conditional decision and states the condition. Record that condition prominently in the outcome. Rejecting all candidates is valid.

## Candidate ledger

Maintain a ledger per candidate per round. Keep the original entries and revisions in their respective artifacts.

| ID | Claim or quantity | Value or range | Unit / horizon / currency | Status and source | Consequence if wrong |
| --- | --- | --- | --- | --- | --- |
| E-01 | [specific claim] | [number, range, or unknown] | [explicit dimensions] | [observed / sourced / assumed / calculated / unknown; reference] | [affected gate or decision] |

For external evidence, record a claim-specific source rather than a homepage alone. For arithmetic, cite input IDs and the equation. For estimates, identify who supplied the estimate and its basis. Do not silently promote a plausible estimate to an observation.

Pair each hard constraint with a separate gate record: constraint ID, relevant ledger IDs, outcome, reason, and next evidence if unresolved. Evaluate path fidelity dimension by dimension; plausibility alone does not excuse a missing sampled choice.

## Economic arithmetic

Define the purchaser, provider, unit of exchange, scenario horizon, and currency first. A purchaser may be different from the end user. Keep purchaser benefit in its own ledger: for example, time saved, avoided errors, or a monetary estimate of those effects. A provider's receipts are not the purchaser's benefit, and a purchaser's estimated benefit is not proof of willingness to pay.

Use scenario arithmetic appropriate to the candidate. For a simple unit-priced scenario:

- Receipts = delivered paid units × price per unit.
- Provider contribution for the declared horizon = receipts − nonlabor delivery costs − labor costs − acquisition costs − other explicitly included costs.
- Cost per delivered unit = included provider costs ÷ delivered units, only when the denominator is nonzero and sufficiently known.
- Purchaser net monetary benefit, if monetization is justified = estimated purchaser benefit − purchaser payment − purchaser adoption or operating costs.

Label the boundary of each measure. Contribution is not profit unless all costs needed for that claim are included. A noncommercial candidate may have zero provider receipts by design; that says nothing by itself about its value or affordability.

Each cost gets one allocation ID and one inclusion location. Labor hours × rate can be counted directly or included in an existing cost, never both. Count either acquisition campaign spend or the corresponding units × acquisition cost per unit for the same acquisitions, never both. Separate recurring costs from setup costs and declare whether setup is allocated or charged in full. Keep different time periods and currencies separate unless an explicit sourced conversion is applied.

Unknowns stay `unknown`, not zero. Compute partial expressions or ranges when possible; if a decisive result depends on an unknown input, say the result is unresolved. Show rounding and denominators. Distinguish physical capacity from modeled demand and collected payment from a hypothetical price.

## Scenario and sensitivity records

Give each candidate an unfavorable, reference, and favorable scenario. These are declared assumptions, not forecasts or realized outcomes. List the changed input IDs and retain the same arithmetic in each scenario.

Find the small number of assumptions that could change eligibility or the ranking. State a sensitivity question such as “At what delivery time per unit does the resource constraint fail?” Solve a threshold only when its inputs support the calculation; otherwise specify the evidence needed. Record the decision on either side of the threshold, including a no-go where appropriate.

Translate each decisive unknown into a validation item: hypothesis, smallest informative test, measurement unit, acceptance/rejection condition, required permission or resource, and what decision changes. A test plan does not authorize execution. The final `validation-plan.md` prioritizes these items for the selected candidate or explains the evidence needed to reopen a no-go.

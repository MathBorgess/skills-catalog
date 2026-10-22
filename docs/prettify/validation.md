# Prettify validation

Observed on 2026-10-10 while implementing [MAT-265](https://linear.app/borgesmathai/issue/MAT-265/criar-prettify-design-guiado-por-designmd-do-briefing-a-entrega). The test boundary was a complete skill run with controlled human responses, plus the optional checker's public CLI. Generic pilot files and raw evidence were retained outside this public repository.

## Complete runs

| Run | Observed execution | Question result and limits |
| --- | --- | --- |
| Web workshop directory | Agent presented two functional low-fidelity layouts, used the chosen card direction, presented high fidelity, and delivered HTML. Chrome exercised filtering and reservation at 390px and 1280px, with keyboard and touch paths. Root independently confirmed Garden remained selected after reservation, visible 3px keyboard focus, no horizontal overflow, and matching original/current DESIGN hashes. Impeccable context and detector ran. | Answered for the two-workshop local fixture. This does not establish behavior with live bookings or a larger catalog. |
| Three-slide reading carousel | Missing DESIGN proposal was revised to cite inspected design guidance, accepted for the piece only, and explored as two actual previews. Controlled input chose one and explicitly skipped high-fidelity review. All three PNG exports were independently verified at 1080×1350 and inspected full-size and at 320×400. No durable DESIGN was created. | Audience comprehension remains inconclusive: no intended reader was tested. Visual assessment records copy, spacing and sequence separately. |
| Photo thumbnail | Root supplied controlled run-only direction and explicit low/high checkpoint skips. Built-in image generation returned an actual PNG; it was opened and rendered at 320px wide. The exact headline and cup were visible without overlap. Output was 1672×941, near 16:9 within pixel rounding; preferred 2048×1152 was not produced. | Audience recognition remains inconclusive. This demonstrates generation and inspection, not editing of a supplied photo or effectiveness with an audience. |

The carousel's inspected [W3C text-spacing reference](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing) informed a spacing robustness principle; it neither supplied the proposed palette nor established raster readability. The web detector's cream-palette warning was retained because the provided DESIGN explicitly required off-white. A legacy PRODUCT schema was reported without running an unrequested migration.

These runs used actual model execution and rendered artifacts, but their human decisions came from a controlled root test driver. They are not actual owner approvals, user studies, or evidence of conversion gains. The web/carousel agent had authored the workflow; a separate fresh-context agent exercised the edge cases below. Root separately inspected the exports and re-exercised the web interaction.

## Controlled stops and authority

A fresh-context agent used an explicitly simulated image resource, not a live provider. The test driver rejected an initial portrait direction, requested a cup direction, then approved the exact shown durable DESIGN creation in an isolated fixture. Installation refusal stopped dependent work with the proposal preserved. A separate authorized simulated installation returned failure and stopped the run. Another scenario explicitly skipped both visual review checkpoints but could not verify an export; the agent reported incomplete delivery. No actual software installation or image edit was claimed in these cases.

## Mechanical and distribution checks

Public CLI tests cover declared complete runs, missing fields/receipts, explicit skips, unapproved DESIGN changes, approved creation/update hashes, rejected directions, missing/refused dependencies, inconclusive questions, absent artifacts, unverified inspection, malformed diagnostics, and invocation from a temporary working directory. The checker reports structural consistency and file presence only; it cannot authenticate a decision, validate rendering, or score visual quality.

`npm run check`, the version-bump check, skill metadata validation, whitespace checks, and package dry-run passed. On macOS, the full suite used `TMPDIR` pointed at a normal directory because an existing explain-me assertion disagrees with the default temporary-path alias. This is a test-environment workaround, not a prettify code change. Package/plugin are 2.8.0; the unpublished skill metadata remains 0.0.0.

Two Luna reviews inspected standards and the approved spec independently. Standards found no actionable breach. The spec review identified an excessive mandatory manifest requirement; it became optional for a requested machine-readable handoff. Targeted follow-up reviews found no remaining actionable findings. This does not replace the owner's PR review.

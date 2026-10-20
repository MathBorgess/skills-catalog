# Morphological project selection: workflow design

| Surface | Status |
| --- | --- |
| Source workflow | Recovered from an executed project exploration |
| Reusable operator skill | Shared understanding confirmed; implementation in branch, validation in progress; not shipped |
| Proponent revision after selection | Accepted extension: revise all N candidates, then select again |
| Commercial result | No observed sales, customer validation or measured competitive advantage |

## Observed sequence

1. Recover the assignment or project brief, constraints, required outputs and unresolved contradictions. Email and academic requirements were input sources in the original case, rather than intrinsic parts of morphological exploration.
2. Normalize the seed ideas into comparable descriptions: purpose, audience, interaction, human control, review/comparison, AI role, proposed difference and smallest useful output.
3. Decompose the ideas into dimensions and alternatives. Preserve the ideas and the box as separate artifacts. Construct representative paths for the original ideas before the later random exploration.
4. Validate dimensions, alternatives and paths. Run the original text-to-morphbox generator, then inspect both the generated PDF and a rendered preview. Structural and visual checks do not establish creative quality.
5. Declare the commercial evaluation criteria before generating the independent candidates. Identify the external commercial-design references and their reuse terms.
6. Draw distinct paths without a semantic or commercial filter. Preserve the seed, box snapshot, source hash, selected indices, alternatives, rejected indices and duplicate paths.
7. Dispatch one separate proponent per accepted path. Each receives the common brief and its own path, without the source ideas or competing proposals. Give each an exclusive output destination. Record requested models and actual concurrency.
8. Preserve the complete prompts and raw candidate proposals, with hashes. Wait for all requested proposals before comparative evaluation.
9. Dispatch a separate devil's advocate. It checks every morphological choice, examines the buyer and reason to pay, challenges costs and acquisition assumptions, evaluates scope and alternatives, and explains the strongest objection to the leading candidate. The original result identified a candidate for paid validation, without establishing that any candidate justified investment.
10. Consolidate the comparison, selection rationale, objections and financial assumptions. Prepare a pitch covering product, audience, interaction, similar products, proposed differences, technologies and feasibility.
11. Investigate the named competitors specifically in There's An AI For That. Earlier proponent and critic research may already have considered competitors; this is a dedicated catalog pass, not the first possible market research.
12. Record the provenance and taxonomy of the catalog evidence. In the source run, access was blocked; the user supplied Supported features. Those labels were preserved without claiming that they were task classifications or directly verified product entries. Official product documentation supported capability comparisons.
13. Refine the pitch and its proposed differences after the competitor investigation. Preserve raw proposals and the critic's report. The source run did not regenerate proposals or perform a second proponent/critic round.

## Procedure invariants recovered from the implementation

- A path selects one existing alternative from every dimension, in dimension order.
- The original draw uses positions 1–4. If a dimension has fewer alternatives, reject an absent position and repeat that dimension, recording every attempt. Do not duplicate a short row to fill the range.
- Reject complete duplicate paths, record the rejection and continue until the requested count is met. Reject a count larger than the box's combinatorial capacity.
- Do not alter a sampled choice to rescue a candidate. A later changed path would be a new, explicitly identified artifact.
- Preserve the seed, random algorithm/version and input snapshot needed to reproduce a run. A port must not silently claim the same seed reproduces a different implementation's sequence.
- Refuse to overwrite an existing run. Preserve original agent outputs; revisions belong in separate artifacts.
- The sampler does not call agents. The orchestrator schedules independent agents within available concurrency, reporting batches accurately when N exceeds the available slots.

## Resolved terminology

The [catalog glossary](../../GLOSSARY.md#morphological-project-selection) distinguishes seed ideas, morphological boxes, morphological paths, project candidates, commercial recommendations and revenue hypotheses. In particular, a path is not itself a project proposal, and a recommendation does not establish observed revenue.

## Design interview

The user requested a reusable operator skill covering N candidates, separate proponents, an independent devil's advocate, suggested adjustments, a revision/consolidation stage, and subsequent competitor research. Q1–Q6 are settled by explicit answers, and Q7 explicitly confirmed the final shared understanding before implementation.

| Question | Decision | Accepted outcome |
| --- | --- | --- |
| Q1 | Output boundary | Deliver a decision package and pitch; hand off implementation |
| Q2 | Revision scope | Revise all N candidates, then perform a new comparative selection |
| Q3 | No viable candidate | Allow rejection of every candidate; distinguish a research lead from a viable business |
| Q4 | Box integration | Markdown and JSON are sufficient; PDF and text-to-morphbox generation are optional |
| Q5 | External framework distribution | Distribute the RCD adaptation with attribution and the complete specific source terms, distinguished from MIT |
| Q6 | Effect of competitor research | Permit withdrawal or reselection among the N revised candidates; research any replacement before closing |

An adverse competitor finding may invalidate the recommendation or change the ranking among already-revised candidates. Research each replacement before accepting it. Preserve the finding and exclusion reason; do not cycle back to a candidate already discarded with evidence. This bounds the research/reselection process by the finite set of N revisions and never authorizes a third generation round.

## Agreed workflow and proposed artifact contract

The core workflow has two candidate rounds. Round one produces N independent proposals. The critic provides candidate-specific feedback; every author revises its own proposal in round two while retaining its original morphological path. The critic then compares all N revisions. Authors do not receive competing proposals. Preserve the original outputs and record each revision separately.

Consolidation is followed by the dedicated There's An AI For That investigation and official-source checks. The critic can withdraw or replace the recommendation in response to that evidence. A final commercial recommendation must account for the competitor evidence rather than silently preserving an earlier conclusion.

The output boundary is a project decision package, rather than a product implementation:

| Artifact | Purpose |
| --- | --- |
| `brief.md`, `ideas.md` | Constraints and normalized seed ideas |
| `morphbox.md`, `morphbox.json` | Human-readable dimensions and structured alternatives |
| `paths.json` | Seed, algorithm/version, input snapshot, accepted paths and rejection log |
| `criteria.json` | Comparison criteria fixed before seeing proposals |
| `prompts/`, `round-1/`, `round-2/` | Full prompts, N original proposals, N revisions and critic reports |
| `research/competitors.md`, `research/sources.json` | Competitor capabilities, catalog labels, provenance and source dates |
| `decision.md`, `project.md`, `validation-plan.md` | Ranking, consolidated scope, objections, economics and future validation |
| `pitch.md` | Timed pitch for a selected candidate, with assumptions and limitations |
| `run.json` | Agent identities, requested/observed models, execution status and artifact hashes |

If every candidate is rejected, the decision and validation plan explain why and what evidence would justify another attempt. Do not force a winning project or a promotional pitch. Any exploratory presentation must explicitly retain the rejection and unvalidated status. The run records that outcome rather than reporting a missing successful pitch as a completed commercial recommendation.

The core box and sampler must work without Python or ReportLab. When explicitly requested and available, text-to-morphbox can also produce a PDF; lack of that optional output does not make the Markdown/JSON exploration incomplete.

```mermaid
flowchart TD
  Ideas[Brief and seed ideas] --> Box[Markdown and JSON morphological box]
  Box --> Paths[N reproducible paths]
  Paths --> First[N independent proposals]
  First --> Critic1[Critic feedback for all N]
  Critic1 --> Second[N revisions preserving paths]
  Second --> Critic2[New comparative selection]
  Critic2 -->|Candidate| Consolidation[Consolidated candidate]
  Critic2 -->|None| NoGo[No-go, reasons and next tests]
  Consolidation --> Research[Catalog and official-source research]
  Research --> Finding{Adverse finding}
  Finding -->|No| Packet[Differences, validation plan and pitch]
  Finding -->|Yes| Reselect{Another revised candidate worth researching}
  Reselect -->|Yes| Research
  Reselect -->|No| NoGo
```

Operational defaults are N = 3 and configurable requested proponent/critic models, respecting available native agent capabilities. Separate context and exclusive outputs preserve independence. The number actually simultaneous is limited by the host, rather than by the requested candidate count. Preserve completed outputs after a partial failure and resume only the missing work; an incomplete round must not be reported as a complete comparison of N. No paid services, public repository creation, outreach or product implementation is implied by running this exploration.

The external framework is [Revenue-Centric Design](https://github.com/heliocosta-dev/revenue-centric-design/tree/1942760c2242f609bf63ce2c97204f5a1791bd68), attributed to Richard (@richardrx). Its supplied terms require attribution, preservation of the full terms in copies/derivatives, and prohibit gambling/betting/casino use. Q5 accepts distributing the adaptation with those specific terms. The [licensing decision](../../.agents/adr/0007-preserve-rcd-reuse-terms.md) records the distinction from existing MIT material; no package has yet been changed or published.

## Catalog implementation constraints

The implementation follows the repository contract: generic English operator instructions, a concise entrypoint with progressive references, Codex picker metadata, catalog and plugin registration, and Node ESM standard-library helpers. The original Python sampler is behavioral reference material; the Node port records its own `splitmix64-v1-low2` reproducibility contract rather than promising Python sequence compatibility.

Validate executable helpers against meaningful behavior, use independent forward-testing for the multi-agent workflow, and run the catalog's required checks. Structural validation alone cannot prove actual isolation, concurrent execution, commercial demand, competitor superiority or financial return. Package publication and local installation remain separate actions.

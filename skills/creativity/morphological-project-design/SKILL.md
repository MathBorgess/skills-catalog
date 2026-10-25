---
name: morphological-project-design
description: "Use when the user brings a project brief and seed ideas and wants distinct project candidates, independent critique, a defensible choice or no-go, and an evidence-backed project and timed pitch before implementation."
metadata:
  author: Matheus Borges
  version: 2.0.0
---
<!-- SPDX-License-Identifier: MIT -->

# Morphological project design

Turn a brief into sampled candidates and a reviewable decision. Authorize analysis and local artifacts only; implementation, outreach, purchases, payments, and publication require separate instructions. Historical credit is recorded in [PROVENANCE.md](PROVENANCE.md).

## Workflow

1. **Preserve and scope.** Create a new run directory. Save the brief, constraints, and original seed representations without rewriting them; keep the seed archive separate from the scoped brief sent to authors. Record missing inputs as unknowns. Use **N = 3** unless requested otherwise. Read [the run contract](references/run-contract.md) before creating files. Preserve every prompt, response, log, and artifact; resume only missing work.
2. **Define the search.** Derive named morphological dimensions from the brief and seeds, with **1–4 distinct alternatives per dimension**. Save the derived box separately from the originals. In `seed-paths.md`, map each seed to representative box choices and identify any choices the box cannot express; keep these explanatory mappings separate from the random draw and author packets. Freeze the evaluation criteria, hard constraint gates, evidence requirements, and sensitivity rules in `criteria.json` before launching authors; use [the evaluation ledger](references/evaluation-ledger.md). Changes require a separately identified run.
3. **Draw once.** Run `node <skill>/scripts/sample-paths.mjs --input <run>/morphbox.json --output <run>/paths.json --count N`, optionally adding `--seed UINT64`. The sampler draws positions 1–4, rejects unavailable positions and duplicate whole paths, and applies no semantic filter. Retain the original input bytes, seed, attempts, and rejected draws. If capacity is below N, resolve the count or box before drawing. Never redraw an inconvenient candidate. Replay using the retained bytes, count, and seed.
4. **Develop round 1.** Launch N independent native authors in clean contexts without inherited coordinator history, one per sampled path, with only the scoped brief, constraints, frozen criteria, and that author's exact path. Give them no original seed narratives or peer outputs. Use [the agent packets](references/agent-prompts.md); retain complete submitted prompts and supplied context. Record requested and observed models, native agent IDs, actual launch batches, and unknown capabilities. If independent native authoring is unavailable, retain the partial run and report it incomplete.
5. **Compare, then revise once.** After all N submissions, an independent critic compares every candidate, checks every sampled choice, and issues candidate-specific feedback. Send each original author only its own submission and feedback. Each revises its own candidate once. Then the critic compares all N revised submissions and checks every path choice again. These are **exactly two rounds**. Preserve replacements and their reasons; do not assign one author another candidate or invent a third round. Apply the frozen gates and ledger; any or all candidates may fail.
6. **Test the provisional choice.** If round 2 yields an eligible leader, research it under [alternatives and pitch](references/competitors-and-pitch.md). Use exact observed There's An AI For That entry, task, and feature labels plus official primary sources. Retain claims, URLs, access dates, provenance, and access gaps. An author-independent critic reassesses each researched candidate using its research path and hash. If evidence rejects it, consider another existing round-2 candidate only after researching it. Never revisit an evidence-rejected candidate; consider at most N candidates.
7. **Record the outcome.** Write `decision.md` and `validation-plan.md` for either outcome. For a selected candidate, also write `project.md` and `pitch.md`; default pitch duration is at most five minutes, with speech markers and an estimate declaring speaking rate and pauses. For no-go, omit project and pitch and specify the next evidence needed. All economic figures are scenarios or evidence-backed inputs, never claimed outcomes.
8. **Seal and check.** Create a schema-2 `run.json` with hashes and the complete bundled `MIT-LICENSE.txt`, byte for byte. Run `node <skill>/scripts/check-run.mjs <run>/run.json`. A structural pass does not prove isolation, path fidelity, research quality, viability, or legal certification; review those separately. Historical runs retain their original schema, evidence, and terms.

## Done-check

- [ ] Original inputs, frozen criteria, exact draw bytes, all prompts, responses, execution records, and both complete rounds remain intact.
- [ ] Every path choice was reviewed twice; authored revisions, replacements, research, and post-research reviews are attributable.
- [ ] The ledger distinguishes purchaser benefit from provider contribution, exposes unknowns, and counts each cost once.
- [ ] The decision explains selection or rejection against the frozen gates; research limitations and next evidence are explicit.
- [ ] Required outcome files and byte-identical MIT notice are hashed; structural results and semantic limitations are reported separately.

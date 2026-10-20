---
name: morphological-project-design
description: >-
  Use when the user wants to turn seed ideas into a morphological box, explore N
  independent project proposals, challenge their revenue potential with a devil's
  advocate, revise every proposal, investigate competitors and prepare a project
  decision package or pitch. Stops before implementing the selected product.
metadata:
  author: Matheus Borges
  version: 0.0.0
---

# Morphological Project Design

Turn ideas into a project worth testing through reproducible combinations, two independent proposal rounds and evidence-aware commercial review. Work in the requester's language.

This instructional workflow adapts **Revenue-Centric Design by Richard (@richardrx)**. Read [provenance](PROVENANCE.md) and preserve the [complete source terms](RCD-LICENSE.txt); they exclude gambling, betting and casino use. Do not apply this adaptation to excluded projects. Original helper scripts are MIT; this instructional material has the specific RCD terms.

1. **Frame the run.** Read [the run contract](references/run-contract.md). Recover the brief, seed ideas, constraints, audience, deliverables and available agent tools. Use N = 3 unless specified; quantity and requested models are configurable. Resolve material unknowns without repeating decisions already made. Create a new run directory and preserve its original inputs.
2. **Build the box.** Normalize the seed ideas, derive dimensions with one to four distinct alternatives each, and write `ideas.md`, `morphbox.md` and `morphbox.json`. Preserve representative paths for the seed ideas separately from the random exploration. PDF through text-to-morphbox is optional; Markdown and JSON suffice.
3. **Freeze criteria and draw N paths.** Read [the commercial review](references/revenue-centric-review.md), record criteria before seeing proposals, then run `node <skill-dir>/scripts/sample-paths.mjs --input <run>/morphbox.json --count N --output <run>/paths.json`. Supply `--seed` for replay. Never filter or repair random paths for coherence or profitability. Preserve the seed, algorithm, attempts and input bytes.
4. **Generate N independent candidates.** Read [the agent prompts](references/agent-prompts.md). Use one native subagent per path with a separate initial context, scoped brief and exclusive output. Supply its path, not the seed ideas or peer proposals. Run concurrently within available slots; record actual batches. If independent delegation is unavailable, report that capability gap instead of simulating N agents yourself.
5. **Challenge every candidate.** Once all N outputs exist, use a separate devil's advocate to audit each path, compare commercial assumptions and produce feedback for every candidate. Preserve its full report and extract only candidate-specific feedback for each author. A score is a judgment, not evidence of demand.
6. **Revise all N and select again.** Each author revises its own candidate once, preserving its path and responding to its feedback. Preserve both versions. After all N revisions exist, the critic compares them again and can reject every candidate. There are exactly two candidate-generation rounds; do not silently add a third.
7. **Consolidate and investigate competitors.** Read [competitors and pitch](references/competitors-and-pitch.md). Consolidate the provisional choice, then research its alternatives in There's An AI For That and official sources. Preserve exact catalog labels, links, dates and provenance. If access is blocked, record the gap and use clearly attributed user-supplied evidence; never bypass a safety block or invent tasks.
8. **Reassess using the findings.** The critic may withdraw the recommendation or choose another of the N revised candidates. Research every replacement before closing. Preserve the selection history and reasons for exclusion; never revisit an evidence-rejected candidate or regenerate candidates. End with a researched candidate or an explicit no-go decision.
9. **Deliver and check.** Write `decision.md`, the consolidated project, financial validation plan and timed pitch when a candidate remains. If none remains, deliver the rejection and next tests without inventing a winner or promotional pitch. Complete `run.json`, copy the RCD terms into the run, and execute `node <skill-dir>/scripts/check-run.mjs <run>/run.json`. Resume missing artifacts after failures without overwriting completed work.

## Done-check

- Original ideas, box, input bytes, distinct sampled paths, criteria, full prompts and both sets of N proposals are preserved.
- Both critic reports audit morphological fidelity; the research and final recommendation reflect actual sources and any substitutions.
- Native delegation records distinguish requested models, observed models and unknowns; concurrency and isolation are not inferred from JSON alone.
- The run checker passes for structure and hashes; semantic fidelity, commercial evidence and pitch timing are reviewed separately.
- Assumptions, source gaps, costs, observed outcomes and proposed tests remain distinguishable. The package ends before MVP construction, outreach, charges or publication.
- Attribution and complete RCD terms accompany the adaptation and generated decision package.

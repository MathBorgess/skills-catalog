# Morphological project design: validation

| Surface | Status on 2026-10-20 |
| --- | --- |
| Implementation | Proposed release branch; not yet published or installed |
| Helper behavior | 22 automated tests passed; full catalog check passed |
| Native workflow | One synthetic N = 2 run completed both proposal rounds |
| Research | Limited supplied evidence; no current catalog or product verification |
| Commercial outcome | No customer use, willingness to pay or revenue observed |

## Automated checks

The [sampler tests](../../skills/creativity/morphological-project-design/scripts/sample-paths.test.mjs) cover a known random sequence, reproducibility, rejected positions, duplicate paths, invalid boxes, impossible counts, exclusive output creation and execution through an installed directory symlink from another working directory. The Node algorithm has its own versioned contract; it does not claim Python `random.Random` compatibility.

The [manifest checker tests](../../skills/creativity/morphological-project-design/scripts/check-run.test.mjs) cover both complete rounds, checksum and source tampering, invalid draw replay, repeated physical output files, declared critic/proponent identity conflicts, missing replacement research, selection cycles, a rejected-all decision, incomplete execution, missing required package files and changed RCD terms. These are structural fixtures, not native behavioral evidence for those decision branches.

`npm run check` passed, including the 22 new helper tests. The skill-creator validator, Markdown link checks and `git diff --check` also passed. A package dry run includes the skill's runtime files and both license notices. The bundled MIT notice matches the root license; the complete RCD terms match the pinned source bytes with SHA-256 `29e6d8b0a1e3dd78776b46b22b9a9a3df94fdbf6a73482f59d688dee7fd38e32`. No package publish or local skill linking was performed.

## Independent forward-test

A separate runner received a synthetic brief for independent consultants preparing paid workshops. It read the installed-shaped skill directory without an expected project answer. The brief used three seed ideas and requested two candidates, a two-week prototype plan and a Portuguese decision package. No prototype was implemented.

The runner created eight dimensions with three alternatives each, froze comparison criteria, and sampled two distinct paths with seed `2026102001`. Two native proponents ran concurrently in each of the two rounds; the original authors were reused for their revisions. Each received its own path and feedback, without competing proposals. A separate critic compared both rounds and reviewed the selected candidate again after documentary research. Seven invocations were recorded. The manifest checker reported:

```text
STRUCTURE OK: 2 paths, two complete rounds; decision=selected; 23 file checks.
```

A subsequent independent code review found that the checker did not require the decision package's core files. The checker and run-contract reference were then strengthened, with two regression tests requiring the deliverables and byte-identical RCD terms. The original native manifest and outputs were preserved. Rechecking that unchanged manifest with the checker at that stage passed 24 file checks, including the separately recorded criteria. This is a post-test structural correction, not another native proposal round.

The final recommendation prioritized one candidate for future validation. No substitute or third proposal round was generated. The supplied research packet contained catalog feature excerpts and dated summaries of official documentation. The runner made no TAAFT request and no current product checks. Product entry URLs, task labels, current prices and hands-on comparisons remained unknown; research was explicitly `limited`.

The package included preserved initial proposals, revisions, feedback, prompts, reviews, decision, consolidated project, validation plan and pitch. The pitch had 388 spoken words: 194 seconds at 120 words per minute, or 224 seconds with a 30-second pause allowance. This is a duration estimate without human rehearsal.

## Deviations and limits

- **Source immutability failed for one documentary file.** During the test, the parent author changed `PROVENANCE.md` to correct the historical source pointer and link the bundled MIT notice. The runner preserved the original copy, failed check and parent declaration. Its measured hashes for `SKILL.md`, the RCD license and all four references remained unchanged. Initial helper hashes were not captured by that runner; the parent reported no helper changes. Final license/package checks were performed separately. Do not describe the entire checkout as immutable during this test.
- **Revision length exceeded the target.** The runner exempted its response-to-critic table from the approximately 500-word target in addition to the path mapping. Revised outputs reached approximately 1,143 and 1,089 words excluding mapping/license. Those originals remain preserved. No third round was used to hide this deviation.
- **Coverage is bounded.** Native execution exercised selection and retention after limited research. Post-research substitution and rejected-all outcomes have structural test coverage but were not observed in this native run. Only N = 2 was exercised natively; default N = 3, larger batches and model overrides remain unverified in that setting.
- **Isolation and model identity have limits.** Fresh native contexts and concurrency snapshots document the mechanism observed. They do not prove complete context isolation or sandboxing. Requested models inherited defaults; the served model was not exposed and remains unknown.
- **Validation is not a market result.** Correct arithmetic under synthetic assumptions, complete artifacts and a critic's ranking do not establish demand, delivery costs, competitive advantage, financial return or spoken pitch duration.

Raw prompts, outputs, native lifecycle evidence, checks and deviations were retained locally for owner review. This public page records the generic findings without publishing the private execution trace.

## Pre-merge structural corrections

Review of the proposed release found two further gaps: a manifest could pass without submitted prompts, and declared authors could switch candidates between rounds. The checker now requires a hashed, nonempty prompt file and native agent ID for each proposal/review, checks additional invocation prompts when recorded, and verifies author continuity. A replacement remains possible when its record names that candidate's initial author and gives a reason; an author from another candidate cannot serve as its replacement.

Six regression tests cover missing, changed, empty and aliased prompt files; additional prompt hashes/IDs; missing identities; undeclared or mismatched replacements; legitimate replacement recovery; and swapped candidate authors. The helper suite now has 28 passing tests. These are structural fixtures. The earlier native N = 2 run was not repeated, and its preserved manifest was not rewritten to claim compliance with these new required fields. Submitted-prompt fidelity, completeness of the invocation inventory and actual context isolation still require host evidence and review.

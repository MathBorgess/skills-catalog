<!-- SPDX-License-Identifier: MIT -->

# Alternative research and outcome files

Research begins after the second comparative review. Its purpose is to test the provisional choice's decisive claims against observed alternatives and primary evidence. Do not create a third author round.

## Research one eligible round-2 candidate

1. State the candidate, its round-2 artifact path/hash, the provisional claim, and the evidence that could disprove it.
2. Search **There's An AI For That** for relevant tasks and alternatives. Retain query text, access date, search scope, and result limitations. Copy entry, task, and feature labels exactly as observed; identify each as an entry, task, or feature. Record “not observed” when a label was not visible. Never invent a directory label from the candidate's wording.
3. Follow relevant entries to official product, documentation, pricing, or other primary-source pages. Attribute each claim to the page that supports it. Record contradictions or differences between directory labels and official capabilities rather than choosing whichever helps the candidate.
4. Compare the candidate with the observed alternatives using the frozen criteria. Distinguish listed capabilities from tested behavior; do not imply hands-on verification unless it occurred within separate authorization.
5. Retain the candidate's research in a unique file under `research/` and record its hash. Update the retained source record by creating a new immutable snapshot while work is active; create the final `research/sources.json` once when the research sequence is complete.

For each material claim, retain the candidate ID, exact claim, URL, access date in `YYYY-MM-DD`, and provenance: directory entry, official primary source, or another clearly identified origin. In the candidate's research notes, retain exact observed labels, relevant extracts or concise observation notes, scope, and limitations. A directory listing establishes what was listed, not completeness, accuracy, or purchaser demand.

If access is blocked, requires unavailable credentials, or a useful label cannot be observed, stop that access attempt and record limited research. Do not bypass controls, infer the missing content, claim no competitors exist, or treat sparse search results as absence evidence. Alternative primary evidence may still be collected; state which required observations remain unavailable.

`research/sources.json` uses **schemaVersion 1**:

```json
{
  "schemaVersion": 1,
  "sources": [
    {
      "proposalId": "proposal-01",
      "claim": "The exact claim supported by this page",
      "provenance": "Official documentation; observed feature label retained in the candidate research notes",
      "url": "https://example.org/documentation",
      "date": "2026-01-15"
    }
  ],
  "gaps": []
}
```

Use the actual access date, never the example date. If a URL or date is unknown, use JSON `null`, add a nonempty `limitations` field on that source, and mark the candidate's research `limited`. Gaps take the shape `{"proposalId":"proposal-01","notes":"Specific missing access or evidence"}`; gaps require a limited candidate. Each researched candidate needs a source or an explicit gap. A source entry's presence does not establish that its claim was verified.

## Evidence review and bounded replacement

Send each researched candidate to an author-independent native critic with its exact research path/hash and complete source records. The critic may also have conducted the two comparative reviews; it must differ from all authors and replacements. Retain its full prompt and a distinct output file. Record `researchPath` and `researchSha256` on the review.

Reassess against the frozen gates. If evidence rejects a candidate, record the reason and never revisit it within this run. A replacement must be another existing round-2 candidate that survived the relevant earlier gates. Research and review the replacement before making it the selected outcome. Do not invent a new candidate, alter a path, ask for another author revision, or silently weaken a criterion.

Keep selection history in order, with unique candidate IDs and each candidate's recorded research path. Include researched provisional choices that were later rejected. The sequence contains at most N candidates. If none supports selection, record `rejected_all`. Limited research may support only the uncertainty treatment allowed by the frozen criteria; it never silently becomes complete evidence.

## Decision and validation plan — both outcomes

`decision.md` is a distinct final record, not an alias or hard link to another artifact. State:

- Selected candidate ID or no-go; all N candidates considered and their decisive gate findings.
- The frozen comparison rule, round-2 provisional choice, research sequence, evidence-driven rejections, and final rationale.
- Source limitations, unresolved assumptions, scenario sensitivities, and any conditions attached to selection.
- What the structural checker verified and what still depends on semantic review.

`validation-plan.md` specifies the next evidence, tests, observable rejection conditions, required resources or permissions, and the decisions each result would change. For no-go, explain what would justify a new run. A new run is distinct from revisiting a rejected candidate in the sealed run.

## Selected outcome only

Write `project.md` with the selected candidate's scope, intended users and purchaser, concrete behavior for every path choice, supporting ledger, resources and boundaries, economic scenarios, unresolved assumptions, and evidence needed next. Specify the user's sequence of actions, controls and approval points; identify planned technologies and any required model's role during use. Map the requested time budget to milestones and an observable completion criterion. Describe proposed work without executing it.

Write `pitch.md` as a speakable script. Unless the user requests another duration, keep the estimate at **five minutes or less**. Enclose only spoken text between `<!-- speech:start -->` and `<!-- speech:end -->`. Put delivery notes, timing calculations and pause allowances outside that span. Count spoken words inside the markers, declare the assumed speaking rate and total pause time, and calculate:

`estimated seconds = spoken words / words per minute × 60 + pause seconds`

Record that this is an estimate, not a timed performance. Explain the problem, proposed response, intended user and purchaser, observed alternatives and specific distinction, evidence and limits, scenario economics, and next validation decision. Describe how a person operates the proposed tool and retains control, which technologies are planned, and where a model acts during use if required by the brief. Explain how milestones and the completion criterion fit the user's available schedule. Do not describe assumptions as traction, model outputs as customer findings, or estimates as achieved results.

For no-go, create neither `project.md` nor `pitch.md`. Preserve all candidate drafts, reviews, research, prompts, and logs.

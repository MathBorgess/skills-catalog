# Competitors, differences and pitch

Use this reference after the second comparative selection and provisional consolidation. Candidate authors may have researched alternatives earlier; this phase specifically checks the selected candidate against catalog and official-source evidence.

## Competitor investigation

Search There's An AI For That for the user's task and the closest products. Record the exact product-entry URL when accessible, exact task labels and their URLs, and separately any Supported features or other taxonomy actually displayed. A feature page does not establish a task classification or product entry. Suggested search terms are not verified catalog labels.

Follow official product documentation for concrete claims about capabilities, usage boundaries and current prices. Keep the source date, URL, specific supported claim and provenance in `research/sources.json`. If a price affects the financial comparison, verify the applicable plan and conditions rather than recycling old catalog copy. Do not infer a product lacks a feature because the supplied list omits it. Distinguish a broad AI suite from the individual module linked in an excerpt.

If access is blocked, respect the block. Do not route through alternate fetchers, mirrors or another browser to obtain the same prohibited access. Record what is missing, request the relevant text/links from the user and continue permitted work. User-supplied excerpts remain attributed to that message, with the date received and unknown publication date when appropriate. A final `limited` research record can preserve the gap; it must not be called directly verified catalog research.

Use a comparison such as:

| Alternative | Supported overlap and source | Exact catalog label/type/link | Proposed useful difference | Evidence still needed |
| --- | --- | --- | --- | --- |
| Existing product or manual workflow | Specific documented capability | Task, feature or unavailable | Testable mechanism for the initial payer | Measured task outcome and willingness to pay |

Include the current manual workflow and a generic model plus common tools when relevant. Editing, human control or AI generation alone seldom establish exclusivity. A useful proposed difference identifies a specific task, workflow constraint and observable benefit, without claiming superiority before comparison.

## Source record

Write `research/sources.json` whenever any candidate has a research entry, and hash it in `run.artifacts`. Use this shape:

```json
{
  "schemaVersion": 1,
  "sources": [
    {
      "proposalId": "proposal-01",
      "date": "2026-10-20",
      "url": "https://example.org/product/docs",
      "claim": "The specific capability supported by this source.",
      "provenance": "Official documentation directly consulted on the recorded date."
    }
  ],
  "gaps": []
}
```

Every source names a candidate recorded in `run.research` and includes `date`, `url`, `claim` and `provenance`. Dates use `YYYY-MM-DD`; provenance explains whether that is publication, consultation or receipt. URLs use HTTP(S). Claims and provenance are nonempty. For limited research, an unknown date or original URL is `null`, accompanied by a nonempty `limitations` field. User-supplied excerpts identify the originating message or retained input in `provenance`; keep them distinguishable from direct verification. The example is a schema fixture, not a consulted competitor.

If limited research produced no usable source, keep `sources` empty for that candidate and add `{"proposalId": "proposal-01", "notes": "<what was blocked or unavailable>"}` to `gaps`. A `complete` research entry requires at least one source record. A no-go before research requires no source file; a no-go after research preserves its sources and gaps. Structural validation checks the fields and references; it does not establish that the source supports the claim.

## Reassessment and bounded reselection

Give the findings to the critic. Record the provisional candidate, finding, rationale and transition in `decision.md` and `decision.selectionHistory`. The critic can retain the candidate, choose a different already-revised candidate or reject all. Research each replacement before accepting it. Preserve rejected candidates and exclusion evidence; never restart the generation process or cycle through the same rejected candidate.

`complete` research means the planned documentary investigation was performed, not that buyers or the market were validated. `limited` means the record contains explicit gaps. Official descriptions are not hands-on testing, and hands-on success would still not establish financial demand.

## Financial validation plan

State the payer hypothesis, unit of sale, price/cost assumptions, initial reachable channel, proposed payment/value test, effort limit and stopping criteria. Separate revenue, contribution and buyer benefit. Declare which costs or taxes remain unknown and which metric would change the recommendation. No customer contact, offer, payment or result has occurred merely because a plan exists.

## Pitch

Use five minutes as the default maximum, or the user's explicit limit. Write only the spoken script inside `<!-- speech:start -->` and `<!-- speech:end -->` markers, with supporting material outside them. Estimate duration from its word count at a declared speaking rate and preserve time for pauses. Call this a textual estimate until a person rehearses it.

Cover six questions:

1. What is it, what task does it support and how will it work?
2. Who uses it, who pays and what benefit could justify the purchase?
3. How does the person interact, make choices and obtain a useful result?
4. Which products/tasks are similar, what overlaps and which proposed differences remain to test?
5. Which tools and technologies are planned, and where does the model act if the brief requires AI during use?
6. Why is the scope feasible within the actual time available, with milestones and a completion criterion?

Do not reuse an old academic calendar as a universal timeline. Distinguish planned implementation from working software, proposed economic benefit from measured value, and agent selection from commercial validation. A no-go result needs reasons and next evidence, rather than a fictional winning-project pitch.

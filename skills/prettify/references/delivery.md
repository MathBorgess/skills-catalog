# Delivery and evidence

Keep each run's brief, decisions, and evidence in `.prettify/<slug>/BRIEF.md`, `DECISIONS.md`, and `EVIDENCE.md`. Keep produced previews in `low/` and `high/` only when those folders contain files. Put the final artifact in the project's normal location, or an agreed output folder for static work. Preserve existing work; do not overwrite unrelated artifacts.

For a web interface, deliver the implemented, navigable work in the project. Preserve the prototype question, relevant content, and behavior. Disclose any structural change that affects behavior. Inspect the main interaction and meaningful states at the agreed viewport sizes, including keyboard access and reduced motion where applicable. A screenshot alone does not verify behavior.

For a static piece, export the agreed format and dimensions. Open and inspect the actual exported file at its intended display scale for crop, overlap, and text readability. For carousels, inspect the entire sequence for consistency and progression. A preview is not evidence that the final export is correct.

Append observed checks and limitations to `EVIDENCE.md`. Create `.prettify/<slug>/run.json` with the helper's v1 manifest, using paths relative to that run folder, and invoke `node <installed-skill>/scripts/check-run.mjs <run.json>`. Include a receipt for each completed or skipped stage, each required dependency, the design decision, the question result, and final inspection. Receipts record observed evidence and decisions; never fabricate them to make the command pass. A skipped stage has status `skipped`, receipt decision `skip`, and a concrete reason. A required refused or unavailable dependency blocks completion. Record final inspection as `unverified` when it could not be done; this is an incomplete run. A rejected design decision stops the run. Record helper output in `EVIDENCE.md` and resolve its reported errors before claiming completion.

The helper reads only local declarations and files. A pass checks manifest consistency and file presence; it cannot authenticate human decisions, agent or provider execution, or design quality. Do not claim that a receipt proves more than its observed content.

Report two findings separately:

1. **Question result:** answered or inconclusive, with the observation supporting the result. State when the artifact cannot establish the answer.
2. **Visual assessment:** observed fit against the accepted `DESIGN.md` or run-specific direction, concrete defects, and unperformed checks. Do not convert visual preference or technical checks into evidence of task success.

Do not publish or deploy the result as part of this workflow unless the user separately requests and authorizes that work.

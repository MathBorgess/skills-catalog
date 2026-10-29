# Delivery and evidence

Keep each run's brief, decisions, and evidence in `.prettify/<slug>/BRIEF.md`, `DECISIONS.md`, and `EVIDENCE.md`. Keep produced previews in `low/` and `high/` only when those folders contain files. Put the final artifact in the project's normal location, or an agreed output folder for static work. Preserve existing work; do not overwrite unrelated artifacts.

For a web interface, deliver the implemented, navigable work in the project. Preserve the prototype question, relevant content, and behavior. Disclose any structural change that affects behavior. Inspect the main interaction and meaningful states at the agreed viewport sizes, including keyboard access and reduced motion where applicable. A screenshot alone does not verify behavior.

For a static piece, export the agreed format and dimensions. Open and inspect the actual exported file at its intended display scale for crop, overlap, and text readability. For carousels, inspect the entire sequence for consistency and progression. A preview is not evidence that the final export is correct.

Append observed checks and limitations to `EVIDENCE.md`. Record human choices, stage skips, dependency outcomes, the question result, and final inspection in the Markdown run record whether or not a machine-readable handoff is requested. Create `.prettify/<slug>/run.json` from the [v1 manifest reference](run-manifest.md) when the owner requests a machine-readable handoff or automation. If you create one, invoke `node <installed-skill>/scripts/check-run.mjs <run.json>` and record its output in `EVIDENCE.md`. In that manifest, include a receipt for each completed or skipped stage, each dependency, the question result, and final inspection. Receipts record claims and evidence; never fabricate them to make the command pass. A skipped stage has status `skipped`, receipt decision `skip`, and a concrete reason. A required refused or unavailable dependency stops the dependent work. Record final inspection as `unverified` when it could not be done; report the limitation. A rejected design decision stops the run. If the selected checker reports errors, call the structural check failed and report the errors; do not describe it as a passing or successful check.

The helper reads only local declarations and files. `complete: true` means only that the declared manifest passed structural checks and referenced files were present; it does not mean the workflow itself is complete. It cannot authenticate human decisions, prove agent or provider execution, or judge visual quality. Do not claim that a receipt proves more than its observed content.

Report two findings separately:

1. **Question result:** answered or inconclusive, with the observation supporting the result. State when the artifact cannot establish the answer.
2. **Visual assessment:** observed fit against the accepted `DESIGN.md` or run-specific direction, concrete defects, and unperformed checks. Do not convert visual preference or technical checks into evidence of task success.

Do not publish or deploy the result as part of this workflow unless the user separately requests and authorizes that work.

# Evaluate the activity and domain personality

Keep the evidence in `<workspace>/iteration-<n>/`. Use the brief's bounded budget; default to one initial pass and at most two revision rounds. Do not interpret a budget as permission for paid services or live bot actions beyond the user's scope.

## 1. Check the structure and discovery

Run `node <skill-home>/scripts/check-package.mjs <out>` from any directory. A zero exit means the required package shape is present, not that its content is correct. Inspect author, activity naming, source support and actual reference loading yourself.

Use `evals/evals.json` to test discovery with the host's skill list. Test both positive task prompts without practitioner names and negative adjacent-task or biography prompts. Record the registered descriptions, prompt, expected selection and observed selection in `triggers.md`. If no real harness is available, a metadata-only review is a useful walkthrough; label actual selection **not run**.

## 2. Run practical cases

For every case, save the exact prompt, supplied inputs, produced artifacts and execution transcript. Cover:

| Kind | What the case must expose |
| --- | --- |
| Normal | A representative deliverable that needs the domain's decisions. |
| Missing input | A crucial absent fact; the agent asks or states a bounded assumption instead of fabricating it. |
| Conflicting guidance | Two methods pointing in different directions; the result explains its choice against the task's constraints. |
| Out of scope | A request outside the activity; the agent states the boundary instead of applying the persona to everything. |

Compare two conditions with the same prompt, inputs, tools, model and settings where controllable: the activity without the generated package, and with it. Start with fresh sessions when available; keep outputs in `without-skill/<case-id>/` and `with-skill/<case-id>/`. Record what differed when conditions cannot be matched. A same-session walkthrough may find defects but is not an independent benchmark. Do not invent token counts, timings or tool executions.

## 3. Critique with complementary domain lenses

Use the generated `references/review-rubric.md`. Remove practitioner labels and condition labels from the presented outputs where practical, so reputation and expected winners do not decide the result. Give each lens the task, artifact and its own source-backed criteria. Record in `reviews.md`:

| Case / condition | Lens / criterion | Method and source | Output evidence | Verdict | Defect and correction |
| --- | --- | --- | --- | --- | --- |
| Case ID and input/output paths | The actual criterion | M/S IDs with locator | Exact passage, artifact property or check output | pass, fail or unverified | What must change, or why no change is needed |

Use deterministic checks for objective properties and domain judgment for substantive quality. An absent required fact is unverified, never a pass. A polished voice cannot compensate for an incorrect result. Every blocking criterion must pass before declaring a case accepted. For divergent lenses, resolve the disagreement against task evidence and the brief; record a material unresolved conflict as a failure.

If one model supplies all critiques, disclose that fact. Several named lenses do not create several independent experts. Say "reviewed against criteria adapted from the sources", never "approved by" the real practitioners.

## 4. Revise the workflow, then retest

For each observed defect, change the relevant method, input rule, profile priority or workflow step; do not merely change the expert's voice. Save the previous version and defect in `revisions.md`. Rerun affected cases and the scope/discovery cases after a trigger change. Preserve failed outputs so improvement remains reviewable.

In `results.md`, record:

- The package revision, model/harness/settings, available tools and evaluation mode.
- Structural check result and evidence path.
- Expected and observed discovery for each trigger, or **not run**.
- Passed, failed and unverified criteria per condition, with output and review paths.
- Baseline comparison and material regressions. Claim improvement only where observed on comparable runs.
- Revisions, remaining defects, shared-model limitations and which evidence remains unavailable.

Use one delivery status: **validated** (structure, actual discovery and practical cases passed both lenses), **needs revision** (an observed blocking failure remains), or **unvalidated** (required execution, evidence or sources are unavailable). A package may be delivered as unvalidated; do not call it validated to make the done-check appear complete.

Leave a numeric finding from actual evaluations: accepted practical cases / executed cases for each condition, and correct observed selections / executed trigger prompts. Exclude unrun items from denominators and report them separately; do not turn missing evidence into zeroes or successes. These small samples describe the observed cases, not a statistical guarantee.

# Revision-bound review and attempt records

`node <skill>/scripts/workflow.mjs` manages private run records. It validates record shape, artifact hashes and dependency consistency. It cannot certify human authorship, semantic fidelity or taste; copy responses only from actual human feedback. The agent's assessment never supplies the human decision/criticism fields.

## Submit a complete stage

Save a JSON input in the private run, then call `workflow.mjs submit <run> <input.json>`:

```json
{"gate":"moodboard","revision":"v1","artifacts":["boards/moodboard.html","direction.md"],"dependencies":[]}
```

Gate names, in order: `moodboard`, `frames`, `storyboard`, `motion-preview`, `final`. Each stage requires acceptance of its previous stage. Add attempt IDs or other packet IDs in `dependencies` when the packet uses them. Images and planning packets require prior acceptance; in `complete-video` mode, motion-preview can bind completed video attempts without individual human reviews. Include every artifact whose change affects that decision; do not rely only on a mutable link.

New runs default to `video_review_mode: "complete-video"`. The storyboard packet must include an ordered, distinct `video_shots` array, for example `["opening", "repair"]`. That list is part of its immutable review key. The adapter permits the next listed shot after a successfully generated current video; it does not permit an unreviewed retry, skipped shot or extra variation. Use `compose.mjs new ... --video-review-mode per-attempt` only when the human requests individual video reviews. Existing runs without the field retain their earlier per-attempt contract; do not silently change a run's recorded policy.

Submission copies artifacts and TO-SPEC into `reviews/<packet-id>/<key>/`. The returned key identifies the exact revision. Source files remain checked against their submitted hashes; changing a current artifact makes its decision stale. Register a new revision before resubmission; descendants become stale only through their recorded dependency links. Updating current TO-SPEC alone does not erase independent artifact approvals; each packet retains its own snapshot.

A human may review the current intact outcome of an attempt made obsolete by an upstream revision, to discard it or specify the next scope. That response does not restore its validity for delivery. Changed attempt artifacts or a superseded outcome key cannot receive a response.

## Record the actual human response

Save a response and call `workflow.mjs review <run> <response.json>`:

```json
{
  "key":"<submitted-key>","actor":"human","decision":"accept",
  "criticism":"The cause and recovery read clearly; nothing needs changing.",
  "evidence":{"source":"<human-message-reference>","quote":"<actual response, verbatim>"}
}
```

Use `accept`, `revise` or `reject`; criticism must be explicit and nonempty. Approval without criticism, criticism without a decision, silence, generic continue and revision mismatch stay pending. A revise/reject response must describe the desired refinement before a new scoped attempt; do not interpret a plain rejection as spending authorization. For an explicit later override use decision `override`, a precise nonempty `scope`, actual source/quote and `waive:["criticism"]` and/or `waive:["uncertain-submission"]`. Such a record reports a human override, not an inferred stage approval.

For an individual attempt response also record `next_attempt`: `"stop"`, a precise `{"gate":"motion-preview","shot":"shot-01"}`, or `"continue-plan"` after acceptance. Copy the human's intended next step; never turn a stop request or plain rejection into generation authority. A scoped next attempt must match both gate and shot. In complete-video mode, leave individual video reviews unrecorded; the aggregate packet records the actual human decision. A recorded individual stop/reject/scope still controls the next call.

Responses are retained under each packet's `responses/`. Put decision, criticism, evidence, affected dependencies and next step into TO-SPEC as well; JSON is a procedural companion, not a replacement for the complete readable context.

## Images through any chosen tool

Reserve before generation:

```json
{"type":"image","provider":"gpt-image","gate":"frames","shot":"opening","prompt":"<reviewed direction>","inputs":[]}
```

Call `workflow.mjs start <run> <request.json>`. It snapshots TO-SPEC and input files and returns an attempt ID. Call the selected image tool once. Inspect output, then call `workflow.mjs finish` with:

```json
{"id":"attempt-0001","outcome":{"status":"generated","note":"<inspection findings and limits>","artifacts":["styleframes/opening.png"]}}
```

Statuses are `generated`, `blocked`, `failed`, `uncertain`; retain concrete failure reports too. `finish` returns a review key binding request/spec/input snapshots, available command/log receipts, outputs and recovery evidence. Generated outcomes verify the reserved request/input hashes. Review each image attempt before another generation. A reviewed individual image does not accept an unseen complete frame packet: record its review before submitting the dependent frame packet. Video attempts use `gflow.mjs generate`, which reserves and finishes the attempt automatically.

For videos, do lightweight technical checks per file, then join the complete sequence and inspect it once before editing/finishing. Submit motion-preview with the playable complete video, its inspection record and every source or unresolved completed video attempt ID in `dependencies`, including unreviewed terminal failures. Include separately disposed/rejected attempts as retained report artifacts; their response does not approve reuse as a source. Acceptance covers the dependency keys without fabricating individual human reviews. Status reports aggregate review separately. Uncovered attempts and stale clips cannot enter final delivery. A human may explicitly delegate intermediate review and request only the finished-film approval; record that scoped instruction as an override, without claiming the human watched unseen clips.

For interrupted runs, inspect existing receipts first. A completed uncertain attempt can be recovered into another outcome revision of the same attempt. A started attempt may be finished after checking whether submission happened. An uncertain outcome blocks replacement until recovered or explicitly abandoned by a scoped human response. Never run an automatic retry loop.

## Resume and validation

Run `workflow.mjs status <run>` and read TO-SPEC, latest packets, responses and attempt receipts. Attempt validity (`current`, `stale`, `unfinished`) is separate from the historical human response. For a workflow lock left by a crash, inspect its PID and process state before removing it; never delete a live process's lock.

`compose.mjs check` validates a final prepared package after moodboard, frames, storyboard and full preview acceptance (or scoped human override), with gflow sources covered by that preview. Final acceptance itself remains a separate human record. Legacy schemas 1–3 are readable through compose only; start a new run from their preserved source/context to use this workflow.

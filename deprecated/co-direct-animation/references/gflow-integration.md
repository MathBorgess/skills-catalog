# Google Flow through gflow-cli

The integration uses the external [gflow-cli](https://github.com/MathBorgess/gflow-cli) executable. It does not vendor its runtime or adopt its production skills. The inspected baseline is commit `cdb2f2c6937393103c0a07bc022537dc9f9278cb` (package 0.83.2). Verify the installed version/help before execution; capabilities differ by host/account/model and can change.

## Discover and report

Run `node <skill>/scripts/gflow.mjs probe`. This reads CLI version/catalog, not account entitlement or successful generation. Report executable availability, saved session, requested input controls and observed generation as distinct facts. Use the external project's setup/auth documentation when runtime or login is missing; prepare the current review packet and report the blocker. Do not read/copy credentials or generate a code animation as a replacement.

The baseline supports text-to-video, local initial/end-frame image-to-video and reference-to-video. Video aspect choices are 16:9 and 9:16. Veo choices accept 4/6/8 seconds; Omni also accepts 10. R2V Quality is refused; Omni permits up to seven reference images, other supported R2V models up to three. The migrated driver further restricts R2V to eight seconds and refuses some UUID/entity inputs. The adapter does not silently remove a setting/reference to evade a refusal. Check the actual account controls before promising the shot.

## Prepare one planned shot

After moodboard, frame and storyboard acceptance, save a private run-relative request:

```json
{
  "shot": "shot-01",
  "mode": "i2v",
  "model": "veo-lite",
  "aspect": "16:9",
  "duration": 8,
  "profile": "<chosen-profile>",
  "project": "<chosen-project>",
  "inputs": ["styleframes/opening.png", "styleframes/resolution.png"],
  "prompt": "<descriptive handoff plus accepted action, camera, invariants and exclusions>"
}
```

Use `t2v` with no image inputs only when the accepted shot calls for it. `i2v` takes one or two images in initial/end order; `r2v` takes reference ingredients. Copy supplied external images into the private run, preserving their source and inspected hashes. Include them and the handoff in the relevant creative review packet. The adapter snapshots the exact images before submission; Flow receives actual files and prompt text, not DESIGN.md/TO-SPEC automatically.

Run `node <skill>/scripts/gflow.mjs generate <run> <request.json>`. It reserves one attempt, checks the command surface, revalidates direction/input hashes and accepted prerequisite revisions, then submits one `gflow video ... --count 1 --output ... --json` operation with literal arguments and no shell. It does not add a prompt rewriting tool, batch runner, automatic retry or provider fallback. No seed flag exists on these baseline generation commands; preserve an exposed seed as unknown/null rather than inventing one.

The receipt preserves request/spec/input snapshots, CLI version/catalog, exact argv, stdout/stderr, returned media ID and reported request fields. Returned `request.model/aspect/duration` describe the CLI request, not independent proof of server model selection or native video properties. Check decoding and actual technical properties per clip; defer creative inspection to the complete sequence. Success requires exit zero, successful generation fields, matching request fields and a nonempty MP4 at the expected destination; `ok` with no downloaded file remains uncertain. Header checks do not decode the film or judge its appearance.

## Review, failure and recovery

The default `complete-video` policy permits successful shots sequentially in the accepted storyboard's `video_shots` order, within the agreed budget. Preserve receipts and do technical checks, without individual clip contact sheets, creative playback or human questions. Join the complete animation and inspect it once before editing/finishing; its [review packet](review-records.md) binds the video attempts. Images still require individual review. An explicitly chosen `per-attempt` policy preserves individual video reviews.

A blocked/failed/uncertain attempt stops automatic continuation. Resolve the concrete blocker and record the next scope before another generation. A preflight absence is recorded as blocked with no generation submitted. Definitive model failure and uncertain completion/download are recorded separately; `retryable` is not permission to spend again. Do not count a proven pre-submit failure as a visual generation, and preserve the evidence supporting that distinction.

For a known media ID use `node <skill>/scripts/gflow.mjs recover <run> <attempt-id>`. It first checks the recorded generation/request contract; download cannot resolve contradictory metadata. It calls `gflow data download` for the same attempt and validates returned ID/profile/project, path and byte count without a new generation. Every recovery retains separate logs and an outcome revision, including failure. Recovery relies on the external CLI's local catalog; an isolated ID may be insufficient. Without a known ID, inspect the private Flow/catalog operation before replacement. A crash can leave a started attempt: preserve its request/command files and resolve whether submission happened; record the outcome with `workflow.mjs finish`. Do not label 'not submitted' without evidence. Explicitly abandoning an uncertain submission requires a revision-bound human override acknowledging that uncertainty.

`gflow movie`/`video chain` are not defaults: the baseline movie scene manifest lacks initial/end frames and local reference fields, and a runner can hide individual receipts and budget/uncertainty boundaries. This adapter retains one operation per invocation while permitting the approved video sequence without intervening clip reviews. An `extend` is another generation from a base clip, not a one-pass film: verify the actual source/model/account control and CLI support before selecting it; retain its cost and provenance separately.

## Image tooling

Let the human choose gflow, GPT Image or another available image tool. Before the tool call reserve one image attempt with `workflow.mjs start`; after output/failure, inspect and `finish` it with concrete artifacts. Preserve the provider's prompt/reference/settings evidence and review the result before another visual generation. The Node protocol does not intercept external image tools; the calling agent must follow this boundary. The same descriptive image handoff feeds video production regardless of the chosen image tool.

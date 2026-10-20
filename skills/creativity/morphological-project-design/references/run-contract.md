# Run contract

Use this reference to set up and resume a run. The scripts require Node.js and its standard library. Native agent delegation and permitted research tools belong to the calling host; the scripts do not call models or open websites.

## Inputs and defaults

Recover existing answers before asking for missing information. Establish the brief, seed ideas, practical constraints, output language and run location. Record any assignment-specific requirements without imposing them on other projects. N defaults to 3; requested models are configurable and must be available to the host. Record the configured/requested model separately from a served model the host actually exposes. Use `unknown` when the latter is not observable.

Create a fresh run directory in the authorized workspace. Do not create a public repository, read email or install/link the skill unless that action is requested or already authorized. Reuse a compatible existing box by copying its original input bytes into the new run. Preserve earlier attempts and dated decisions.

`morphbox.json` uses:

```json
{
  "dimensions": [
    {"name": "Audience", "alternatives": ["Independent trainers", "Small teams"]},
    {"name": "Output", "alternatives": ["Checklist", "Visual board"]}
  ]
}
```

Every dimension has a distinct, nonempty name and one to four distinct, nonempty alternatives. Write a readable Markdown matrix as well. The helper also accepts text rows in the upstream format `Dimension: Alternative A, Alternative B`. Save that exact input in the run as `morphbox.input.txt` when using text. JSON avoids commas being interpreted as alternative separators.

Keep original ideas and representative seed paths as explanatory artifacts. Random proponents receive the scoped brief and their own sampled path, rather than those seed narratives.

## Draw and replay

```sh
node <skill-dir>/scripts/sample-paths.mjs --input <run>/morphbox.json --count 3 --output <run>/paths.json
node <skill-dir>/scripts/sample-paths.mjs --input <run>/morphbox.json --count 3 --seed <recorded-uint64> --output <new-output>/paths.json
```

Replace `<skill-dir>` with the loaded skill's directory, never a developer's checkout path. The output must not exist. Capture the seed produced by an unseeded draw. The helper uses `splitmix64-v1-low2`, not Python's `random.Random`; an old Python seed does not imply the same sequence. Replay compares the deterministic path/attempt/duplicate fields, excluding the creation timestamp.

Positions are uniformly drawn from 1–4. A position absent from a short dimension is recorded and retried for that dimension; do not pad the alternatives or alter the distribution. A complete duplicate path is recorded and retried. The input's combinatorial capacity bounds N. No semantic or economic filter belongs in this procedure.

Optional PDF: use an authorized, available text-to-morphbox checkout at a recorded revision, following its actual invocation instructions. Inspect the output before calling it legible. Failure of this optional export does not invalidate complete Markdown/JSON artifacts. Do not download or install a dependency silently to hide a missing capability.

## Artifacts and execution record

Keep `brief.md`, `ideas.md`, the box, `paths.json`, `criteria.json`, full `prompts/`, `round-1/`, `round-2/`, `research/`, `decision.md`, `project.md`, `validation-plan.md`, `pitch.md` when applicable, `RCD-LICENSE.txt` and `run.json`. The output language follows the requester. Paths inside the manifest are relative to its directory, including symlink resolution; keep external inputs as copies inside the run.

The structural manifest has this shape; expand the proposal arrays to exactly the IDs in `paths.json`:

```json
{
  "schemaVersion": 1,
  "draw": {"path": "paths.json", "sha256": "<sha256>", "inputPath": "morphbox.json"},
  "rounds": [
    {"id": "initial", "proposals": [
      {"id": "proposal-01", "path": "round-1/proposal-01.md", "sha256": "<sha256>"}
    ]},
    {"id": "revised", "proposals": [
      {"id": "proposal-01", "path": "round-2/proposal-01.md", "sha256": "<sha256>"}
    ]}
  ],
  "reviews": [
    {"id": "initial", "path": "round-1/critic.md", "sha256": "<sha256>"},
    {"id": "revised", "path": "round-2/critic.md", "sha256": "<sha256>"}
  ],
  "research": [
    {"proposalId": "proposal-01", "path": "research/proposal-01.md", "sha256": "<sha256>", "status": "complete"}
  ],
  "decision": {
    "status": "selected",
    "proposalId": "proposal-01",
    "report": {"path": "decision.md", "sha256": "<sha256>"},
    "considered": ["proposal-01"],
    "selectionHistory": [
      {"proposalId": "proposal-01", "researchPath": "research/proposal-01.md"}
    ]
  }
}
```

`decision.considered` contains all sampled IDs, not only the winner. A `rejected_all` decision omits `proposalId`; its selection history can be empty if rejection occurred before a research candidate existed. Research can be `limited` with `notes` stating precisely what was inaccessible, user-supplied or unverified. Every provisional candidate and replacement in the history needs a corresponding research entry. A selected candidate must appear in that history.

Add native `agentId`, `requestedModel`, `observedModel`, timestamps, actual batches, invocation parameters and completion/error records to the relevant proposal/review entries or an execution section. Preserve the host's evidence when available. These records document what was observed; they do not sandbox filesystem access or prove that a model never saw other context. Record hashes only after an artifact is saved. Any later final decision or revised research is a separate version, with history preserved.

Run the checker from any working directory:

```sh
node <skill-dir>/scripts/check-run.mjs <run>/run.json
```

It verifies the source bytes and draw replay, IDs, two complete rounds, reviewer files, path confinement, hashes, selection history and research-file presence. It cannot determine whether a proposal respects the meaning of every choice, a source supports a claim, an agent was actually independent, a pitch fits a human's speech or anyone will pay. Keep those reviews separate from a structural pass.

## Failure and stopping rules

- If the host lacks native independent delegation, stop that phase and report the gap. Do not write role-play outputs and present them as separate agents.
- If N exceeds available slots, schedule batches and record actual overlap; N is the candidate count, not a claim about simultaneous execution.
- After partial failure, preserve completed files and resume only missing work with a recorded retry. Use a replacement agent only with that candidate's own context. An incomplete round cannot become a final comparison of N.
- Both rounds preserve the sampled choices. If criticism cannot be resolved within a path, retain the objection and permit rejection; do not silently reroll.
- After competitor research, each new provisional candidate must be researched before acceptance. Never cycle back to an evidence-rejected candidate. At most N distinct revised candidates can be considered; there is no third generation round.
- If every candidate fails, produce a no-go decision, objections and evidence needed to reconsider. Do not force a winner or a promotional pitch. An optional explanatory presentation must preserve that status.

Copy the skill's complete `RCD-LICENSE.txt` into the run and attribute Richard and the pinned source in its decision package. Implementing the MVP, contacting customers, charging money, deploying, publishing or creating an external repository are subsequent actions, rather than evidence supplied by this workflow.

<!-- SPDX-License-Identifier: MIT -->

# Run contract

Use this contract for newly generated runs. The sampler and checker are local, dependency-free Node scripts; their structural checks supplement the workflow's judgment.

## Files and immutable state

Create a new run directory without reusing an existing run's paths. All manifest paths are relative to the manifest's directory and must resolve to regular files inside it. Do not use absolute paths, `..`, backslashes, escaping symlinks, or file aliases to merge roles.

Retain at least:

| File or group | Purpose |
| --- | --- |
| `brief.md` | Scoped brief, constraints, explicit unknowns, and N |
| `ideas.md` and retained input files | Original seed representations and their provenance, separate from derived dimensions |
| `morphbox.md` | Human-readable dimensions, alternatives, and derivation |
| `morphbox.json` | Exact raw sampler input, retained byte for byte |
| `seed-paths.md` | Derived representative choices for each original seed, including unrepresented aspects; separate from the random paths |
| `criteria.json` | Frozen criteria, gates, comparison rule, and uncertainty treatment |
| `paths.json` | Complete sampler output, including attempts and duplicate draws |
| `prompts/` | Complete submitted invocation and follow-up text |
| `rounds/initial/`, `rounds/revised/` | N separate submissions per round |
| `reviews/` | Two comparative reviews and one separate output per researched candidate |
| `execution/` | Native agent, model, batching, replacement, failure, and context evidence |
| `research/` | Candidate research, source snapshots, and final `sources.json` when research occurs |
| `decision.md`, `validation-plan.md` | Final decision and next evidence plan, for either outcome |
| `project.md`, `pitch.md` | Selected outcome only |
| `MIT-LICENSE.txt` | Complete bundled MIT notice, copied byte for byte |
| `run.json` | Final schema-2 manifest |

Original text seeds can appear verbatim in `ideas.md`. For images, attachments, or other representations, preserve original files and index their paths/hashes there; do not replace them with descriptions. Keep seed narratives out of author packets. Keep separately supplied source documents intact even when the scoped brief summarizes their constraints.

After constructing the box, record representative dimension/alternative choices for each seed in `seed-paths.md`. Mark any aspect that has no faithful box choice instead of forcing a match. Hash this explanatory artifact in the manifest. It does not consume a sampled path, constrain the random draw or belong in an author's packet.

Create files exclusively. During work, write checkpoints and source snapshots to new numbered paths; do not repeatedly replace `run.json`, `sources.json`, or logs. Keep partial outputs and retries with their own identities. Preserve superseded material; select the authoritative final artifact by its manifest reference rather than deleting its predecessors.

On resume, inventory the run and verify recorded hashes before dispatching work. Continue only missing invocations, outputs, reviews, or finalization steps. If an invocation's outcome is uncertain, inspect its native status before retrying. Stop on damaged, contradictory, or hash-mismatched evidence; do not repair it by overwriting or regenerating different bytes at the same path. A sealed run is immutable. Changed criteria or a changed final decision belong in a separately identified run that links to the earlier evidence.

## Sampler interface — schema 1

```sh
node <skill>/scripts/sample-paths.mjs --input <run>/morphbox.json --output <run>/paths.json --count 3
node <skill>/scripts/sample-paths.mjs --input <run>/morphbox.json --output <run>/replay.json --count 3 --seed 123
```

`--count` defaults to 3; `--seed` is an optional unsigned decimal 64-bit integer. `--format auto|json|text` is optional. The output must be new. Replay to another new path, never over the recorded draw.

The JSON input is `{"dimensions":[{"name":"Dimension","alternatives":["Choice A","Choice B"]}]}`. Text input uses one `Name: A, B` row per dimension. Each dimension has 1–4 distinct, nonempty alternatives. Dimension names are distinct and nonempty. Preserve their order.

The sampler's `schemaVersion` remains **1**. It records `splitmix64-v1-low2`, the decimal seed string, the SHA-256 of raw input bytes, parsed dimensions, count, accepted sequences, per-position attempts, and discarded duplicate whole paths. Draws are positions 1–4: unavailable positions are rejected, then duplicate complete paths are rejected. No semantic incompatibility, attractiveness, or economic judgment affects sampling. Count cannot exceed the product of the alternative counts.

The checker replays this algorithm, not a language runtime's unrelated random generator. Reproduction requires the retained input bytes, count, and seed. Editing whitespace in the raw input changes its hash even when parsing would give the same box.

## Final manifest — schema 2

Every artifact reference is `{"path":"relative/file","sha256":"64 lowercase hexadecimal characters"}`. Hash full file bytes, including complete prompts. Do not hash a summary instead of the submitted text. File names below are illustrative except the required package names and `decision.md`.

```json
{
  "schemaVersion": 2,
  "draw": {
    "path": "paths.json",
    "sha256": "<draw hash>",
    "inputPath": "morphbox.json"
  },
  "rounds": [
    {
      "id": "initial",
      "proposals": [
        {
          "id": "proposal-01",
          "agentId": "<native author ID>",
          "path": "rounds/initial/proposal-01.md",
          "sha256": "<submission hash>",
          "prompt": {
            "path": "prompts/initial-proposal-01.md",
            "sha256": "<complete submitted prompt hash>"
          }
        }
      ]
    },
    {
      "id": "revised",
      "proposals": [
        {
          "id": "proposal-01",
          "agentId": "<same native author ID>",
          "path": "rounds/revised/proposal-01.md",
          "sha256": "<submission hash>",
          "prompt": {
            "path": "prompts/revised-proposal-01.md",
            "sha256": "<complete submitted prompt hash>"
          }
        }
      ]
    }
  ],
  "reviews": [
    {
      "id": "initial",
      "agentId": "<native critic ID>",
      "path": "reviews/initial.md",
      "sha256": "<review hash>",
      "prompt": {
        "path": "prompts/review-initial.md",
        "sha256": "<prompt hash>"
      }
    },
    {
      "id": "revised",
      "agentId": "<native critic ID>",
      "path": "reviews/revised.md",
      "sha256": "<review hash>",
      "prompt": {
        "path": "prompts/review-revised.md",
        "sha256": "<prompt hash>"
      }
    }
  ],
  "additionalPrompts": [
    {
      "id": "research-proposal-01",
      "path": "prompts/research-proposal-01.md",
      "sha256": "<complete submitted prompt hash>"
    }
  ],
  "research": [
    {
      "proposalId": "proposal-01",
      "status": "complete",
      "path": "research/proposal-01.md",
      "sha256": "<research hash>"
    }
  ],
  "postResearchReviews": [
    {
      "proposalId": "proposal-01",
      "agentId": "<native critic ID>",
      "researchPath": "research/proposal-01.md",
      "researchSha256": "<research hash>",
      "path": "reviews/research-proposal-01.md",
      "sha256": "<review hash>",
      "prompt": {
        "path": "prompts/review-research-proposal-01.md",
        "sha256": "<complete submitted prompt hash>"
      }
    }
  ],
  "decision": {
    "status": "selected",
    "proposalId": "proposal-01",
    "considered": ["proposal-01"],
    "report": {
      "path": "decision.md",
      "sha256": "<decision hash>"
    },
    "selectionHistory": [
      {
        "proposalId": "proposal-01",
        "researchPath": "research/proposal-01.md"
      }
    ]
  },
  "criteria": {
    "path": "criteria.json",
    "sha256": "<criteria hash>"
  },
  "artifacts": [
    {"path": "brief.md", "sha256": "<hash>"},
    {"path": "ideas.md", "sha256": "<hash>"},
    {"path": "morphbox.md", "sha256": "<hash>"},
    {"path": "morphbox.json", "sha256": "<raw input hash>"},
    {"path": "validation-plan.md", "sha256": "<hash>"},
    {"path": "MIT-LICENSE.txt", "sha256": "<bundled notice hash>"},
    {"path": "research/sources.json", "sha256": "<source record hash>"},
    {"path": "execution/invocations.json", "sha256": "<execution evidence hash>"},
    {"path": "project.md", "sha256": "<hash>"},
    {"path": "pitch.md", "sha256": "<hash>"}
  ]
}
```

This shape shows **one candidate only to make the fields readable**. For the default N = 3, put every actual draw ID exactly once in each round and in `decision.considered`. Use actual IDs from `draw.sequences`; do not manufacture missing IDs. Include every retained supporting file not already referenced elsewhere in `artifacts`, including logs, original inputs, feedback packets, context attachments, checkpoints, and prior source snapshots.

The two rounds are named `initial` and `revised`. Each has N distinct native author IDs, and an author cannot own different candidates across rounds. Normally a candidate keeps the same author. If it changes, its revised record must add `"replacement":{"fromAgentId":"<initial ID>","reason":"<specific reason>"}`; unchanged authors must not declare replacement. Retain the failed author's work and all replacement context.

Each comparative review needs a native ID different from every author in both rounds. Its prompt and output must be separate files. The same critic may provide both comparative and post-research reviews. Proposals, reviews, and prompts have separate real paths and file identities. The decision report and every post-research critic output are distinct from every other artifact.

`additionalPrompts` is optional when empty. Otherwise every record has a unique nonempty invocation `id` and its own `prompts/` path/hash. Use it for researcher calls, additional author or critic messages, replacements, and other dispatched prompts beyond the primary prompt references. Do not repeat a primary prompt entry as an additional invocation.

Research records have unique `proposalId` values from the draw. Status is `complete` or `limited`; limited records require nonempty `notes` describing the gap. Every research record requires a post-research review with the matching `researchPath` and `researchSha256`. Include final `research/sources.json` in `artifacts` whenever research occurs; its source schema remains 1 as defined in [the research guide](competitors-and-pitch.md).

`selectionHistory` is ordered, has unique candidate IDs, and contains at most N entries. Every entry names matching recorded research; no rejected candidate returns later. For `selected`, the final history entry is the selected candidate. For `rejected_all`, omit `proposalId` or set it to `null`, omit project/pitch files, and retain the complete decision and validation plan. If all candidates fail before research, research and history may both be empty.

`criteria` is an optional top-level artifact reference; `criteria.json` is required either there or in `artifacts`, never in both. Do not duplicate additional artifact paths. Requested/observed models, capability unknowns, actual batches, and full context provenance belong in retained hashed execution artifacts; the checker does not interpret those records.

## License and schema boundaries

For new runs, use schema 2 and copy the bundled skill-level `MIT-LICENSE.txt` to the run root unchanged. Do not substitute a shortened notice, a repository notice with different bytes, or an assertion that attribution was preserved. The checker compares the complete bundled notice bytes.

The current checker also recognizes historical schema-1 manifests and validates their historical notice against a fixed digest; it does not obtain current terms from the historical archive. Historical runs retain their original evidence and terms. Do not change their schema, replace notices, migrate them, or relabel them as newly licensed runs. Historical attribution and the archive's relationship to this original workflow are documented in [PROVENANCE.md](../PROVENANCE.md); the archive is not an input or runtime dependency for a new run.

## Check and report

```sh
node <skill>/scripts/check-run.mjs <run>/run.json
```

Create the final manifest once after all required artifacts exist and their bytes are stable. A selected run requires the decision, validation plan, project, pitch, complete two rounds, required reviews, and researched selection. A no-go requires the decision, validation plan, complete rounds, and reviews for every research record it retains.

The checker verifies path containment, hashes, exact sampler replay, declared IDs and replacement records, round coverage, required files, source-record shape, research/review references, selection-history structure, and the schema-appropriate notice. It does not establish whether agents were actually isolated, batches overlapped, models matched requests, prompts were fully disclosed, criteria were frozen on time, candidates honored their choices, evidence supports claims, arithmetic is appropriate, or the project is viable. Those require inspection of the retained evidence. A structural pass is neither a real-world outcome nor legal certification.

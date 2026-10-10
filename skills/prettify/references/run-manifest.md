# Run manifest and receipts

Use this reference when creating the structural record for a run. Save `run.json` at `.prettify/<slug>/run.json`; set `projectRoot` to `../..`. Artifact, design, snapshot, and receipt paths are then relative to the project root. Run `node <installed-skill>/scripts/check-run.mjs <run.json>` and record its JSON output in `EVIDENCE.md`.

The manifest has exactly these top-level fields: `version` (`1`), `projectRoot`, `design`, `stages` (`briefing`, `lowFidelity`, `highFidelity`), `dependencies`, `questionResult`, and `delivery`. Follow the helper's accepted states and field names exactly. Unknown fields and states fail validation.

```json
{
  "version": 1,
  "projectRoot": "../..",
  "design": {
    "path": "DESIGN.md",
    "original": {"path": ".prettify/home-redesign/DESIGN.original.md", "sha256": "<actual original file SHA-256>"},
    "decision": "accepted",
    "update": null
  },
  "stages": {
    "briefing": {"status": "complete", "receipt": ".prettify/home-redesign/receipts/briefing.json"},
    "lowFidelity": {"status": "complete", "receipt": ".prettify/home-redesign/receipts/low.json"},
    "highFidelity": {"status": "skipped", "receipt": ".prettify/home-redesign/receipts/skip-high.json"}
  },
  "dependencies": [
    {"name": "Impeccable", "required": true, "status": "available", "receipt": ".prettify/home-redesign/receipts/impeccable.json"},
    {"name": "browser inspection", "required": true, "status": "available", "receipt": ".prettify/home-redesign/receipts/browser.json"}
  ],
  "questionResult": {"status": "inconclusive", "receipt": ".prettify/home-redesign/receipts/question.json"},
  "delivery": {
    "artifacts": [{"kind": "web", "path": "frontend"}],
    "inspection": {"status": "inspected", "receipt": ".prettify/home-redesign/receipts/inspection.json"}
  }
}
```

The example illustrates a declared, inspected run: `frontend/` must exist and contain `package.json`; use an HTML file for a standalone web artifact, or a file for a static artifact. Replace the illustrative hash with the actual SHA-256. A missing `DESIGN.md` uses `original: null`; a piece-only accepted proposal points `design.path` at its run-local file and uses `decision: "piece-only"`, `update: null`. A new durable `DESIGN.md` uses `original: null`, `decision: "accepted"`, and an update receipt with `beforeSha256: null`. For an existing spec, copy the original to the snapshot path before editing; only the explicitly approved durable edit gets an update receipt with matching before and after hashes. Rejection uses `decision: "rejected"` and stops the run.

Each receipt is JSON with `decision`, optional non-empty `reason`, and optional `evidence` array of observed facts. Completed stage receipts use `accepted`; skip receipts use `skip` plus a reason. Dependency receipts use `available`, `missing`, or `refused`; required dependencies must be available. The question receipt uses `answered` or `inconclusive`. Final inspection uses `inspected`; `unverified` has no receipt and means the run is incomplete. A durable design update receipt uses `design-update-approved`, `beforeSha256`, and `afterSha256`.

For example, a skipped-stage receipt records an actual user choice and the consequence:

```json
{"decision":"skip","reason":"User requested direct delivery after low fidelity; this skips the high-fidelity review checkpoint.","evidence":["User requested direct delivery in this run."]}
```

The checker reads local declarations and file presence only. It cannot authenticate a person's decision, tool execution, provider rendering, interaction behavior, or visual quality. Keep receipts truthful and retain the observed evidence they describe; a passing check is not a substitute for final inspection.

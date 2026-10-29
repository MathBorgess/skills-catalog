# Run manifest and receipts

Use this schema when the owner requests a machine-readable handoff or automation; the Markdown brief, decisions, evidence, human checkpoints, and actual final inspection remain required either way. Save `run.json` at `.prettify/<slug>/run.json` and set `projectRoot` to `../..`. The project root may also be an absolute local path. Paths for DESIGN files, snapshots, receipts and artifacts resolve from `projectRoot`. Run `node <installed-skill>/scripts/check-run.mjs <run.json>` and preserve its JSON output in `EVIDENCE.md`.

The manifest has exactly these top-level fields: `version` (`1`), `projectRoot`, `design`, `stages` (`briefing`, `lowFidelity`, `highFidelity`), `dependencies`, `questionResult` and `delivery`. Unknown fields and states fail validation.

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

The example represents declared evidence. `frontend/` must be an existing project directory; it does not need a `package.json`. A standalone web artifact can instead be an HTML file. A static artifact must be an existing file. The final inspection receipt is required for `complete: true` from the structural checker.

Each receipt is JSON with a matching `decision`, non-empty `reason`, and a non-empty `evidence` array of non-empty strings. These are recorded claims, not authenticated proof that a person made a decision or that work occurred. For example:

```json
{"decision":"skip","reason":"The user requested direct delivery after low fidelity, skipping the high-fidelity checkpoint.","evidence":["User requested direct delivery in this run."]}
```

Completed stage receipts use `accepted`; skipped stages use `skip`. Required dependencies must have status `available`; every dependency status (`available`, `missing`, or `refused`) needs a matching receipt. A required missing or refused dependency blocks completion. Question results use `answered` or `inconclusive`, each with a matching receipt. An inconclusive result is valid and remains distinct from visual assessment.

For an existing `DESIGN.md`, copy it to the run snapshot before edits and record its SHA-256 in `design.original`. Keep `design.update` null if it stays unchanged. A durable edit needs a separate receipt with `decision: "design-update-approved"`, `beforeSha256` matching the original hash and `afterSha256` matching the current file. For a project without a DESIGN file, use `original: null`. A new piece-only proposal uses `decision: "piece-only"` and `update: null`; a new durable DESIGN needs `decision: "accepted"` and an update receipt with `beforeSha256: null` and `afterSha256` matching the created file. A rejected design direction stops the run.

An unverified final inspection has no receipt and prevents `complete: true`. The checker reads declarations and local file presence; it does not run the web app, validate interaction behavior, authenticate decisions, or judge visual quality. A passing structural check does not establish actual workflow completion or replace final inspection.

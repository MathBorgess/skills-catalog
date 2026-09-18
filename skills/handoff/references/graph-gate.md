# Graph gate

Run grilling rounds after `route` and before `route --approve`. The owner approves one exact `plan.json`: graph, slot/lane, model, effort, and `rtk` mode.

## Each round

1. Show the routed graph as Mermaid, its immediate concurrency, and this table:

   | Session | Tier | Size | Slot / lane | Model | Effort | Dependencies and why |
   |---|---|---|---|---|---|---|

   Mark owner-set model or effort with `✎`.
2. Ask numbered frontier questions. Include every uncertain dependency, write-set boundary, tier, model, effort, and `rtk` mode (read the `RTK` column: `mode/via`; `full` is an experiment, not a default). When RTK is installed and the plan has no `rtk`, always ask whether to add `"rtk": "guarded"` — recommend yes. Give each question a recommended answer. Treat a `route` dependency warning as evidence that the dependency may be non-causal.
3. Apply the owner's edits to `plan.json`, run `route` again, and show the new graph/table. Repeat until the owner approves.

Questions should test whether a dependency is causal, concurrent writes are really separate, a tier matches the judgment left open, and a model/effort override is deliberate. Do not silently change an owner override.

## Lock

After approval, run `route --approve`. It records the plan hash. If the plan changes later, route it and repeat the gate; dispatch will reject the stale approval.

This may become a standalone `implementation-grilling` skill once a second skill needs it.

# Graph gate

Run grilling rounds after `route` and before `route --approve`. The owner approves one exact `plan.json`: graph, slot/lane, **provider**, **model**, **effort**, `rtk` mode, and predicted-versus-declared **capabilities**.

## Each round

1. Show the routed graph as Mermaid, its immediate concurrency, and this table:

   | Session | Tier | Size | Slot / lane | Model | Effort | Dependencies and why |
   |---|---|---|---|---|---|---|

   Mark owner-set model or effort with `✎`. The Model column always displays the actual resolved provider model name (for Codex, resolved from local configuration or cache); `default` is never presented as a model name. Effort includes explicit and model-encoded `xhigh` when that is the route.
2. Show predicted-versus-declared capabilities per session (`declared` · `predicted` · `effective`). **Disagreement is visible before approval**: classifier additions are listed; an owner declaration the classifier missed is kept, shown, and never dropped. Effective capabilities are the fail-closed union of owner declaration and classifier output. Rules stay the default; local shadow records a prediction without changing the route; local action requires explicit opt-in.
3. Ask numbered frontier questions. Include every uncertain dependency, write-set boundary, tier, model, effort, capability disagreement, and `rtk` mode (read the `RTK` column: `mode/via`; `full` is an experiment, not a default). When RTK is installed and the plan has no `rtk`, always ask whether to add `"rtk": "guarded"` — recommend yes. Give each question a recommended answer. Treat a `route` dependency warning as evidence that the dependency may be non-causal.
4. Apply the owner's edits to `plan.json`, run `route` again, and show the new graph/table. Repeat until the owner approves.

Questions should test whether a dependency is causal, concurrent writes are really separate, a tier matches the judgment left open, and a model/effort override is deliberate. Do not silently change an owner override. Do not let a classifier reduce owner-declared capabilities.

## Lock

After approval, run `route --approve`. It records the plan hash. If the plan changes later, route it and repeat the gate; dispatch will reject the stale approval.

This may become a standalone `implementation-grilling` skill once a second skill needs it.

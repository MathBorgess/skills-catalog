# Metrics

`handoff.mjs score` re-probes slots, writes the scorecard to `manifest.md`, and appends one JSON line to `$TMPDIR/handoff/metrics.jsonl`. Do not assemble or rewrite it by hand.

The line keeps run identity, mode, session totals/statuses, elapsed time, parent turns, available/used providers, quota deltas, per-provider-and-size session costs, relaunches, quota deaths, launch failures, blocked/failed/abandoned counts, and routing defect counts. It also records:

```json
{
  "skill": "handoff",
  "settle_s": 30,
  "sessions": [{"id": "01", "effort": "high", "override": true}]
}
```

`override` is true when the owner explicitly set model or effort. Report `quota_delta_pct`, `wall_clock_s`, `parent_turns`, and every non-zero defect count with the scorecard.

## Route estimates

Route reads the last fifty lines and uses the median `session_cost_pct` for each provider/size after three samples; before then it uses its prior. The file is append-only. This history changes estimates, not observed facts: report unavailable measurements as unavailable.

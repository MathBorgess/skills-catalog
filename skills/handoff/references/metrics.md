# Metrics

`handoff.mjs score` re-probes slots, writes the scorecard to `manifest.md`, and appends one JSON line to `$TMPDIR/handoff/metrics.jsonl`. Do not assemble or rewrite it by hand.

The line keeps run identity, mode, session totals/statuses, elapsed time, parent turns, available/used providers, quota deltas, per-provider-and-size session costs, relaunches, quota deaths, launch failures, blocked/failed/abandoned counts, and routing defect counts. It also records:

```json
{
  "skill": "handoff",
  "settle_s": 30,
  "rtk_version": "0.49.0",
  "sessions": [{"id": "01", "effort": "high", "override": true,
    "rtk": {"mode": "guarded", "via": "hook", "rewrites": 12, "recalls": 1,
            "history": {"commands": 12, "input_tokens": 9000, "output_tokens": 1400, "saved_tokens": 7600}}}]
}
```

`rtk.history` is RTK's own count (bytes/4) for commands run under the session's worktree during its lifetime; `null` when RTK recorded nothing. `recalls` is `null` for `prompt` children, which have no hook. A read-only session shares the parent's cwd, so its history is marked `shared_cwd` and is not attributable.

`override` is true when the owner explicitly set model or effort. Report `quota_delta_pct`, `wall_clock_s`, `parent_turns`, and every non-zero defect count with the scorecard.

## Route estimates

Route reads the last fifty lines and uses the median `session_cost_pct` for each provider/size after three samples; before then it uses its prior. The file is append-only. This history changes estimates, not observed facts: report unavailable measurements as unavailable.

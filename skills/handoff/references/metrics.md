# Metrics

`handoff.mjs score` writes the scorecard. It re-probes every slot, diffs against the snapshot taken before the run, appends one JSON line to `$TMPDIR/handoff/metrics.jsonl`, and writes the same block into `manifest.md`. You do not assemble any of it by hand.

## What it records

```json
{
  "skill_version": "1.0.0",
  "mode": "fan-out",
  "n_sessions": 3, "n_done": 3,
  "wall_clock_s": 1840, "parent_turns": 2,
  "providers_available": ["claude", "codex", "cursor"],
  "providers_used": ["claude", "cursor"],
  "quota_delta_pct": { "claude": 11.0, "cursor": 4.5 },
  "session_cost_pct": { "claude": [{ "size": "l", "pct": 11.0 }] },
  "relaunches": 1, "quota_deaths": 1, "launch_fails": 0,
  "blocked": 0, "failed": 0, "abandoned": 0,
  "independence_miss": 0, "spread_miss": 0, "admission_ignored": 0
}
```

Two properties this shape has and a hand-kept scorecard does not.

**It measures cost, not just hygiene.** `quota_delta_pct` is what the run actually spent, per slot, in the only currency that runs out. A run can score clean on every defect flag and still have been far too expensive; without this number nobody finds out except by feel, one run too late.

**The defect fields are counts, not booleans.** Six relaunches and one relaunch are not the same event, and a flag that collapses them hides the runs worth fixing.

`independence_miss` stays `0` because `route` refuses colliding write-sets before anything launches — it is in the record to show the gate held, not to be scored after the damage. `admission_ignored` is `1` when the router warned that the cut exceeded available quota and it was dispatched anyway.

## The history feeds the next run

`route` reads the last fifty lines of `metrics.jsonl` and takes the median `session_cost_pct` per provider and size. Once three runs have used a given pairing, admission control estimates from this machine's real numbers instead of the built-in prior. That is the loop: measure the cost, and the next cut is planned against what things actually cost here.

Nothing else reads the file. It is append-only; do not rewrite or prune it.

## Reporting

Show the user `quota_delta_pct`, `wall_clock_s`, `parent_turns`, and any non-zero defect count, next to the routing table. No commentary beyond the numbers and which session tripped what.

## Reading the history

When the user asks whether the skill is getting worse, read the tail of `metrics.jsonl` and answer from it. Patterns worth naming out loud:

| Pattern across recent runs | What it means |
|---|---|
| `quota_deaths` > 0 repeatedly on one provider | that provider's real ceiling is lower than the probe suggests; lower `HANDOFF_LOW_PCT`. On a provider with lanes the death is counted per lane, so read the run's events for which pool actually ran out before changing the threshold for both |
| `launch_fails` > 0 | the installed CLI's flags have moved — fix `launchArgs` and say which flag |
| `spread_miss` = 1 with several providers available | the cut is too coarse to spread, or one provider is being named by habit |
| `relaunches` climbing while `n_done` holds | briefs are short of context; the fix is in `brief.md`, not in the router |
| `parent_turns` climbing | someone is polling instead of letting `dispatch` block |

**Do not patch the skill's own files from inside a run.** Rewriting your own instructions at the end of an expensive run, from a handful of counters and with nobody reviewing the edit, is how a skill drifts. Report the pattern and the one-sentence change you would make; the user decides, and it lands as an ordinary edit with a diff to read.

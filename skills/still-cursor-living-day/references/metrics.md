# Metrics

`score` appends one JSON line to `$TMPDIR/still-cursor-living-day/metrics.jsonl` and never rewrites the file. `skills-evaluate` reads it; nothing else should.

```json
{
  "skill": "still-cursor-living-day",
  "run": "20260922T141500Z",
  "frames": 12,
  "routes": { "api:openai": 8, "manual": 4 },
  "transitions": 27,
  "weakest_window": 6,
  "tau": 0.88,
  "shape": "collection",
  "tally": { "restriction_violated": 1, "restriction_suspect": 2, "constant_absent": 0,
             "constant_drifted": 1, "presence_sterile": 0, "chronology_out": 1,
             "chronology_ambiguous": 2, "continuity_broken": 0 },
  "proposals": 4,
  "dispatch_failures": 2,
  "wall_clock_s": 903
}
```

What each number is for:

- **`tau`** — the ordering fidelity of the blind pass. The one number that says whether The Variable survived generation. Compare it across runs of the same plan on different routes: that comparison is the actual experiment.
- **`transitions` and `weakest_window`** — the density of the trace chain, and the cost of deleting the four most deletable frames. They are properties of the plan, not of the images, so they change only when the plan changes.
- **`tally`** — where the collection fails, by pillar. `restriction_violated` concentrated on one route says that route cannot hold the restriction; spread evenly it says the shared clause is weak.
- **`dispatch_failures`** — frames that needed a second attempt. Rising failures on a route with a flat tally means the route got slower, not worse.
- **`routes`** — which generator produced how many frames. Without it, a tau difference between two runs has no attributable cause.

Report `tau`, `shape` and every non-zero entry of `tally` with the scorecard. A run whose judge passes never completed has no line, and that is correct: an unfinished measurement is not a zero.

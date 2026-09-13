# Metrics

Every run records the same scorecard so later runs can tell whether the skill is getting worse. Scores are `0` or `1`. `1` on a `*_miss` / `*_fail` / `*_regret` field is a defect.

## Scorecard

Write this block at the bottom of `manifest.md` after the wave (or after compact write). Then append the same fields as **one JSON object, one line** to `$TMPDIR/handoff/metrics.jsonl` (create the file if missing).

```yaml
metrics:
  skill_version: "0.0.0"   # copy SKILL.md metadata.version; do not invent a newer one
  mode: compact   # or fan-out
  n_sessions: 0
  n_waves: 0
  providers_available: []  # subset of cursor, claude, codex
  providers_used: []
  independence_miss: 0     # launched overlapping writers, or had to serialize after launch
  brief_gap: 0             # a child blocked on context that was in the parent conversation
  parent_implemented: 0    # parent edited files a child owned
  routing_regret: 0        # wrong provider/model; had to redo the session elsewhere
  launch_fail: 0           # CLI missing, bad flags, or child never started
  spread_miss: 0           # ≥2 providers were ok/unknown but every launched session used one
  quota_miss: 0            # launched on low/empty while an ok provider existed, no user override
```

Definitions — set the flag to `1` when the sentence is true:

| Flag | Set to 1 when |
|---|---|
| `independence_miss` | Two sessions in the same wave wrote the same path, or you merged/serialized them after launch because they were never independent. |
| `brief_gap` | A result status is `blocked` asking for a fact, path, or constraint that was already in the parent conversation and not in `NN.md`. |
| `parent_implemented` | The parent applied the child's in-scope edits instead of relaunching. |
| `routing_regret` | You relaunched the same goal on a different provider or model because the first pairing could not do the job. |
| `launch_fail` | The process never started, `--help` flags were wrong, or the binary was missing after you assigned it. |
| `spread_miss` | Two or more providers were `ok` or `unknown` and every launched session still used a single provider. |
| `quota_miss` | A session launched on a `low` or `empty` provider while an `ok` provider existed and the user had not named that provider. |

Compact runs still append a line (`n_sessions: 1`, `n_waves: 0`, launch flags `0` unless a named-provider launch failed).

## Report

Always show the flags to the user next to the routing table. No commentary beyond the flags and which session tripped them.

## Review trigger

After appending the line, read the last **10** lines of `metrics.jsonl` (fewer if the file is shorter).

Patch the loaded skill copy when **either**:

- this run has `launch_fail: 1` (recipes in [`providers.md`](providers.md) are stale), or
- any single flag is `1` in **3 or more** of those last 10 lines.

Otherwise write nothing into the skill files.

## What to patch

One sentence, in the file the flag names. Do not rewrite the workflow.

| Flag | File | Add |
|---|---|---|
| `independence_miss` | `references/routing.md` | The overlapping paths from this run as a false-independence example. |
| `brief_gap` | `references/brief.md` | The missing section or field name in the required template. |
| `parent_implemented` | `SKILL.md` | A tighter stop rule in §5 naming the path the parent touched. |
| `routing_regret` | `references/routing.md` | "Do not send \<kind of job\> to \<provider/model\> when \<other\> is available." |
| `launch_fail` | `references/providers.md` | The working flag line from this machine's `--help`. |
| `spread_miss` | `references/quota.md` | Restate the worked example using this run's remaining percents. |
| `quota_miss` | `references/quota.md` | Name the skipped-high provider and the low provider that was used anyway. |

Loaded copy, in this order, first hit:

1. `skills/handoff/SKILL.md` under the current workspace
2. `.claude/skills/handoff/SKILL.md`
3. `.cursor/skills/handoff/SKILL.md`

If none exist, write `$RUN/skill-patch.md` with the sentence and stop — do not invent a skill directory.

When you do edit a loaded copy: change only that sentence. Copy `skill_version` from `SKILL.md` `metadata.version` — do not bump it. Version rises only when this skill is published to `main` of the catalog. Tell the user the path you changed.

---
name: skills-evaluate
description: Use when evaluating skills, analyzing skill metrics, improving skills, skills evaluate, reviewing skill runs, or proposing skill changes. Not for running shunt or handoff themselves.
metadata:
  author: Matheus Borges
  version: 0.0.0
---

# Skills Evaluate

Turn skill telemetry, sketchpad notes, and issues into concrete catalog improvements. Run procedure deterministically via script; reserve model judgment for diagnosing root causes, auditing scope drift, and consulting the owner.

## 1. Run the Evaluation Script

Execute `evaluate.mjs` against recent telemetry:

```bash
node skills/skills-evaluate/scripts/evaluate.mjs --last 10
```

The script prints:
- Sibling skills and their trigger descriptions parsed live from `skills/*/SKILL.md`.
- Numeric metric medians across the last N runs vs the latest run for `shunt` and `handoff`.
- Titles of active notes in `.agents/sketchpad/*.md`.
- Open repository issues from GitHub CLI (`gh`).

## 2. Diagnose Telemetry

Compare latest run numbers against historical medians. Use the diagnosis table below to identify whether a symptom requires a **skill instruction change**, a **script fix**, or an **observability change**:

| Metric / Pattern | What It Signals | Likely Root Cause | Proposed Improvement |
|---|---|---|---|
| `shunt.recover` rate climbing | Outline compression failed; model forced raw re-read | Outline too aggressive or missing symbol signatures | **Skill**: widen outline regex or raise line threshold. **Obs**: log triggering file paths. |
| `shunt.edit_bypass`: reads >> edited | Whole-file reads granted under edit intent with no edits | Model exploited bypass intent to evade outline guard | **Skill**: restrict bypass eligibility; lower byte ceiling. **Obs**: record read-to-edit ratio. |
| `shunt.raw_bytes` vs `printed_bytes` ratio near 1 | Run wrapper ineffective; large outputs dumped unfiltered | Command filter regex missed compiler or test runner output | **Script**: add sanitizer for tool format (e.g. test noise). **Obs**: report uncompressed stream sources. |
| `shunt.excerpts` per outline = 0 | Outlines generated but never excerpted | Model inspected irrelevant files on speculative queries | **Skill**: guide model to inspect only high-confidence candidates. |
| `shunt.excerpts` per outline >> 5 | High fragmentation; multiple excerpts on same file | Outline lacked sufficient context to locate span in one go | **Skill**: improve outline line-numbering and symbol context. |
| `handoff.quota_deaths` > 0 repeatedly on one provider | Provider ceiling exhausted during run | Real ceiling lower than probe estimate (`HANDOFF_LOW_PCT` too high) | **Skill**: lower provider threshold. **Obs**: count deaths per lane to isolate specific quota pool. |
| `handoff.blocked` > 0 | Child blocked waiting on missing context or dependencies | Session brief omitted required inputs or files | **Skill**: enforce context pre-flight checks in `brief.md`. **Obs**: record blocking reason in `result.md`. |
| `handoff.result.md` missing or malformed | Child finished without standard result artifact | Child crashed, hit provider timeout, or skipped exit step | **Skill**: reinforce exit checklist in session prompt template. **Obs**: capture child process exit code and stderr tail. |
| `handoff.settle_s` vs early returns | Parent resume delayed or uncoalesced failures | Settle window hyperparameter too long or too short | **Script**: calibrate settle window to observed session durations. **Obs**: log interval between completion events. |
| `handoff.override`: true frequently | Human or parent overriding router choices | Router priors out of touch with real workload requirements | **Skill/Script**: recalibrate model assignment weights or size priors. **Obs**: log override reason and target slot. |
| `handoff.estimate` vs actual `quota_delta_pct` diverging | Projected quota cost inaccurate | Historical sample too small or task tier (s/m/l) misjudged | **Script**: recalibrate size buckets; require more samples before trusting priors. **Obs**: record token delta per session. |
| `handoff.wall_clock_s` high for small tier | Small sessions running excessively long | Subagents spinning in polling loops or deep reasoning | **Skill**: enforce step caps per session. **Obs**: record elapsed time per lifecycle phase. |
| `handoff.launch_fails` > 0 | Agent CLI command failed to start | Installed CLI flags changed or binary missing from PATH | **Script**: update `launchArgs` in router and specify failing flag. **Obs**: capture launch stderr. |
| `handoff.spread_miss` = 1 with 2+ providers available | Work concentrated on one provider despite options | Task cut too coarse to spread, or habit bias in selection | **Skill**: decompose task into smaller decoupled sessions. **Obs**: print available slot capacity during plan gate. |
| `handoff.relaunches` climbing while `n_done` holds | Sessions failing initially and succeeding on retry | Briefs short of context; environment setup missing | **Skill**: fix brief template; do not patch router. **Obs**: diff initial brief against relaunch prompt. |
| `handoff.parent_turns` climbing (> 2) | Parent consuming excessive tokens during run | Parent polling interactively instead of waiting for dispatch | **Skill**: enforce blocking dispatch; instruct parent not to poll. |

## 3. Audit Scope Drift

Compare actual workload patterns from telemetry and `.agents/sketchpad/*.md` against the sibling skill descriptions printed by `evaluate.mjs`:

1. **Trigger Drift**: If user requests repeatedly trigger a skill inappropriately, or fail to invoke it when intended, propose a refined `description` in frontmatter.
2. **Responsibility Creep**: If a skill accumulates procedures outside its core domain (e.g. handoff performing file compression, or shunt orchestrating multi-session dispatch), propose moving the responsibility to the correct skill or a deterministic script. Remember: *One job per skill. If the description needs an "and also", it is two skills.*
3. **Missing Capability**: If telemetry or sketchpad notes reveal recurring manual workarounds that fit no existing skill, propose drafting a new skill adhering to repository layout and CLAUDE.md.

## 4. Consult the Owner

Synthesize your diagnosis into actionable proposals:
1. Present the findings clearly: what the telemetry signals, the observed evidence, and the proposed one-line change.
2. Distinguish between instruction improvements, script optimizations, and observability additions.
3. Ask the owner which proposals should become GitHub issues or pull requests.
4. **Never create an issue or edit files without explicit owner confirmation.** Run `gh issue create` only after approval.

## Done Check

Evaluation is complete when:
1. `evaluate.mjs` has executed and its output is analyzed against the diagnosis table.
2. Sibling skill scopes have been audited for drift or overlap.
3. Findings and proposed changes have been presented to the owner for approval.

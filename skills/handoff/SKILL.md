---
name: handoff
description: Use when the user wants a handoff document for another agent, to split remaining work into parallel sessions, to dispatch Cursor, Claude, or Codex via CLI, to spread work across providers to save tokens, to skip a provider that is out of quota, or says /handoff, fan-out, compact this, routing table, or end of task.
argument-hint: "compact | fan-out | provider or model constraints"
metadata:
  author: Matheus Borges
  version: 1.0.0
---

# Handoff

Package the current conversation into self-contained session briefs another agent can execute without this context. Two modes of that one job: **compact** (one successor) and **fan-out** (N independent sessions, max parallel, possibly other providers).

The parent does not do the children's work. It cuts, routes, writes briefs, launches, reads result files, scores the run.

## 1. Mode

- Named provider, "parallel", "fan-out", "split sessions", "subagents", "other IDE/CLI" → **fan-out**.
- "Handoff", "end of task", "compact", or a next-session focus with no parallel language → **compact**.
- Ambiguous: **fan-out** if two or more remaining cuts share no files and no sequence; else **compact**.
- User arguments are routing constraints (provider, model, focus). They win.

Load [`references/routing.md`](references/routing.md) before cutting or assigning providers.

## 2. Run directory

Create this on the OS temp dir — not the workspace:

```text
$TMPDIR/handoff/<run-id>/
  manifest.md
  sessions/NN.md
  sessions/NN.prompt.md
  sessions/NN.result.md
```

`run-id` is UTC `YYYYMMDDTHHMMSSZ`. Fall back to `/tmp` when `TMPDIR` is unset. Write `manifest.md` before any launch, using the template in routing.md.

## 3. Cut, route, write

1. List remaining work. Merge anything that shares files or must run in order into one session or a later **wave**. Each session in a wave is independent.
2. Probe which of `agent`/`cursor-agent`, `claude`, `codex` exist (`command -v`). That is the provider pool: Cursor, Claude, Codex.
3. Probe **remaining quota** per provider ([`references/quota.md`](references/quota.md)). Drop `empty`; avoid `low` (`< 20%` remaining unless the user set another floor). Assign with weighted round-robin so two eligible providers never collapse onto one. User-named provider still wins. Then pick the **model** as in [`references/providers.md`](references/providers.md): cheaper/faster for mechanical work, stronger for design and review; never hardcode model ids.
4. Write one brief per session from [`references/brief.md`](references/brief.md). Pointers to existing artifacts by path or URL; no duplicated specs. Redact secrets and PII.

## 4. Show the routing table, then launch

Print the quota snapshot from [`references/quota.md`](references/quota.md), then this table, then launch in the **same turn**. Do not wait for approval.

```markdown
| Session | Goal | Provider | Model | Remaining | Isolation | Brief |
|---|---|---|---|---|---|---|
| 01 | … | cursor \| claude \| codex | <id or default> | 63% \| low 8% \| unknown | worktree … / cwd | $RUN/sessions/01.md |
```

- **compact:** one row. Launch only if the user named a provider for the successor.
- **fan-out:** one row per session in the current wave. Launch every row.

Launch recipes: [`references/providers.md`](references/providers.md). All launches for a wave go out together. File-writing sessions get their own worktree. The child's last action is writing `sessions/NN.result.md`.

Parent in-process subagents (Task and the like) only when no other provider CLI is installed, or the session is read-only and should finish in seconds.

## 5. Orchestrate

Until the wave's result files exist (or a child has died):

- Poll `sessions/NN.result.md` and process liveness. Do not ingest full transcripts or CLI stdout dumps.
- On `done`, accept. On `blocked`/`failed` from rate-limit or quota language, mark that provider `empty` ([`references/quota.md`](references/quota.md)) and reassign any session not yet launched; do not pick up the implementation yourself. Any other `blocked`/`failed`: relaunch with a patched brief or fold into the next wave.
- Start the next wave only after the current wave's results are in.

Then score the run ([`references/metrics.md`](references/metrics.md)): write the scorecard into `manifest.md`, append one JSON line to `$TMPDIR/handoff/metrics.jsonl`, report the scores. If a review trigger fires, patch the loaded skill copy as that file specifies.

## Done-check

- [ ] `$TMPDIR/handoff/<run-id>/` exists with `manifest.md` and one brief per session.
- [ ] Quota snapshot and routing table were shown; every row has provider, model, and remaining.
- [ ] Fan-out: children launched without waiting for approval; parent did not implement their work.
- [ ] Compact: brief written; launched only if a provider was named.
- [ ] Secrets and PII redacted; existing artifacts referenced, not copied.
- [ ] Scorecard is in the manifest and appended to `metrics.jsonl`.
- [ ] Report lists the run path, the table, child statuses, metric scores, and one next action.

---
name: handoff
description: Use when the user wants a handoff document for another agent, to split remaining work into parallel sessions, to dispatch Cursor, Claude, or Codex via CLI, to spread work across providers to save tokens, to skip a provider that is out of quota, or says /handoff, fan-out, compact this, routing table, or end of task.
argument-hint: "compact | fan-out | provider or model constraints"
metadata:
  author: Matheus Borges
  version: 1.0.0
---

# Handoff

Package the current conversation into self-contained session briefs another agent can execute without this context. Two modes of that one job: **compact** (one successor) and **fan-out** (N independent sessions across every provider on the machine).

Your job is the part a script cannot do: **cut the work, scope each session, write the goals.** Quota probing, admission control, independence checking, slot assignment, launching, waiting, rerouting a dead session and scoring are `scripts/handoff.mjs` — call it, read its table, move on. Do not redo its arithmetic in prose, and do not launch a child by hand.

## 1. Mode

- Named provider, "parallel", "fan-out", "split sessions", "subagents", "other IDE/CLI" → **fan-out**.
- "Handoff", "end of task", "compact", or a next-session focus with no parallel language → **compact**.
- Ambiguous: **fan-out** if two or more remaining cuts share no files and no sequence; else **compact**.
- User arguments are routing constraints (provider, model, focus). They win.

## 2. Run directory and supply

`run-id` is UTC `YYYYMMDDTHHMMSSZ`, under the OS temp dir — never the workspace. Probe before anything else:

```bash
HANDOFF_RUN="${TMPDIR:-/tmp}/handoff/$(date -u +%Y%m%dT%H%M%SZ)"
node <skill>/scripts/handoff.mjs probe --run "$HANDOFF_RUN"
```

That prints the slot table and writes `quota.json`. A slot is **provider × account**, not a binary — one machine can hold several, and each carries **every window the plan gates on** (`5h 8% (30m) · 7d 43% (3d)`). `Binding` is only the headline; the five-hour window is what decides whether a session starts now or in forty minutes, so never route off the headline alone. A slot may also carry **lanes** — pools it bills separately inside the same window. Cursor has two (`cursor-models 45% · other-models 0%`): they are alternatives, not gates, and the model id picks which one a session spends. A lane at 0% does not make the slot dead, and a slot at 55% does not make the lane alive, so read both columns. The probe falls back through three sources (vendor tool, OAuth credential, local transcripts), so a reading marked `~` is estimated from this machine's own transcripts rather than read from the account — usable for routing, never quoted as the real limit.

If a slot still reads `unknown`, run the same command with `--explain`: it prints every credential path and transcript directory it consulted, found or missing. Give the user that list and the one-line fix. Details: [`references/quota.md`](references/quota.md).

## 3. Cut the work into a graph

This is the step that is yours. Write `$HANDOFF_RUN/plan.json`:

```json
{"mode":"fan-out","horizon_s":7200,"sessions":[
  {"id":"01","goal":"…","tier":"design","size":"l","writes":["src/auth/**"],"reads":["**"],"deps":[]},
  {"id":"02","goal":"…","tier":"mechanical","size":"s","writes":["docs/**"],"deps":[]},
  {"id":"03","goal":"…","tier":"review","size":"m","writes":[],"deps":["01","02"]}
]}
```

- `deps` is a dependency graph, **not waves.** A session starts when its own dependencies finish, not when a whole batch does. Batching is what turns twenty sessions into ten serial rounds.
- `writes` is the write-set. Two sessions with no dependency path between them **must not** share one — `route` refuses the plan if they do, naming the paths.
- `tier` (`mechanical` | `design` | `review`) and `size` (`s` | `m` | `l`) drive model choice and cost estimation.
- `horizon_s` is how long you expect the whole run to take. It decides whether a provider whose window reopens mid-run counts as supply.

Rules for cutting: [`references/routing.md`](references/routing.md).

## 4. Write the briefs

One `NN.md` + one `NN.prompt.md` per session, per [`references/brief.md`](references/brief.md). **You author Goal and Constraints yourself** — they carry the conversation knowledge nothing else has. Expansion (scope lists, pointers, boilerplate) may be delegated to a cheap model that writes straight to disk; you do not read it back. Pointers to existing artifacts by path or URL; never paste the artifact. Redact secrets and PII.

## 5. Route, then dispatch — same turn, no approval

```bash
node <skill>/scripts/handoff.mjs route    --run "$HANDOFF_RUN"
node <skill>/scripts/handoff.mjs dispatch --run "$HANDOFF_RUN" --budget 540
```

`route` prints the quota table and the routing table, refuses a plan whose sessions collide, and warns when the cut costs more quota than the pool holds. Show both tables to the user.

`dispatch` launches everything whose dependencies are met, waits, relaunches a session whose provider ran out on the next eligible slot, and returns a one-line-per-session digest. It is one call, not a poll loop. If it reports sessions still running, call it again — or run it with `run_in_background` and keep working. A session that fails to start at all is a stale CLI flag: [`references/providers.md`](references/providers.md) says how to fix it and where.

**compact:** one session in the plan; write the brief and stop. Launch only if the user named a provider.

## 6. Read only the digest

- Accept `dispatch`'s table. To re-check later: `handoff.mjs status --run "$HANDOFF_RUN"`.
- Open `sessions/NN.result.md` only for a session you must act on.
- **Never** read `logs/NN.log`, a child transcript, or anything under `wt/`. That is the child's raw output; ingesting it spends exactly what this skill exists to save. On a Claude parent the guard hook refuses it outright.
- **Never** implement a child's in-scope work yourself. A blocked child gets a corrected brief and a relaunch, not your edits.
- A session `blocked` on missing context means its brief was short a fact you had. Patch `NN.md` and relaunch that id.

## 7. Score

```bash
node <skill>/scripts/handoff.mjs score --run "$HANDOFF_RUN"
```

Re-probes, writes the scorecard into `manifest.md`, appends one line to `$TMPDIR/handoff/metrics.jsonl`, and prints what the run actually cost in plan quota. Report those numbers. Details and how the history feeds the next run's estimates: [`references/metrics.md`](references/metrics.md).

## Done-check

- [ ] `probe` ran before any launch; the slot table was shown with every window and every lane, not just the binding one.
- [ ] `plan.json` exists; `route` accepted it (no write-set collisions) and its table was shown.
- [ ] Every session has a brief written before dispatch; Goal and Constraints are yours.
- [ ] Fan-out: dispatched without waiting for approval; no child launched by hand.
- [ ] Parent implemented nothing a session owned, and read no child log or worktree.
- [ ] Secrets and PII redacted; existing artifacts referenced, not copied.
- [ ] `score` ran; the report gives the run path, both tables, per-session status, and the quota cost.

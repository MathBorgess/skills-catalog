# Quota

Probe remaining plan quota **before** assigning providers. Then round-robin across whoever is not low. Never dump every session on the richest provider when another eligible one exists.

Remaining means **account quota left this window**, not the parent's context-window fullness. Do not print emails, API keys, or dollar spend. Percent remaining is the only number that goes in the table.

## Probe

For each installed provider, take the **first source that returns a number**. Write the snapshot into `manifest.md` (template below). If a probe errors, that provider is `unknown` — do not install helper tools to fix it.

Tightest window wins: if a source reports both a short window (≈5h) and a longer one (daily/weekly), use the **lower** remaining percent.

| Provider | Sources, in order |
|---|---|
| cursor | `cclimits --cursor --json`; `cursor-cli-usage json`; remaining % the parent already has from `/usage` in this session |
| claude | `cclimits --claude --json`; remaining % the parent already has from `/usage` in this session |
| codex | `cclimits --codex --json`; `codex-cli-usage json`; remaining % the parent already has from `/usage` or `/status` in this session |

Parse `remaining` or `100 - used` from JSON. Ignore fields that are dollar amounts.

Also apply, without a probe:

- User said a provider is out / nearly out → `empty` or `low`.
- A child this run failed with `rate limit`, `usage limit`, `quota`, or `out of extra usage` → that provider becomes `empty` for later sessions in this run.

## Buckets

Default `LOW = 20` (percent remaining). A user-stated threshold wins.

| Bucket | When | Eligible? |
|---|---|---|
| `empty` | remaining `0`, or exhausted error | never |
| `low` | remaining `< LOW` | only if nothing `ok`/`unknown` is left |
| `ok` | remaining `≥ LOW` | yes, weight = remaining |
| `unknown` | probe failed | yes, weight = `50` |

## Assign (weighted round-robin)

Eligible = `ok` ∪ `unknown`. If that set is empty, eligible = the `low` provider with the **highest** remaining (still never `empty`). If every provider is `empty`, stop: show the quota table, do not launch, tell the user.

`order` = installed providers cycling **starting after the parent** (`cursor` → `claude` → `codex` → `cursor` …), then drop anyone not eligible.

`assigned[p] = 0` for each eligible `p`.

For each session, in NN order:

1. User named a provider for that session → use it, even if `low`. Mark the row `user override`.
2. Else pick eligible `p` that minimizes `assigned[p] / weight[p]`. Tie → first in `order`.
3. `assigned[p] += 1`.

Worked example: parent is cursor; remaining claude `80`, codex `70`, cursor `10`. Cursor is `low` (out). Weights `{claude:80, codex:70}`. Four sessions → `claude, codex, claude, codex` — not four on Claude.

A chosen binary missing at launch → next eligible in `order`, same as [`providers.md`](providers.md).

## Quota table (show with the routing table)

```markdown
| Provider | Remaining | Bucket | Source |
|---|---|---|---|
| cursor | 63% | ok | cursor-cli-usage |
| claude | unknown | unknown | probe failed |
| codex | 8% | low | skipped |
```

Add a **Remaining** column to the session routing table (`63%` / `low 8%` / `unknown`).

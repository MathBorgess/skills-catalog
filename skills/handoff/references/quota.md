# Quota

`handoff.mjs probe` answers one question: how much plan quota is left on each slot, and when does it reopen. Read this file when a slot comes back `unknown` and you have to tell the user why, or when you are changing the probe itself.

Remaining means **account quota left in the current window**, never the parent's context-window fullness. Percent remaining and time-to-reset are the only numbers that go in a table. Never print an email, a token, an account id, or a dollar figure.

## What the probe reads

Per provider, first source that yields a number:

1. **`ai-usagebar usage --json`**, if that binary happens to be installed. It already tracks twenty-odd vendors and multiple accounts behind a 60-second atomic cache with a 429 backoff, so preferring it costs nothing and survives an endpoint change.
2. **The CLI's own OAuth credential**, read directly, then that provider's usage endpoint:

| Provider | Credential | Endpoint | Field |
|---|---|---|---|
| claude | `~/.claude/.credentials.json` → `claudeAiOauth.accessToken` | `api.anthropic.com/api/oauth/usage` | `five_hour.utilization`, `seven_day.utilization` |
| codex | `~/.codex/auth.json` → `tokens.access_token` | `chatgpt.com/backend-api/wham/usage` | `rate_limit.primary_window/secondary_window.used_percent` |
| cursor | `~/.config/cursor/auth.json`, else the IDE's `state.vscdb` key `cursorAuth/accessToken` when `sqlite3` is present | `cursor.com/api/usage-summary` | total percent used |

3. **Binary present, nothing readable** → `installed`, remaining `unknown`.

Two things the probe deliberately will not do. It **never writes a credential file** — no token refresh, because another process owns that file and a half-written refresh breaks the user's CLI. And it **never installs anything** to make a probe succeed. An expired token reports `unknown` with the fix: run that provider's CLI once to log in.

Every reported window is percent **used**; remaining is `100 − used`. Where a provider states several windows, the **tightest** one wins — a provider is only as free as its most binding limit.

## Buckets

`LOW` defaults to 20 percent remaining; `HANDOFF_LOW_PCT` overrides it, and a user-stated threshold wins over both.

| Bucket | When | Eligible? |
|---|---|---|
| `absent` | binary not installed | never |
| `empty` | remaining `0`, or a child died with quota language this run | never |
| `low` | remaining `< LOW` | **yes if its window reopens inside `horizon_s`** — assigned, then held until the reset. Otherwise only when nothing better exists |
| `ok` | remaining `≥ LOW` | yes |
| `unknown` | probe failed | yes, at a neutral weight — an unprobed slot is not a dead slot |

That `low` row is the one that matters. Discarding a slot because its stock is low, when its window reopens in minutes, is how a run ends up crowded onto one provider and then stalls when that one runs out.

## When every slot is unknown

The probe failed everywhere. Say so plainly, name the reason each slot gave, and give the user the one-line fix (log in to that CLI, or install `ai-usagebar`). Routing still works — `unknown` carries a neutral weight — but admission control is guessing, so do not promise the pool can hold the cut.

This is not a cosmetic failure. A run routed entirely on `unknown` learns each provider's real limit only by killing a session on it, and recovering a dead session costs more than the whole probe ever would.

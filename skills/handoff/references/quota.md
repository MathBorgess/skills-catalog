# Quota

`handoff.mjs probe` answers one question: how much of each slot's current window is left, and when does it reopen. Read this file when a slot comes back `unknown` and you have to tell the user why, or when you are changing the probe itself.

Remaining means **account quota left in the current window**, never the parent's context-window fullness. Percent remaining and time-to-reset are the only numbers that go in a table. Never print an email, a token, an account id, or a dollar figure.

## Three sources, in order

Per provider, the first source that yields a number wins.

**1. `ai-usagebar usage --json`**, if that binary happens to be installed. It tracks twenty-odd vendors and multiple accounts behind a 60-second atomic cache with a 429 backoff, so preferring it costs nothing and survives an endpoint change.

**2. The CLI's own OAuth credential**, read directly, then that provider's usage endpoint.

| Provider | Credential, in order | Endpoint | Field |
|---|---|---|---|
| claude | each `CLAUDE_CONFIG_DIR` entry (or `~/.config/claude`, `~/.claude`) `/.credentials.json`, then the **macOS login Keychain** under service `Claude Code-credentials` | `api.anthropic.com/api/oauth/usage` | `five_hour.utilization`, `seven_day.utilization` |
| codex | each `CODEX_HOME` entry (or `~/.codex`) `/auth.json` | `chatgpt.com/backend-api/wham/usage` | `rate_limit.primary_window/secondary_window.used_percent` |
| cursor | `~/.config/cursor`, `~/.config/cursor-agent`, `~/Library/Application Support/cursor`, `~/.cursor` (`auth.json` or `cli-config.json`), then the IDE's `state.vscdb` key `cursorAuth/accessToken` when `sqlite3` is present | `cursor.com/api/usage-summary` | `individualUsage.plan.totalPercentUsed` |

Cursor's session cookie is **not** the raw token: it is `WorkosCursorSessionToken=<user id>%3A%3A<token>`, where the user id is the part of the JWT's `sub` claim after the provider prefix (`auth0|user_abc` → `user_abc`). Sending the bare token returns HTTP 401 with a credential that is perfectly valid.

A file that parses is **not** evidence that the file is current. On macOS, Claude Code keeps the live token in the Keychain and the `.credentials.json` in the home directory is frequently a stale copy, so the probe checks expiry and moves to the next source rather than trusting the first hit.

**3. Local transcripts.** No credential, no network, no login. Every CLI writes a JSONL transcript per session recording token usage per turn, and those turns group into the same rolling five-hour windows the plans bill against. The method is [ccusage](https://github.com/ccusage/ccusage)'s.

| Provider | Transcripts |
|---|---|
| claude | `<config dir>/projects/**/*.jsonl`, deduplicated by session + message id so a sidechain replay of a parent turn is not counted twice |
| codex | `<CODEX_HOME>/sessions/**/*.jsonl` and `archived_sessions/**/*.jsonl`, taking `payload.info.last_token_usage` per turn, or recovering the delta from the cumulative total |
| cursor | none verified — `--explain` is how you find where its login landed |

A window opens at the containing hour of its first turn and closes when a turn arrives more than five hours after that opening, or more than five hours after the previous turn. The denominator is the **heaviest completed window in the last seven days on this machine**, so the reading answers "how heavy is this window against my own heaviest". Newest files first, bounded by seven days and 64 MB, so a probe stays a probe.

These readings carry `estimated: true` and print with a `~` (`60%~`, `five_hour~`). Never present one as the account's real limit — there is no plan quota in a transcript. One exception is exact: when Claude Code has logged `Claude AI usage limit reached|<epoch>`, that timestamp is the real reset and it overrides the computed one.

## Every window is kept

Reported windows are percent **used**; remaining is `100 − used`. A plan gates on **several windows at once** — Claude reports a five-hour and a seven-day window, Codex a five-hour and a weekly one — and the slot carries all of them.

Collapsing them to the tightest number was wrong, and wrong in a way that is invisible: a slot showing `43% · seven_day` says nothing about whether the five-hour window that gates the next twenty minutes is nearly spent. The table now prints every window (`5h 8% (30m) · 7d 43% (3d)`), and `Binding` is only the headline.

Three separate questions come out of that list, and they have different answers:

| Question | Answered by |
|---|---|
| Can this slot take work at all, over the run? | supply per window over `horizon_s`, taken at the **minimum** — a window that reopens mid-run stops counting against the slot |
| Is it safe to start **right now**? | any window under `LOW` **at this instant** blocks a start, whatever the horizon says |
| How long must it wait? | the **latest** reset among those blocked windows, when they reopen inside the horizon |

So a slot whose five-hour window sits at 8% but reopens in thirty minutes is assigned work on a two-hour run — and **held for thirty minutes** before it starts, rather than being discarded or walking into the wall. On a twenty-minute run the same slot is simply out, because nothing refills in time.

## Two things the probe will not do

It **never writes a credential file** — no token refresh, because another process owns that file and a half-written refresh breaks the user's CLI. And it **never installs anything** to make a probe succeed.

## Buckets

`LOW` defaults to 20 percent remaining; `HANDOFF_LOW_PCT` overrides it, and a user-stated threshold wins over both.

| Bucket | When | Eligible? |
|---|---|---|
| `absent` | binary not installed | never |
| `empty` | remaining `0`, or a child died with quota language this run | never |
| `low` | remaining `< LOW` | **yes if its window reopens inside `horizon_s`** — assigned, then held until the reset. Otherwise only when nothing better exists |
| `ok` | remaining `≥ LOW` | yes |
| `unknown` | every source failed | yes, at a neutral weight — an unprobed slot is not a dead slot |

That `low` row is the one that matters. Discarding a slot because its stock is low, when its window reopens in minutes, is how a run ends up crowded onto one provider and then stalls when that one runs out.

## When a slot still says unknown

Run `handoff.mjs probe --explain`. It prints every credential path and every transcript directory consulted, marked found or missing, per provider. Report that list to the user with the one-line fix — a login that landed somewhere the probe does not know is a path to add, not a mystery to live with.

Routing still works on `unknown` (it carries a neutral weight), but admission control is guessing, so do not promise the pool can hold the cut. A run routed entirely on `unknown` learns each provider's real limit only by killing a session on it, and recovering a dead session costs more than the whole probe ever would.

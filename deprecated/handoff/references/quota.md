# Quota

`handoff.mjs probe` answers one question: how much of each slot's current window is left, and when does it reopen. Read this file when a slot comes back `unknown` and you have to tell the user why, or when you are changing the probe itself.

Remaining means **account quota left in the current window**, never the parent's context-window fullness. Percent remaining and time-to-reset are the only numbers that go in a table. Never print an email, a token, an account id, or a dollar figure.

## Three sources, in order

Per provider, the first source that yields a number wins.

**1. The CLI's own OAuth credential**, read directly, then that provider's usage endpoint.

| Provider | Credential, in order | Endpoint | Field |
|---|---|---|---|
| claude | each `CLAUDE_CONFIG_DIR` entry (or `~/.config/claude`, `~/.claude`) `/.credentials.json`, then the **macOS login Keychain** under service `Claude Code-credentials` | `api.anthropic.com/api/oauth/usage` | `five_hour.utilization`, `seven_day.utilization` |
| codex | each `CODEX_HOME` entry (or `~/.codex`) `/auth.json` | `chatgpt.com/backend-api/wham/usage` | `rate_limit.primary_window/secondary_window.used_percent` |
| cursor | the Cursor **IDE**'s `state.vscdb`, key `cursorAuth/accessToken`, read with `sqlite3` or a `python3` one-liner | `POST api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage` with `Authorization: Bearer` and `Connect-Protocol-Version: 1` | `planUsage.totalPercentUsed` plus the two pools, `autoPercentUsed` and `apiPercentUsed`; `billingCycleStart/End` |
| antigravity | none on disk — a **running product's** loopback RPC, else the Google session in the OS keyring under service `gemini`, account `antigravity` | `POST <discovered base>/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary`, else `POST cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary` with `Authorization: Bearer` | `groups[].buckets[]` keyed `gemini-5h`, `gemini-weekly`, `3p-5h`, `3p-weekly`; `remainingFraction`, `resetTime` |

Cursor's session cookie is **not** the raw token: it is `WorkosCursorSessionToken=<user id>%3A%3A<token>`, where the user id is the part of the JWT's `sub` claim after the provider prefix (`auth0|user_abc` → `user_abc`). Sending the bare token returns HTTP 401 with a credential that is perfectly valid.

**Cursor's token is the IDE's, not the CLI's.** `cursor-agent` stores identity and settings in `~/.cursor/cli-config.json` and **no usage token at all**; the token this endpoint needs is the one the Cursor IDE keeps in its SQLite state file. A machine with the CLI but no signed-in IDE therefore has nothing to read, and that is the correct answer rather than a bug to keep hunting.

**A missing source is never a failed probe.** `probe` exits 0 whatever it finds: the slot reads `unknown`, the note says which source was missing, and routing carries it at a neutral weight — so a machine with `cursor-agent` and no Cursor IDE still gets Cursor sessions, just without a quota reading or lane split to steer them. Only a provider whose **binary** is absent is dropped outright, as `absent`.

The dashboard endpoint takes a bearer token and nothing else. An older summary endpoint (`cursor.com/api/usage-summary`) is kept as a fallback and authenticates differently: a composite cookie `WorkosCursorSessionToken=<user id>%3A%3A<token>`, where the user id is whichever part of an oauth id like `github|user_abc` starts with `user_` — not blindly the second. Sending the bare token there is a 401 on a perfectly valid credential. `state.vscdb` can exceed 2 GB, so it is queried, never slurped.

**A config file is not a credential.** `cursor-agent`'s `cli-config.json` carries settings and an `authInfo` block — email, display name, user id — and no session token at all. So the probe does not look for known key names: it walks the parsed config and takes the first string that decodes as a JWT with a `sub` claim. Key names move between CLI versions; the shape of a session token does not. A file holding identity but no token is reported as `no token`, which is a different problem from `missing` and has a different fix — telling someone to log in again when they already are is the least useful thing the probe can say.

A file that parses is **not** evidence that the file is current. On macOS, Claude Code keeps the live token in the Keychain and the `.credentials.json` in the home directory is frequently a stale copy, so the probe checks expiry and moves to the next source rather than trusting the first hit.

**Antigravity has no credential file at all.** Google ships three products that share one account-wide quota — the Antigravity app, the IDE, and the `agy` CLI — and each runs the same CSRF-guarded JSON-RPC surface on a loopback port bound with `--https_server_port 0`. The port is drawn from the ephemeral range, so it cannot be hardcoded: the probe discovers it from the listening sockets of a process named `agy`, `antigravity`, or `language_server` (`lsof -nP -iTCP -sTCP:LISTEN -F pcn`, falling back to `ss -ltnpH` on Linux), and `ANTIGRAVITY_LS_ADDRESS=host:port` overrides the search. Each product binds two listeners — RPC in the clear, then HTTPS — so ports are grouped per process, sorted high-to-low, and taken rank by rank: the likely-RPC port of every product is tried before any product's TLS port.

The desktop products embed a CSRF token in the HTML they serve at `/` (`csrfToken":"`); the `agy` CLI serves no such page, so a missing token is not treated as fatal — the RPC's own rejection decides. When nothing is running, the same summary is served by Google's Cloud Code API to the session every Antigravity product saves through Go's `go-keyring`: a login Keychain item on macOS, a Secret Service item on Linux, under service `gemini` and account `antigravity`, holding JSON that is sometimes wrapped as `go-keyring-base64:<base64>` and sometimes nests the tokens under `token`. That session is read, never refreshed — renewing it needs Antigravity's own OAuth client, and rewriting another program's session is not this script's business, so an expired one is reported as expired.

One field is inverted against every other provider here: `remainingFraction` is what is **left**, `0..1`, where everyone else reports what is spent. A value outside that range is dropped rather than clamped, because a clamp would invent a reassuring number for a window whose real state is unknown.

**3. Local transcripts.** No credential, no network, no login. Every CLI writes a JSONL transcript per session recording token usage per turn, and those turns group into the same rolling five-hour windows the plans bill against. The method is [ccusage](https://github.com/ccusage/ccusage)'s.

| Provider | Transcripts |
|---|---|
| claude | `<config dir>/projects/**/*.jsonl`, deduplicated by session + message id so a sidechain replay of a parent turn is not counted twice |
| codex | `<CODEX_HOME>/sessions/**/*.jsonl` and `archived_sessions/**/*.jsonl`, taking `payload.info.last_token_usage` per turn, or recovering the delta from the cumulative total |
| cursor | none verified — `--explain` is how you find where its login landed |
| antigravity | none verified: `agy` keeps conversations in a SQLite store whose schema this script has not read, and a guessed reading is worse than an honest `unknown` |

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

## Two lanes are not two windows

Two providers here bill **several independent pools**, and each names its own:

| Provider | Lane | Where it comes from | What draws on it |
|---|---|---|---|
| cursor | **Cursor Models** (`cursor-models`, kind `own`) | `autoPercentUsed` | Auto, Composer, the Grok tiers — Cursor's own models, with their own included usage |
| cursor | **Other Models** (`other-models`, kind `frontier`) | `apiPercentUsed` | named third-party models (Claude, GPT, Gemini), charged at that model's API price against the plan's included credit |
| antigravity | **Gemini** (`gemini`, kind `own`) | buckets `gemini-5h`, `gemini-weekly` | Antigravity's own Gemini models |
| antigravity | **Claude/GPT** (`third-party`, kind `frontier`) | buckets `3p-5h`, `3p-weekly` | the third-party models Antigravity can drive |

The **names** are each vendor's vocabulary and go in the table; the **kind** — `own` or `frontier` — is what routing reasons about, so a third provider that splits its plan needs no new branch in the router.

The two differ in shape, and the difference matters. Cursor's lanes are percentages inside **one shared cycle**: the lane caps the window. Antigravity's lanes each carry **their own five-hour and weekly windows**, with their own resets — so its Gemini pool can be wide open while its Claude/GPT five-hour window is spent and reopens in twenty minutes. Supply, the hold decision and the start time are all computed per lane, which is what makes that case schedulable instead of fatal.

For Cursor, `totalPercentUsed` is the blend of the two, and it is the number that hides the case that decides a run. A live Ultra account has been observed at `auto 98.1% · api 100% · total 98.5%`: the headline says the slot has 1.5% left, and a session routed there on a named model dies on its first call while Composer would have worked all day.

**Windows are simultaneous; lanes are alternatives.** A plan gates on every window at once, so a slot is worth the **least** of its windows. A session draws from exactly one lane, so a slot is worth the **best** of its lanes — and which one it draws from is decided by the model id, which is why routing pins a model rather than stating a preference. A lane at 0% is out even while the cycle it sits inside reads 55%.

Cursor's two pools reset with the monthly cycle, so a lane caps the windows it shares that cycle with rather than carrying a reset of its own. Antigravity's carry their own, which is why a lane may hold windows instead of a single percentage.

**Both pools or neither.** A payload that reports one and not the other yields no lanes at all and the slot falls back to the blended total — a half-known split would send routing off a guess, and the total is at least a real number. Team and enterprise accounts report no `plan` object; there the two percentages come from the prose fields `autoModelSelectedDisplayMessage` and `namedModelSelectedDisplayMessage`, under the same rule.

Claude and Codex report one undivided pool, so they carry no lanes and every line above collapses to the behaviour they already had.

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

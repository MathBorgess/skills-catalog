# Cutting and routing

Use a dependency only when B needs A's output. Independent sessions run in parallel; their write-sets must not overlap. Read-only overlap is safe. Prefer separate useful jobs; merge only glue work. `route` refuses concurrent collisions and warns about dependencies that appear non-causal.

Set `size` for cost (`s`: 1–2 local files; `m`: one established module; `l`: a subsystem or open design). Set `tier` for judgment: `mechanical` has a fixed shape, `design` leaves choices open, and `review` is read-only verification. Declare `needs` such as `network`, `unix-socket`, `git-write`, `pty`, or `disk-write`; route excludes incompatible sandboxes. Use the model taxonomy in [`prompts/model-routing.md`](../../../prompts/model-routing.md).

## Model and effort

Leave `model` and `effort` unset unless the owner chose them. Route selects an eligible lane and effort from tier defaults:

| Tier | Default effort | Usual lane |
|---|---|---|
| mechanical | low | own / fast |
| design | high | frontier |
| review | medium | frontier |

An explicit `model` pins its lane. An explicit `effort` replaces the tier default. Both are owner overrides, marked `✎` in the graph gate. Route warns when an override is costly, mismatched, or unavailable; it does not reroute it. Probe CLI model lists rather than inventing identifiers. For Codex sessions, route resolves the actual configured model (e.g. from `config.toml` or `models_cache.json`) instead of presenting a `default` placeholder.

Each provider's lanes are alternatives; each lane's quota windows are simultaneous. Route estimates supply over `horizon_s`, admits demand against it, assigns work by projected lane utilisation, and holds a lane that reopens inside the horizon. It can reroute quota deaths only where the approved plan permits it. See [`quota.md`](quota.md) for supply diagnosis.

Sessions with writes receive isolated worktrees; read-only sessions use the current checkout. The dispatcher creates the worktrees.

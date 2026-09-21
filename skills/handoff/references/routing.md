# Cutting and routing

Use a dependency only when B needs A's output. Independent sessions run in parallel; their write-sets must not overlap. Read-only overlap is safe. Prefer separate useful jobs; merge only glue work. `route` refuses concurrent collisions and warns about dependencies that appear non-causal.

Set `size` for cost (`s`: 1–2 local files; `m`: one established module; `l`: a subsystem or open design). Set `tier` for judgment: `mechanical` has a fixed shape, `design` leaves choices open, and `review` is read-only verification. Declare `capabilities` such as `network`, `git-write`, `disk-write`, `docker`, `browser`, or `secrets` (Wave 0 names `unix-socket`, `pty`, and `high-memory` remain valid). `route` excludes incompatible sandboxes. Legacy `needs` still routes, with one deprecation warning per plan. Use the model taxonomy in [`prompts/model-routing.md`](../../../prompts/model-routing.md).

Effective capabilities are the fail-closed union of owner declaration and classifier output. The classifier only adds; it never removes an owner declaration. Rules are the default. Local shadow (`plan.s1.mode = "shadow"` plus a checkpoint) records six Nouls without changing the route. Local action (`"action"`) is an explicit opt-in and unions predictions at `p(yes) ≥ 0.25`. Disagreement is printed before approval.

## Model and effort

Leave `model` and `effort` unset unless the owner chose them. Route selects an eligible lane and effort from tier defaults:

| Tier | Default effort | Usual lane |
|---|---|---|
| mechanical | low | own / fast |
| design | high | frontier |
| review | medium | frontier |

An explicit `model` pins its lane. An explicit `effort` replaces the tier default. Both are owner overrides, marked `✎` in the graph gate. Route warns when an override is costly, mismatched, or unavailable; it does not reroute it. Probe CLI model lists rather than inventing identifiers. For Codex sessions, route resolves the actual configured model (e.g. from `config.toml` or `models_cache.json`) instead of presenting a `default` placeholder.

Every routed session names a real model — the plan's, the lane's pin, the CLI's configured one, or, for a CLI that lists no models, a provider roster (claude: `opus,sonnet,haiku`, frontier first, overridable with `HANDOFF_CLAUDE_MODELS`; a `mechanical` tier takes the cheaper entry). Route refuses the plan when nothing can name a session's model, and a quota reroute only moves a session to a slot that can name one, so no child ever launches on whatever default its CLI happens to carry.

Each provider's lanes are alternatives; each lane's quota windows are simultaneous. Route estimates supply over `horizon_s`, admits demand against it, assigns work by projected lane utilisation, and holds a lane that reopens inside the horizon. It can reroute quota deaths only where the approved plan permits it. See [`quota.md`](quota.md) for supply diagnosis.

Sessions with writes receive isolated worktrees; read-only sessions use the current checkout. The dispatcher creates the worktrees.

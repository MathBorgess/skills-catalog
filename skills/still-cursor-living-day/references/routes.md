# Generation routes

No coding-agent provider generates an image by itself. What generates an image is an image model behind an API, a session tool that reaches one, or a person. A route is therefore only eligible when it can actually produce a file, and `probe` reports which ones can here.

| Capability | What it means | Where it comes from |
|---|---|---|
| `probed` | This machine proved it: a key is in the environment, or the route needs nothing. | `api:*` with their key set, `manual` |
| `declared` | The binary is on PATH and is being asked to reach an image model it may or may not hold. | `cli:codex`, `cli:gemini`, `cli:antigravity` |
| `absent` | Cannot produce an image here. `route` refuses any frame assigned to it. | a missing key, a missing binary |

A `declared` route is never treated as a promise. The child is told exactly which path to write, and `collect` reads the bytes afterwards — a CLI that printed a beautiful description and wrote nothing fails there, loudly, on that frame alone.

## The routes

**`api:openai`** — `POST /v1/images/generations`, key in `$OPENAI_API_KEY`. Override the model with `SCLD_OPENAI_MODEL` (default `gpt-image-1`), the endpoint with `SCLD_OPENAI_ENDPOINT`, the size with `SCLD_IMAGE_SIZE`.

**`api:gemini`** — `generateContent` on the image model, key in `$GEMINI_API_KEY` or `$GOOGLE_API_KEY`. Override with `SCLD_GEMINI_MODEL` (default `gemini-2.5-flash-image`) and `SCLD_GEMINI_ENDPOINT`.

Model names move. They are environment variables precisely so a renamed model is a one-line fix and not a broken skill.

**`cli:codex` / `cli:gemini` / `cli:antigravity`** — the CLI is launched with the frame's prompt plus the absolute path to write. Override its argv with `SCLD_CLI_CODEX_ARGV`, `SCLD_CLI_GEMINI_ARGV`, `SCLD_CLI_AGY_ARGV` when a flag changes.

**`manual`** — the prompt is written to `prompts/NN.txt` and the exact target path is printed. Generate wherever you like and drop the file there. This is the honest fallback, not a punishment: a route you drive by hand still passes through the same `collect` evidence and the same judge.

## Mixing routes on purpose

Frames may use different routes, and there is a reason to want that. The axis argues that the instability of synthetic identity is part of the work; two generators produce two different instabilities. If you mix, say so at the gate and record which frame came from where — `score` keeps the per-route counts in the metrics line, and a reader of the collection is entitled to know.

## Delegating the fan-out to handoff

`dispatch` already runs the twelve in parallel under a concurrency cap, which is all most runs need. Reach for the `handoff` skill instead only when the generation step is itself agent work — a child that has to iterate on a frame, inspect its own output, and retry. In that case call the Skill tool with `"handoff"`, give each session one frame and one write path, and restrict routing to lanes that can reach an image model. Do not use handoff as a plain parallel launcher for API calls: it plans, gates and scores code sessions, and none of that is free.

## When a frame fails

`dispatch --only 03,07 --force` re-runs exactly those frames. Nothing else is touched, the approved hash still holds, and `collect` re-proves the whole set. A frame that fails three times on one route is a frame whose prompt is being refused by that provider — change the route or the wording, not the axis.

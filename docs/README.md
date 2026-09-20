# docs — for the people who maintain the skills

This tree is written **for humans**. Nothing here is loaded by a model, and nothing here is part of any skill's contract.

That separation is the point, and it is why `docs/` is not a folder inside `skills/`:

| Tree | Reader | Purpose |
| --- | --- | --- |
| `skills/<name>/SKILL.md` | a model, at the moment of triggering | the workflow it performs |
| `skills/<name>/references/*.md` | a model, on demand **while executing** | depth a step needs to be carried out |
| `docs/<name>/*.md` | a person | how the thing works and why it is built that way |

A model loading `references/` is mid-run and will act on what it reads. So a reference may only contain what is true of the shipped skill right now — a design that is planned, a mechanism that is half built, or a diagram of the target state all invite a model to call something that does not exist. Those belong here instead.

`CONTEXT.md` at the repository root stays where it is: it is the shared vocabulary for both readers, and neither tree owns it.

## What goes in a skill's folder

Each skill **may** have one, and there is no required shape. A page earns its place by answering something a maintainer will actually ask. Useful kinds, none of them mandatory:

- **Mechanism** — how a run behaves end to end: sequence, states, the gates, where a human is required.
- **Why it is shaped this way** — the alternatives that were rejected and what made them wrong.
- **Operational** — what breaks in practice, what a failure looks like, how to read the scorecard.
- **Non-technical** — what the skill is for and when to reach for it, for someone deciding whether to use it at all.

## House rules

- **Mark what ships.** A page that mixes current behaviour with a plan must say which is which, in a form that survives skimming. A status table at the top beats a sentence in the middle.
- **Link, do not copy.** Point at `SKILL.md`, a script, a reference, an ADR or an issue. A copied paragraph is a second source of truth that goes stale quietly.
- **No version bump for a change here.** `docs/` is outside `skills/`, so `check-version-bump.mjs` does not fire and nothing is republished. Moving a page in or out of `skills/` does change a skill and does need the bump.
- **Diagrams are Mermaid**, so they render on GitHub without a build step and stay diffable.

## Index

| Skill | Page |
| --- | --- |
| [`handoff`](../skills/handoff/) | [mechanism](handoff/mechanism.md) — the six phases, the three owner gates, the session graph, and what is shipped versus roadmap |

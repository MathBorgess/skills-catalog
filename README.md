# skills-catalog

A public catalog of agent skills, written and maintained by **[Matheus Borges](https://github.com/MathBorgess)** — each one a self-contained instruction set that turns a model into an operator for a specific job.

A skill here is not a prompt you paste once. It is a folder of markdown a model reads to run a workflow the same way every time: what to ask, what to write, where to write it, and what to check before it says it is done.

Every skill in this catalog comes out of a workflow I actually run, distilled until nothing personal is left in it — the biography stays in my own repositories, and what ships here is the part that transfers to someone else.

The plugin layout, install scripts, and some skill patterns were inspired by [Matt Pocock's skills](https://github.com/mattpocock/skills). The skills, the catalog, and the published packages are mine. The motion heuristics in `motion-identity` are adapted for video from [LottieFiles' motion-design skill](https://github.com/lottiefiles/motion-design-skill) and [GreenSock's gsap-skills](https://github.com/greensock/gsap-skills), both MIT.

## Install

Pick **one** route. The Claude Code plugin is a managed bundle. skills.sh writes files you own and can edit. Installing both leaves every skill twice.

### Claude Code — plugin

```bash
claude plugin marketplace add MathBorgess/skills-catalog
claude plugin install skills-catalog@mathborgess
```

Or, from inside a session:

```
/plugin marketplace add MathBorgess/skills-catalog
/plugin install skills-catalog@mathborgess
```

This repo is its own marketplace (it is not on Anthropic's official listing). After a release, update with `claude plugin marketplace update mathborgess` and `claude plugin update skills-catalog@mathborgess`.

### Cursor, Codex, and other agents — skills.sh

From GitHub:

```bash
npx skills add MathBorgess/skills-catalog
```

From GitHub Packages ([`@mathborgess/skills-catalog`](https://github.com/MathBorgess/skills-catalog/pkgs/npm/skills-catalog)):

```bash
npx skills add npm:@mathborgess/skills-catalog
```

GitHub Packages needs a token even for a public package. Keep it in `~/.npmrc`, never in the repo:

```
@mathborgess:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

The repo `.npmrc` already maps the scope. npmjs.org still has [`@borgesmathai/skills-catalog`](https://www.npmjs.com/package/@borgesmathai/skills-catalog) from an earlier publish; new versions ship on GitHub Packages.

Pick the skills you want and which coding agents to install them on. Add `-g` for a user-wide install. One skill: append `--skill <name>`. Later: `npx skills update <name>`.

### This machine, while hacking on the catalog

```bash
npm run link
```

Symlinks every categorized skill into `~/.claude/skills`, `~/.cursor/skills`, `~/.codex/skills`, `~/.agents/skills`, and `~/.gemini/config/skills`. Not the end-user installer.

Because those are symlinks into this working tree, **a `git pull` refreshes the content of every linked skill on its own** — the link points at the file that just changed. The one thing a pull cannot do by itself is link a skill that did not exist before, drop one that was removed, or repair a link to a moved folder: that only happens when the script runs again.

So `npm run link` also points this clone's `core.hooksPath` at `.githooks` (only if nothing else claims it). From then on, `.githooks/post-merge` runs after a `git pull` on `main` and re-links **when that pull added, removed, or moved a skill**, staying silent otherwise:

```
skills-catalog: 1 skill(s) added or removed in this pull — local links refreshed.
```

To wire it without running the link script, or to check it is on:

```bash
git config core.hooksPath .githooks
git config --get core.hooksPath
```

Two things it deliberately does not cover: a pull on a branch other than `main`, and a **rebasing** pull (`pull.rebase=true`), which fires `post-rewrite` instead of `post-merge` — run `npm run link` by hand after one of those if the skill set changed.

## Catalog

The folders and tables separate `engineering`, `creativity`, and `experiments`. Installation and invocation still use the leaf skill name, without a category prefix. Learning workflows sit with engineering; writing sits with creativity.

Two kinds of skills live in this catalog:
- **Operators**: Generic, reusable workflows run to get work done across projects on work that keeps arriving.
- **Experiments**: Specific, non-generic skills designed to test and measure agent behavior under fixed constraints or specific hypotheses, leaving a measurable finding behind.

### Engineering

Domain design, agent workflow maintenance, and technical learning. These are operator skills.

| Skill | Version | Kind | What it does |
|---|---|---|---|
| [`domain-modeling`](skills/engineering/domain-modeling/) | 1.0.0 | operator | Actively builds and sharpens a project's domain model, ubiquitous language, and glossary during design; records ADRs for hard-to-reverse architectural decisions. |
| [`study-wiki`](skills/engineering/study-wiki/) | 1.0.0 | operator | Interviews you about the certifications you are chasing, then builds and operates a personal study repository: a knowledge graph of notes, a question bank, an error log, and a daily study loop that injects questions, grades your answers, and records where you are weak. |
| [`teach-me`](skills/engineering/teach-me/) | 1.2.0 | operator | Runs one study session against a wiki that already exists: a phone-sized HTML lesson plus a session note and error log. Not for bootstrapping an empty wiki — that is study-wiki. |
| [`skills-evaluate`](skills/engineering/skills-evaluate/) | 0.2.0 | operator | Reads the metrics the other skills leave in the OS temp dir, the maintainer sketchpad and open issues; compares the last run with the recent median, diagnoses root causes, checks each skill against its own scope, and proposes improvements to the skill or to its observability. |

### Creativity

Visual explanations, design, motion, and writing. These are operator skills; `motion-identity` defines how a brand moves, while `co-direct-animation` co-directs films from authored DESIGN.md and a human briefing through reviewed Flow shots and final assembly. `poster-design`, `campaign-identity-grid`, `brand-campaign-shots` and `illustration-style-remix` run image-model design work, each checking its outputs against written constraints before delivery.

| Skill | Version | Kind | What it does |
|---|---|---|---|
| [`video-reference`](skills/creativity/video-reference/) | 1.1.0 | operator | Distills local videos into layered references and retrieves detailed Remotion direction with evidence and human-reviewed adaptation dependencies. |
| [`morphological-project-design`](skills/creativity/morphological-project-design/) | 1.0.0 | operator | Turns seed ideas into reproducible morphological paths, two rounds of N independent proposals and commercial critique, competitor research, a decision package and pitch. RCD instructional adaptation has [specific terms](LICENSES.md). |
| [`explain-me`](skills/creativity/explain-me/) | 2.0.0 | operator | Creates one visual explanation, in the language you asked in, with controlled-writing text, diagrams, images, interactive HTML or a narrated video, landscape or portrait for Reels/Shorts/TikTok (Remotion motion, local Kokoro voice), styled from an editable, brand-able DESIGN.md; teach-me retains quizzes and progress records. |
| [`prettify`](skills/creativity/prettify/) | 0.0.0 | operator | Guides a visual idea from a clear question through briefing, low-fidelity and high-fidelity review to an inspected web or static delivery, with explicit design decisions and task-specific dependencies. |
| [`motion-identity`](skills/creativity/motion-identity/) | 2.0.0 | operator | Grills a brand's owner, round by round, into a motion identity — personality, one GSAP ease per role (enter, exit, emphasis), durations, ambient level, signature move, kinetic type and a never-list — and writes it into the brand's DESIGN.md, where Remotion and explain-me both read it; renders a short deterministic Remotion proof the owner approves by watching, and prints the block a Remotion REVIEW.md carries to the footage skills. Disney's principles, archetypes and timing adapted for video from LottieFiles' motion-design and GreenSock's gsap-skills. |
| [`easy-to-read`](skills/creativity/easy-to-read/) | 1.0.0 | operator | Once activated, keeps every text it writes for you in plain language for the rest of the session — chat replies, documents, notes, summaries, PR and issue bodies — under STE-lite plus the profile of the text's language (ASD-STE100 for English; ABNT NBR ISO 24495-1 and the Senado style for Brazilian Portuguese; the core alone for other languages). Lints documents and long replies with a zero-dependency linter before they ship, and never rewrites code, commands, paths, identifiers or quotes. Canonical home of the writing rules explain-me ships as byte copies. |
| [`co-direct-animation`](skills/creativity/co-direct-animation/) | 1.0.0 | operator | Co-directs animations from DESIGN.md and human briefing, preserving direction and decisions in an external TO-SPEC. Uses five human critique gates, user-chosen image tools and reviewed gflow video shots, then assembles the film. Replaces reference-animation. |
| [`poster-design`](skills/creativity/poster-design/) | 1.0.0 | operator | Builds an image-model poster around one subject: picks one of three archetypes (flat digital portrait, photo-grid tribute, ensemble from references), derives its slots from the subject, generates with the tool you name, and inspects every output against the archetype's own checks, counting figures, cells and name widths. |
| [`campaign-identity-grid`](skills/creativity/campaign-identity-grid/) | 1.0.0 | operator | Builds a brand tile wall of logo, slogan and photo blocks from a row-by-row spec, checks each output by counting rows, cells, gaps and slogan letters, and switches to generating tiles separately and assembling them in an HTML grid when the model keeps breaking the layout. |
| [`brand-campaign-shots`](skills/creativity/brand-campaign-shots/) | 1.0.0 | operator | Writes a Brand DNA brief the user corrects, casts the muse from it, then generates an editorial campaign triptych and inspects it for brand fit, one consistent muse and invented logos. |
| [`illustration-style-remix`](skills/creativity/illustration-style-remix/) | 1.0.0 | operator | Redraws a person or character, or a whole set, in one named style: breaks the style into six observable layers, locks them in a style block, varies only the subject, and inspects every output layer by layer for drift. |

### Experiments

Shipped workflows with a fixed hypothesis, measurement, and exit condition. These live in `skills/experiments/`; unshipped trials remain in `docs/experiments/`.

| Skill | Version | Kind | What it does |
|---|---|---|---|
| [`still-cursor-living-day`](skills/experiments/still-cursor-living-day/) | 0.0.0 | experiment | Runs one image collection end to end under a fixed axis: twelve frames of the same MacBook, display off, carried through a day across places, distances and angles, with one white arrow on the same pixel of its screen in every frame, sized by the perspective the laptop is seen in. The generator never draws the cursor — asked for one, image models put it anywhere at any size — so the panel is generated blank, its four corners are marked in a local page, and a zero-dependency script projects the arrow onto it by homography. It refuses a plan that breaks the restriction, drifts out of the panel's reflectivity band, holds a frame nobody would miss, never leaves one room, or asks a generator for a cursor; gates the twelve briefs in one hash-locked approval; dispatches the generations in parallel (GPT-Image, Gemini, a CLI child, or a manual drop); refuses a panel too small, occluded or drawn on to carry the arrow; and runs a two-pass LLM-as-judge — blind first, which reorders the day into a Kendall tau — that proposes and never regenerates. Ships a guard hook that seals the plan while the blind pass is open. |

### Deprecated

The following skills are **deprecated** and no longer maintained or accessible in the catalog. They have been moved out of `skills/` to [`deprecated/`](deprecated/) and are no longer usable or installed by the plugin or package:

- [`handoff`](deprecated/handoff/): Previously used to compact conversation briefs and schedule cross-provider session graphs. Deprecated and removed from active catalog.
- [`shunt`](deprecated/shunt/): Previously used to keep large models off heavy I/O via read thresholds and run wrappers. Deprecated and removed from active catalog.

## Using a skill

How a skill works under the hood, for whoever maintains it, is in [`docs/`](docs/) — written for people, never loaded by a model.

After install, start a session and type `/domain-modeling`, `/study-wiki`, `/teach-me`, `/explain-me`, `/motion-identity`, `/co-direct-animation`, `/easy-to-read`, `/skills-evaluate`, or `/still-cursor-living-day`, or just say what you want — the skill's `description` is what makes the model reach for it on its own.

**Improving the skills**

1. Use a skill.
2. In a clone of this repo, run `/skills-evaluate`: it reads the metrics history, `.agents/sketchpad/` and open issues, and proposes what to fix — in the skill, in its metrics, or in the catalog's scope.
3. Accepted findings become issues, then PRs with a version bump.

**Anywhere else (chat, Cowork, an API app)**

Paste the contents of the skill's `SKILL.md` as the opening message and let the model pull the `references/` files it names as it needs them. The skill is written so `SKILL.md` alone is enough to get started; the reference files are the depth.

## Anatomy of a skill in this catalog

```
skills/<category>/<name>/
  SKILL.md             # frontmatter (name, description) + the workflow, top to bottom
  agents/openai.yaml   # Codex picker metadata
  references/          # the depth — loaded on demand, not up front
```

`SKILL.md` stays short enough to be read in full at the start of every session. Anything longer than a screen or two — templates, literal prompts, checklists — moves to `references/` and gets linked by path from `SKILL.md`.

Every `SKILL.md` carries its author and version in frontmatter, so a skill copied into someone else's project still says where it came from and which revision it is:

```yaml
---
name: study-wiki
description: <written for the moment of triggering>
metadata:
  author: Matheus Borges
  version: 1.0.0
---
```

`metadata.version` is the last version published on `main`. Staging edits, brainstorming and tests do not bump it. The publish commit is the only one that raises the number (and this table): `0.0.0` until the first publish (`1.0.0`), then patch / minor / major for the cumulative delta since the previous `main` version.

## Contributing

All changes land through **pull requests** against `main`. Direct pushes to `main` are blocked, including for admins. Branch, open a PR, wait for the **Catalog** check, merge.

Issues and suggestions are welcome. A new skill has to meet [`AGENTS.md`](AGENTS.md), the one contract every agent in this repo works from. Short version: one job per skill, a description written for the moment of triggering, `metadata.author` and `metadata.version` in the frontmatter, an `agents/openai.yaml`, no dead scaffolding, and every instruction concrete enough that two different models produce the same shape of output.

Skills contributed by other people keep their own author in `metadata.author`; authorship travels with the skill, not with the repository.

### Add a skill

1. Read `AGENTS.md` and one existing skill end to end.
2. Create `skills/<category>/<name>/SKILL.md` and `skills/<category>/<name>/agents/openai.yaml`.
3. Add a row to the catalog table above at version `0.0.0`.
4. Append `"./skills/<category>/<name>"` to `.claude-plugin/plugin.json` → `skills`.
5. Run `npm run check` and fix anything it reports.
6. Open a pull request against `main`. Do not push to `main`.

### Release (maintainers)

Package version and plugin version move together on a catalog release. Bump them **on the PR**, not on `main`. Skill frontmatter versions bump only in the commit that publishes that skill to `main`, for the cumulative work since the last published number.

```bash
git checkout -b release/x.y.z
npm version patch          # or minor / major — syncs plugin.json, commits, tags vX.Y.Z
git push -u origin HEAD --follow-tags
```

Open the PR, wait for **Catalog**, merge. Merging to `main` publishes [`@mathborgess/skills-catalog`](https://github.com/MathBorgess/skills-catalog/pkgs/npm/skills-catalog) to GitHub Packages if that version is not already there. Then:

```bash
claude plugin tag --push   # skills-catalog--vX.Y.Z for Claude Code
```

Claude Code users who already added the marketplace run `claude plugin marketplace update mathborgess` then `claude plugin update skills-catalog@mathborgess`.

To submit the plugin to Anthropic's community marketplace later, follow [Discover plugins](https://code.claude.com/docs/en/discover-plugins). Until that listing exists, the self-hosted marketplace commands above are the Claude install path.

## License

Existing catalog material and original helpers remain MIT © Matheus Borges — see [`LICENSE`](LICENSE). The Revenue-Centric Design instructional adaptation in `morphological-project-design` has specific source-available terms, including attribution and a gambling/betting/casino exclusion. See [`LICENSES.md`](LICENSES.md) for the exact file scopes and complete applicable terms.

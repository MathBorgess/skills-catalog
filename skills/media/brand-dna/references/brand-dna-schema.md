# Brand DNA schema

Write `brand-dna.md` with three sections and one row per field. Mark every row `[known]` (with its source path, URL, or user quote) or `[inferred]` (with the observation behind it). Once the human confirms an `[inferred]` row, promote it to `[known] (confirmed by user)`.

## 1. Visual & Brand Core

| Field | What to write |
|---|---|
| Standing | `own-brand`, `client`, or `concept-study` (`unofficial concept` when not owned) |
| Archetype | The brand or creator character in one phrase (e.g., the pragmatic builder, the rebel craftsman) |
| Philosophy | What the brand believes and argues for, in one sentence |
| Audience & Prerequisites | Who watches/reads, how they live, and which concepts they already bring walking in |
| Palette | 3–5 colors with hex values; primary background, primary text, and signature accent first |
| Typography | `display` (headlines/hooks) and `body` (captions/prose) font families and weights |
| Materials & Visual Lineage | Textures, lighting, and the editorial/photographic tradition the brand sits closest to |

## 2. Voice DNA

| Field | What to write |
|---|---|
| Tone | Three words that govern spoken and written attitude |
| Cadence & Burstiness | Sentence-length oscillation rule (e.g., alternate punchy `<= 5`-word sentences with `20–28`-word clauses; spoken ceiling `<= 18` words per beat) |
| Vocabulary & Grounding | Preferred concrete terms, domain language rules, and how new terms are grounded |
| Banned AI Clichés | Exact rhetorical patterns and words never used (see `voice-and-cadence.md`) |

## 3. Motion & Guardrails

| Field | What to write |
|---|---|
| Motion Archetype | `playful`, `premium`, `corporate`, or `energetic` (from `motion-archetypes.md`) |
| Role Eases | GSAP eases for `enter`, `exit`, `emphasis`, and `base` |
| Max Static Hold | Maximum seconds on screen without visual change (`2.0 s` default for short-form video) |
| Never | Two or three concrete things the brand never shows, claims, or does on screen |

## Brief Block (for video handoffs)

At the bottom of `brand-dna.md`, include a `## Brief Block` of at most 8 lines summarizing palette, display/body fonts, motion archetype, role eases, max static hold, and the `Never` list so Remotion and storyboard reviews read one self-contained block.

## Rules

- Never mark a guessed color hex, typeface, or slogan `[known]`. If no source states it, mark it `[inferred]` and ask.
- Downstream skills (`social-video-director`, `social-post-director`, `brand-campaign-shots`, `campaign-identity-grid`, `poster-design`, `illustration-style-remix`) read this file first and skip intake questions that `brand-dna.md` already settles.
- Local moodboards (`moodboard.md`) may layer episodic artistic, visual, and sensory accents *above* `brand-dna.md` for a single piece without mutating the durable `brand-dna.md`.

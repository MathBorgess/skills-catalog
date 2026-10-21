# Social post formats, grounding, and Arena delta loop (`viral-rag`)

Use this reference in Step 2 (format & angle selection) and Step 5 (beat/slide writing). Also check `<project>/references/viral-rag/` when present for project-specific reference cards.

## 1. Five social post and carousel archetypes

| Archetype | Structure (`7–10` slides or beats) | Best for |
|---|---|---|
| **1. Narrative Carousel** (*Problema -> Mecanismo -> Prova*) | `Slide 1` First-Fold Hook -> `Slide 2` The hidden friction -> `Slides 3–6` One grounded mechanism step per slide -> `Slide 7` Real trade-off / before-after proof -> `Slide 8` Summary card + save/comment CTA | Instagram / LinkedIn carousels (`1080x1350`) |
| **2. Contrarian Thesis** (*Quebra de Consenso*) | `First Fold` Challenges a default industry rule -> `Beat 2` Why the default rule fails under pressure -> `Beat 3` Concrete incident or metric -> `Beat 4` The replacement rule -> `Close` Sharp 1-sentence question | LinkedIn text posts, X/Threads, Feed essays |
| **3. Build-in-Public Breakdown** (*Bastidor c/ Fricção Real*) | `First Fold` What we shipped/tested and what broke -> `Beats 2–4` The decision tree and rejected option -> `Beat 5` Diff/screenshot/numbers -> `Close` Open question to peers | Founder updates, engineering logs, lab notes |
| **4. Two-Column / Before-After Contrast** | `Slide 1` Contrast Hook -> `Slides 2–6` Paired comparisons (`Naive Way` vs. `Engineered Way`) -> `Slide 7` Decision rule -> `Slide 8` Saveable checklist | Carousels, visual cheat-sheets |
| **5. Actionable Framework** (*3–5 Regras Operacionais*) | `First Fold` Specific outcome + constraint -> `Beats 2–5` Named rules (each with *what to do* + *what to avoid*) -> `Close` Diagnostic question | Educational threads, save-heavy carousels |

## 2. Concept Grounding across beats and slides (from `writing-beats` / `writing-shape`)

- **Settle prerequisites first:** Read `Audience & Prerequisites` from `brand-dna.md`. Anything not in that list must be grounded by an earlier beat/slide before a later beat/slide can use it.
- **One move per slide or paragraph:** If a slide or paragraph is doing two jobs (defining a problem *and* introducing a new tool), split it.
- **Format trade-offs to weigh explicitly:**
  - *Prose vs. list:* Prose carries causal argument; lists carry parallel items. Never turn a causal chain into bullet points.
  - *Slide ceiling:* In a carousel, each slide holds at most **1 headline (`2–6` words)** and **1 body block (`<= 28` words)**.

## 3. Arena-style surgical delta commands

Support fast conversational commands over `<out>/post.md` and `<out>/storyboard.md`:

- `variar gancho` / `vary hook`: propose 3 new First-Fold Hooks while keeping the body intact.
- `revisar slide <N> <instruction>` / `revisar bloco <N>`: edit only slide/beat `N` in place and verify grounding for `N+1`.
- `secar texto`: cut word count by 25–30% across blocks while preserving every grounded concept and burstiness contrast.
- `mudar moodboard <change>`: update `moodboard.md` and adjust tone/visual cues across affected slides.

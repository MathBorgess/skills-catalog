---
name: social-post-director
description: "Use when the user wants to direct, write, hook, moodboard, or structure a social media post, carousel, thread, or written piece — 'cria um post', 'carrossel para instagram', 'post para linkedin', 'thread', 'texto para rede social', 'roteiro de carrossel'. Runs a fast Arena-style human-agent loop over brand-dna and viral-rag: format & angle -> moodboard (sensory/editorial layer above DNA) -> First-Fold Hook -> grounded beats/slides -> slide/visual Storyboard -> Inspect by counting."
metadata:
  author: Matheus Borges
  version: 1.0.0
---

# Social Post Director

Co-direct social posts, carousels, and threads through a fast, Arena-style conversational loop. Work one decision frontier at a time over versioned files (`brief.md`, `brand-dna.md`, `moodboard.md`, `post.md`, `storyboard.md`, `review.md`). Accept surgical delta commands (`variar gancho`, `revisar slide 3`, `secar texto`, `mudar moodboard`, `trocar CTA`) at any turn, patching only the targeted block without rewriting the rest.

## Steps

1. **Intake and Brand DNA.** Ask for the topic or raw material pile, target platform (`Instagram Carousel`, `LinkedIn`, `X/Threads`, `Feed Post`), and whether visual slides or companion cards are needed. Write `<out>/brief.md` (`<out>` defaults to `media/posts/<slug>/`). Call the Skill tool with `brand-dna` to resolve `brand-dna.md`: reuse it in zero questions when already confirmed; otherwise confirm every `[inferred]` line before continuing.
2. **Choose format and angle (`viral-rag`).** Consult [post formats](references/post-formats.md) and any project-local `<project>/references/viral-rag/` cards. Recommend **one format archetype and one unique angle** with a one-sentence reason, and name one runner-up. Wait for the human's pick and record it in `brief.md`.
3. **Build the Moodboard (before the hook).** Write `<out>/moodboard.md` following [moodboard and layout](references/moodboard-and-layout.md). The moodboard sits **above** `brand-dna` and `voice-dna` as the episodic editorial, artistic, and sensory direction for this piece: reading atmosphere, voice/cadence modulation (e.g., clinical breakdown vs. sharp manifesto), palette/type accent, and visual direction for slides or imagery. Reach mutual understanding (human confirmation) before step 4, because the moodboard shapes the hook itself.
4. **Engineer the First-Fold Hook.** Guided by the confirmed `moodboard.md`, chosen format, and [post hooks](references/post-hooks.md), propose **three distinct First-Fold Hooks** in `<out>/post.md` (for carousels: `Slide 1 Headline + Sub-hook + Visual cue`; for text posts: `Line 1 + Line 2 before "see more"`), each using a distinct trigger (*Contrarian Thesis*, *Proof-First Metric/Failure*, *Curiosity Gap*, *Direct Call-Out*, *Hard Rule*). The human picks or combines one.
5. **Write Beats or Slides.** Grow `<out>/post.md` block by block or slide by slide following [post formats](references/post-formats.md). Enforce *Concept Grounding* (each block/slide relies only on prerequisites or earlier blocks and grounds at most one new concept) and *Voice DNA* burstiness (alternating `<= 5`-word punches with `20–28`-word structural sentences). End with an authored question or action CTA.
6. **Build the Visual Storyboard when visuals are requested.** For text-only posts or threads without slides or companion cards, record `storyboard: not applicable (text-only)` in `brief.md` and proceed to step 7. Otherwise, separate from the moodboard, write `<out>/storyboard.md` following [moodboard and layout](references/moodboard-and-layout.md): map each slide or visual card's layout, headline (`2–6` words), body word ceiling (`<= 28` words/slide), visual anchor, and aspect ratio (`1080x1350` portrait carousel or `1080x1080`), ready for human confirmation. When visual production is requested, call the Skill tool with the chosen downstream skill (`poster-design`, `campaign-identity-grid`, or `prettify`).
7. **Inspect by counting.** Fill the *Expected / Seen* table from [post inspection](references/post-inspection.md) into `<out>/review.md`: first-fold word count, words-per-slide/paragraph ceiling, sentence burstiness span, zero ungrounded leaps, and zero `Banned AI Clichés` or `Never` violations. Change one variable per revision round.

## Done-check

- [ ] `brand-dna.md` has zero unconfirmed `[inferred]` lines; `brief.md` records the platform, format archetype, and angle.
- [ ] `moodboard.md` was confirmed by the human *before* the hook and defines the episodic editorial/visual layer above `brand-dna`.
- [ ] Three distinct First-Fold Hooks were offered and the human selected or combined one before the body was written.
- [ ] `post.md` grounds one concept per block/slide and obeys the `Voice DNA` burstiness and cliché bans.
- [ ] When slides or companion cards are requested, `storyboard.md` is separate from `moodboard.md`, maps the visual sequence with exact word ceilings, and has human confirmation; text-only work records `storyboard: not applicable (text-only)` in `brief.md`.
- [ ] `review.md` holds a numeric *Expected / Seen* table with every check passing or any remaining limitation stated plainly.

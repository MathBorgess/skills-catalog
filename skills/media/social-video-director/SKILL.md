---
name: social-video-director
description: "Use when the user wants to direct, script, hook, moodboard, or storyboard a short-form vertical video for social media — 'Reels', 'YouTube Shorts', 'TikTok', 'cria um reel', 'roteiro de shorts', 'gancho de vídeo', 'dirige um vídeo curto', 'storyboard de reel'. Runs a fast Arena-style human-agent loop over brand-dna and viral-rag: format & angle -> moodboard (sensory/artistic layer above DNA) -> 0-3s Hook Triad -> 3-track Retention Beats -> second-by-second Storyboard -> Inspect by counting."
metadata:
  author: Matheus Borges
  version: 0.0.0
---

# Social Video Director

Co-direct high-retention vertical videos (`1080x1920`, Reels, Shorts, TikTok) through a fast, Arena-style conversational loop. Work one decision frontier at a time over versioned files (`brief.md`, `brand-dna.md`, `moodboard.md`, `script.md`, `storyboard.md`, `review.md`). Accept surgical delta commands (`variar hook`, `revisar beat 3`, `mudar moodboard`, `encurtar`, `trocar CTA por loop`) at any turn, patching only the targeted section without rewriting the rest.

## Steps

1. **Intake and Brand DNA.** Ask for the topic or goal, target platform (`Reels`, `Shorts`, `TikTok`), production mode (`talking-head`, `faceless`, `hybrid`), and available assets (raw camera/screen footage or none). Write `<out>/brief.md` (`<out>` defaults to `media/videos/<slug>/`). Resolve `brand-dna.md` via the `brand-dna` skill: reuse it in zero questions when already confirmed; otherwise confirm every `[inferred]` line before continuing.
2. **Choose format and angle (`viral-rag`).** Consult [viral formats](references/viral-formats.md) and any project-local `<project>/references/viral-rag/` cards. Recommend **one format archetype and one unique angle** with a one-sentence reason, and name one runner-up. Wait for the human's pick and record it in `brief.md`.
3. **Build the Moodboard (before the hook).** Write `<out>/moodboard.md` following [moodboard and storyboard](references/moodboard-and-storyboard.md). The moodboard sits **above** `brand-dna` and `voice-dna` as the episodic artistic, visual, and sensory direction for this video: atmosphere/sensation, intentional modulations over base DNA (voice/cadence tension, palette/lighting accent, motion energy), framing/B-roll anchors, and sonic feel. Reach mutual understanding (human confirmation) before step 4, because the moodboard shapes the hook itself.
4. **Engineer the Hook Triad (`0–3s`).** Guided by the confirmed `moodboard.md`, chosen format, and [viral hooks](references/viral-hooks.md), propose **three distinct Hook Triads** in `<out>/script.md`. Each triad pairs `Visual Hook (0–1.5s)` + `On-Screen Headline (2–6 words, Mute Test)` + `Spoken Opening (zero greeting filler)` under a distinct psychological trigger (*Contrarian*, *Proof-First*, *Curiosity Gap*, *Pattern Interrupt*, *Standalone Series Hook*). The human picks or combines one.
5. **Write the Retention Beats.** Grow `<out>/script.md` beat by beat (`2–4s` per beat) across three parallel tracks (`Audio/Speech`, `Visual Stage`, `Overlay/Motion`) following [retention and grounding](references/retention-and-grounding.md). Ground one concept per beat before later beats lean on it, escalate to a concrete *Payoff*, and close with a *Dominant CTA* or *Seamless Loop*.
6. **Build the Storyboard.** Separate from the moodboard, write `<out>/storyboard.md` (and `REVIEW.md` when entering studio production) following [moodboard and storyboard](references/moodboard-and-storyboard.md) and [choreography and type](references/choreography-and-type.md): second-by-second `1080x1920` mapping, safe zone (`x=108..900, y=250..1500`), the 8-line motion `Brief Block`, and a reversible *Speech-Cut Ledger* when raw footage exists. Confirm mutual understanding with the human; when asked to produce, assemble and open the composition in Remotion Studio (or dispatch to `explain-me`).
7. **Inspect by counting.** Fill the *Expected / Seen* table from [inspection checks](references/inspection-checks.md) into `<out>/review.md`: hook onset (`<= 0.5s`), headline length (`2–6` words), spoken ceiling (`<= 18` words/beat), max static window (`<= maxStaticSec`), sentence burstiness, zero banned AI clichés or `Never` violations, and safe-zone compliance. Change one variable per revision round.

## Done-check

- [ ] `brand-dna.md` has zero unconfirmed `[inferred]` lines; `brief.md` records the chosen format archetype and angle.
- [ ] `moodboard.md` was confirmed by the human *before* the hook and defines the episodic sensory/artistic layer above `brand-dna`.
- [ ] Three distinct `0–3s` Hook Triads were offered; the chosen hook passes the Mute Test (`2–6` headline words, onset `<= 0.5s`, no greeting filler).
- [ ] `script.md` maps every `2–4s` beat across `Audio/Speech`, `Visual Stage`, and `Overlay/Motion` with intact concept grounding.
- [ ] `storyboard.md` is separate from `moodboard.md`, covers the full arc second by second in `1080x1920` with safe-zone protection (`x=108..900, y=250..1500`), and has human confirmation.
- [ ] `review.md` holds a numeric *Expected / Seen* table with every check passing or any remaining limitation stated plainly.

# Inspection by counting (`review.md`)

In Step 7, judge the completed package (`brief.md`, `brand-dna.md`, `moodboard.md`, `script.md`, `storyboard.md`, and rendered frames/studio when produced) by counting observable properties, never by vague impression. Write this exact table into `<out>/review.md`:

## Expected / Seen Table

| Check | Expected | Seen (Count / Measurement) | Verdict (`pass / fail / unverified`) |
|---|---|---|---|
| **1. Brand DNA confirmation** | `0` unconfirmed `[inferred]` lines in `brand-dna.md` | `<count>` unconfirmed lines | `pass / fail` |
| **2. Moodboard gate order** | `moodboard.md` confirmed *before* hook and separate from `storyboard.md` | Confirmed at step 3; separate files present | `pass / fail` |
| **3. Hook Triad completeness (`0–3s`)** | 3 channels present (`Visual 0–1.5s`, `Headline 2–6 words`, `Spoken hook`); passes Mute Test | Visual onset `<s >`, Headline `<N>` words, Greeting filler `<0 or N>` | `pass / fail` |
| **4. Hook motion onset** | First kinetic/visual entrance between `0.1 s` and `0.5 s` (not `t = 0.0 s`) | Onset at `<t> s` | `pass / fail` |
| **5. Spoken beat length ceiling** | Every beat in `script.md` has `<= 18` spoken words | Max spoken words in a beat: `<N>` (Beat `<id>`) | `pass / fail` |
| **6. Sentence burstiness** | Script oscillates between short (`<= 5` words) and longer (`>= 12` words) sentences | Shortest: `<N>` words; Longest: `<M>` words | `pass / fail` |
| **7. Concept grounding chain** | `0` beats using a concept before it is grounded or listed as a prerequisite | `<count>` ungrounded leaps | `pass / fail` |
| **8. Pacing & Motion Gate** | Visual change every `2–4 s`; no static hold `> Max Static Hold` (`2.0 s` default) | Max static window: `<t> s` | `pass / fail` |
| **9. Headline reading time** | Every on-screen headline holds for `>= 0.3s * words + 0.5s` | Min hold ratio across beats: `<value>` | `pass / fail` |
| **10. Safe-zone & face protection** | All critical overlays within `x=108..900, y=250..1500`; `0` frames covering a face | Safe-zone breaches: `<count>`; Face occlusions: `<count>` | `pass / fail / unverified` |
| **11. Source color & DNA guardrails** | `0` LUT/color filters on source footage; `0` `Banned AI Clichés` or `Never` violations | Cliché matches: `<count>`; `Never` breaches: `<count>` | `pass / fail` |
| **12. Ending mechanics** | Explicit *Dominant CTA* (held for reading) or syntactic *Seamless Loop* into `B01` | Mode: `<CTA | Loop>`; hold/bridge verified | `pass / fail` |

## Revision rule

When any check fails, change **one variable per revision round** (e.g., trim a 22-word spoken beat to 14 words, or move an overlay inside `x=108..900`), update `review.md`, and re-verify before reporting completion.

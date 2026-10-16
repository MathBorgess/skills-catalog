# Viral hooks engineering (`0–3s` Hook Triad)

Use this reference in Step 4, **after** `moodboard.md` is confirmed. The moodboard's core sensation, voice modulation, and visual direction govern which hook triggers fit and how they look and sound.

## The Hook Triad (`0.0s – 3.0s`)

A short-form hook is never a single spoken line. Half of feeds start muted, so every candidate must be specified as three synchronized channels:

1. **Visual Hook (`0.0s – 1.5s`):** Ongoing physical action, immediate visual contrast (before/after, live terminal/UI failure, unexpected prop), or a kinetic headline entrance between `0.1s` and `0.5s` (never at `t = 0.0s`, which reads as a jump cut).
2. **On-Screen Headline (`2–6` words, `>= 96 px` in `1080x1920`):** Heavy display type that **tensions or complements** the spoken line rather than repeating the transcript verbatim. Exactly one word takes the accent color and `eases.emphasis`. Must pass the **Mute Test**: a viewer with sound off understands the stakes in under 2 seconds.
3. **Spoken Opening (First sentence, `<= 15` words):** Starts directly inside the conflict, proof, or question. Zero greeting filler (`"Hey guys"`, `"Oi pessoal"`, `"Today we are going to talk about..."`).

## Six psychological hook triggers (`viral-rag`)

When proposing three candidates in Step 4, pick **three distinct triggers** from this table and adapt their emotional tone to `moodboard.md`:

| Trigger | Psychological mechanism | Spoken template | Visual + On-Screen Headline pairing |
|---|---|---|---|
| **1. Contrarian / Premise Break** | Cognitive dissonance against a consensus belief | *"Everyone tells you to [default habit], and that is why [bad outcome] keeps happening."* | Split or strike-through of the default approach; Headline: `O ERRO DO [HÁBITO]` |
| **2. Proof-First / Real Failure** | Concrete evidence or dramatic failure on frame 1 before any explanation | *"This 40-line script just [unexpected result / broke X in 3 seconds]."* | Frame 0 shows the real output, crash, or finished artifact; Headline: `[NÚMERO/FALHA] EM 3 SEGUNDOS` |
| **3. Curiosity Gap / Open Loop** | Specific information gap that demands closure | *"I tested [specific tool/method] on [real task] so you don't waste [cost] — here is where it broke."* | Live screen or timer starting; Headline: `ONDE O [X] QUEBRA` |
| **4. Direct Call-Out / Filter** | Immediate self-selection of the exact target viewer | *"If you still [painful manual step] every time you [task], watch this."* | Close-up on the exact friction point; Headline: `PARE DE FAZER [X] NA MÃO` |
| **5. Pattern Interrupt** | Sensory break in the first `0.5s–1.5s` | Short 2–4 word statement followed by a `0.3s` beat and camera/scale shift | Hard framing change, macro object drop, or percussive kinetic slam; Headline: `2–4` giant words |
| **6. Standalone Series Hook** | Episodic autonomy for multi-part series | *"To make [X] run locally, we had to cut [Y] in half — and the first try failed."* | Direct visual of today's obstacle; never open with `"Part 2"` or `"Continuing from yesterday"` |

## How `moodboard.md` modulates the Hook Triad

- **Urgent / Raw Debug moodboard:** Prefer *Proof-First / Real Failure* or *Curiosity Gap*; handheld/screen framing, `expo.out` slam at `0.15s`, high-contrast accent word.
- **Calm / Surgical Editorial moodboard:** Prefer *Contrarian* or *Standalone Series Hook*; clean dark stage, `power3.out` word-by-word reveal, deliberate `0.2s` breath after the first clause.
- **Playful / Provocative moodboard:** Prefer *Pattern Interrupt* or *Direct Call-Out*; expressive prop/framing, `back.out(2.5)` overshoot on the accent word.

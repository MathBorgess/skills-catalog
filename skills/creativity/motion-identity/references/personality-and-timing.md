# Personality and timing

Which archetype a brand moves in, which GSAP ease each role takes, and how long each kit primitive lasts in a video. Adapted for video from LottieFiles' [motion-design skill](https://github.com/lottiefiles/motion-design-skill) (MIT, © 2025 LottieFiles) and GreenSock's [gsap-skills](https://github.com/greensock/gsap-skills) (MIT, © 2026 GreenSock). Their UI numbers are milliseconds for a hand on a button. A viewer of a video is not touching anything and has to read, so the values below are seconds, and longer.

## Three pillars

Settle these before any number:

| Pillar | Question | Drives |
|---|---|---|
| Emotional intent | What should the viewer feel? | ease, duration, amplitude |
| Visual narrative | What is the micro-story of this move? | setup, action, resolution |
| Motion craft | What makes it believable? | arcs, follow-through, weight |

## The four archetypes

Pick one per brand. A brand uses its archetype for 90% of its moves. One named moment may borrow another archetype, for example a calm brand that celebrates a result once.

| Archetype | Keywords | Enter | Exit | Emphasis | Base (moves) | Overshoot | Word stagger |
|---|---|---|---|---|---|---|---|
| `playful` | fun, curious, friendly, warm | `back.out(1.7)` | `power2.in` | `back.out(2.5)` or `elastic.out(1, 0.5)` | `power2.inOut` | 10–20% | 0.10–0.14 s |
| `premium` | elegant, minimal, calm, sophisticated | `power3.out` | `power2.in` | `power2.out` (no overshoot) | `sine.inOut` | 0% | 0.16–0.20 s |
| `corporate` | clear, professional, trustworthy | `power3.out` | `power2.in` | `back.out(1.2)` | `power2.inOut` | 0–3% | 0.06–0.08 s |
| `energetic` | bold, fast, loud, exciting | `expo.out` | `expo.in` | `elastic.out(1, 0.45)` or `back.out(3)` | `power3.inOut` | 15–30% | 0.04–0.06 s |

No keyword fits? Recommend `corporate` for a product or a service, and `playful` for a brand that teaches or entertains.

## Durations in a video (seconds, per kit primitive)

`motion.durations` uses explain-me's primitive names. HyperFrames reads the same numbers as the brand's tempo.

| Primitive | What it is | playful | premium | corporate | energetic |
|---|---|---|---|---|---|
| `grow` | an entrance from a point | 0.5 | 0.9 | 0.6 | 0.35 |
| `fade` | an entrance or exit by opacity | 0.4 | 0.8 | 0.5 | 0.3 |
| `indicate` | an emphasis | 0.6 | 0.9 | 0.6 | 0.45 |
| `write` | text, letter by letter | 0.7 | 1.2 | 0.9 | 0.5 |
| `draw` | a stroke drawn on | 0.9 | 1.6 | 1.2 | 0.7 |
| `move` | a move between positions | 0.9 | 1.6 | 1.2 | 0.7 |
| `morph` | one shape into the next | 0.8 | 1.4 | 1.0 | 0.6 |
| `camera` | a push, a pan, a reset | 1.2 | 2.2 | 1.5 | 1.0 |
| `count` | a number that tweens | 0.9 | 1.4 | 1.0 | 0.7 |

Adjust after the format (decision D2). Slow down 20% for an explainer that the viewer must follow. Speed up 20% for overlays on a person, where the face stays the subject.

## Rules that do not change with the archetype

- **Entrances decelerate, exits accelerate.** Enter with `.out`, leave with `.in`, move between two places with `.inOut`. The reverse feels sluggish going in and reluctant going out.
- **Exits are shorter.** An exit takes 65–75% of its entrance. The viewer cares about what arrives.
- **Never linear in space.** `none` is for a steady rotation, a progress bar or a counter's clock, never for a thing moving across the frame.
- **Speed is weight.** 0.15–0.3 s is energy and urgency. 0.3–0.5 s suits most content. 0.5–0.8 s is gravity. 0.8–2 s is cinematic.
- **Distance scales duration.** A move twice as far takes about 1.3× as long. Across a third of the frame or more, break it with an arc or a speed change.
- **Vary on purpose.** One ease for 80% of the moves gives the brand a recognizable feel. Use the same curve on every tween and every speed alike, and the video reads as a template. The emphasis and the signature are where it differs.

## Emotion to motion

| Emotion | Character | Path | Ease | Typical length |
|---|---|---|---|---|
| Delight | bouncy, overshoot | curved, upward | `back.out(1.7)` | 0.4–0.7 s |
| Calm | smooth, flowing | gentle curves | `sine.inOut` | 0.9–1.6 s |
| Confidence | direct, decisive | straight, horizontal | `power3.out` | 0.4–0.8 s |
| Curiosity | exploratory, varied | arcs, a turn | `power2.out` + a small `back.out` emphasis | 0.5–0.9 s |
| Urgency | sharp, fast | straight lines | `expo.out` | 0.2–0.4 s |
| Elegance | slow, controlled | long arcs | `power3.out` / `sine.inOut` | 0.8–1.4 s |
| Surprise | sudden, expanding | radial outward | `expo.out` | 0.3–0.5 s |

The path also speaks. Angular reads as tense, curved as friendly, vertical-up as growth, horizontal as progress, radial-in as focus.

## From other notations to GSAP

The video tools load GSAP core without CustomEase, so every ease in a spec is a GSAP name. `motion.mjs check` refuses anything else.

| You found | Write |
|---|---|
| CSS `ease` | `power2.out` |
| `ease-in` / `ease-out` / `ease-in-out` | `power2.in` / `power2.out` / `power2.inOut` |
| `ease-out-back`, `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | `back.out(1.7)` |
| `ease-in-out-back`, `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | `back.inOut(1.7)` |
| `ease-out-expo`, Material emphasized `(0.05, 0.7, 0.1, 1)` | `expo.out` |
| Material standard `(0.2, 0, 0, 1)` | `power3.out` |
| Material / "fast out, slow in" `(0.4, 0, 0.2, 1)` | `power2.inOut` |
| Material accelerate `(0.3, 0, 1, 1)` | `power2.in` |
| a spring, stiff (stiffness 400+, damping 25+) | `back.out(1.1)` |
| a spring, standard (250–350, 18–24) | `back.out(1.4)` |
| a spring, bouncy (150–250, 10–15) | `elastic.out(1, 0.5)` |

`back.out(n)` overshoots once (a bigger n overshoots more). `elastic.out(amplitude, period)` oscillates: a smaller period means more wobbles. Neither belongs on an exit.

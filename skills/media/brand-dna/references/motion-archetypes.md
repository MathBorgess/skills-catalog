# Motion archetypes and timing

Rules for filling Block 3 (`Motion & Guardrails`) and the `## Brief Block` of `brand-dna.md`. Adapted for video from LottieFiles' [motion-design skill](https://github.com/lottiefiles/motion-design-skill) (MIT) and GreenSock's [gsap-skills](https://github.com/greensock/gsap-skills) (MIT).

## The four motion archetypes

Pick one per brand for 90% of its moves. An episodic `moodboard.md` may modulate energy or borrow an emphasis ease for a specific piece.

| Archetype | Keywords | Enter | Exit | Emphasis | Base (moves) | Overshoot | Word stagger |
|---|---|---|---|---|---|---|---|
| `playful` | fun, curious, friendly, warm | `back.out(1.7)` | `power2.in` | `back.out(2.5)` | `power2.inOut` | 10–20% | 0.10–0.14 s |
| `premium` | elegant, minimal, calm, editorial | `power3.out` | `power2.in` | `power2.out` | `sine.inOut` | 0% | 0.16–0.20 s |
| `corporate` | clear, technical, trustworthy, direct | `power3.out` | `power2.in` | `back.out(1.2)` | `power2.inOut` | 0–3% | 0.06–0.08 s |
| `energetic` | bold, fast, punchy, urgent | `expo.out` | `expo.in` | `back.out(3)` | `power3.inOut` | 15–30% | 0.04–0.06 s |

## Invariant motion rules

- **Entrances decelerate (`.out`), exits accelerate (`.in`), moves between positions use `.inOut`.**
- **Exits take 65–75% of entrance duration.** Viewers care about what arrives.
- **Kinetic type in portrait (9:16):** 2–6 words per headline, at least `96 px` tall, word-by-word entrance, one emphasized word in the brand's accent color, held still for at least `0.3 s` per word plus `0.5 s` before exit.
- **Motion Gate (`Max Static Hold`):** Default `2.0 s` (never above `4.0 s` in short-form video). Nothing on stage stays frozen longer than this limit.

## Brief Block template (max 8 lines)

```markdown
## Brief Block
- Palette: bg #0B0D10 | text #F5F7FA | accent #FF5A36
- Type: display Space Grotesk 700 (>=96px hook) | body Inter 500
- Motion: energetic | enter expo.out (0.35s) | exit expo.in (0.25s) | emphasis back.out(3)
- Pacing: maxStaticSec 2.0s | word stagger 0.05s | build 25% / breathe 35% / resolve 40%
- Safe zone (9:16): x=108..900, y=250..1500; never cover a face with captions or cards
- Never: no stock cyber-grids, no LUT over camera skin tone, no "Not X, it's Y" phrasing
```

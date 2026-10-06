# Disney's twelve principles, for video

What each principle looks like in a motion-graphics video, how a motion identity expresses it, and when a brand refuses it. Adapted for video from LottieFiles' [motion-design skill](https://github.com/lottiefiles/motion-design-skill) (MIT, © 2025 LottieFiles), whose version is written for interfaces. Frame counts assume 30 fps.

The motion identity cannot hold all twelve as keys. It holds the role eases, the durations, the ambient level and the signature. The prose of `## Motion identity` says which principles the brand uses and which it refuses ("Principles in use", "Principles refused"). The agent that writes a video reads that prose.

| # | Principle | In a video | How the identity expresses it | Budget by archetype |
|---|---|---|---|---|
| 1 | **Squash and stretch** | an object that lands flattens a little and recovers, keeping its volume | prose only. In HyperFrames, `scaleX`/`scaleY` in opposite directions for 2–4 frames on impact. explain-me has no primitive for it: refuse it there. | playful and energetic on impacts; corporate and premium never |
| 2 | **Anticipation** | a small move the other way before the main one: a word dips before it jumps, the camera eases back before it pushes | prose, plus a short opposite `move` or `grow` with `from` near 1 before the main call | 10–20% of the main move, 0.1–0.2 s; premium a hint only; skip for overlays on a person |
| 3 | **Staging** | one thing is the subject at a time. The rest dims or waits. | the kit's one central object per beat; `fade` with `{ to: 0.25 }` dims context | every archetype |
| 4 | **Straight ahead and pose to pose** | planned key poses (titles, diagrams) against frame-by-frame life (particles, a hand-drawn line) | pose to pose by default; straight ahead only inside the signature | pose to pose for all; energetic may use straight ahead for bursts |
| 5 | **Follow-through and overlap** | parts arrive at different times: the underline lands after the word, the label after its shape | stagger 0.05–0.15 s between a parent and its children; the emphasis settles with a second tween (`power2.out`) after the overshoot | all; premium keeps the overlap short and soft |
| 6 | **Slow in, slow out** | nothing starts or stops at full speed | the role eases: `.out` to enter, `.in` to leave, `.inOut` to move | all; never `none` for a move across the frame |
| 7 | **Arcs** | a path through space curves; a straight line reads mechanical | `move` with `along: "#path"` on a curved guide; in HyperFrames a MotionPath or an `x`/`y` pair on different eases | corporate subtle (a few px of bow); playful pronounced |
| 8 | **Secondary action** | something small supports the main move: a glow behind a word that lands, a line that draws under it | the underline, the label, the accent color on the emphasized word; amplitude 30–50% of the main move, 0.05–0.1 s later | all; it never competes with the subject |
| 9 | **Timing** | length is weight and mood | `motion.durations`; exits shorter than entrances | see the duration table in [`personality-and-timing.md`](personality-and-timing.md) |
| 10 | **Exaggeration** | the overshoot past the target before it settles | the emphasis ease and its peak | playful 15–25%, energetic 20–30%, corporate 0–5%, premium 0% |
| 11 | **Solid drawing** | shapes keep their proportions and their light while they move | never distort the logo. Move it whole, or trace its curve beside it. Keep stroke widths steady through a zoom. | all |
| 12 | **Appeal** | the sum: smooth curves, satisfying timing, one personality everywhere | the whole identity, applied the same way in every video | all |

## Appeal killers

Jerky motion. Timing that changes for no reason. An abrupt stop. Every element on the same ease and the same speed. Ornaments that wiggle to look alive. A logo that bounces. Text that moves while the viewer is reading it.

## Combinations that read well

| Moment | Principles |
|---|---|
| A headline word lands | anticipation (optional), slow out, follow-through (the underline), secondary action (accent color) |
| The main point of the video | staging (everything else dims), exaggeration within budget, the signature move |
| A result appears | slow out, secondary action (a count, a glow), timing that holds still for half a second after |
| A scene hands over | slow in and out on the base ease, overlap (the next subject starts before the old one is gone) |
| An error or a limit | timing, slow out, no exaggeration: firm, not funny |

## Signature recipe

A **signature** is the one move a viewer could recognize the brand by with the sound off. It needs:

1. **A motif the brand owns** (decision D3): the curve of its symbol, the order of its colors, a typographic gesture. Never a new ornament.
2. **One verb**: draw, sweep, trace, unfold, stack. Name the move in two to four words ("ribbon sweep", "stack and lock").
3. **A place in the story**: where the narration or the headline lands its main point. Once per video, not on every scene.
4. **A length**: 1 to 2 seconds, on the brand's eases. The draw enters on `eases.enter`, and the accent peaks on `eases.emphasis`.
5. **A version for each tool**:
   - explain-me: one or two kit primitives (`draw` along a path shaped like the motif, `move` along it, `morph`), written as a `## Motion examples` beat.
   - HyperFrames: a short GSAP passage on the scene's timeline. The proof's `--signature` script is the first version of it ([`delivery.md`](delivery.md)).

The logo is never the moving part. Its curve can be drawn next to it, swept under a word or traced as a path. The mark itself stays intact.

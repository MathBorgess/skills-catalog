# Choreography, kinetic type, and safe zones (`1080x1920`)

Distilled for short-form vertical video (`1080x1920`, `30 fps`) from LottieFiles' [motion-design skill](https://github.com/lottiefiles/motion-design-skill) (MIT) and GreenSock's [gsap-skills](https://github.com/greensock/gsap-skills) (MIT).

## 1. Frame and Safe Zones (`1080x1920`)

- **Canvas:** `1080 x 1920` (`9:16`), `30 fps`.
- **Platform UI Safe Box:** Keep all headlines, cards, diagrams, faces, and key visual details inside **`x = 108..900` (`width: 792 px`), `y = 250..1500` (`height: 1250 px`)**.
  - Top `0..250 px`: reserved for status bar and platform chrome.
  - Right `900..1080 px`: reserved for Reels/TikTok/Shorts action buttons (like, comment, share, save).
  - Bottom `1500..1920 px`: reserved for creator handle, caption overlay, and audio ticker.
- **Burned caption band (when used):** `[108, 1400, 900, 1500]` (`x1, y1, x2, y2`, inside the safe box), chunked in sync with speech, never overlapping stage graphics or the presenter's face.
- **Face protection rule:** Never place text, logos, or cards over a presenter's eyes, mouth, or face.

## 2. Kinetic Typography (The Big Words)

- **Word count ceiling:** `2–6` words in a headline. Narration carries the rest.
- **Minimum size:** At least `96 px` in `1080x1920` for hook and milestone headlines.
- **Word-by-word entrance:** Each word enters on `eases.enter`, staggered by the archetype's word stagger (`0.04–0.14s`). Whole-group stagger stays under `0.5 s`.
- **One emphasized word per screen:** Peaks on `eases.emphasis`, takes the accent color from `brand-dna.md` / `moodboard.md`, and settles back.
- **Reading hold:** Hold every headline still for at least `0.3 s per word + 0.5 s` before it exits or transforms.
- **Exit:** Exit together, last word first, on `eases.exit` (`65–75%` of entrance duration).

## 3. Scene Choreography

- **Hierarchy first:** What moves first reads as most important. Supporting elements move less on every axis.
- **One origin:** Elements of a group enter from the same side or point.
- **The 1/3 rules:** No move crosses more than a third of the frame without an arc or speed change; with 3+ elements, at most a third move at once.
- **Build, breathe, resolve:** Build (`20–30%` of beat): elements enter. Breathe (`30–40%`): content holds with at most one subtle motion of life. Resolve (`30–40%`): exit or transition into the next beat.
- **Never start at `t = 0.0 s`:** Wait `0.1–0.3 s` for the first motion so frame 0 does not read as a jump cut.

## 4. Deterministic Render Habits (Remotion / Seekable GSAP)

When opening a storyboard in Remotion Studio:
- Drive every animation from `useCurrentFrame()` or a paused GSAP timeline seeked frame by frame (`fromTo` with `immediateRender: false` on stacked tweens).
- Animate transforms and opacity (`x`, `y`, `scale`, `rotation`, `opacity`), never layout properties (`width`, `top`, `left`).
- No `autoplay`, no wall-clock timers (`Date.now`, `performance.now`), no `Math.random()`, and no infinite `repeat: -1`.

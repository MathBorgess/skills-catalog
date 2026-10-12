# Choreography and kinetic type

How several things move together, how big words move, and the GSAP habits that survive a seeked render. Adapted for video from LottieFiles' [motion-design skill](https://github.com/lottiefiles/motion-design-skill) (MIT, © 2025 LottieFiles) and GreenSock's [gsap-skills](https://github.com/greensock/gsap-skills) (MIT, © 2026 GreenSock). Only the parts that hold when a video is rendered by seeking a paused timeline are kept.

## Choreography

- **Hierarchy first.** What moves first reads as most important. Stagger in order of importance, not in reading order. The subject gets the largest move and the strongest ease. Supporting elements move less on every axis.
- **One origin.** Elements of one group enter from the same side or the same point. Mixed directions read as noise.
- **The 1/3 rules.** No move crosses more than a third of the frame without an arc or a speed change. With three or more elements, at most a third of them move at once: the first settles as the third starts.
- **Stagger budget.** A whole group's stagger stays under 0.5 s, whatever the count. Use the same ease family for the group, vary only the start. The last element may overshoot a little, as punctuation.
- **Build, breathe, resolve.** Every scene has three parts. Build (the first 20–30%): elements enter. Breathe (30–40%): the content holds with at most one motion of life. Resolve (30–40%): the exit, or a decisive end. Leave 0.1–0.2 s of stillness before the next build.
- **Transitions mean something.** A crossfade says "this continues". A hard cut says "wake up". A slow dissolve says "drift with me". The next idea starts from what the last one left on screen: transform it, do not clear and redraw.
- **Counter-motion and depth.** When the subject moves one way, the background may drift the other way at 20–30% of its speed. Foreground moves fastest, background slowest.
- **Never start at t = 0.** Wait 0.1–0.3 s for the first motion; a move on the first frame reads as a jump cut.

## Pacing per format

| Format | Motion carries | Pace | Watch out for |
|---|---|---|---|
| Portrait (Reels, Shorts, TikTok) with a person on camera | overlays: kinetic titles, a callout, lower thirds, captions | quick entrances, short holds | faces and the platform's buttons; the caption band; logos over a face |
| Explainer with no person (explain-me) | the whole frame: one central object that is drawn and transformed | one beat per sentence, 3 to 7 s | text-heavy frames; anything still for longer than the Motion Gate allows |
| Landscape lesson or talk | diagrams and big numbers | slower: the viewer follows an argument | moving text while it is being read |
| Short sting, no narration (≤10 s) | the brand itself: logo reveal, kinetic headline | fastest; the signature is the climax | crowding several ideas into one sting |

## Kinetic type: the big words

The style asks for big words that dominate the frame. They stay readable because they are few and because they stop moving before the viewer reads them.

- **Few words.** Two to four words in a headline, one idea. Never more than six on screen as headline type. Narration carries the rest.
- **Big.** The largest size at which every word fits the safe width. In portrait, no word of a headline is under about 96 px. Labels in explain-me keep its own floor (56 units, 64 in portrait).
- **Word by word is the default.** Each word enters on `eases.enter`, staggered in the archetype's word stagger. Use letter by letter for one or two words, as a deliberate effect (explain-me's `write` does this). Use line by line for a sentence.
- **One emphasized word per screen.** It peaks on `eases.emphasis`, takes the accent color, and settles back with a second, softer tween. That word carries the meaning; the color stays on it.
- **Reading time.** Hold a headline still for at least 0.3 s per word plus 0.5 s before it leaves or transforms.
- **Exit together, last word first,** on `eases.exit`, faster than the entrance.
- **In each tool.**
  - explain-me: one `<text>` per word, introduced with `grow` or `fade` (`shift` gives the direction), emphasized with `indicate`. Use `write` for one or two words.
  - HyperFrames: split the words into spans (SplitText with `type: "words"`, or spans you write). Animate them with `fromTo` on the scene's timeline. HyperFrames' `kinetic-beat-slam` rule is a percussive variant for energetic brands.

## Ambient

`motion.ambient` is the background life behind the stage: `none`, `subtle` or `lively`. It is a slow glow, never the motion the content needs. explain-me draws it outside its stage and then watches only the stage for the Motion Gate. In HyperFrames, keep it on the scene's timeline with a finite repeat count. One ambient motion per scene at most; stillness after motion is a choice too.

## GSAP habits that survive a seeked render

HyperFrames renders a video by seeking one paused timeline, frame by frame. These habits from GreenSock's guidance and HyperFrames' own rules keep every frame a function of the playhead:

- **Everything on the timeline.** Every tween goes on the scene's `tl` with a position parameter, never a bare `gsap.to()` (it runs on the wall clock and never renders). Use labels (`tl.addLabel("signature", 4.2)`) to keep the story readable.
- **`fromTo` over `from`.** Explicit start and end states are the same at every seek. Stack several tweens on one property of one element with `immediateRender: false` on all but the first.
- **One transform owner at a time.** Two concurrent tweens on the transform of one element overwrite each other. Run them one after the other, or split them across a parent and a child.
- **Transforms and opacity, not layout.** Animate `x`, `y`, `scale`, `rotation`, `xPercent`, and `opacity` / `autoAlpha`. Not `width`, `top` or `left`.
- **Finite repeats only.** No `repeat: -1`, no `play()`, no clocks (`Date.now`, `performance.now`), no `Math.random()`. Spread values with `gsap.utils.distribute({ from: "center" })` instead of randomness.
- **Named eases only.** The video tools load GSAP core without CustomEase, so a cubic-bezier cannot be used: take the nearest name from [`personality-and-timing.md`](personality-and-timing.md).

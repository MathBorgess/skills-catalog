# LottieFiles motion design — distilled reference

Source: [LottieFiles motion-design](https://github.com/lottiefiles/motion-design-skill/tree/f9a8a041b85185ee4881b3471d3415e939aac772/skills/motion-design), revision `f9a8a041b85185ee4881b3471d3415e939aac772`, read 2026-10-12. Original author: **LottieFiles**, version 1.0.0, [MIT license](lottiefiles-LICENSE.txt). This profile adapts documented practice; it does not establish measured success or official Apple/Disney guidance.

All **17 Markdown documents / 1,628 source lines** are retained in the [complete compilation](lottiefiles-motion-design-source.md), with per-file byte counts, SHA-256 and section anchors in the [coverage manifest](lottiefiles-motion-design-coverage.json). The compilation preserves the source text, including inconsistencies. It is reference data, not a replacement operating skill. Read this profile in full; consult corresponding source sections for implementation detail. Every selected run snapshots the compilation, manifest and license as well as this profile.

## Direction before parameters

Decide **emotion → micro-story → physical craft**. Name what the viewer should feel, what changes in the scene and what makes that change believable. Then choose purpose, audience, context, motion category, personality, direction, properties, timing and easing. Revealing, concealing, transitioning, emphasizing, responding and ambient motion serve different jobs.

Give each scene one dominant personality, with purposeful exceptions: playful (arcs and elastic recovery), premium (controlled pace and generous space), corporate (predictable feedback), energetic (fast accents and strong contrast). These are starting points, not taste rankings. The collection can compare personalities; each work needs internal coherence. Do not redefine durable brand identity here.

Map emotion to behavior: joy rises in buoyant arcs; calm follows sustained curves; urgency is direct and brief; weight falls with deliberate resistance; surprise expands; elegance follows controlled arcs; curiosity explores and pauses; tenderness yields. Direction and color associations depend on culture/context. Never let a reference's green-success/red-error convention replace authored semantics automatically.

## Story, cast and attention

Plan anticipation → action → reaction → resolution. The source offers setup/action/resolution shares of 20–30/30–40/30–40%, and a four-act alternative of 10–20/30–50/10–20/20–30%. Choose a coherent score rather than adding incompatible ranges. Brief feedback may omit wind-up; a film needs time to establish space and resolve the transformation.

Assign primary action, secondary response and ambient life. Secondary amplitudes around 30–50% and ambient around 10–20% of the primary are source starting points, not literal perceptual measurements. A focal object is a narrative role: a seed, fold, connection or collective transformation can lead. **Do not default to a logo as protagonist.** Let focus pass between performers with a visible cause.

Use shared origins, stagger, counter-motion and follow-through. A group can arrive sequentially, center-out, in waves, reverse order or seeded organic order. Group trajectories share a motion language; secondary parts may use different damping. A trigger initiates reactions promptly; distance/material determines delayed propagation. Foreground/midground/background displacement ratios 1/.5/.2 (deep background .1) illustrate parallax, not mandatory world coordinates.

The source's one-third distance and active-element rules are attention heuristics. Break long journeys into meaningful changes of velocity, arc or intention. Count **competing focal events**, not every quietly moving particle in a coherent school. Make an exception explicit when a spatial collection moves as one performer. Rest is a composed state; ambient movement is never a quota.

## Twelve animation principles

| Principle | Transfer into a spatial scene |
|---|---|
| Squash/stretch | Express compression and stored energy; preserve volume in 3D (`sx * sy * sz ≈ 1`) where the material calls for it. |
| Anticipation | Shift weight, bend or gather before propulsion. |
| Staging | Use silhouette, contrast, depth and timing to make one event legible. |
| Straight ahead / pose to pose | Plan story poses; use deterministic procedural motion for living detail. |
| Follow-through / overlap | Let trailing segments and partners settle later according to weight. |
| Slow in/out | Make acceleration purposeful; preserve continuity at phase boundaries. |
| Arcs | Use curved travel when motivated; mechanisms can intentionally move straight. |
| Secondary action | Make shadows, folds and neighbors react to the main action. |
| Timing | Separate heavy from light bodies, tension from release, action from reading. |
| Exaggeration | Amplify the chosen beat while retaining a coherent material and recovery. |
| Solid drawing | Keep perspective, light, proportion, contact and depth consistent. |
| Appeal | Seek satisfying poses, contrast and rhythm; evaluate the result at full speed. |

Apply these through the mandatory Mindful Movement cast: intention, emotional pivot, weight, friction, elastic limits and spatial bubbles. Do not bolt twelve effects onto every object.

## Timing and implementation lookups

These are **source UI seeds**, not film durations or universal physical constants:

| Family | Source starting range |
|---|---|
| Micro feedback / button / icon | 80–120 / 120–180 / 150–250 ms |
| Card / modal / page / dramatic reveal | 200–350 / 300–400 / 400–600 / 600–1200 ms |
| Ambient | 2–20 s; breathing 2–4 s, floating 3–5 s |
| Playful / premium / corporate / energetic | 150–300 / 350–600 / 200–400 / 100–250 ms |
| Child follow-through / shared trigger | 50–150 ms / starts within ~50 ms |
| Stagger micro / standard / dramatic / wave | 20–40 / 50–100 / 100–200 / 30–60 ms per item |

The source says both dramatic stagger <600 ms and all stagger <500 ms. For responsive UI, prefer the stricter total waiting budget and compute it explicitly: last onset is `(count - 1) * delay`, last completion adds duration. For a film's traveling wave, derive delays from propagation distance and name the longer narrative beat. Do not compress an entire spatial story into a UI budget.

Use deceleration for arrival, acceleration for departure, smooth acceleration/deceleration within a shot; a seamless loop must join both position and velocity. Constant angular rotation, conveyor travel or physical ballistic segments can be intentional. The source's ban on linear spatial easing is not a ban on physically meaningful constant velocity. Entrances often outlast departures (source exit ≈65–75%); continuity and story take precedence in film.

Example curves from the source: smooth `(0.4,0,0.2,1)`, decisive `(0.2,0,0,1)`, emphasized `(0.05,0.7,0.1,1)`, back `(0.175,0.885,0.32,1.275)`. Its named industry labels are upstream claims, not independently verified specifications. Spring stiffness/damping numbers are solver-dependent. Distinguish damping coefficient `c` from damping ratio `ζ = c / (2√(km))`; values like 20 and 1 are not interchangeable.

Material seeds: rigid/heavy bodies recover without rubber bounce; elastic bodies compress/recoil; fluid bodies lag and flow; paper bends along structure; gas disperses; glass retains rigidity. Upstream multipliers (metal 1.2×, rubber .8×, fluid 1.5×, paper 1×, gas 2×, glass .9×) illustrate contrast, not physics. In 3D, derive shadows from geometry/light; do not arbitrarily delay a cast shadow by 50 ms just because a UI recipe does.

Choose a primary expressive property and only useful secondary ones. Position carries relations; scale suggests proximity/emphasis; rotation reveals orientation; opacity controls visibility; color carries context. Depth additionally needs a consistent projection, occlusion, light and ground/contact cues. Prefer transform/opacity for DOM animation; WebGL geometry/materials have different budgets. “GPU” never means unlimited objects or guaranteed frame rate. Measure the actual scene/device and separate offline export speed from interactive playback performance.

## Pattern library translated

| Source pattern family | Useful mechanism / spatial adaptation |
|---|---|
| Direct / emergent / masked / assembled entrances | Travel into space, grow into a pose, reveal behind geometry, or assemble from parts. Preserve origins and readable silhouettes. |
| Direct / dissolve / collapse / transfer exits | Depart, softly disappear, fold away or visibly join another group. Preserve eye continuity across scenes. |
| Press, hover, toggle, focus | Immediate intent/feedback in controls; short compression/release for interactive objects. Keyboard and reduced-motion equivalents remain usable. |
| Success, error, warning, disabled/enabled | Make state understandable with text/shape as well as motion/color. Use an appropriate reaction; avoid ritual confetti, shaking or flashes. |
| Spinner, skeleton, progress, indeterminate | Distinguish measured progress from activity. Constant rotation is allowed; never imply fabricated completion. |
| Breathing, floating, gradient shift, rotation, shimmer, particles | Build subtle ambient life with bounded amplitude and phase offsets. Reserve the visual energy for the story. |
| Lists, grids, navigation, dashboards | Use hierarchy and stagger; do not turn every collection into UI cards. |
| Modal, tabs, accordion, page transition | Carry continuity, origins, clear state and coordinated space negotiation. |
| Drag/drop, shared origin, counter-motion | Transfer weight and energy; neighbors make room, then recover. |

## Context and quality

Adapt to destination and repetition: a frequently used control needs fast, restrained feedback; a viewing experience can be dramatic. The source suggests shorter/simpler mobile motion and larger TV timing; assess actual screen, distance and input instead of multiplying blindly. Responsive framing must preserve the story. Dark scenes need restrained highlights, not flashes.

Provide pause/replay/seek and a static or simple nonspatial reduced-motion presentation for interactive work. Suppress automatic spatial loops under reduced motion. Do not encode meaning solely in movement or color. Inspect readable silhouettes at final output size, continuity, anticipation, energy transfer, follow-through, resolution, performance and accessibility.

Diagnose before adding effects: robotic → inspect timing/path/overlap; sluggish → shorten waiting and recovery; jarring → repair continuity and missing preparation; flat → inspect layers, occlusion and light; distracting → reduce competing events; generic → strengthen material and narrative; inconsistent → align related behaviors; dropped frames → profile geometry, painting, filters and overdraw. “More bounce” is not a universal repair.

## Coverage map

Every upstream file is covered; source anchors follow the manifest:

| Original file | Distilled destination |
|---|---|
| `SKILL.md` | All sections; original workflow treated as reference data |
| `director/core-philosophy.md` | Direction; story, cast and attention |
| `director/decision-framework.md` | Direction; context and quality |
| `director/disney-principles.md` | Twelve animation principles |
| `director/motion-personality.md` | Direction; timing; durable identity deferred |
| `director/emotion-mapping.md` | Direction; contextual color semantics |
| `director/choreography.md` | Story/attention; stagger and depth |
| `director/narrative-structure.md` | Four phases, resolution and beat transitions |
| `director/context-adaptation.md` | Platform, accessibility, performance, responsive and dark scenes |
| `patterns/entrance-exit.md` | Pattern library, continuity and asymmetry |
| `patterns/state-feedback.md` | All feedback/loading/focus families |
| `patterns/ambient-continuous.md` | All ambient families, parallax and visual energy |
| `patterns/multi-element.md` | Stagger, coordinated sequences, shared origin and counter-motion |
| `reference/property-selection.md` | Property meaning and implementation budgets |
| `reference/timing-easing-tables.md` | Numeric seeds, material contrast, curves and spring units |
| `reference/quality-checklist.md` | Context/quality; film-specific interpretation of UI rules |
| `reference/troubleshooting.md` | Diagnosis by visible defect |

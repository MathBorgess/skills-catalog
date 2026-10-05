# HyperFrames as the explain-me video engine

`explain-me` renders its videos with HyperFrames, used as an engine only and called through its CLI as a subprocess. The skill ships its own template, 3b1b Kit, design spec and driver around it. HyperFrames' own intent interview, brief, storyboard and HeyGen sign-in preflight are not part of the workflow.

## Context

The first video pipeline drew frames into a Pillow buffer and joined them with audio through ffmpeg. The output was a static dashboard: a header bar, panels, bullet lists and almost no motion. Its quality depended on which agent wrote the drawing code in each run, because nothing fixed the floor.

The reference also promised Remotion or Motion Canvas. Both need an npm and React build in every project, and no script ever produced a video with them.

The skill needs three things the old pipeline lacked: motion that a fixed kit of primitives guarantees, a timeline locked to the narration's measured length, and a check that fails before a still video renders.

## Considered options

- **Own zero-dependency SVG engine on headless Chrome.** No upstream risk and it matches the zero-dependency rule. We would still build seek-safe timelines, deterministic frame capture, audio muxing and a motion check. The catalog would own all of it, and nothing guarantees the output is better than the Pillow pipeline.
- **Manim CE.** The native 3b1b look. It needs Python with native libraries (Cairo, Pango, often LaTeX), scenes are Python while SVG and interactive HTML stay in HTML, and it has no built-in narration-timing or static-hold check.
- **HyperFrames.** HTML and GSAP compositions, rendered deterministically by seeking a paused timeline in headless Chrome. It ships a Kokoro `tts` command that reports each clip's duration, a `check` command with a `keepsMoving` and an `appearsBy` assertion, and an Apache-2.0 licence. Its own workflow is heavier than we want, and rendering needs the network.
- **Remotion.** React compositions with good tooling. It needs an npm and React project per video, and its licence carries commercial conditions.

## Decision

Use HyperFrames as the render engine only. `explain.mjs` creates the project from `assets/composition.html`, writes the Design Spec as `frame.md`, runs `hyperframes tts`, `check` and `render`, and ignores every HyperFrames step that interviews, plans or signs in.

Swapping the engine later costs a new driver and template. `script.json`, the Design Spec and the writing rules do not change.

## Consequences

- **Scripts stay dependency-free.** The driver calls the HyperFrames CLI as a subprocess, so every script stays Node ESM with the standard library only, as [AGENTS.md](../../AGENTS.md) requires.
- **Installed first, never updated.** The driver resolves HyperFrames in this order: `hyperframes` on `PATH`, then the highest cached version in the npx cache, then `npx --yes hyperframes@latest`. It never updates an installed copy.
- **No version pin, by the owner's choice.** `run.json` records the tier and version of each run. `doctor` reports when a newer version exists. The accepted risk is upstream breakage: a release can change the composition contract or the CLI flags, and the fix is an edit to the template or the driver. A break should show as a failing `check` or `render`, and `run.json` names the version that broke.
- **One shared voice model.** The Kokoro model (about 311 MB) and its voices (about 27 MB) live in HyperFrames' own cache, `~/.cache/hyperframes/tts/`, and HyperFrames downloads them on the first `tts` call. The skill home holds no second copy.
- **A two-second static hold, on purpose.** The Motion Gate fails when anything stays still for more than two seconds. That number is HyperFrames' `keepsMoving` default, and we record it here as a deliberate choice. A Design Spec may loosen `motion.maxStaticSec` to a value above zero. It may never turn the gate off: `design check` fails on `motion.gate: off`. Every loosened value appears in the delivery as an override.
- **Rendering is not offline.** The template loads GSAP core and its DrawSVG, MorphSVG, MotionPath and SplitText plugins from jsDelivr. The video render needs the network. Interactive HTML stays offline.
- **Licence.** HyperFrames is Apache-2.0. The catalog ships none of its code, so the terms apply to the copy the user installs.

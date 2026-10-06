# A motion-identity skill instead of importing motion skills

The catalog adds one small skill, `motion-identity`. It runs a grilling to build a brand's motion identity and writes it into the brand spec that HyperFrames and explain-me already read. It does not install, vendor or fork the motion skills it learned from, and it does not render videos of its own beyond a short proof.

## Context

The goal is a brand whose videos all move the same captivating way: big words that dominate the frame, and movement shaped by Disney's principles. That holds whether the video comes from a HyperFrames workflow or from explain-me.

Three things already existed:

- **HyperFrames** ships its own `motion-graphics` skill (a genre: short, unnarrated pieces of about ten seconds), `hyperframes-animation` (motion rules, transitions, and seek-safe GSAP and Lottie adapters) and `hyperframes-creative` (reads `frame.md`, `design.md` or `DESIGN.md`, frontmatter first).
- **LottieFiles' `motion-design`** (MIT) teaches motion direction: archetypes, Disney's principles, emotion-to-ease maps. It is written for interfaces, with millisecond tables.
- **GreenSock's `gsap-skills`** (MIT) teaches the GSAP API for the web: ScrollTrigger, React, frameworks. Some of its patterns (`play()`, `repeat: -1`, scroll-driven timing) break a render that seeks a paused timeline.

Three gaps remained:

- Nothing owned the brand's motion. HyperFrames' design spec has no motion keys, and its adherence check covers color, type, corners, spacing and depth, not movement.
- `talking-head-recut` and `embedded-captions` never read the spec. They hear the brand only through `BRIEF.md`.
- The two consumers disagree. HyperFrames' house style puts ambient motion on every decorative element. explain-me forbids idle loops.

## Considered options

- **A thin skill that owns the motion identity.** It grills the owner with the reference heuristics rewritten for video, writes keys and prose into the brand spec, proves the result with a deterministic HyperFrames clip, and prints a brief block for the footage skills. explain-me learns the new keys.
- **Import the three as they are**, and write the brand's motion by hand. Three overlapping sources of motion advice load at once: UI-scale numbers, and web patterns the video engine rejects. The footage skills still never hear the brand.
- **A full `motion-graphics` skill that composes and renders.** It duplicates HyperFrames' own workflow under the same name, and the two compete for the same trigger.
- **Vendor or fork LottieFiles and GreenSock into the catalog.** That is about 3,300 lines to keep in step with upstream, and the GSAP half stays web-shaped.

## Decision

Build `motion-identity` as an operator skill. The motion identity is four frontmatter keys under `motion` (`personality`, `eases.enter` / `.exit` / `.emphasis`, `ambient`, `signature`), plus the existing `ease` and `durations`. Three prose sections go with them: `## Motion identity` with a status line, `## Motion examples`, and `## Brief block`. explain-me reads the keys: its kit applies an ease per role, draws an ambient glow outside the stage, and limits the Motion Gate to the stage whenever that glow is on. HyperFrames reads the frontmatter as brand truth and the prose as judgment. The footage skills get the brief block.

The reference skills stay upstream. Their ideas enter as rewritten, credited references at video scale, filtered to what survives a seeked render.

## Consequences

- **One file per brand.** Videos reference the spec (`--design`, a link at the project root, the brief). Feedback on a video changes the spec, not that video.
- **The approval is visual.** An identity is `approved` only after its owner has watched a proof. Without a render it stays `draft`, and the delivery says why.
- **The proof needs what the engine needs.** It needs network access for GSAP on jsDelivr and a headless Chrome. The proof page is deterministic: same spec, same plan, same frames.
- **Two copies to keep equal.** `motion-identity/scripts/lib/yaml.mjs` is a byte copy of explain-me's parser, and the key lists and the GSAP-ease rule exist in both skills, so each skill installs and runs alone. `motion.test.mjs` fails when they drift apart.
- **Named eases only.** The video tools do not load CustomEase. A `cubic-bezier()` or a CSS ease name fails `motion.mjs check`, which names the nearest GSAP ease. explain-me warns on it.
- **Ambient is an override.** Any level other than `none` departs from explain-me's 3b1b default. It is reported like a rule override, and it never satisfies the Motion Gate.
- **Naming.** "Motion graphics" names the style of a video. HyperFrames' `motion-graphics` names one of its workflows. The glossary records both, so a trigger on the phrase is not mistaken for that workflow.

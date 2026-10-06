---
name: motion-identity
description: "Use when the user wants to create, grill or evolve a brand's motion identity — how its videos move — inside the brand's DESIGN.md (or frame.md / design.md), so that HyperFrames videos and explain-me videos come out with the same captivating motion graphics: 'motion identity', 'motion graphics da marca', 'como a marca se move', 'quero vídeos que brilhem os olhos', 'deixa o vídeo mais dinâmico / encantador', 'princípios Disney', 'easing da marca', 'movimento no DESIGN.md', 'prepara o DESIGN.md para vídeo'; also when feedback on a finished video is about how things move ('muito quicado', 'saída lenta', 'too bouncy', 'feels flat'). Runs a grilling round by round, writes the motion keys and prose the video tools read, renders a short proof the owner approves by watching, and prints the block for a HyperFrames BRIEF.md. Not for making the video itself (HyperFrames or explain-me do that), nor for palette or type work with no motion in it."
metadata:
  author: Matheus Borges
  version: 1.0.0
---

# Motion Identity

Build the motion layer of a brand spec, the **motion identity**, through a grilling with its owner. Write it where every video tool reads it. A video's **motion graphics** come from it: big words that dominate the frame, and movement shaped by Disney's principles so that it delights. Keep one spec for the whole brand. Never edit a video to get the motion right.

`<skill>` is the folder that holds this SKILL.md. `motion.mjs` means `node <skill>/scripts/motion.mjs`. Proofs go to `~/.cache/motion-identity/proofs/` (`MOTION_IDENTITY_HOME` overrides it). Nothing goes into the brand's project but the spec itself.

## Steps

1. **Find and read the spec.** Use the path the user gives, else `motion.mjs find --project <dir>` (`frame.md`, then `design.md`, then `DESIGN.md`). Read all of it: frontmatter, prose and the images it names. If the user names no spec and none exists, ask where to create one. Never overwrite another spec. If the spec already has a motion identity, you are in **evolve** mode (step 7).
2. **Prepare the floor.** Run `motion.mjs check <spec>`. The floor is `colors.background`, `colors.text` and `typography.display` / `typography.body` in the frontmatter. Copy each value from the brand's own words, verbatim. Ask for any value the spec does not state. Never invent a hex, a font, a gradient angle or a ratio. Changing a brand spec is the owner's decision: show the diff before you write it.
3. **Grill, one frontier at a time.** Follow [`references/grilling-rounds.md`](references/grilling-rounds.md). Each round asks only the decisions whose prerequisites are settled. Each question carries your recommended answer, the brand's own words that support it, and the heuristic it rests on:
   - [`references/disney-for-video.md`](references/disney-for-video.md): the twelve principles.
   - [`references/personality-and-timing.md`](references/personality-and-timing.md): archetypes, eases, durations.
   - [`references/choreography-and-type.md`](references/choreography-and-type.md): hierarchy, staggers, kinetic type.

   Facts in the spec or its assets are yours to find. Only decisions go to the owner. Write each answer into the spec as soon as it is decided, so later questions use it.
4. **Write the identity.** Use the keys and sections in [`references/spec-schema.md`](references/spec-schema.md):
   - `motion.personality`, `motion.ease`, `motion.eases` (`enter`, `exit`, `emphasis`), `motion.durations`, `motion.ambient` and `motion.signature`, all in the frontmatter;
   - `## Motion identity`, with its status line `**Status:** draft (…)`;
   - `## Motion examples`, with kit primitives only;
   - `## Brief block`, at most 8 lines.

   Headings stay in English, because the tools find them by name. The text under them stays in the brand's language.
5. **Check.** Run `motion.mjs check <spec>` until it reports no error. If explain-me sits beside this skill, also run `explain.mjs design check <spec>`.
6. **Prove it in motion.** Run `motion.mjs proof <spec> --text "<2 to 4 big words in the brand's voice>" --lang <tag> --orientation <the brand's main channel>`. Add `--signature <file.js>` to play the brand's own move (rules in [`references/delivery.md`](references/delivery.md)). Open every frame in `frames/`, the contact sheet and the video. Fix the spec or the signature and run the proof again when a word is cut, text overlaps, an ease reads wrong or the frame is empty. Then show the owner the sheet and the video. If the proof cannot render (no network, no browser), say so plainly and keep the status `draft`.
7. **Approve or evolve.** When the owner approves what they watched, set `**Status:** approved on AAAA-MM-DD by <role>`. Feedback goes back to the round that owns it (the symptom table in [`references/grilling-rounds.md`](references/grilling-rounds.md)): propose the diff, apply it after a yes, and prove again. Feedback on a finished video changes the spec, never that video's code.
8. **Hand off.** Run `motion.mjs brief <spec>` and give the block to whoever runs HyperFrames: it goes into the notes of `BRIEF.md`. Say how each tool reads the spec ([`references/delivery.md`](references/delivery.md)). explain-me takes `--design <spec>`. A HyperFrames project gets the spec at its root as a link, never a copy. `talking-head-recut` and `embedded-captions` hear the brand only through the brief.

## Done-check

- [ ] The floor values in the frontmatter come verbatim from the brand. Nothing was invented, and the owner saw every diff to the spec.
- [ ] Every motion key traces to an answer the owner gave or a recommendation they accepted in a grilling round.
- [ ] `motion.mjs check <spec>` reports no error.
- [ ] `## Motion identity` has a status line. `## Motion examples` uses kit primitives only. `## Brief block` has at most 8 lines.
- [ ] You opened every proof frame, the sheet and the video before the owner saw them. Or the delivery says why no proof rendered, and the status is `draft`.
- [ ] The status is `approved` only after the owner watched the proof.
- [ ] The Motion Gate is untouched: no `gate: off`, and `maxStaticSec` is above 0.
- [ ] The delivery gives the brief block and how explain-me, HyperFrames and the footage skills each read the spec.

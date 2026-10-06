# Grilling rounds

The motion identity is a tree of decisions. A decision is on the **frontier** when every decision it depends on is settled. Each round asks the whole frontier and nothing else. Each answer settles a branch and moves the frontier forward. The session ends when the frontier is empty.

## Rules

1. **Frontier only.** Never ask a question whose answer depends on another open question. It belongs to a later round.
2. **Recommend every answer.** Write each question as: the question, the options (at most four), your recommendation marked `➡️`, and one line of why. The why quotes the brand's own words (promise, tone, audience) and names the heuristic file and section it rests on. The owner judges a recommendation. Do not make them invent an answer.
3. **Facts are yours.** Find in the spec or its assets what is already there: the palette, the fonts, the logo's shape, the channels named in the prose. Ask only for decisions and trade-offs.
4. **Write as you go.** When a branch is settled, write its key or sentence into the spec at once, so that the next questions use it. Show the owner each diff.
5. **One brand, one identity.** Do not open a second personality for one channel. A channel may borrow one moment (rule of 90/10 in [`personality-and-timing.md`](personality-and-timing.md)). It never gets its own archetype.
6. **Stop on an empty frontier.** No key is left at a silent default. A default the owner accepted counts as an answer.

## The tree

| # | Decision | Depends on | Writes | Heuristic |
|---|---|---|---|---|
| D1 | **Emotional target**: what the viewer feels in the first second (delight, calm, confidence, curiosity, urgency, elegance) | nothing | `## Motion identity`, first paragraph | Three pillars and the emotion map, [`personality-and-timing.md`](personality-and-timing.md) |
| D2 | **Where it plays**: which channels and formats come first (portrait with a person on camera, explainer with no person, landscape lesson), and which tool makes each one | nothing | `## Motion identity`, "Where it plays" | Pacing per format, [`choreography-and-type.md`](choreography-and-type.md) |
| D3 | **Motif**: what in the brand can move (a curve of the logo, a symbol, a color order, a typographic gesture) and what must stay still (the logo itself) | nothing | `## Motion identity`, "Motif" | Signature, [`disney-for-video.md`](disney-for-video.md) (appeal, solid drawing) |
| D4 | **Personality**: one archetype, and the one moment that may borrow another | D1, D2 | `motion.personality` | Archetypes and the 90/10 rule |
| D5 | **Role eases**: enter, exit, emphasis, and the base ease for moves | D4 | `motion.eases`, `motion.ease` | Ease table per archetype, CSS-to-GSAP table |
| D6 | **Duration palette**: the length of each kit primitive | D4, D2 | `motion.durations` | Video durations per archetype |
| D7 | **Exaggeration budget**: overshoot, squash and stretch, anticipation, yes or no and how much | D4 | `## Motion identity`, "Principles in use" and "Principles refused" | Exaggeration and squash rows, [`disney-for-video.md`](disney-for-video.md) |
| D8 | **Signature move**: what moves, along what, how long, and where in a video it lands | D3, D5, D6 | `motion.signature`, a proof signature script | Signature recipe, [`disney-for-video.md`](disney-for-video.md) |
| D9 | **Kinetic type**: how the big words enter (whole, word by word, letter by letter), how one word is emphasized, how many words share the screen | D4, D5, D7 | `## Motion identity`, "Kinetic type"; `rules.maxWordsOnScreen` if it differs | Kinetic type, [`choreography-and-type.md`](choreography-and-type.md) |
| D10 | **Ambient and stillness**: `none`, `subtle` or `lively`, and where stillness is a choice (the end hold, a pause before the main point) | D1, D4 | `motion.ambient` | Ambient row, [`choreography-and-type.md`](choreography-and-type.md) |
| D11 | **Never-list**: three to six things this brand never does in motion | D4 to D10 | `## Motion identity`, "Never" | Troubleshooting table below, appeal killers |
| D12 | **Brief block**: the 5 to 8 lines a HyperFrames brief carries | D4 to D11 | `## Brief block` | [`spec-schema.md`](spec-schema.md) |

The usual rounds: **R1** D1, D2, D3. **R2** D4. **R3** D5, D6, D7, D10. **R4** D8, D9. **R5** D11, D12. Then the proof. A round is shorter when the spec already settles a decision: say what you found and move on.

## How to recommend

- **D1.** Read the brand's promise and audience. "Show what really works, to beginners" points to *curiosity + confidence*, not to *urgency*. Name two emotions at most: one leads, one supports.
- **D2.** List the formats the prose names. A video with a person on camera leaves the motion to overlays (titles, callouts, captions), so the identity must read at small size and stay out of faces. An explainer with no person carries the whole frame.
- **D3.** Prefer a shape the brand already owns (the logo's curve, its color order) over a new ornament. The logo itself never deforms: its curve can be drawn, swept or traced beside it.
- **D4.** Match D1's words to the archetype keywords. Two archetypes fit? Pick the one whose *exit* suits the brand. Exits show restraint more than entrances.
- **D5.** Start from the archetype row, then check each role against D1. An entrance decelerates (`.out`). An exit accelerates (`.in`). An emphasis may overshoot (`back.out`, `elastic.out`) only if D7 allows it.
- **D6.** Start from the archetype row. Slow it for a long read or an explainer. Speed it for overlays on a person, where motion must not steal the face.
- **D7.** Give each principle a yes, a no, or a number (overshoot %, wind-up %). Premium refuses squash and overshoot. Playful uses both on impacts only.
- **D8.** One move, one second or two, used once per video where the narration lands its main point. Name it in two to four words. Write a note that says what moves, along what, and on which ease.
- **D9.** Big words are few: two to four per screen in a headline, one emphasized. Word by word is the default. Letter by letter suits one or two words only.
- **D10.** `none` unless the brand wants life in the background and the formats allow it. Ambient never stands in for the main motion. The Motion Gate ignores it.
- **D11.** Collect what earlier rounds refused, and add the appeal killers that tempt this archetype. For example, a playful brand that bounces errors, or a premium brand that spins.

## Evolve: from a symptom to the round that owns it

| Feedback | Likely cause | Reopen |
|---|---|---|
| "Robotic", "stiff" | linear or same ease everywhere, no arcs | D5, D7 (arcs, follow-through) |
| "Too slow", "drags" | durations too long for the format | D6 |
| "Too bouncy", "childish" | overshoot over the budget | D7, D5 (emphasis) |
| "Flat", "cheap" | no secondary action, no emphasis | D7, D9 |
| "Too busy", "dizzy" | too many things moving, ambient too strong | D9 (1/3 rule), D10 |
| "No personality", "generic" | archetype not applied the same way every time | D4, D8 |
| "The exit feels late" | exit not faster than the entrance | D5, D6 |
| "Hard to read" | words too small, too many, or moving while read | D9 |

Ask only the reopened decisions, recommend a change, and prove again. The rest of the identity stays as approved.

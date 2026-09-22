# Judging

Two passes, in this order, each in a **fresh agent**. The pass that ordered the day must not have seen the plan; the agent that wrote the briefs must not grade them. This is not ceremony: a judge holding the prompts grades the intention, and an author grading itself reproduces its own blind spots with a confident number attached.

While the blind pass is open, a guard hook refuses reads of `plan.json`, `prompts/`, `frames/` and `judge/key.json`, and refuses hand-edits of any recorded verdict. If it fires, the answer is to finish the pass, not to route around it.

## Pass 1 — blind

The agent gets twelve images labelled `A`–`L` in a shuffled order, and nothing else. It returns, per image, three levels plus an evidence sentence, and one ordering of all twelve.

| Field | Levels | What separates them |
|---|---|---|
| `restriction` | `clean` / `suspect` / `violated` | `violated` is any lit pixel outside the cursor, any interface element, any light that reads as emitted by the panel, any studio-lit reflection. `suspect` is a brightness the judge cannot attribute to the room. |
| `constant` | `anchored` / `drifted` / `absent` | Compare the cursor tip's position against the other eleven images, not against a description. `drifted` is any visible displacement, resize or rotation. |
| `presence` | `traced` / `sterile` | `traced` requires a nameable object that says someone was recently here. A beautiful empty room is `sterile`. |

`evidence` is required on every frame and is a sentence naming what was actually seen — "a cup ring and a jacket on the chair back", not "looks lived in". A level without evidence is an opinion, and `judge submit` refuses it.

`order` is all twelve labels, earliest to latest. This is the measurement the whole axis rests on: the run's **Kendall tau** compares that guess with the true chronology. Tau near 1 means the day reads from the images alone. Tau near 0 means The Variable is in the briefs and not in the artefacts — the images are not carrying the day, whatever their individual verdicts say.

## Pass 2 — informed

Now the agent sees the clocks and the trace chain, and answers what only a reader of the series can:

| Field | Levels | Question |
|---|---|---|
| `chronology` | `in-line` / `ambiguous` / `out-of-line` | Does this image sit at the hour it claims? |
| `continuity` | `consistent` / `broken` | Do the objects arrive at this frame in the state the previous frames left them? |

And the collection itself: `shape` is `collection` or `batch`, plus two written answers — the causal sentence tying frame 03 to frame 09, and what is actually lost if four frames are deleted. Both are refused as stubs if they are shorter than an answer. Those two questions are the first and third attacks in [`axis.md`](axis.md), asked of the finished work instead of the proposal.

## The judge proposes; it never acts

`discard_proposals` is a list of opinions with reasons. Nothing in this skill deletes, regenerates, reorders or retouches a frame on a verdict. `score` merges the judge's proposals with the ones implied by the levels, prints them, and stops. The owner decides, and a re-run is `dispatch --only <ids> --force` against the same approved plan.

Two reasons this line is hard. A judge that can regenerate what it dislikes optimises the collection towards its own taste, and the tau stops measuring the work. And a discard is an authorial decision: which twelve images exist is the axis's fifth attack, and it is not a machine's call.

## Reading the numbers honestly

- A high tau with several `suspect` restrictions is a series that reads well and may not be clean. Look at the images.
- A low tau with twelve `clean` frames is a series that obeys the restriction and is not telling a day. That is the worse failure, and it is not fixed by regenerating one frame.
- `violated` on one frame is a regeneration. `violated` on four is a prompt problem in the shared clause, and the fix is upstream, in the plan, at the gate.

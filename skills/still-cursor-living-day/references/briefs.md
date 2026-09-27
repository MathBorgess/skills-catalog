# Writing the twelve briefs

`plan.json` is the collection before it exists. Fill it once, completely, then gate it. Worked prompts, positive and negative, are in [`examples.md`](examples.md) — read those before writing the first one.

## The shape

```json
{
  "axis": "still-cursor-living-day",
  "frame_count": 12,
  "invariants": {
    "cursor_clause": "… its tip landing on exactly 61.5% of the frame width and 43.0% of the frame height, whatever part of the frame the laptop occupies …",
    "surface_clause": "an open MacBook whose display is off: a dark grey-black panel emitting no light at all …",
    "optics_clause": "the panel is semi-gloss, about thirty percent reflective …"
  },
  "frames": [
    {
      "id": "03",
      "clock": "08:10",
      "place": "kitchen table",
      "room": "chair pulled out, the table half cleared, a bag open on the floor",
      "light": "low morning sun, a hard edge of light on the upper wall",
      "human": "a shoulder and half a jaw, leaning in to put the cup down, not looking at the panel",
      "framing": { "scale": "medium", "view": "oblique" },
      "traces": [
        { "object": "cup", "state": "full" },
        { "object": "charger", "state": "coiled in the bag" }
      ],
      "route": "api:openai",
      "prompt": "<surface_clause>. <cursor_clause>. <optics_clause>. …"
    }
  ]
}
```

`init` writes all three invariant clauses for you. Change the cursor coordinate once, at the start, if you want a different anchor — never per frame. The script refuses a frame carrying its own clause, because those three are what does not vary.

## The day, and the places

Twelve clocks, strictly increasing, across one whole day: the first frame before the machine is in use and the last after it. Do not space them evenly by the clock — space them by what changes.

`place` is where the laptop has been carried and opened. The floors the script enforces: **at least five distinct places** across the twelve, and **at most three consecutive frames sharing one**. That is not a style preference; twelve frames of one desk is exactly what the first real runs produced, and the series read as one photograph taken twelve times. Somewhere in the day the machine should be closed, moved and reopened, and the reflection should show it: a different ceiling, a different depth behind the panel, a window that is now on the other side.

`room` describes what is around it in that place. `light` is the hour, concretely — "late afternoon" is a mood, "the hard edge of sun has dropped to the skirting board, the rest of the wall in shadow" is an instruction. Keep the sun moving in one direction across the day; a sun that goes back is a broken day.

## Framing

`framing.scale` is how much of the frame the panel occupies: `distant`, `small`, `medium`, `dominant`. `framing.view` is the angle onto it: `frontal`, `oblique`, `steep`, `over-shoulder`, `low`. The script requires **at least three distinct scales and three distinct views**, with **at most two consecutive frames repeating the same pair**.

The panel does not have to own the frame and does not have to be centred. What it has to do is land so that the cursor's tip falls on the anchor coordinate — the composition is built around the anchor, and the laptop goes wherever that leaves it. A small laptop on the far side of a café counter with the arrow sitting on its screen at the same point as the frame before is the strongest image in the series, and it is also the hardest to get: expect to re-dispatch those.

The cursor's own drawn size stays identical across all twelve, which deliberately breaks perspective. That is the point — the arrow is not in the room, it is on the image, the way a hardware overlay is not in the scene it survives.

## The trace chain, travelling

Every frame declares `traces`: the physical objects present and their state at that hour. This is what makes the twelve a collection, and it now has to survive the machine moving.

- **Every frame must change at least one object's state.** `route` refuses a frame that moves nothing, and it is right to: a frame nobody would miss belongs to a batch.
- At least one chain travels with the laptop — the charger that comes out of the bag and never goes back, crumbs on the keyboard, a sticker, rain still on the lid. Those are the objects that hold the series together when the room changes.
- At least one chain stays behind: a cup left full at the kitchen table is the cup found cold there at night. A chain that is abandoned in a place and rejoined later is stronger than one that never leaves.
- An object that appears must keep appearing until something removes it, and its state must change on a schedule a person would produce: `full` → `half` → `cold, ring on the table` → `gone, ring still there`.
- States are compared as text, so be consistent: `half` in frame 05 and `half-full` in frame 06 read as a change that did not happen.
- A change of place is not a continuity break. An object arriving in a state the earlier frames did not leave it in is.

## The prompt

Build every prompt the same way, in this order:

1. `surface_clause`, verbatim.
2. `cursor_clause`, verbatim.
3. `optics_clause`, verbatim.
4. The place, the hour and the light — concretely.
5. What is reflected: the person's fragment, what they are doing, the objects at their current state.
6. The framing in words, matching the `framing` fields: how much of the frame the laptop takes, from what angle, and what sits between the camera and it.

Do not repeat the negations per frame. The three clauses already say what may not appear, and a frame that writes "no glowing screen" or "not like a mirror" again trips the lexicon scan for good reason: negations in generative prompts are unreliable, and the contract is stated once, in one place, identically.

The camera changes between frames now, so the thing to keep constant in the wording is the optics and the anchor, never the crop.

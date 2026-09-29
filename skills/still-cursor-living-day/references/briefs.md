# Writing the twelve briefs

`plan.json` is the collection before it exists. Fill it once, completely, then gate it. Worked prompts, positive and negative, are in [`examples.md`](examples.md) — read those before writing the first one.

## The shape

```json
{
  "axis": "still-cursor-living-day",
  "frame_count": 12,
  "invariants": {
    "surface_clause": "the same 14-inch MacBook Pro in space black in every image … its display off: a blank dark grey-black panel …",
    "optics_clause": "the panel is semi-gloss, about thirty percent reflective …"
  },
  "cursor": { "glyph": "macos-arrow", "panel": { "model": "14-inch MacBook Pro", "points": [1512, 982] }, "anchor": [1080, 410], "pointer_size": 2 },
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
      "prompt": "<surface_clause>. <optics_clause>. …"
    }
  ]
}
```

`init` writes both invariant clauses and the cursor block for you. Decide `cursor.anchor` and `cursor.pointer_size` once, at the start — never per frame — and read [`cursor.md`](cursor.md) before changing them. The script refuses a frame carrying its own clause or cursor, because those are what does not vary.

The cursor is never in a prompt. Not its position, not its existence: a prompt that says `cursor`, `pointer` or `arrow` is refused, because a generator asked for one draws it in the middle of the screen at a size of its choosing, and the composite would then put a second one beside it.

## The day, and the places

Twelve clocks, strictly increasing, across one whole day: the first frame before the machine is in use and the last after it. Do not space them evenly by the clock — space them by what changes.

`place` is where the laptop has been carried and opened. The floors the script enforces: **at least five distinct places** across the twelve, and **at most three consecutive frames sharing one**. That is not a style preference; twelve frames of one desk is exactly what the first real runs produced, and the series read as one photograph taken twelve times. Somewhere in the day the machine should be closed, moved and reopened, and the reflection should show it: a different ceiling, a different depth behind the panel, a window that is now on the other side.

`room` describes what is around it in that place. `light` is the hour, concretely — "late afternoon" is a mood, "the hard edge of sun has dropped to the skirting board, the rest of the wall in shadow" is an instruction. Keep the sun moving in one direction across the day; a sun that goes back is a broken day.

## Framing

`framing.scale` is how much of the frame the panel occupies: `distant`, `small`, `medium`, `dominant`. `framing.view` is the angle onto it: `frontal`, `oblique`, `steep`, `over-shoulder`, `low`. The script requires **at least three distinct scales and three distinct views**, with **at most two consecutive frames repeating the same pair**.

The laptop can be anywhere in the frame, at any size, from any of those angles. What every frame owes the cursor is the anchor's patch of screen: facing the camera, unoccluded — no hand, cup or strap across it — and large enough to carry a legible arrow. The cursor is composited in perspective, so it is as big as that patch of screen makes it: at the default pointer size, a `distant` panel yields an arrow of two or three pixels, and `panel submit` refuses anything under six. `route` warns about it before generation. When a distant frame matters, raise `pointer_size` for the whole series rather than dropping the frame.

**The object must stay the object.** The same 14-inch MacBook Pro in space black in every frame — same finish, same proportions, same bezel and notch. The surface clause says so, and the blind judge rates it (`object`). Vary how it is seen, never what it is. A persistent physical mark that the camera can see from the front — a scuff on the palm rest, a sticker by the trackpad — helps a generator keep it the same machine, and becomes a trace in its own right.

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
2. `optics_clause`, verbatim.
3. The place, the hour and the light — concretely.
4. What is reflected: the person's fragment, what they are doing, the objects at their current state.
5. The framing in words, matching the `framing` fields: how much of the frame the laptop takes, from what angle, and what sits between the camera and it — never in front of the screen's right-hand half, where the anchor is.

Do not repeat the negations per frame. The two clauses already say what may not appear, and a frame that writes "no glowing screen" or "not like a mirror" again trips the lexicon scan for good reason: negations in generative prompts are unreliable, and the contract is stated once, in one place, identically.

The camera changes between frames, so what stays constant in the wording is the machine and the optics, never the crop. The anchor is not in the wording at all.

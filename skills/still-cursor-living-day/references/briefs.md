# Writing the twelve briefs

`plan.json` is the collection before it exists. Fill it once, completely, then gate it.

## The shape

```json
{
  "axis": "still-cursor-living-day",
  "frame_count": 12,
  "invariants": {
    "cursor_clause": "a single standard white arrow mouse cursor, monochrome, its tip anchored at exactly 61.5% of the frame width and 43.0% of the frame height, identical in size, angle and position in every image of the series",
    "surface_clause": "the computer display is a completely black, non-emitting reflective glass panel: no windows, icons, wallpaper, notifications or interface of any kind, no light leaving the panel, and what is seen on the glass is only the room reflected in it"
  },
  "frames": [
    {
      "id": "03",
      "clock": "08:10",
      "room": "kitchen light reaching the desk from the left; the chair pulled out",
      "light": "low morning sun, a hard edge of light on the upper wall",
      "human": "a shoulder and half a jaw, leaning in to put the cup down, not looking at the glass",
      "traces": [
        { "object": "cup", "state": "full" },
        { "object": "jacket", "state": "on the chair back" }
      ],
      "route": "api:openai",
      "prompt": "<surface_clause>. <cursor_clause>. …"
    }
  ]
}
```

`init` writes both invariant clauses for you. Change the coordinate once, at the start, if you want a different anchor — never per frame. The script refuses a frame carrying its own clause, because The Constant is a property of the series.

## The day

Twelve clocks, strictly increasing, spread across one day and not across one workday: the first frame is before the room is in use and the last is after it. Do not space them evenly by the clock. Space them by what changes — the hours where the light moves fastest and the hours where the body degrades fastest deserve more frames than the flat middle of the afternoon.

The person is never posed and never looks at the glass. They enter the frame as a shoulder, a forearm, the back of a head, a silhouette crossing behind the desk. Between the first frame and the last, the same face should be recognisable and slightly wrong each time — that drift is deliberate and belongs in the prompt as continuity of a person, never as "the same face exactly".

## The trace chain

This is what makes the twelve a collection. Every frame declares `traces`: the physical objects in the room and their state at that hour.

- An object that appears must keep appearing until something removes it, and its state must change on a schedule a person would produce: a cup goes `full` → `half` → `cold, ring on the desk` → `gone, ring still there`.
- **Every frame must change at least one object's state.** `route` refuses a frame that moves nothing, and it is right to: a frame nobody would miss is a frame that belongs to a batch.
- At least one chain should run the whole day (a cup and its ring, a jacket that migrates chair → floor → gone) and at least one should start late (keys dropped at 19:00 and never moved).
- Sunlight is a trace too. Track where the hard edge of light sits, and keep it moving in one direction across the walls — a sun that goes back is a broken day.
- `traces` state strings are compared as text, so be consistent: `half` in frame 05 and `half-full` in frame 06 read as a change that did not happen.

## The prompt

Build every prompt the same way, in this order:

1. `surface_clause`, verbatim.
2. `cursor_clause`, verbatim.
3. The room, the hour and the light — concretely. "Late afternoon" is a mood; "the hard edge of sun has dropped to the skirting board, the rest of the wall in shadow" is an instruction.
4. What is reflected: the person's fragment, what they are doing, the objects at their current state.
5. Optics: that the image on the glass is a reflection, dim, slightly doubled by the panel's front surface, and that the darkest part of the frame is the panel itself.

Do not repeat the negations per frame. `surface_clause` already says what may not appear, and a frame that writes "no glowing screen" again trips the lexicon scan for good reason: negations in generative prompts are unreliable, and the contract is stated once.

Keep the camera the same in all twelve — same distance, same angle to the panel, same focal impression. A moving camera makes the cursor coordinate meaningless even when the generator honours it.

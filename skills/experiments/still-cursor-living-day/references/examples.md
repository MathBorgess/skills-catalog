# Prompt examples

`<clauses>` below stands for the two invariant clauses — surface, then optics — pasted verbatim at the head of every prompt. What follows them is the part you write, and it is the only part that varies. None of it mentions a cursor: the arrow is composited afterwards, on the screen pixel `plan.cursor` names ([`cursor.md`](cursor.md)).

Read the positives for range and the negatives for the traps. Both are here because the first real runs came back coherent and monotonous: the axis was being obeyed and nothing was happening.

## Positive

### 01 — 05:52, bedroom floor, `small` / `low`

> `<clauses>` Shot from floor level across a rug, the open laptop small in the lower right of the frame where it was set down the night before, the duvet edge and one bare foot out of focus in the foreground. Pre-dawn blue coming from a single uncurtained window behind the camera, so the panel holds a pale rectangle of that window and, very dimly, the shape of a shoulder still in bed. A charging cable runs out of frame towards a socket. A glass of water beside it, nearly empty, a ring of condensation on the floorboards.

**Why it works.** The laptop is small and off-centre, and its screen still faces the camera with nothing across it, so the composited arrow has a clear patch of glass to sit on. Nothing is happening yet and the room already says a person: the glass, the ring, the cable, the shoulder. The light names the hour without a clock.

### 03 — 08:10, kitchen table, `medium` / `oblique`

> `<clauses>` The laptop at a shallow angle on a kitchen table, taking about a third of the frame from the left, a cereal bowl and a jacket over the chair back beside it. Hard morning sun has climbed to the top third of the wall behind the camera; the panel holds that wall, the ceiling line and a forearm setting down a full cup, the hand blurred by the movement. Crumbs on the table. A coiled charger half out of an open bag on the floor, reflected as a dark knot low in the panel.

**Why it works.** The cup enters the series full here, and the charger is introduced coiled so it can come out later. The person is a forearm mid-action — present, not posing.

### 05 — 11:34, bus seat, `small` / `steep`

> `<clauses>` The laptop open on a lap on a bus, seen steeply from above and slightly behind, occupying maybe a fifth of the frame, the rest knees, a bag strap and the seat back in front. Flat overcast light through a window on the left; the panel holds the window's bright band sliding across it, the blur of a wall going past outside, and the underside of a jaw. A crumpled receipt wedged beside the seat cushion. The charger cable now loose, trailing out of the bag onto the seat.

**Why it works.** Same day, completely different place, and the chain moved with it: the charger came out of the bag. Motion in the reflection carries the time of day without any object announcing it.

### 07 — 13:05, café counter, `dominant` / `frontal`

> `<clauses>` The laptop almost head-on and close, filling most of the frame on a scratched wooden counter, a saucer and a cooling cup pushed to one side. Midday light from a shopfront window high behind the camera; the panel holds the room's far wall, the doorway and the head and shoulders of a person who has looked away towards the street, plus a stranger's back crossing behind. A serviette folded into a wedge under one corner of the laptop to level it.

**Why it works.** The one frame where the panel is allowed to dominate, and it earns it: the reflection is at its most populated here, at the busiest hour. The wedge under the corner is the kind of trace nobody stages.

### 09 — 17:48, park bench, `small` / `frontal`

> `<clauses>` The laptop open on a wooden bench, small and centred low in the frame, grass and a path behind it, nobody else around. Late sun very low and orange from the left, long shadows across the slats; the panel holds the treeline, a sky going warm, and a person leaning back out of frame with a hand over their eyes. The cup from the morning is not here. A jacket bunched on the bench beside the laptop, sleeves inside out.

**Why it works.** The absence is doing the work — the cup was left behind at the kitchen table, and the jacket has migrated. Read against frame 03, this is the same day nine hours on and the tiredness is in the body, not in a filter.

### 12 — 23:41, kitchen table, `medium` / `over-shoulder`

> `<clauses>` The same kitchen table, seen over a shoulder from behind, the laptop occupying the middle third, still open. No daylight at all; the only illumination is spill from a hallway out of frame, so most of the image is near-black and the panel is the deepest black in it, holding a faint doorway rectangle and the outline of a head, which sits at the left edge of the frame, clear of the screen. The morning's cup is still on the table, cold, a dried ring around it. The jacket is on the floor. The charger is plugged in now, cable taut across the table.

**Why it works.** It closes both chains in the place they opened: the cup found cold where frame 03 filled it, the charger finally plugged in. The panel is barely distinguishable from the dark and is still, measurably, the darkest thing in the frame.

## Negative

Each of these is a real way the series fails. Most are caught before generation; the last few only show up in the judge.

**The same desk twelve times.** Every `place` set to one room, or nine of the twelve in it. → `route` refuses it: at least five distinct places, at most three consecutive frames sharing one. This was the actual failure of the first runs, not a hypothetical.

**The same crop twelve times.** `framing` left at `medium` / `frontal` throughout. → Refused: three distinct scales and three distinct views minimum, and at most two consecutive frames repeating a pair. The panel being the same size in every image is what made the collection read as one photograph.

**"a mirror finish on the panel, the room crystal clear in it"** → Refused by the lexicon. It also destroys the axis: a clean mirror makes the object a mirror, and the work is about a screen that has stopped being a screen.

**"a matte black screen, pure black rectangle in the middle"** → Refused by the lexicon. The other side of the same failure: with no reflection at all there is no room, no day, and no reason for the thing to be a laptop.

**"the panel slightly more reflective here to catch the sunset"** → Not caught by the lexicon, caught at the gate and by the judge's `opacity` level. One reflectivity, across the series. If a frame needs more light in the panel, put more light in the room.

**"a white cursor resting on the black screen"** → Refused by the lexicon, and it is the one negative the first runs were built on. Asked for a cursor, every generator drew it in the middle of the screen, at a different size each time, and never at the requested point. The cursor is composited, so the prompt never mentions it.

**The generator draws an arrow anyway.** It happens even unasked, because stock laptops come with pointers. → Caught at marking: untick "panel is blank" and the frame is refused for re-dispatch. Compositing over it would put two cursors on one screen.

**"her hand resting across the right side of the keyboard and screen"** → Caught at marking as `anchor_occluded`. The anchor sits right of centre on the screen; anything crossing that patch hides the one thing that must be seen, and drawing the arrow over the hand would float it in front of her.

**"the laptop far across the room, a small dark shape on a shelf"** → `route` warns, `panel submit` refuses: at the default pointer size the arrow on a `distant` panel is two or three pixels, under the six-pixel floor. Frame it closer, raise the resolution, or raise `pointer_size` for all twelve — the cursor's size is coherent with the laptop's, so a far laptop needs a larger pointer, never a larger arrow in one frame.

**The laptop changes between frames** — silver here, a different bezel there, an older keyboard. → The surface clause names one machine; the blind judge's `object` level catches the drift. Vary how it is seen, never what it is.

**"the laptop centred and filling the frame"** in every prompt → Refused by the framing floors, and the collection reads as one photograph. Vary the scale and the angle; the cursor follows the screen wherever it goes.

**"a work call open on screen while the person is crying in the reflection"** → Refused. It is also the crutch the restriction exists to remove: the meaning has to come from the glass, the light and the leftovers, never from a lit pixel doing the explaining.

**"lit by a softbox from the left, the person smiling at the camera"** → Refused twice: studio lighting, and a posed reflection. Nobody looks at a dead screen on purpose.

**"a beautiful empty room at golden hour, nothing on the table"** → Not refused by the lexicon; refused by the traces rule if every object is `absent`, and binned by the judge's `presence` level otherwise. A room with no leftovers is a furniture catalogue.

**"no glowing screen, not like a mirror, no interface elements"** → Refused, and the error says why: the negations live in the two invariant clauses, once. Repeating them per frame both wastes the prompt and, in generative models, tends to summon what it names.

**"late afternoon vibes, moody and lonely"** → Nothing catches this, and it produces the average of every stock photograph in the training set. Name what the light is doing to a specific surface at a specific height, and let the loneliness be a consequence.

**A phone lit on the table beside the laptop** → Warned by the lexicon (`phone` is ambiguous), and it has to be resolved at the gate. A dark phone is a trace. A lit phone is a second screen emitting light, which is the restriction broken by a device the restriction did not name.

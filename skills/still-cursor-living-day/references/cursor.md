# The cursor

The cursor is the one element of the collection that is not generated. It is drawn by `scripts/cursor.mjs`, after generation, at one fixed pixel of the MacBook's screen, in all twelve frames.

## Why it is not in the prompt

The first real runs asked the generator for "a white arrow, its tip at 61.5% of the frame width and 43.0% of its height". Across twelve frames the arrow landed at that point in none. Every generator drew it in the middle of whatever screen it had drawn, at a size of its own choosing, different each time. Image models do not place a small glyph at a coordinate, and no rewording changes that.

The same runs showed the second mistake: the point was fixed in the *image*, and with the laptop now moving between frames, that image point fell on the screen in only ten of twelve. A cursor lives on a screen, so its fixed point has to be a point of the screen.

So the generator is never asked for a cursor, and `route` refuses a prompt that says `cursor`, `pointer` or `arrow`. What stays constant is set in `plan.cursor` and enforced by arithmetic.

## `plan.cursor`

```json
"cursor": {
  "glyph": "macos-arrow",
  "panel": { "model": "14-inch MacBook Pro", "points": [1512, 982] },
  "anchor": [1080, 410],
  "pointer_size": 2
}
```

- **`panel.points`** is the display in screen points, origin top-left. 1512×982 is the 14-inch MacBook Pro's default; it has to match the machine `surface_clause` names.
- **`anchor`** is where the arrow's tip sits on that display: the same screen pixel in every frame. It must keep the arrow inside the central 90% of the panel and below the notch.
- **`pointer_size`** is the macOS pointer-size setting, 1 to 4. It is a property of the machine, so it is the same in all twelve. It exists because a coherent cursor on a laptop across a café is a few pixels tall; raising it keeps the arrow legible in the distant frames while its size stays true to perspective in all of them.

The block is part of the plan's hash. Changing any of it after approval means routing and gating again.

## Marking the panels

The composite needs one thing it cannot compute: where the display is in each image. `panel open` writes two ways to supply it:

- **`panels/mark.html`** — open it in a browser. For each frame, click the four corners of the display's glass inside the bezel, where the edges would meet at the rounded top corners, in the screen's own order: top-left, top-right, bottom-right, bottom-left, whatever the camera angle. The page shows the arrow it will draw, live, and turns red when a frame would be refused. A magnifier follows the mouse. Progress survives a reload. **Download corners.json** when all twelve are green.
- **`panels/task.md`** — the same contract for a vision agent. Agents are poor at pixel coordinates; if you use one, look at the composite before judging.

Two flags per frame, both honest questions:

- `clean_panel` — did the generator draw anything on the panel? A second arrow, a window, a glow. If so, re-dispatch: compositing over it puts two cursors on one screen.
- `anchor_occluded` — does anything in front of the panel cover the anchor point? A hand, a cup, a strap. If so, re-dispatch or re-frame: drawing over it would float the arrow in front of the thing that should be hiding it.

## What `panel submit` refuses

- corners outside the image, not convex, or counter-clockwise — the last means the order is wrong or the panel faces away;
- an edge shorter than 8px;
- `clean_panel` not true, or `anchor_occluded` not false;
- an arrow that would project outside the image;
- an arrow under **6px** tall. The refusal names the three ways out: frame it closer, generate the series at a higher resolution (`SCLD_IMAGE_SIZE`), or raise `pointer_size` for all twelve. `route` already warns before generation when a `distant` framing is likely to hit this.

Submissions merge: send the frames that failed again, and the accepted ones stay. A frame regenerated after its corners were accepted loses them — its bytes changed, so its panel may have moved.

## `composite`

Refuses unless all twelve have accepted corners that match the current bytes of each frame and the current cursor block. For each frame it computes the homography from the panel's screen points to the four corners, projects the arrow's outline through it, and fills it. The pixels are additive — emitted light on top of what the glass already reflects — with 4×4 supersampled edges. The arrow's black border is not drawn: on a panel that emits nothing else, a black border is indistinguishable from the dark glass, and a photograph of this would show exactly that.

It prints, per frame, the panel point (identical in all twelve), where the tip landed in the image, and the cursor's height in pixels. That table is the explicit proof of the constant. `composited/manifest.json` records it with hashes, and the raw generations stay untouched in `frames/`. The same inputs always produce the same bytes.

## What still needs eyes

The composite guarantees position, size and perspective. It cannot know that the corners were clicked in the right place. If a cursor looks like it floats beside the glass rather than on it, the corners are off: the blind judge's `constant` level catches that as `drifted`, and the fix is to re-mark that frame, not to regenerate it.

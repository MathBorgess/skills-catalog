# The axis

> The collection investigates the passage of a single day through images in which a laptop's display stops working as an interface and operates only as a semi-reflective surface. In every piece, the tip of the system's standard cursor rests on the same pixel of the same laptop's screen while the rest of the panel stays off, emitting no light and carrying no active interface element. What persists is that anchor: one machine, one arrow on one screen pixel, over dark glass held at one constant reflectivity. What varies is everything the machine is carried through — the places it gets opened in, the light of the hour, how near or far the frame stands from it, and the traces of the human presence that keeps coming back to it. Only images that respect that restriction, and that build that temporal narrative, belong to the collection.

That paragraph is the whole contract. Everything below is it, made checkable.

## The pillars

| Pillar | What it means concretely |
|---|---|
| **The Restriction** | The same open MacBook in every frame, its display off. No active interface element and no light emitted by the panel: zero windows, icons, wallpapers, notifications, menu bar, zero lit pixels of any colour, except the monochrome static cursor. No studio lighting in the reflected scene either. |
| **The Constant** | The standard white arrow cursor, its tip on the same pixel *of the MacBook's screen* in all twelve frames, at one pointer size. Seen from a different distance or angle, it is foreshortened and scaled exactly as the screen is — it moves through the image only because the laptop does. It is never generated: it is composited after generation, through the perspective of the screen's four corners ([`cursor.md`](cursor.md)). |
| **The Optics** | One reflectivity, held across the series: semi-gloss, about thirty percent. The room is legible in the panel but two or three stops darker, edges softened, no specular highlight sharp enough to read detail in, and the panel always the darkest value in the frame. Neither a clean mirror nor a flat matte black rectangle. |
| **The Variable** | One day moving forward, told by the places the laptop is carried to, by ambient light, by how close the frame stands, by what the person does in the reflection, and by the small instabilities the generator leaves in a face it is trying to reproduce. |
| **The Discard** | Out: any artefact with a lit pixel outside the cursor; any panel that reads as a mirror or as matte black; any reflection that reads as a pose or a selfie; any place with no trace of recent human presence; any image off the chronological line. |

The machine travels; the cursor does not move *on it*. That asymmetry is the work: a person carries the same dead screen through a kitchen, a bus, a counter, a bench and a bedroom floor, and the one thing that never moves is the arrow the machine froze on its own glass.

## What the finished collection has to survive

These are the questions the work is defended against. They are not rhetoric — each has a mechanical counterpart in the run, and the judge is asked the last two directly.

1. **"This is a batch, not a collection."** The answer is causal, never "time passes". Frame 09 is the physical consequence of the day that began rested in frame 03 — the same charger, the same cooling cup, the same body five places later — while the cursor stayed on its coordinate as an unmoving witness. `route` refuses any frame that changes no object's state, which is the same claim in arithmetic.
2. **"The restriction restricts nothing."** It costs two things. First, the easiest device available: the juxtaposition of a lit screen against the person reflected in it. Forbidding every pixel throws that crutch away and forces the meaning through the optics of the glass, the ambient light and the leftovers of a body. Second, the generator itself: the one element the axis depends on is the one element a generator cannot be trusted to draw. The cursor is taken away from it entirely and placed by arithmetic on one screen pixel, which means every frame has to show that pixel — unoccluded, facing the camera, large enough to carry a legible arrow. A framing that hides the anchor is refused, however good the image.
3. **"Delete four and nobody notices."** Wrong, if the chain is real. The chain travels with the machine: a cup filled at one table is cold at the next and abandoned by night; the charger comes out of the bag and never goes back; the sun crosses specific walls in a specific order. `route` prints how many transitions each four-frame window would destroy, and a series that survives the deletion is a series that did not have a chain.
4. **"Three other groups will do loneliness at a computer."** The subject is not the everyday; it is the inversion of the machine's role. The display is demoted to a blind mirror with no practical use, keeping only the frozen aim of the cursor while a biological life wears out in front of it and hauls it from room to room. The computer is not being used — it is being carried, and it is watching.
5. **"Where is the discard?"** Two concrete kinds get binned: the beautiful sterile frame (a spectacular sunset in the reflection, but no key on the table, no jacket, no forgotten glass — a furniture catalogue, not a life), and any render where the model lit a single pixel, drew an interface element, or pushed the panel out of its reflectivity band in either direction.
6. **"The tool chose the axis for you."** The concept precedes the tool: the same series survives as procedural 3D with semi-gloss glass shaders and ray tracing. Generative models are justified by the instability of synthetic identity — the reflection tries to reproduce the same person and mutates slightly at every frame, which is exactly the artificiality of that observation.
7. **The two questions of fire.**
   - *Erase the cursor in every image and what is lost?* Everything. Without it the pieces read as under-exposed photographs of a laptop in a room. The cursor is what converts the glass into a screen, anchors the viewer's perspective inside the machine, and completes the inversion.
   - *A powered-off MacBook has no cursor — is that a coherence error?* No: it is a machine in suspension. The mouse pointer often lives in a dedicated hardware overlay, and when the graphical layer dies or blanks, the frozen arrow is literally the last thing still alive in the hardware — at the last screen pixel it was on. That is exactly what the collection renders: the same pixel of the same panel, all day, from wherever the machine was set down.

## Framings that lose the argument

Never describe the work — to the owner, in a prompt, or in a report — as any of these:

- "We used AI because photographing it for real would be too much work." It reads as laziness, and it is also false: the axis survives a tool change.
- "It is about everyday life seen in the reflection of screens." That hands the work to the cliché it is built against.
- "A collection of pretty pictures with reflections." That turns a collection back into a batch.

Say instead: the machine inverted, the cursor's spectral persistence, the continuity of traces, the anchor the composition obeys.

## The lexicon

`scripts/collection.mjs` refuses a prompt containing an unambiguous breach — `wallpaper`, `notification`, `taskbar`, `glowing screen`, `softbox`, `selfie`, `posing`, `mirror finish`, `crystal clear reflection`, `matte black screen`, and any mention of a `cursor`, `pointer` or `arrow`, which the generator must never be asked for — and warns on words that are ambiguous by nature: `window`, `lamp`, `led`, `phone`, `tv`, `mirror`, `gloss`. A room has windows and lamps, and the axis lives or dies on which kind you meant, so those are raised at the gate rather than guessed. The negations belong in the two invariant clauses, which are stripped before the scan; a per-frame prompt should not repeat them.

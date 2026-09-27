# The axis

> The collection investigates the passage of a single day through images in which a laptop's display stops working as an interface and operates only as a semi-reflective surface. In every piece, the tip of the system's standard cursor lands on the same point of the image while the panel stays off, emitting no light and carrying no active interface element. What persists is that anchor: one cursor, at one coordinate, over dark glass held at one constant reflectivity. What varies is everything the machine is carried through — the places it gets opened in, the light of the hour, how near or far the frame stands from it, and the traces of the human presence that keeps coming back to it. Only images that respect that restriction, and that build that temporal narrative, belong to the collection.

That paragraph is the whole contract. Everything below is it, made checkable.

## The pillars

| Pillar | What it means concretely |
|---|---|
| **The Restriction** | An open MacBook whose display is off. No active interface element and no light emitted by the panel: zero windows, icons, wallpapers, notifications, menu bar, zero lit pixels of any colour, except the monochrome static cursor. No studio lighting in the reflected scene either. |
| **The Constant** | The tip of the standard white arrow cursor, on the same coordinate of the *image*, at the same drawn size and angle, in all twelve frames — whatever part of the frame the laptop occupies and however large it appears. The composition is built around that point; the machine is not. |
| **The Optics** | One reflectivity, held across the series: semi-gloss, about thirty percent. The room is legible in the panel but two or three stops darker, edges softened, no specular highlight sharp enough to read detail in, and the panel always the darkest value in the frame. Neither a clean mirror nor a flat matte black rectangle. |
| **The Variable** | One day moving forward, told by the places the laptop is carried to, by ambient light, by how close the frame stands, by what the person does in the reflection, and by the small instabilities the generator leaves in a face it is trying to reproduce. |
| **The Discard** | Out: any artefact with a lit pixel outside the cursor; any panel that reads as a mirror or as matte black; any reflection that reads as a pose or a selfie; any place with no trace of recent human presence; any image off the chronological line. |

The machine travels, the cursor does not. That asymmetry is the work: a person carries the same dead screen through a kitchen, a bus, a counter, a bench and a bedroom floor, and the one thing that never moves is the arrow the machine froze.

## What the finished collection has to survive

These are the questions the work is defended against. They are not rhetoric — each has a mechanical counterpart in the run, and the judge is asked the last two directly.

1. **"This is a batch, not a collection."** The answer is causal, never "time passes". Frame 09 is the physical consequence of the day that began rested in frame 03 — the same charger, the same cooling cup, the same body five places later — while the cursor stayed on its coordinate as an unmoving witness. `route` refuses any frame that changes no object's state, which is the same claim in arithmetic.
2. **"The restriction restricts nothing."** It costs two things. First, the easiest device available: the juxtaposition of a lit screen against the person reflected in it. Forbidding every pixel throws that crutch away and forces the meaning through the optics of the glass, the ambient light and the leftovers of a body. Second, the composition itself: every frame has to be built so the cursor's tip lands on one fixed point of the image, which means the framing serves the anchor rather than the subject. A photographer would frame the laptop; here the laptop lands wherever the anchor leaves it.
3. **"Delete four and nobody notices."** Wrong, if the chain is real. The chain travels with the machine: a cup filled at one table is cold at the next and abandoned by night; the charger comes out of the bag and never goes back; the sun crosses specific walls in a specific order. `route` prints how many transitions each four-frame window would destroy, and a series that survives the deletion is a series that did not have a chain.
4. **"Three other groups will do loneliness at a computer."** The subject is not the everyday; it is the inversion of the machine's role. The display is demoted to a blind mirror with no practical use, keeping only the frozen aim of the cursor while a biological life wears out in front of it and hauls it from room to room. The computer is not being used — it is being carried, and it is watching.
5. **"Where is the discard?"** Two concrete kinds get binned: the beautiful sterile frame (a spectacular sunset in the reflection, but no key on the table, no jacket, no forgotten glass — a furniture catalogue, not a life), and any render where the model lit a single pixel, drew an interface element, or pushed the panel out of its reflectivity band in either direction.
6. **"The tool chose the axis for you."** The concept precedes the tool: the same series survives as procedural 3D with semi-gloss glass shaders and ray tracing. Generative models are justified by the instability of synthetic identity — the reflection tries to reproduce the same person and mutates slightly at every frame, which is exactly the artificiality of that observation.
7. **The two questions of fire.**
   - *Erase the cursor in every image and what is lost?* Everything. Without it the pieces read as under-exposed photographs of a laptop in a room. The cursor is what converts the glass into a screen, anchors the viewer's perspective inside the machine, and completes the inversion.
   - *A powered-off MacBook has no cursor — is that a coherence error?* No: it is a machine in suspension. The mouse pointer often lives in a dedicated hardware overlay, and when the graphical layer dies or blanks, the frozen arrow is literally the last thing still alive in the hardware. The computer is not dead; it is awake, stuck, watching the day go by from wherever it was set down.

## Framings that lose the argument

Never describe the work — to the owner, in a prompt, or in a report — as any of these:

- "We used AI because photographing it for real would be too much work." It reads as laziness, and it is also false: the axis survives a tool change.
- "It is about everyday life seen in the reflection of screens." That hands the work to the cliché it is built against.
- "A collection of pretty pictures with reflections." That turns a collection back into a batch.

Say instead: the machine inverted, the cursor's spectral persistence, the continuity of traces, the anchor the composition obeys.

## The lexicon

`scripts/collection.mjs` refuses a prompt containing an unambiguous breach — `wallpaper`, `notification`, `taskbar`, `glowing screen`, `softbox`, `selfie`, `posing`, `mirror finish`, `crystal clear reflection`, `matte black screen`, and the rest of that list — and warns on words that are ambiguous by nature: `window`, `lamp`, `led`, `phone`, `tv`, `mirror`, `gloss`. A room has windows and lamps, and the axis lives or dies on which kind you meant, so those are raised at the gate rather than guessed. The negations belong in the three invariant clauses, which are stripped before the scan; a per-frame prompt should not repeat them.

# The axis

> The collection investigates the passage of a single day through images in which the computer display stops working as an interface and operates only as a reflective surface. In every piece, the tip of the system's standard cursor stays fixed at the same coordinate while the screen remains completely dark, emitting no light and showing no active interface element. What persists is the structure of the image: a static cursor and black glass. What varies is the chronological progression of an ordinary routine, read through changes of room, of light, and through the faint traces of the human presence reflected in the surface. Only images that respect that restriction, and that build that temporal narrative, belong to the collection.

That paragraph is the whole contract. Everything below is it, made checkable.

## The four pillars

| Pillar | What it means concretely |
|---|---|
| **The Restriction** | No active interface element and no light emitted by the display: zero windows, icons, wallpapers, notifications, zero lit pixels of any colour, except the monochrome static cursor. No studio lighting in the reflected scene either. |
| **The Constant** | The tip of the standard white arrow cursor, anchored at the exact same coordinate, at the same size and angle, on the black reflective glass, in all twelve frames. |
| **The Variable** | One day moving forward, told by ambient light and room changes, by what the person does in the reflection, and by the small instabilities the generator leaves in a face it is trying to reproduce. |
| **The Discard** | Out: any artefact with a lit pixel outside the cursor; any reflection that reads as a pose or a selfie; any room with no trace of recent human presence; any image off the chronological line. |

## What the finished collection has to survive

These are the questions the work is defended against. They are not rhetoric — each one has a mechanical counterpart in the run, and the judge is asked the last two directly.

1. **"This is a batch, not a collection."** The answer is causal, never "time passes". Frame 09 is the physical consequence of the day that began rested in frame 03, while the cursor stayed on its coordinate as an unmoving witness. `route` refuses any frame that changes no object's state, which is the same claim in arithmetic.
2. **"The restriction restricts nothing."** It costs the easiest device available: the juxtaposition of a lit screen against the person reflected in it. Forbidding every pixel throws that crutch away and forces the meaning through the optics of the glass, the ambient light and the leftovers of a body.
3. **"Delete four and nobody notices."** Wrong, if the object chain is real: a cup filled in one frame sits half-empty in the next and cold by night; the sunlight crosses specific points of the wall. `route` prints how many transitions each four-frame window would destroy.
4. **"Three other groups will do loneliness at a computer."** The subject is not the everyday; it is the inversion of the machine's role. The display is demoted to a blind mirror with no practical use, keeping only the frozen aim of the cursor while a biological life wears out in front of it. The computer is not being used — it is watching.
5. **"Where is the discard?"** Two concrete kinds get binned: the beautiful sterile frame (a spectacular sunset in the reflection, but no key on the table, no jacket, no forgotten glass — a furniture catalogue, not a life), and any render where the model lit a single pixel or drew an interface element, however good the rest was.
6. **"The tool chose the axis for you."** The concept precedes the tool: the same series survives as procedural 3D with reflective glass shaders and ray tracing. Generative models are justified by the instability of synthetic identity — the reflection tries to reproduce the same person and mutates slightly at every frame, which is exactly the artificiality of that observation.
7. **The two questions of fire.**
   - *Erase the cursor in every image and what is lost?* Everything. Without it the pieces read as under-exposed photographs of a room. The cursor is what converts the glass into a screen, anchors the viewer's perspective inside the monitor, and completes the inversion.
   - *A powered-off monitor has no cursor — is that a coherence error?* No: it is a machine in suspension. The mouse pointer often lives in a dedicated hardware overlay, and when the graphical layer dies or blanks, the frozen arrow is literally the last thing still alive in the hardware. The computer is not dead; it is awake, stuck, watching the day go by.

## Framings that lose the argument

Never describe the work — to the owner, in a prompt, or in a report — as any of these:

- "We used AI because photographing it for real would be too much work." It reads as laziness, and it is also false: the axis survives a tool change.
- "It is about everyday life seen in the reflection of screens." That hands the work to the cliché it is built against.
- "A collection of pretty pictures with reflections." That turns a collection back into a batch.

Say instead: the machine inverted, the cursor's spectral persistence, the continuity of traces.

## The lexicon

`scripts/collection.mjs` refuses a prompt containing an unambiguous breach — `wallpaper`, `notification`, `taskbar`, `glowing screen`, `softbox`, `selfie`, `posing`, and the rest of that list — and warns on words that are ambiguous by nature: `window`, `lamp`, `led`, `phone`, `tv`. A room has windows and lamps, and the axis lives or dies on which kind you meant, so those are raised at the gate rather than guessed. The negations belong in `invariants.surface_clause`, which is stripped before the scan; a per-frame prompt should not repeat them.

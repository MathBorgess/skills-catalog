# Poster archetypes

Pick one. Each entry holds its look, slots, prompt block shape, *Inspect* list and usual failure, so it can be read alone.

## A. Flat digital portrait poster

**Use when** the subject is one person, the look should be bold and graphic, and the poster is for a screen. The most reliable of the three.

**Look.** One flat 2D surface, edge to edge pure white, with no paper, shadow, frame or room. A single vertical solid-color rectangle sits in the middle as a graphic container. A gritty black-and-white portrait, cropped chest-up in profile or three-quarter view, is masked into and over the rectangle, the head overlapping its top edge. The last name sits below the rectangle in a tall condensed bold sans in the container color. The first name, in a loose handwritten script in the same color, lies over the torso and stays legible against the photo. A small logo or the subject's initials sit centered at the top.

**Slots.** `SUBJECT`, `CONTAINER COLOR` (derived from the subject's identity, with the reason), `LOGO OR INITIALS`, `REFERENCE PHOTO` (optional).

**Block shape.** Open with the medium ("a flat digital graphic export, not a photograph of a printed sheet"), then container, subject, the two name treatments, the header mark, and last the guardrail that no text crosses the face.

**Inspect.**
- The surface is flat: no paper grain, shadow, frame or perspective.
- Name text matches `brief.md` letter by letter, both names.
- No text covers the face; the first name still reads against the photo.
- Container color matches the brief; the head overlaps its top edge.
- The header mark is the intended logo or the initials, not an invented emblem.

**Usual failure.** The model adds a paper texture or a drop shadow. Re-state the medium line first; do not add more prohibitions.

## B. Photo-grid tribute poster

**Use when** the subject has a body of work to show (a career, a catalogue) and the poster should feel tactile and print-like.

**Look.** An off-white or light-grey background with a visible paper or concrete texture, never flat white. A large black-and-white portrait silhouette, centered, with wide negative space around it. The silhouette's interior is a dense mosaic of action shots from the subject's career. Cells carry varied textures — halftone dots, fabric or thread, heavy film grain — so the mosaic reads as collage, not as pasted photos. The base stays monochrome; color overlays tied to team, flag or brand land on a few cells to create rhythm. The name is small at top left, the symbol smaller at top right.

**Slots.** `SUBJECT`, `ACCENT COLORS` (team, flag or brand, with the reason), `TYPEFACE` (one, named), `SYMBOL`.

**Block shape.** Medium and background first, then the silhouette container, the mosaic and its texture list, the color strategy, and last the type budget as numbers: name at most 20% of the canvas width, symbol at most 10%.

**Inspect.**
- Measure the name and the symbol against the canvas width; both stay within their caps.
- The silhouette is recognizable and centered with wide margins.
- At least three different cell textures are visible; color sits on a minority of cells.
- The background shows texture and is not flat white.
- Name text matches `brief.md` letter by letter.

**Usual failure.** Type grows large and loud. Repeat the caps as numbers and name the typeface; adjectives such as "small" are not enough.

## C. Ensemble poster from references

**Use when** the user has several reference images (characters, team members) and wants one cinematic group poster.

**Look.** A heroic group with depth and hierarchy: central figures in the foreground, others layered behind, seen from a low upward angle. A dramatic backdrop — storm sky, skyline or open space — with strong key light and rim light on the figures.

**Slots.** `CHARACTER LIST` (one line each: name, reference file, depth tier), `BACKDROP`, `TITLE TEXT` (optional, spelled out).

**Block shape.** Short. The list of characters with their tiers, the camera angle, the backdrop and the lighting. Long detailed prompts lowered adherence in the source test; shorter ones held.

**Inspect.**
- Count the figures; the number equals the character list.
- Each figure matches its own reference; none merged, swapped or missing.
- No extra person appears.
- Title text, if any, is spelled as in the brief.

**Usual failure.** Consistency falls as reference images are added: characters change, vanish or appear uninvited. Run it in stages (two or three characters, then add), set the run budget up front, and count figures in every output.

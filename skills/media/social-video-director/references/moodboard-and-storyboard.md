# Moodboard and Storyboard separation

`moodboard.md` and `storyboard.md` are **two separate files and two separate confirmation gates**:

1. **`moodboard.md` (Step 3 — BEFORE the Hook):** The episodic artistic, visual, and sensory direction layered *above* `brand-dna.md`. It shapes how the hook feels, how the voice is modulated, and what visual world the video inhabits.
2. **`storyboard.md` / `REVIEW.md` (Step 6 — AFTER the Script):** The concrete, second-by-second temporal execution plan (`1080x1920`) mapping audio, stage, overlays, safe zones, and cuts.

Never merge them into one step, and never write hooks before the human confirms `moodboard.md`.

---

## Part 1: `moodboard.md` (Artistic & Sensory Layer Above DNA)

While `brand-dna.md` holds the brand's permanent identity, each video has its own emotional temperature. `moodboard.md` defines how *this specific piece* bends or accents the base DNA:

| Field | What to write |
|---|---|
| **Core Sensation (Vibe)** | How the viewer should feel in the first 3 seconds and across the piece (e.g., *late-night debugging urgency*, *calm surgical precision*, *playful myth-busting provocation*) |
| **Voice & Cadence Modulation** | How this video modulates `Voice DNA`: faster/dryer cuts, conspiratorial closeness, or high-contrast punchlines |
| **Visual & Lighting Direction** | Framing style (tight macro, handheld desk POV, split two-tab stage, dark 3b1b canvas), lighting contrast, and texture |
| **Palette & Type Accent** | Which color from `brand-dna.md` leads this piece, how the accent color is triggered on emphasis words, and headline weight/treatment |
| **Motion Energy Override** | Whether this video runs at the brand's base motion archetype or borrows a sharper/calmer tempo (e.g., `energetic` hook slam into `corporate` clarity) |
| **Visual & Sonic Anchors** | 2–3 concrete reference cues (B-roll motifs, UI artifacts, sound design/SFX anchors like crisp keystrokes, bass drop, or dead-air pause) |

Wait for the human's confirmation or edits on `moodboard.md` before generating Hook Triads in Step 4.

---

## Part 2: `storyboard.md` and `REVIEW.md` (Second-by-Second Execution)

Once `script.md` is approved, translate the 3-track beats and the confirmed `moodboard.md` into `<out>/storyboard.md`:

### 1. Header & Brief Block
Include the 8-line `## Brief Block` (from `brand-dna.md`, including any episodic modulation from `moodboard.md`), target duration, `1080x1920` (`30 fps`) resolution, and safe-zone box (`x=108..900, y=250..1500`).

### 2. Second-by-Second Storyboard Table
Cover the entire arc from `0.0s` to the final frame without gaps:

| Panel / Beat | Time (`start–end s`) | Visual Stage (Camera / Screen / B-Roll / Generative) | On-Screen Text & Graphic Construction | Motion (`build / breathe / resolve` + GSAP eases) | Audio / Speech & Sound Anchors | Editable Target (Prop / Component / Asset) |
|---|---|---|---|---|---|---|
| `B01 (Hook)` | `0.0–2.8s` | Tight desk framing; terminal error visible at `0.0s` | Headline `"300 GiB NO CELULAR"` (`104px`, accent on `300 GiB`) | Enter at `0.15s` with `expo.out`; emphasis pulse on `300 GiB` | Spoken hook + low percussive thud at `0.15s` | `HookScene.tsx` (`headline`, `accentWord`) |

### 3. Speech-Cut Ledger (when editing raw camera/screen footage)
Review the full source recording for false starts, accidental repetitions, and dead air. Record every cut candidate so edits remain reversible:

| Cut ID | Source Interval | Before / Removed / After | Destination Join (`s`) | Action (`proposed / applied / kept`) | Reason & Affected Layers |
|---|---|---|---|---|---|

**Cut rules:**
- Distinguish accidental stumbles from rhetorical repetition or honest admissions of failure (real friction often anchors retention — keep it when it serves the story).
- Inspect both sides of every splice: full words, breathing tails, acoustic continuity, facial/gesture continuity, and overlay timelines.
- **Never alter source footage color:** No LUTs, color filters, or silent HDR-to-SDR tone mapping on camera skin tones.
- **Never cover a face** with captions, cards, or logos.

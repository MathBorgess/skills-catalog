# Moodboard and Slide/Visual Storyboard separation

`moodboard.md` and `storyboard.md` are **two separate files and two separate confirmation gates**:

1. **`moodboard.md` (Step 3 — BEFORE the Hook):** The episodic editorial, artistic, and sensory layer *above* `brand-dna.md` and `voice-dna`. It defines the reading atmosphere, voice modulation, and visual direction before any hook or slide is written.
2. **`storyboard.md` (Step 6 — AFTER the Copy):** The concrete slide-by-slide or visual card specification mapping layout, typography hierarchy, safe margins, and asset handoffs.

---

## Part 1: `moodboard.md` (Editorial & Sensory Layer Above DNA)

Write `<out>/moodboard.md` with these fields and confirm with the human before Step 4:

| Field | What to write |
|---|---|
| **Reading Atmosphere (Vibe)** | The immediate impression of the piece (e.g., *field-notebook candor*, *high-contrast editorial manifesto*, *calm architectural blueprint*) |
| **Voice & Cadence Modulation** | How this post bends `Voice DNA`: sharper staccato openings, dry technical precision, or narrative intimacy |
| **Visual & Layout Direction** | Visual medium for the piece (typography-led brutalist slides, annotated code/UI captures, editorial photography, or text-only rhythm) |
| **Palette & Type Accent** | Dominant background/text pairing from `brand-dna.md` and how the accent color highlights the single key word on cover/milestone slides |
| **Visual Anchors** | 2–3 concrete visual motifs (e.g., real terminal diff, hand-drawn arrow, two-column comparison card) |

---

## Part 2: `storyboard.md` (Slide-by-Slide / Visual Specification)

After `post.md` is approved in Step 5, write `<out>/storyboard.md` to map the visual execution:

### Canvas & Safe Margins
- **Instagram / LinkedIn Carousel:** `1080 x 1350` (`4:5` portrait, default) or `1080 x 1080` (`1:1`).
- **Safe Margins:** Keep all text and critical visuals inside `x = 90..990, y = 110..1240` (clear of carousel pagination dots, top header, and corner badges).

### Slide / Card Table

| Slide / Card ID | Role (`Cover / Escalation / Proof / CTA`) | On-Slide Headline (`2–6` words, accent word marked) | On-Slide Body (`<= 28` words) | Visual Anchor / Diagram / Asset | Downstream Tool (`prettify / poster-design / campaign-identity-grid / manual`) |
|---|---|---|---|---|---|
| `S01 (Cover)` | First-Fold Hook | `"O CUSTO OCULTO DO CONTEXTO"` (accent: `CUSTO OCULTO`) | "Por que colar arquivos inteiros degrada a decisão do agente." | Split diagram: bloated prompt vs. surgical excerpt | `prettify` |

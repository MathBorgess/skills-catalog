# Video & Motion Graphics Pipeline (3b1b Style)

A structured workflow for generating discardable, high-clarity explainer videos using TypeScript motion graphics (Remotion or Motion Canvas), local Kokoro ONNX narration, and ffmpeg assembly.

## Visual Aesthetic (3Blue1Brown)

- **Canvas & Tone**: Background `#0f172a` (Slate-900) or `#09090b` (Zinc-950).
- **Geometric Clarity**: Distinct geometric shapes, vector axes, and transform animations.
- **Purposeful Motion**: Motion is only used when the underlying mechanism evolves over time. Every movement signals a state change or mathematical relationship.
- **Typography**: Clean monospace readouts for values and clear sans-serif for labels. High-contrast white (`#f8fafc`) and neon accents (`#38bdf8`, `#818cf8`, `#34d399`).

---

## 4-Step Pipeline

```
1. Scene Script (STE-lite) → 2. Kokoro Audio → 3. Motion Code (Time-Locked) → 4. ffmpeg Multiplex
```

### Step 1: Scene Breakdown
Break the mechanism into 3 to 6 chronological scenes. Each scene has:
- `scene_id`: e.g. `01-intro`, `02-transform`, `03-result`.
- `narration`: Exactly 1–3 short STE-lite sentences.
- `visual_action`: The geometric or state transformation occurring during that narration.

### Step 2: Audio Synthesis via Kokoro ONNX

Verify if `kokoro_onnx` is installed:
```bash
python3 -c "import kokoro_onnx, soundfile" 2>/dev/null && echo "OK" || echo "MISSING"
```

If **MISSING**, recommend installation to the user:
```bash
uv pip install kokoro-onnx soundfile
# or
pip install kokoro-onnx soundfile
```
*Fallback*: If the user chooses not to install Kokoro now, calculate scene durations using an estimated speaking rate (~140 words per minute) and produce a silent video accompanied by a `.srt` subtitle file.

When installed, synthesize per-scene `.wav` files using a small inline Python script:
```python
from kokoro_onnx import Kokoro
import soundfile as sf

kokoro = Kokoro("kokoro-v0_19.onnx", "voices.bin")
samples, sample_rate = kokoro.create(
    "The broker validates incoming packets before routing.",
    voice="af_bella",
    speed=1.0,
    lang="en-us"
)
sf.write("scene_01.wav", samples, sample_rate)
```
Read the duration of each `.wav` file (`ffprobe -i scene_01.wav -show_entries format=duration -v quiet -of csv="p=0"`).

### Step 3: Motion Graphics Animation (Remotion / Motion Canvas)

**Crucial Timing Rule**: Audio duration dictates visual duration.
```ts
const FPS = 30;
const scene01DurationFrames = Math.ceil(audioDurationSeconds * FPS);
```

In Remotion or Motion Canvas:
- Sequence each visual scene to match its exact audio duration.
- Apply `spring` or cubic bezier easing (`[0.25, 0.1, 0.25, 1]`) to geometric movements.
- Keep coordinate axes and persistent labels stable across scene boundaries.

### Step 4: Multiplexing with ffmpeg

Merge the rendered animation and synchronized audio tracks:

```bash
ffmpeg -y -i scenes_visual.mp4 -i combined_audio.wav \
  -c:v copy -c:a aac -b:a 192k \
  -movflags +faststart \
  output_explainer.mp4
```

To burn subtitles directly into the video:
```bash
ffmpeg -y -i output_explainer.mp4 -vf subtitles=subtitles.srt output_captioned.mp4
```

---

## Deliverables Checklist

- [ ] Rendered `.mp4` file playable in standard media players.
- [ ] Complete `.srt` subtitle file containing timestamps and scene text.
- [ ] Narration verified for pronunciation and sync against visual transitions.
- [ ] Fallback declared plainly if audio engine was unavailable.

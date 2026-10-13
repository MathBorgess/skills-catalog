# Remotion as the video editor

The owner's decision replaces the HyperFrames backend with Remotion for video-reference, motion-identity and explain-me. It supersedes ADR0003's engine/cache/check behavior and ADR0004's HyperFrames consumer details; the brand motion schema remains.

For a reference-guided edit, the first pass shows REVIEW.md with a0–3s hook, captions and screen elements second by second, assembles the complete editable video with reference behavior and author content, and opens actual Remotion Studio. The human then leads AI-assisted edits. Use1080×1920, protect important content from Instagram overlays and never change source footage color. No compulsory H.264 conversion, transcript/cut gate, pilot or storyboard approval round. An unresolved material dependency still requires a human decision. Export/publication need their own request.

New footage editing uses native React scenes, Sequence and useCurrentFrame. The existing SVG/GSAP explanatory Kit is preserved through a native React adapter that seeks a paused timeline from each frame; audio metadata becomes Sequence/Html5Audio. Generated projects declare exact Remotion/React/GSAP dependencies, installed explicitly. Node drivers use only standard library and subprocesses. Kokoro is called directly through local Python with independent local weights, never through an editor CLI.

The new check loads Remotion compositions and probes first-frame runtime. It does not pretend to enforce the old engine's motion, overlap or contrast checks. Intended assertions remain a review specification, with manual frame/Studio/audio checks. Tests distinguish mocked subprocess contracts from an actual runtime probe. Saved historical envelopes are parseable but never evidence of current engine checks.

The original stays intact. Remotion's server renderer is SDR; do not silently tone-map HDR or promise identical HDR output. Refer to [official HDR behavior](https://www.remotion.dev/docs/hdr). No old production or experimental render is shipped as new editorial content.

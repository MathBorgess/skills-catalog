# MANDATES for every edit and reference use

Load this contract when recovering any reference, preparing an adaptation or editing a production. Copy its operative rules to the independent project’s `MANDATES.md` and include that path plus the full rules in every downstream editor brief. Preserve evidence packets and source media; never rewrite an immutable reference to make it appear compliant.

## 1. iPhone input, color and spoken-word cut review

If the input is from an iPhone, inspect its codec, bit depth, orientation, primaries, transfer function, matrix, range and HDR/Dolby Vision metadata before preparing H.264. Convert a separate copy for compatibility only when color preservation is technically supported. Never alter the source or apply creative grading, LUTs, brightness/contrast/saturation/temperature changes, filters, recoloring or implicit HDR-to-SDR tone mapping to the presenter. A blurred reference-derived background may be treated separately; that is not permission to treat the presenter.

H.264 does not mean Rec.709. Do not remove HDR tags, reinterpret HDR samples as SDR, or claim matching tags prove equal color. If source precision/metadata or the chosen editor cannot be preserved, describe the concrete conflict and ask the human to choose the affected frontier. Keep color preservation unresolved rather than silently overriding this mandate. Inspect the current editor’s actual HDR decode, compositor and output pipeline: an SDR/headless preview or export cannot certify an unchanged HDR result. A compatibility proxy is not the color master.

Transcribe the full speech locally with source timestamps, including uncertain words. Present the transcript and exact proposed source intervals to remove before applying those cuts: silence/pause, mistakes, repeated phrases and filler words such as “tipo”, “cara”, “né”. For each, give the excerpt, reason, evidence/uncertainty and expected effect on the sentence. Do not invent fillers or mistake a meaningful word for one (“the face of my brand” is content). ASR gaps are not verified silence. Protect word attacks, breathing that carries intent, punchlines and audio tails. Keep source/destination clocks explicit. Only apply specifically accepted cuts; retain a review version without cuts and preserve the original.

## 2. Show the plan second by second

Present an explicit hook in 0–3 s. For every production second, give source time/range, spoken words, subtitle/highlight text, visual element/asset, layout, entrance/hold/exit and coupled sound/visual anchors. Include a proposed post caption separately from on-screen subtitles. Report intended emphasis and references without inventing speech or evidence. Retiming a word remaps its caption, graphic and sound links together. Show gaps and uncertain alignment; one row per second does not establish frame-level accuracy.

## 3. Assemble and open HyperFrames Studio for review

Use HyperFrames Studio unless the user explicitly chooses a different editor. Load its entry skill and the relevant current composition contracts. Discover existing runtimes before installing dependencies; pin versions and keep media local. Build a separate review version so existing human edits are preserved. Open the actual Studio, verify media loading and a representative beginning/middle/end, and hand over the editable project plus transcript, cuts and plan. Do not call a static storyboard a Studio preview. Never export, render the final video or publish without the user’s specific instruction; a standing “do not render” remains binding.

## Frame and Instagram safe areas

Use 1080×1920. Keep important text, faces, logos, charts and calls to action away from top, bottom and right-side UI. A conservative starting content rectangle is x=108–900 and y=250–1500; it is a project design margin, not a guaranteed platform measurement. Review the current placement with the user and account for their intended Instagram surface. Backgrounds may bleed; essential information may not. Keep the presenter below cards and subtitles without clipping the important part of the face. Do not change footage color to improve readability; use separate overlay panels/typography instead.

## Delivery status

Record each mandate as applied, proposed, blocked or unverified. Distinguish source preservation, proxy metadata checks, browser appearance review and actual output fidelity. Never promote a technically successful transcode to a color-fidelity claim. Record the human’s exact choice for any color/engine/cut exception; do not author consent yourself.

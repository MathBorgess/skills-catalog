# Analyze sound locally

Load this when distilling audio, resolving a sound/image dependency, or completing an audio layer. The deliverable is a source-timed sound score and an explicit verification status, not just a transcript.

## 1. Discover capability and preserve the clock

Probe FFmpeg/FFprobe, the installed local ASR runtime and model files, RAM, and whether this agent can actually listen. On macOS, probe Swift and SoundAnalysis before adding a dependency. Present any missing model/runtime, approximate download size and purpose to the human before installing it. Keep media local; a model download does not authorize uploading a video. Use an isolated environment and pin model revision/runtime versions. Never enable remote code execution merely to load weights.

Hash the original. Record each stream's start PTS, duration, sample rate and channel count with FFprobe. Decode an unnormalized PCM WAV preserving source rate and channels for sound analysis. Make a separate mono/resampled derivative only when ASR requires it. Preserve extraction arguments, checksums and source-time mapping. Do not replace the stereo master with a 16 kHz speech proxy.

```sh
ffprobe -v error -show_streams -show_format -of json "$input"
ffmpeg -v error -nostdin -i "$input" -map 0:a:0 -vn -c:a pcm_s16le "$audio_wav"
ffmpeg -nostdin -i "$input" -map 0:a:0 -vn -af ebur128=peak=true -f null -
```

Use unique output paths. Compare decoded sample duration with stream/container duration; AAC priming, padding and edit lists can differ. Inspect decoded audio PTS when they disagree. Record uncovered tails and gaps. Do not silently stretch sound or infer silence from absent decoded samples. Crop-relative ASR and classifier times require the source offset; this mapping must also account for timestamp gaps if present.

## 2. Separate three kinds of evidence

| Evidence | What it supports | What it cannot establish alone |
|---|---|---|
| Signal measurement | LUFS, true peak, RMS envelope, channel energy, attack candidates, timing | Sound identity, speaker intent, musical beat |
| Local model prediction | Likely speech/music/effect classes, words and word alignment | Verified transcription, exact effect, calibrated certainty |
| Direct listening with the source | Timbre, role, tail, intelligibility and correspondence | Original plugin, sample library, gain automation or production settings |

Capture a coarse sound map across the entire decoded source, then examine short overlapping windows around important visual changes. Report sound roles separately: speech, musical bed, designed effects, ambience, silence/pause and closing tail. Unknown is a valid role until verified; a low classification score is not proof of absence.

On supported Apple systems, an offline baseline is `SNClassifySoundRequest(classifierIdentifier: .version1)` with `SNAudioFileAnalyzer` and an `SNResultsObserving` observer. Query `knownClassifications`; save all scores and returned `timeRange` values. One-second windows with 50% overlap are a useful starting configuration, not a guarantee of exact onset timing. Check returned coverage, including the final partial window. Do not silently pad and call the padding observed sound.

The built-in classifier runs on-device ([Apple documentation](https://developer.apple.com/videos/play/wwdc2021/10036/)). Treat scores as model outputs, not calibrated correctness probabilities. In local short-form-video trials, speech/music classification was useful for triage, while labels such as zipper, insect and laughter were ambiguous under mixed speech/effects. Never turn such a label directly into an asset request.

## 3. Transcribe and reject bad decoding

Use an installed local speech model with the expected language and word timestamps. Preserve raw output, model revision, parameters, elapsed time and input hash. Disable previous-text conditioning when investigating runaway repetition. Detect repeated phrases, implausible words, zero-length word runs, speech predicted over a music-only candidate tail, and disagreement with on-screen text.

Reject a failed decode explicitly. Retry a bounded interval with overlapping context; reconcile duplicate words and retain uncertain boundaries. Compare a second local model only if available or approved. Caption text can corroborate semantics but cannot prove the spoken words or their timings. Never copy corrected words onto old timestamps without realignment/review. Confidence/log probabilities are diagnostics, not acceptance criteria by themselves.

Distinguish the installed `mlx-whisper` runtime from its model weights. Reuse a working runtime instead of installing it again. For a memory-constrained Apple Silicon machine, test Base first if present; when rapid multilingual speech fails, Small multilingual is a reasonable bounded escalation (about 481 MB of FP16 weights). Select by an actual run's transcript quality, elapsed time and MLX peak memory, not a universal model ranking. A local pilot recovered a repetitive Base failure with Small, but proper names still required review. Keep the failed run for comparison. The [MLX Whisper implementation](https://github.com/ml-explore/mlx-examples/blob/main/whisper/README.md) accepts a local model path and word timestamps; use a pinned downloaded directory and offline mode during inference. ASR still does not describe music or effects.

## 4. Measure attacks, then test relationships

Use roughly 10 ms hops for an RMS envelope and spectral-flux onset candidates; preserve window length, FFT size, peak spacing and threshold. Consonants, plosives and edit clicks also make peaks. An onset detector finds signal changes, not musical beats ([librosa onset documentation](https://librosa.org/doc/0.11.0/generated/librosa.onset.onset_detect.html)). Estimate a beat grid only on a sufficiently long, audibly periodic musical segment; record alternatives such as half/double tempo and leave BPM unknown if they cannot be resolved.

For each important synchronization, keep:

- Audio anchor: verified word start, identified effect attack, or musical beat; plus source time and uncertainty.
- Visual anchor: first change, completion, peak scale or contact; plus source PTS and uncertainty.
- Signed offset: visual anchor minus audio anchor. Separately state the event-start offset required by the CLI relation schema.
- Semantic role and basis: coincidence, plausible emphasis, or reviewed synchronization; list competing nearby attacks.
- Preservation rule: what must move together if the speech, music, copy or graphical format changes.

A nearest peak is only a candidate correspondence. Review the original at normal speed and a bounded excerpt before asserting that a sound belongs to a word or object. Do not use a one-second classification window to claim millisecond sync. Track attack, decay and tail separately; a whoosh can anticipate entry and end on the visual landing.

## 5. Escalate only for a specific ambiguity

If overlapping voice/music blocks judgment, propose local source separation as a derived inspection aid. [Demucs](https://github.com/facebookresearch/demucs) separates musical sources; it does not recover the original editing tracks, and artifacts/bleed remain. Its two-stem vocals mode still performs full separation. Check RAM and download requirements before installing; keep this optional. Mid/side subtraction is also not voice separation and is useless for identical mono channels. Recheck findings against the untouched mix.

## 6. Save without inflating completion

Store measurements, raw predictions, rejected attempts, review clips and a checksum manifest inside the private project. Reference their hashes in analysis provenance. A structural CLI check does not verify external analysis artifacts: verify their manifest separately. New findings create a new immutable analysis revision.

State technical processing coverage separately from semantic/listening coverage. Do not fill the CLI's audio coverage merely because all samples were processed. If direct listening is unavailable, deliver the measured score and a finite review queue with exact intervals/questions; keep required acoustic fidelity incomplete. Each remaining question should name what blocks reuse: words, effect identity, tail, timing, or music role. A render can test a proposed reconstruction only after that proposal is identified as such; it does not validate the original automatically.

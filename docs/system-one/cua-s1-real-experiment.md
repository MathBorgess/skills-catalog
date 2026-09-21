# CUA-S1-real exploratory shadow evaluation (session 01)

Evidence report for the handoff session `01` brief: run the real, published
`cua-ai/cua-s1-forms` checkpoint through the System One runtime introduced by
PR #52, and observe — in shadow only — whether it carries any useful signal
for E1 (handoff capability Nouls) and E3 (shunt RTK Noul). No training, no
fine-tuning, no default/action promotion happened in this session.

**Hypothesis**: a small pretrained option scorer *might* expose useful
lexical/structural signal for skill decisions outside its original
form-filling domain. This is exploratory transfer, not an assumption of
transfer, and negative/neutral evidence is a valid outcome — see
[Recommendation](#recommendation).

## 1. Provenance

| Field | Value |
| --- | --- |
| Repo | `cua-ai/cua-s1-forms` (Hugging Face) |
| Revision | `f54adbf447f4ca6ec259f529ee3f2e3e09f8cc71` — matches the repo's current `sha` at the time of this session; re-verify before reuse in a later session |
| License | MIT |
| `cua-s1-forms.safetensors` | 2,828,784 bytes · sha256 `05954c1caf51c2fb6c13ea4acbfc88a2e7653dea192252bb51dc89e76a356ddc` (matches the Hugging Face LFS object oid independently) |
| `cua-s1-forms.json` | 1,053 bytes · sha256 `62d31e2f9a001a8e9b6f8534c5194d07ebdd3f9d62ef1ac281906622992650ca` |
| `cua-s1-forms.pt` | present upstream (legacy pickle); never fetched, never loaded — `loadCheckpoint()` rejects `.pt`/`.pth`/`.bin`/`.pkl`/`.pickle` by extension before any parsing |
| Upstream source pinned for this session | `trycua/cua` `libs/cua-s1`, latest commit touching that path: `b7f7e2d8714609853a29c7d049140bc46aec0954` (2026-09-18) |
| Architecture (from the sidecar `config`) | `encoder=tinyx`, `width=128`, `rank=128`, `layers=2`, `heads=4`, `context_tokens=224`, `option_tokens=96` — matches the model card exactly |
| Parameters | 706,048 (matches the model card's stated count exactly) |

Both hashes were computed independently (`shasum -a 256`) against freshly
downloaded files and matched the pinned values in `scripts/fetch-cua-s1.mjs`
before this report was written — this is not a claim taken from the model
card.

## 2. Checkpoint format work

`loadCheckpoint(path)` in `skills/{handoff,shunt}/scripts/s1.mjs` (kept
byte-identical, verified by `handoff.test.mjs`) now accepts two encodings
through the same entry point:

- the existing reviewable JSON-tensor fixture (`encoding: "json-tensors"`) — unchanged, all 31 pre-existing `s1-local.test.mjs` assertions still pass;
- the real `.safetensors` + `.json` pair, via a new bounded, dependency-free safetensors reader (`parseSafetensorsHeader`) that validates: 8-byte header length against the file size and a 64 KiB cap, duplicate top-level tensor names (JSON.parse silently drops these, so detection runs on the raw header text before parsing), `dtype === "F32"` only, positive integer shapes, `data_offsets` bounds and exact byte-length-per-shape, and a global tensor-element cap shared with the JSON-tensor path.

Existing `CKPT_LIMITS` (`file_bytes: 8,000,000`, `tensor_elems: 1,000,000`)
already cover the real checkpoint (2.8 MB, 706,048 params) — no limits needed
raising.

Integrity: the sidecar's `state_signature` is recomputed from the raw
safetensors bytes exactly as upstream `cua_s1.checkpoint._state_signature`
does — SHA-256 over canonical JSON of the config, then per sorted tensor name
`[name, "torch.float32", shape]` canonical JSON, then the tensor's raw bytes
straight from the file (no float round-trip). This exact algorithm, including
the `"F32" → "torch.float32"` dtype-string mapping that only appears when a
real `torch.Tensor` reports its own dtype, was confirmed against the real
downloaded checkpoint with a small Python/`safetensors` script before being
ported to JS (see [§4](#4-methodology-caveat-numpy-not-torch)) — it reproduced
the sidecar's `state_signature` bit for bit. The safetensors file's own
embedded `__metadata__` (`format`, `format_version`, `state_signature`) is
also checked against the sidecar, matching upstream's double-check. Unknown or
missing tensor names are rejected (tensor-name-set cardinality must match the
architecture's expected set exactly).

`scripts/fetch-cua-s1.mjs` is the only place this repo talks to the network
for CUA-S1: it downloads both files from the pinned revision, verifies both
SHA-256 hashes, refuses (and deletes the partial download) on any mismatch,
caches under `.cache/cua-s1/<revision>/` (gitignored, never committed), and is
idempotent (a verified cache hit skips the network entirely). It is not part
of `npm run check` or any skill's runtime path.

## 3. Native form-filling positive control

Five hand-built cases in the documented input contract
(`skills/handoff/scripts/fixtures/cua-s1-forms-real/native-corpus.json`),
covering the four action types:

| Case | Options | Argmax (Node = numpy ref) |
| --- | --- | --- |
| `phone-field-empty` | 2 fills + check/click/skip | `fill Tel: (503) 555-0142` |
| `phone-field-already-filled` | same options, value pre-filled | `skip` (matches the README's documented no-op convention) |
| `consent-checkbox-unchecked` | check/click/skip, no document entity given | `skip` |
| `submit-button` | check/click/skip | `click` |
| `distractor-field-no-match` | 2 fills + check/click/skip, no matching entity | `skip` (matches the README's "distractor → skip" convention) |

4 of 5 match this report's own naive pre-registered expectation (the
checkbox case has no document entity in its constructed context, so "skip" is
defensible, not a failure). This corpus is small and hand-built — it
establishes that the pipeline runs correctly and produces sensible-looking
form actions, not a calibration or accuracy claim (the model card's own
99.95%/100% numbers are upstream's, unverified here).

**Node vs. reference**: argmax matches on all 5/5 cases; max per-logit
absolute difference across all cases was `1.14e-5` (well inside the declared
`atol=rtol=1e-3`) — consistent with float32 summation-order noise between two
independent implementations, not a bug.

## 4. Methodology caveat: numpy, not torch

The brief calls for comparing Node against "the official Python loader." The
real upstream loader (`cua_s1.model.load_checkpoint`) requires `torch>=2.2`.
**Torch was not installed in this session.** The host disk had 7.9 GiB free
out of 228 GiB (96% used) and is shared with the main checkout and any other
concurrent worktree sessions (per this environment's own worktree
instructions); a full torch CPU install (with its dependency closure)
commonly runs several hundred MB to over 1 GB, which was judged an unsafe
amount to commit on a nearly-full shared disk for a one-off check. `numpy` and
`safetensors` (51 MB combined, isolated in a throwaway venv) were installed
instead.

What was actually run and cross-checked against the *real* downloaded
weights:

- a from-scratch numpy port (`/tmp/cua-s1-upstream/numpy_ref.py`, not
  committed — scratch only) transliterating
  `libs/cua-s1/python/src/cua_s1/model.py`'s `TinyTransformerScorer` and
  `AttentionHead.forward` equations line-for-line from the fetched upstream
  source, float32 throughout;
- the exact `_state_signature` byte-hashing algorithm from
  `libs/cua-s1/python/src/cua_s1/checkpoint.py`, confirmed to reproduce the
  real checkpoint's `state_signature` bit for bit.

This is **not** literal execution of `torch.nn.TransformerEncoderLayer` /
`torch.nn.MultiheadAttention` — it is a second, independent transcription of
the same published equations, run against the same real weights. It is
meaningfully stronger evidence than checking the JS implementation against
itself, but it is not proof that this repo's JS matches torch's actual fused
kernels (operation order, internal padding-mask handling in edge cases such as
an entirely-empty context string were not exercised here — see
[§8 Unmeasured](#8-unmeasured--remaining)). Treat the "argmax matches for
every case" done-when item as satisfied against this numpy reference, with
true torch-based confirmation **unmeasured** and recommended as the first
follow-up if this experiment continues.

## 5. Performance (this machine, this run)

Node v26.8.1, darwin, measured with `process.hrtime.bigint()` /
`process.memoryUsage()` — no invented or extrapolated numbers.

| Metric | Result |
| --- | --- |
| Load time (5 cold `loadCheckpoint` calls) | 4.2–10.8 ms (first call includes JIT warmup) |
| Inference latency, single `decide()` call, 5 live options (30 repeats) | min 307.5 ms · p50 325.8 ms · p95 392.2 ms · max 428.5 ms · mean 334.4 ms |
| Repeat-run determinism (10× identical input) | bit-identical output every time (no dropout at inference; the runtime never applies `config.dropout`) |
| Process RSS after load + 30 inferences | 141.7 MB |
| Process heap used | 20.6 MB |

The pure-JS attention/encoder loops (no BLAS, no vectorization) make a single
decision noticeably slower than the toy fixture (which is orders of magnitude
smaller). ~330 ms per Noul call is acceptable for an offline shadow
experiment: it would not be acceptable for a synchronous action-mode gate
without further optimization — a fact this report surfaces but does not
attempt to fix, since action mode is out of scope for this session.

## 6. E1 shadow (capability Nouls)

Adapter: `skills/handoff/scripts/s1-form-adapter.mjs`, `ADAPTER_VERSION =
"form-checkbox-v1"`. Each yes/no capability question is re-encoded, before any
case was scored, as a checkbox form element (`ELEMENT Checkbox "<question>"
value="<goal, truncated>"`) with options `["check", "skip"]`, then mapped back
(`check` → yes, `skip` → no). This is the **only** encoding evaluated this
session; a `fill <capability>`-phrased alternative was discussed but not run.

No real historical `decisions.jsonl` existed in this (fresh) environment, so
the corpus is a small, declared synthetic set (12 cases: one clearly-positive
and one clearly-negative goal per capability), not production history. Each
case's `expected` label is this report's own pre-registered guess from the
goal text — **not** a historical owner/graph-gate label, and not treated as
ground truth. Full records (redacted) were appended to
`$TMPDIR/handoff/cua-s1-shadow-observations.jsonl`, a separate file from the
production `decisions.jsonl`; `capabilityScorer`/`predictCapabilities` in
`handoff.mjs` were not called and the live routing path was not exercised.

| Metric | Value |
| --- | --- |
| Cases | 12 (6 capabilities × 1 positive + 1 negative) |
| Abstentions | 0 |
| Agreement with this report's declared (non-ground-truth) expectation | 6/12 = **50%** — chance level for a binary label |
| `p_yes` distribution | exactly `0.000` or `1.000` on every case — the adapter's softmax is fully saturated, never uncertain |

The saturation is itself a finding: the model does not treat this checkbox
framing as ambiguous, it is confidently near-0 on nearly every case
regardless of whether the goal text actually mentions the capability. This
looks like the model falling back to its dominant training prior (the
`cua-s1-forms.json` sidecar's own validation metadata records `skip` as the
largest class, 11,516 of ~22,054 examples) rather than reading the injected
goal text as a form-relevant signal.

## 7. E3 shadow (raw vs. RTK)

Same adapter and encoding, applied to the "must the output reach the model
whole?" question. `GUARDED` (the regex floor, unchanged, imported directly
from `s1.mjs`) is computed independently for comparison only — it was never
overridden and no command's routing changed.

| Metric | Value |
| --- | --- |
| Cases | 10 commands (4 guarded-floor matches: `git diff`, `cat`, `grep`, `rg --files`; 6 non-floor) |
| Abstentions | 0 |
| Agreement with the regex floor on floor-matching commands | 1/4 = **25%** |
| Would-widen-raw-beyond-floor (non-floor command the model called raw) | 1/6 (`npm run build`) — no effect: shadow mode never changes the executed command, and action mode was not run |

25% floor agreement is poor, and directionally it is the *wrong* kind of
disagreement for a security-relevant floor: on 3 of 4 guarded commands the
model would have called them **not** raw (compressible), which is exactly
what the guarded regex exists to prevent regardless of any model's opinion.
This is a concrete illustration of why the floor is immutable, not a
regression — nothing here changed the floor or any executed command.

## 8. Unmeasured / remaining

- True torch-based Python parity (see [§4](#4-methodology-caveat-numpy-not-torch)).
- Empty-context edge-case parity: the internal encoder self-attention's
  "force position 0 visible" behavior (`safe_context_mask[:, 0] = True` in
  upstream `model.py`, used only inside the encoder stack, not at the final
  `AttentionHead`) was read from source and is believed consistent with this
  runtime's existing `encoderStack`/`softmaxLast` fallback, but was not
  exercised by a dedicated empty-string test case this session.
- Real production `decisions.jsonl` history for E1/E3 (none existed in this
  environment) — the shadow corpora above are declared-synthetic, not
  historical, and are reported as such.
- #27 task-cost A/B evidence — unrelated to this session, still unmeasured
  per `docs/system-one/measurement.md`.
- A second adapter encoding (e.g., `fill <capability-name>` phrasing) —
  discussed, not run.
- Calibration, precision, recall, or "better than rules/regex" claims — none
  are made; §6–7 report agreement rates against declared (not historical)
  expectations and against the immutable floor, explicitly not accuracy.

## 9. Constraints respected

- Owner-declared capabilities, the graph gate, and `rules` stayed the default
  everywhere; `predictCapabilities`/`capabilityScorer` in `handoff.mjs` and
  `probeLocal`/`mustReachWhole` in `shunt.mjs` were not modified and were not
  called by this experiment.
- The guarded regex floor (`GUARDED`) is untouched and was only read, never
  overridden.
- `createFormAdapterBackend` is never passed to `setBackend()` and is not
  reachable from either skill's default code path — it exists only in
  `s1-form-adapter.mjs`, called by that file's own harness and by nothing
  else.
- No weights were committed; `.cache/` is gitignored.
- No training or fine-tuning occurred.
- `npm run check` (the default, no-network suite) passes unchanged, including
  every pre-existing `s1-local.test.mjs` assertion against the toy fixture
  (32 checks, none removed or weakened).

## Recommendation

**Redesign the adapter, not an action experiment.** The evidence is genuinely
negative/neutral rather than promising: chance-level (50%) agreement on E1
with saturated (0/1) probabilities, and poor (25%) agreement with the E3
security floor in the direction that would have weakened it if this had been
action mode. That combination — confident but seemingly prior-driven output —
suggests the checkbox encoding is not eliciting the checkpoint's real
form-filling competence (as shown by §3's native-domain positive control,
which does work), rather than that the checkpoint has nothing to offer. Before
spending more shadow-collection effort on `form-checkbox-v1` specifically,
try the discussed `fill <capability-name>` phrasing (closer to the
checkpoint's dominant, best-performing action class) on the same declared
corpus; if that also saturates at chance level, this report's own conclusion
would move to **stop** the transfer experiment rather than collect more
shadow data with a known-weak adapter.

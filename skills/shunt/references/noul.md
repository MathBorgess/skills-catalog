# Local Noul (opt-in)

The guarded regex in `scripts/rtk.mjs` is the **floor**. A matching segment keeps the whole command raw. A local model may only *add* raw commands. It cannot compress a floor match.

## Default

`rules`. Activate with no `--noul` flag. Rewrites are today's regex. The local checkpoint is not loaded.

## Opt-in

```bash
node <skill>/scripts/shunt.mjs activate --rtk --noul=shadow --checkpoint PATH
node <skill>/scripts/shunt.mjs activate --rtk --noul=action --checkpoint PATH
```

`PATH` is a reviewable JSON tinyx checkpoint (`createLocalBackend` in `s1.mjs`, consumed from the shared runtime). `--noul` alone is refused. `--noul-threshold` is an uncalibrated knob in `[0.5, 1]`, default `0.8`. It is not a license.

| Policy | Live rewrite | Local model |
|---|---|---|
| `rules` | regex only | off |
| `shadow` | regex only | scored and recorded; output unchanged |
| `action` | regex, plus raw when `p(yes)` clears the threshold | may add raw; never override the floor |

## Fail open

Abstention, invalid checkpoint, inference error, and `p(yes)` between the thresholds keep the command **raw**. Lossy compression is the unsafe direction.

## Rollback

Activate again without `--noul`. A new activate is a new run. There is no sticky global backend.

## Evidence

The committed toy fixture proves the load and forward path. It is not cua-s1-form-v0 and it is not calibrated. Task-cost evidence is a paired run recorded by `scripts/s1-ab.mjs` — see [ab.md](ab.md).

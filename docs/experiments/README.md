# Experiments

Versioned trials that are **not** part of any skill. Not to be confused with an **experiment skill**, which does ship in `skills/` and is run like any other — the distinction, and what an experiment skill owes, is in [`AGENTS.md`](../../AGENTS.md). A model loading `skills/` must not find a scorer, a checkpoint, or an instruction to call one here. These pages are for people deciding whether a later trial is worth running.

The baseline a scorer has to beat is the reasoned record the skill already writes: `tier`, `size`, `capability_answers`, `needs`, and the verdict and risk stored by `accept`. Trials do not replace that record.

Each trial is one directory, named `YYYY-MM-DD-<subject>-vN`. A new encoding, a new checkpoint, or a new decision site is a new directory. Do not edit a closed trial to make it look better; add the next version beside it.

| Trial | Status | What it decided |
| --- | --- | --- |
| [2026-09-21-cua-s1-forms-v1](2026-09-21-cua-s1-forms-v1/README.md) | pending — not in the skill | The published form checkpoint runs. The checkbox encoding used for E1/E3 does not show transferable signal. No scorer is wired into handoff or shunt. |

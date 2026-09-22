# Experiments

Versioned trials that are **not** part of any skill. A model loading `skills/` must not find a scorer, a checkpoint, or an instruction to call one here. These pages are for people deciding whether a later trial is worth running.

The baseline a scorer has to beat is the reasoned record the skill already writes: `tier`, `size`, `capability_answers`, `needs`, and the verdict and risk stored by `accept`. Trials do not replace that record.

The runtime that can print a proposal in those field names is [`scorers/system-one/`](../../scorers/system-one/README.md). It is not imported by a skill, it does not edit a plan, and `beats_reasoned_record` stays false until a directory in this folder says otherwise.

Each trial is one directory, named `YYYY-MM-DD-<subject>-vN`. A new encoding, a new checkpoint, or a new decision site is a new directory. Do not edit a closed trial to make it look better; add the next version beside it.

| Trial | Status | What it decided |
| --- | --- | --- |
| [2026-09-21-cua-s1-forms-v1](2026-09-21-cua-s1-forms-v1/README.md) | pending — not in the skill | The published form checkpoint runs. The checkbox encoding used for E1/E3 does not show transferable signal. No scorer is wired into handoff or shunt. |

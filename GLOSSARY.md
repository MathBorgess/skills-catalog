# skills-catalog

A public catalog of agent skills turning models into operators and experiments through deterministic procedures, disciplined judgment, and structured workflows.

## Language

### Catalog & Architecture

**Catalog**:
The curated collection of agent skills maintained, tested, and published from this repository.
_Avoid_: toolkit, prompt library

**Skill**:
A self-contained directory with `SKILL.md`, metadata, and references instructing an agent on a specific workflow.
_Avoid_: prompt, system message, macro

**Operator**:
A generic, reusable workflow run to get recurring work done across varying environments and user contexts.
_Avoid_: generic tool, agent script

**Experiment**:
A specific, non-generic workflow built to test an idea and return a measurable finding under controlled variables; leaves the catalog when its question is answered.
_Avoid_: trial (a trial is an un-shipped prototype under `docs/experiments/`)

**Deprecated Skill**:
A retired skill moved out of `skills/` into `deprecated/`, no longer indexed, maintained, or accessible in the catalog.
_Avoid_: disabled skill, inactive skill

**Done-check**:
The final verification checklist at the bottom of a `SKILL.md` specifying conditions that must be satisfied before reporting completion.
_Avoid_: definition of done, conclusion

**Reference**:
Supplementary, concern-specific documentation in `references/` loaded on demand while executing a skill.
_Avoid_: documentation (docs for human maintainers live in `docs/`)

**Scorer**:
A small local model returning a typed decision with a calibrated probability, used where a step is repetitive judgment.
_Avoid_: classifier

### Still Cursor, Living Day (Experiment)

**Frame**:
One of the twelve images and the brief that produced it. Its id is its position in the day; positions are not reshuffled.
_Avoid_: photo, shot

**Invariant Clause**:
The two sentences — the cursor's coordinate, the black non-emitting panel — carried verbatim by every prompt.

**Place**:
Where the laptop was carried and opened for one frame. A variable, floored: at least five distinct places across the twelve.
_Avoid_: treating the room as part of the constant

**Anchor**:
The screen pixel of the MacBook the cursor's tip sits on in all twelve frames, set once in `plan.cursor`.
_Avoid_: an image coordinate

**Composite**:
The step that draws the cursor after generation, projecting the anchor through the homography of the panel's four marked corners.
_Avoid_: asking a prompt for a position

**Opacity Band**:
The reflectivity the panel holds across the series, stated in `optics_clause`. Fails if too-mirrored or too-matte.

**Trace**:
A physical object in the room and its state at one hour.

**Transition**:
A trace's state changing between frames. The collection is made of transitions.
_Avoid_: counting frames as continuity

**Breakage**:
How many transitions the removal of a frame would destroy. A frame at zero is a batch member (deletable without loss).

**Route Capability**:
Whether a generation route can produce an image here: `probed` (proved on this machine), `declared`, or `absent`.

**Blind Pass**:
The judging pass that sees twelve shuffled, unlabelled images and no prompts, rates pillars, and orders the day.
_Avoid_: running them in one pass

**Informed Pass**:
The second judging pass that sees chronology and trace chain and answers collection questions.

**Tau**:
The Kendall rank correlation between the blind pass's ordering and the true chronology.

**Proposal**:
The judge's named defect plus a suggested action. Never an automated modification without owner consent.
_Avoid_: auto-discard, auto-regen

### System One

**Choice / Score / Noul**:
The three decision shapes. **Choice** picks one of N options. **Score** rates against ordered levels. **Noul** returns the probability that the answer is yes.
_Avoid_: modelling non-exclusive requirements as a Choice

**Abstention**:
A scorer declining because no option cleared its threshold. A first-class outcome with a declared destination.

**Floor**:
The rule a scorer replaces, kept as the bound it cannot cross.

**Shadow Log**:
The append-only record of every scorer call opened at decision time and resolved with its outcome when the run closes.

**Free Label**:
An outcome that is itself the answer (e.g. a session blocking on a socket requires `unix-socket`).

**Inferred Label**:
A label the teacher wrote from hindsight artefacts for decisions whose outcome was silent.

**Silent Half**:
Decisions whose failure leaves no trace. Free labels are biased by construction; labelling the silent half is the teacher's job.

**Trivial Baseline**:
The majority answer at a decision site. A scorer that does not beat it has learned nothing.

**Shuffled-Context Control**:
Scoring each option list against the wrong context to test whether option statistics alone dominate accuracy.

**Calibration**:
How closely a scorer's stated probability matches its observed hit rate.

### Evaluation

**Metrics Line**:
One JSON object per run appended by a skill to its history in the OS temp dir.

**Scope Drift**:
A skill doing work its `description` does not claim, or another skill's work.

### Visual Explanation (Explain Me)

**Load-bearing Distinction**:
The singular boundary, difference or mechanism the learner must grasp and explain back.
_Avoid_: general summary, conceptual overview

**STE-lite**:
A controlled structural writing subset (80% of ASD-STE100) enforcing sentences ≤ 20 words (procedures) or ≤ 25 words (descriptions), paragraphs ≤ 6 sentences, active voice, and strict technical term stability without synonyms.
_Avoid_: simple English (STE-lite has strict numeric limits and terminology locks)

**Interactive Explainer**:
A standalone, self-contained single-file HTML document (inlined CSS/JS) allowing real-time parameter exploration via Canvas or SVG controls without build steps.
_Avoid_: web application, widget

**3b1b Style**:
A visual aesthetic using dark slate backgrounds (#0f172a / #18181b), clean geometric transforms, high contrast labels, and motion tied strictly to state transitions.

**Scene-Driven Video**:
A motion graphics explainer (Remotion / Motion Canvas) whose visual timeline is dynamically locked to the exact duration of each audio scene.

**Kokoro Narration**:
Local text-to-speech audio generated per scene via Kokoro ONNX, avoiding third-party cloud API dependencies and dictating video scene timings.

**Explain-Back**:
A targeted diagnostic question testing whether the learner can reconstruct the mechanism without seeing the answer key.

## Deprecated Domains

The domain languages for **Shunt** (outlines, excerpts, edit bypass, run wrapper, recover event) and **Handoff** (session, slot, graph gate, digest, supervisor, child, capabilities, gate run, verdict, risk level, attention matrix, revise round) have been moved to [deprecated/](deprecated/) alongside their retired skill implementations.

## Relationships

- An **operator** skill transfers to anyone; an **experiment** skill tests an idea and leaves a metric behind.
- **Still cursor, living day** locks its plan with a hash at an owner gate; **breakage** is to a collection what a causal dependency is to an engineering graph.
- Every skill writes **metrics lines**; `skills-evaluate` reads them and never the other way around.
- **Scorers** write the **shadow log**; the **teacher** resolves what the outcome left silent; neither ever acts inside an active run.
- **Domain modeling** formalizes terms into `GLOSSARY.md` inline and records non-obvious architecture trade-offs in ADRs.
- **Explain-me** produces standalone visual explanations and controlled STE-lite text; `teach-me` embeds them and owns curriculum, quizzes, and learner state.
- **Interactive explainers** use single-file HTML/CSS/JS without build steps; **scene-driven videos** sync visual timelines to local **Kokoro ONNX** audio clips.

## Flagged Ambiguities

- "Experiment" meant both a **trial** under `docs/experiments/` and a shipped skill whose purpose is to measure — resolved: a **trial** ships nothing and stays unreachable from `skills/`; an **experiment skill** is installed and triggered like any other and earns its place with a number from real runs.
- "Judge" collided with **teacher**, which must never write verdicts — resolved: a **judge** grades artefacts against a declared axis and decides nothing about what runs next; a **teacher** labels past decisions from their outcomes and grades no work.
- "Deprecated skill" vs "Experiment" — resolved: an experiment has an active hypothesis being measured; a deprecated skill is retired work removed from `skills/` to `deprecated/`.
- "Full ASD-STE100" vs "STE-lite" — resolved: full ASD-STE100 requires an English-only 900-word dictionary; STE-lite enforces the structural grammar rules (sentence/paragraph ceilings, active voice, term consistency) language-agnostically.

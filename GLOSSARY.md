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

### Easy to Read

**STE-lite**:
The structural writing core that every reader text obeys in any language: sentence and paragraph ceilings, one idea per sentence, and a locked term for each defined concept. Narration has a lower sentence ceiling than written text, because a listener cannot reread. Its canonical home is the `easy-to-read` skill.
_Avoid_: simple English (STE-lite has strict numeric limits and terminology locks); calling a language profile "STE-lite"

**Language Profile**:
The layer of grammar and word rules added on top of STE-lite for one language, the language of the text. English follows ASD-STE100; Brazilian Portuguese follows ABNT NBR ISO 24495-1 and the Senado's plain-language style. A language without a profile gets the core alone.
_Avoid_: dictionary (a profile carries a curated word list, not the ASD dictionary)

**Reader Text**:
Any text written for a person to read: a chat reply, a document, a note, a summary, a PR or issue body. While easy-to-read is active, every reader text in the session follows STE-lite and the language profile of its language.

**Exempt Span**:
A part of a reader text that the rules never rewrite: code, commands, file paths, identifiers, URLs, quoted source text, and anything inside backticks or a code fence. It stays byte for byte, even when it breaks a rule.

### Visual Explanation (Explain Me)

**Load-bearing Distinction**:
The singular boundary, difference or mechanism the learner must grasp and explain back.
_Avoid_: general summary, conceptual overview

Explain-me writes every text, label and narration under **STE-lite** and the **Language Profile** of the Requester Language. Both terms are defined under Easy to Read, the skill that owns them.

**Interactive Explainer**:
A standalone, self-contained single-file HTML document (inlined CSS/JS) allowing real-time parameter exploration via Canvas or SVG controls without build steps.
_Avoid_: web application, widget

**3b1b Style**:
The default look of explain-me: one central object that is drawn, written and transformed on a near-black field in the manim palette, with no interface chrome on screen. A design spec may replace any part of it.
_Avoid_: dashboard, slide, card grid (a frame with a header bar, panels or bullet lists is not 3b1b style)

**Scene-Driven Video**:
A narrated motion explainer rendered by HyperFrames from an HTML composition whose motion is locked to the narration's timing.
_Avoid_: slideshow, frame buffer

**Requester Language**:
The language every word of an explanation is delivered in — narration, on-screen text, subtitles, glossary, explain-back. It is the language of the request message, unless the user names another or the caller passes one.
_Avoid_: locale, voice language (the voice follows the requester language, never the other way round)

**Skill Home**:
The one per-machine directory, outside any project, where explain-me keeps what it reuses across runs and what each run produces. Every agent and every install shares it.
_Avoid_: workspace, project cache, `.venv` in the repository

**Run**:
One explanation produced end to end, kept as its own folder under the skill home; its deliverables stay there unless the user or the caller names a destination.

**Kokoro Narration**:
Local text-to-speech in the requester language, synthesised one beat at a time on the machine, with no cloud voice and no sign-in. The narration's measured length sets the video's timing, never the reverse.
_Avoid_: voiceover (implies a cloud or human voice)

**Orientation**:
The frame shape of a video: landscape (16:9) for players, lessons and slides, or portrait (9:16) for Reels, Shorts and TikTok. It comes from the request; with no cue, landscape.
_Avoid_: format (a format is video, SVG, interactive HTML or text; orientation only applies to video), aspect ratio (say landscape or portrait)

**Safe Zone**:
The part of the frame where content may sit, clear of the margins and, in portrait, of the platform's own buttons and captions laid over the video. It is a design token, so a brand may move it.
_Avoid_: margin (a margin is only the edge; the safe zone is the whole usable box)

**Burned Captions**:
Captions drawn into the video frame itself, chunk by chunk with the narration, in the design's type and colours. On by default in portrait, off in landscape; the `.srt` ships either way.
_Avoid_: subtitles (the `.srt` file), on-screen text (the stage's own labels)

**Beat**:
One narration sentence and the motion keyed to it — the unit that voice, motion and subtitles share. A scene is a run of beats.
_Avoid_: scene (a scene groups beats), cue, slide

**3b1b Kit**:
The fixed set of motion primitives explain-me ships — draw, write, morph, move, camera, indicate, count, grow, fade — that every agent composes beats from, so the motion's floor does not depend on which agent wrote it.
_Avoid_: animation library, free-form tweens

**Motion Gate**:
The check a video must pass before it is rendered: nothing on screen stays still longer than the static-hold limit, and each beat's subject appears on time. The default limit is two seconds, inherited from HyperFrames. A design spec may loosen the limit but never switch the gate off, and every loosened default is named in the delivery.
_Avoid_: preview review, eyeballing the render

**Design Spec**:
The editable file of visual and narration tokens — palette, type, preferred motion with worked examples, reference images, motion timing, voices — that every format (video, SVG, interactive HTML) reads. A run resolves it in layers, key by key: an explicit spec, then the project's brand spec, then the user's own, then the skill's default. Changing the style means editing a spec, never a single artefact.
_Avoid_: theme, per-video styling

**Brand Spec**:
A project's own design spec (`frame.md`, `design.md` or `DESIGN.md`) describing a brand that explain-me can adopt. It is offered at intake and may override any default of the skill, including the 3b1b style.
_Avoid_: brand kit, template

**Explain-Back**:
A targeted diagnostic question testing whether the learner can reconstruct the mechanism without seeing the answer key.

### Media Direction

**Brand DNA**:
The durable record (`brand-dna.md`) of a brand and creator's identity across three blocks — Visual & Brand Core, Voice DNA, and Motion & Guardrails — where every line is marked `[known]` with its source or `[inferred]` until the human confirms it. Shared across all skills in `skills/media/`.
_Avoid_: brand kit, unverified style prompt

**Voice DNA**:
The spoken and written cadence layer inside `brand-dna.md` specifying three tone words, sentence-length burstiness (oscillating short `<= 5`-word punches with longer structural clauses), vocabulary grounding rules, and explicit banned AI clichés.
_Avoid_: generic tone of voice, persona bio

**Moodboard**:
The episodic artistic, visual, and sensory direction (`moodboard.md`) created *above* `brand-dna` and `voice-dna` for a single video, post, or campaign. It defines the piece's core sensation, intentional modulations over the base DNA, and visual/sonic anchors, and requires human confirmation *before* the hook or script is written.
_Avoid_: merging with storyboard, permanent brand spec mutation

**Hook Triad**:
The indivisible `0–3 s` opening unit of a short-form vertical video, synchronizing a Visual Hook (`0–1.5 s`), an On-Screen Headline (`2–6` words passing the Mute Test), and a Spoken Opening (zero greeting filler) under a named psychological trigger.
_Avoid_: spoken-only hook, transcript repetition on screen

**First-Fold Hook**:
The opening unit of a written post or carousel visible before any swipe or click (`Slide 1` headline + sub-hook + visual cue for carousels; `Lines 1–2` for text posts).
_Avoid_: intro paragraph, warm-up preamble

**Retention Beat**:
The `2–4 s` unit of progression in a short-form script (`script.md`) or block/slide sequence (`post.md`), locking one grounded concept and three parallel tracks (`Audio/Speech`, `Visual Stage`, `Overlay/Motion`).
_Avoid_: unstructured paragraph, scene without per-beat tracks

**Concept Grounding**:
The rule that no beat or slide may rely on a concept unless the audience brought it as a declared prerequisite or an earlier beat established it.
_Avoid_: forward reference, unexplained jargon

**Storyboard**:
The temporal and spatial execution plan (`storyboard.md` / `REVIEW.md`), separate from `moodboard.md`, translating approved beats and moodboard direction into a second-by-second `1080x1920` vertical score (or slide-by-slide layout) with safe zones, motion `Brief Block`, and reversible speech-cut ledger.
_Avoid_: moodboard, vague shot list without timing

**Viral RAG**:
The curated, queryable repertoire of hook triggers, format archetypes, retention mechanics, and project-local reference cards (`<project>/references/viral-rag/`) consumed by `social-video-director` and `social-post-director`.
_Avoid_: heavy frame-by-frame video ingestion during ideation

**Inspect by Counting**:
The final verification step (`review.md`) that judges a media package or render through a numeric *Expected / Seen* table (word ceilings, hook onset seconds, burstiness span, static-hold limits, safe-zone breaches, cliché count), changing one variable per revision round.
_Avoid_: subjective impression review

### Prototype Exploration

**Prototype**:
A temporary artifact used to answer an explicit design question, with the relevant alternatives or state visible to the person exploring it.
_Avoid_: production implementation, visual mockup (when the question requires interaction)

**Prettify**:
The complete workflow connecting a prototype's question, its creation or reuse, and an intentional visual treatment under a shared design spec.
_Avoid_: cosmetic pass (alone; prettify also owns the prototype exploration)

**Question Result**:
The evidence-based answer to the question a prototype was built to explore, including an inconclusive answer when the evidence is insufficient.
_Avoid_: visual approval, runnable artifact (neither alone answers the question)

**Visual Assessment**:
The judgment of a rendered artifact's visual decisions against its design spec and intended impression.
_Avoid_: question result, detector score (neither alone establishes visual appeal)

**Briefing**:
The definition of a visual assignment's question, audience, message or task, constraints and intended artifact.
_Avoid_: design spec (the assignment and the durable visual identity are different concepts)

**Low Fidelity**:
A visual exploration of structure, hierarchy and sequence that leaves detailed appearance open to change.
_Avoid_: unfinished high-fidelity design, text-only direction

**High Fidelity**:
A reviewable visual representation close to the intended final appearance, following the chosen direction and design spec.
_Avoid_: delivery (visual review and a usable final artifact are different milestones)

**Stage Skip**:
The human's explicit choice to bypass an intermediate design checkpoint, accepting less control before the result is delivered.
_Avoid_: automatic approval, omitted verification

**Reference Acceptance**:
The human's decision to use a proposed visual reference for the current artifact, without by itself making that direction part of the durable design spec.
_Avoid_: design spec update, permanent brand decision

### Morphological Project Selection

**Seed Idea**:
An initial project concept whose possibilities help identify dimensions and alternatives for exploration.
_Avoid_: project candidate, selected project

**Morphological Box**:
A set of project dimensions, each with distinct alternatives, that defines the space of possible combinations.
_Avoid_: list of ideas, candidate ranking

**Morphological Path**:
A combination containing one alternative from every dimension of a morphological box.
_Avoid_: project proposal, variation (unqualified)

**Project Candidate**:
A developed project proposal interpreting one morphological path for a specific audience and use.
_Avoid_: morphological path, commercial recommendation, proposal (unqualified)

**Commercial Recommendation**:
A comparative judgment about a project candidate's commercial potential and the evidence still needed, including a judgment that none currently merits advancement.
_Avoid_: validated business, observed revenue, investment approval

**Revenue Hypothesis**:
An untested claim about who would pay, for what outcome, at what price and with which economic benefit.
_Avoid_: revenue, commercial validation, realized return

**Candidate Revision Round**:
An iteration in which every proponent updates its project candidate in response to criticism while retaining its morphological path.
_Avoid_: reroll, winner-only refinement

**No-Go Decision**:
A recommendation not to advance any reviewed project candidate under the current evidence, with the reasons and evidence needed to reconsider.
_Avoid_: missing result, proof that no market exists

**Competitive Finding**:
A source-supported observation about an existing alternative that changes the assessment of a candidate's proposed value or differentiation.
_Avoid_: assumed absence of a feature, catalog label alone, measured advantage

## Deprecated Domains

The domain languages for **Shunt** (outlines, excerpts, edit bypass, run wrapper, recover event), **Handoff** (session, slot, graph gate, digest, supervisor, child, capabilities, gate run, verdict, risk level, attention matrix, revise round), **Motion Identity** (standalone motion grilling and proof), and **Animation Direction** (`co-direct-animation`'s five-gate Flow pipeline) have been moved to [deprecated/](deprecated/) alongside their retired skill implementations. Their motion archetypes, role eases, kinetic type rules, and moodboard/storyboard progression are now absorbed into **Media Direction** (`brand-dna`, `social-video-director`, `social-post-director`). Meanwhile, `video-reference` remains in *analysis* status while `viral-rag` serves as the active reference engine for media direction.

## Relationships

- An **operator** skill transfers to anyone; an **experiment** skill tests an idea and leaves a metric behind.
- **Still cursor, living day** locks its plan with a hash at an owner gate; **breakage** is to a collection what a causal dependency is to an engineering graph.
- Every skill writes **metrics lines**; `skills-evaluate` reads them and never the other way around.
- **Scorers** write the **shadow log**; the **teacher** resolves what the outcome left silent; neither ever acts inside an active run.
- **Domain modeling** formalizes terms into `GLOSSARY.md` inline and records non-obvious architecture trade-offs in ADRs.
- **Easy-to-read** owns **STE-lite**, the **language profiles** and their linter; explain-me ships byte copies so it installs and runs alone, and a contract test fails when the copies differ.
- While **easy-to-read** is active, every **reader text** follows STE-lite and the profile of its language, and every **exempt span** passes through unchanged.
- **Explain-me** produces standalone visual explanations and controlled STE-lite text; `teach-me` embeds them and owns curriculum, quizzes, and learner state.
- **Interactive explainers** use single-file HTML/CSS/JS without build steps; **scene-driven videos** key every **beat**'s motion to its **Kokoro narration**, and pass the **motion gate** before they render.
- **Orientation** sets the frame and its **safe zone**; in portrait the kit draws **burned captions** in a band of their own, and the **motion gate** watches the stage, never the captions.
- A **design spec** styles every format; a **brand spec** may replace any 3b1b default, but never switches the motion gate off or changes the **requester language**.
- **STE-lite** is shared by every language; a **language profile** adds the rules of one language on top of it.
- In `skills/media/`, **`brand-dna`** establishes the durable identity, **Voice DNA**, and motion baseline (`[known]` vs. `[inferred]`) once per project; every media skill (`social-video-director`, `social-post-director`, `brand-campaign-shots`, `campaign-identity-grid`, `poster-design`, `illustration-style-remix`) reuses it without re-interviewing the owner.
- In **`social-video-director`** and **`social-post-director`**, the **Moodboard** sits *above* `brand-dna` as an episodic sensory and artistic layer confirmed *before* the **Hook Triad** (or **First-Fold Hook**), whereas the **Storyboard** comes *after* the **Retention Beats** to map second-by-second or slide-by-slide execution, verified by **Inspect by Counting**.

## Flagged Ambiguities

- "Experiment" meant both a **trial** under `docs/experiments/` and a shipped skill whose purpose is to measure — resolved: a **trial** ships nothing and stays unreachable from `skills/`; an **experiment skill** is installed and triggered like any other and earns its place with a number from real runs.
- "Judge" collided with **teacher**, which must never write verdicts — resolved: a **judge** grades artefacts against a declared axis and decides nothing about what runs next; a **teacher** labels past decisions from their outcomes and grades no work.
- "Deprecated skill" vs "Experiment" — resolved: an experiment has an active hypothesis being measured; a deprecated skill is retired work removed from `skills/` to `deprecated/`.
- "Full ASD-STE100" vs "STE-lite" — resolved: full ASD-STE100 requires an English-only dictionary; STE-lite is the language-agnostic structural core, and the grammar and word rules of one language live in its **language profile** (ASD-STE100 for English; ABNT NBR ISO 24495-1 and the Senado style for Brazilian Portuguese).
- "Requester Language" vs "the language of the text" — resolved: easy-to-read picks the **language profile** from the language of the text, which is the language of the request unless the user or a caller names another; in explain-me that language is the **Requester Language**, so both skills pick the same profile.
- "3b1b style" meant both a fixed palette and a way of moving — resolved: it is explain-me's default look, motion grammar included; a **brand spec** may replace any part of it, and only the **motion gate** and the **requester language** stay fixed.
- "Moodboard" vs "Storyboard" vs "Brand DNA" — resolved: **`brand-dna`** is the durable brand, voice, and motion baseline across pieces; **`moodboard`** is the episodic artistic, visual, and sensory layer above `brand-dna` confirmed *before* the hook; **`storyboard`** is the concrete temporal/spatial execution table built *after* the script.

# skills-catalog

Skills that keep an expensive model on judgment and move I/O, dispatch and measurement into scripts.

## Language

### Shunt

**Outline**:
A capped map of an over-threshold file (headings, symbols with `path:line`) written by a script instead of reading the file.
_Avoid_: summary (a summary is written by a small model; an outline is deterministic)

**Excerpt**:
A line span of a file copied to disk so the model reads only that span. Expected use, not a failure.

**Edit bypass**:
Permission to read a file marked as a patch target in full, up to a ceiling.

**Run wrapper**:
A command run whose raw output goes to disk and whose filtered view reaches the model; the raw log path is its recovery path.

**Recovery path**:
The direct route back to the uncompressed data (an excerpt span, a raw log) without re-running or re-reading everything.

**Recover event**:
The model had to take the recovery path because compression dropped what it needed. The signal that compression failed.
_Avoid_: counting excerpts as recover events

**RTK mode**:
`off`, `guarded` or `full` — whether a run's shell output goes through RTK. **Guarded** never sends diffs, code or search to RTK; **full** sends everything and is an experiment arm.
_Avoid_: "rtk on" (say which mode)

### Handoff

**Session**:
One unit of the cut work, briefed and run by a child agent in its own worktree.

**Slot**:
A provider × account with its quota windows; may hold several **lanes** billed separately.

**Graph gate**:
The single owner approval of the plan — graph, slot/lane, model and effort per session — reached by grilling rounds and locked by the plan's hash.
_Avoid_: approval (alone; there is only one gate)

**Override**:
A model or effort the owner set on a session instead of the derived default.

**Digest**:
The batched per-session outcome `dispatch` returns, carrying each finished session's result block.

**RTK via**:
How a child gets RTK: `hook` (a Claude child's scoped PreToolUse) or `prompt` (the instruction appended for a hookless CLI).

**Settle window**:
Seconds `dispatch` keeps waiting after the first actionable event to coalesce others before returning. A tunable.

**Supervisor**:
The parent session: it cuts the graph, writes briefs, dispatches, and reads digests. It is the system's bottleneck, so every design question about cost is asked as "does this take work off the supervisor?".
_Avoid_: orchestrator, parent agent (one name per role)

**Child**:
The agent running one **session** in its own worktree. It has no supervisor context and never reads another child's brief.

**Capabilities**:
The sandbox facilities a session requires — `network`, `unix-socket`, `git-write`, `pty`, `disk-write`, `high-memory`. The supervisor answers each one yes or no in `capability_answers`. `needs` is exactly the yeses. `route` excludes any provider whose sandbox blocks one of them, and refuses the plan when an answer is missing or the two fields disagree. A **requirement of the work**, never a permission granted to it: you grant a permission, you discover a requirement.
_Avoid_: permissions; a second, predicted list

**Reasoned decision**:
The typed answer a scorer would have returned, written by the supervisor or the child while no scorer is in the skill. `route` and `accept` check the shape. A later scorer may fill the same fields and may not cross the floor.

**Gate run**:
The `verify` commands executed **by the dispatcher** in the session's worktree after the child exits. A child's pasted output is a claim; the gate run is the evidence.
_Avoid_: tests (a gate run is whatever the plan declared, and it is not the child's own run)

**Accepted**:
A session whose gate run passed and whose **verdict** cleared. Only an accepted session unblocks its dependents.
_Avoid_: done (`done` means the child wrote a result file saying so — it is a claim, not acceptance)

**Verdict**:
The typed acceptance decision over a finished session: `approved`, `revise`, `rejected` or `escalate`. Produced from artefacts by the dispatcher, never by the session's own author.

**Risk level**:
The ordered consequence class of what a session changed — `routine`, `notable`, `consequential`, `critical`. It answers who has to look, not whether the work is correct.

**Attention matrix**:
The table that turns a **verdict** and a **risk level** into one action. Risk gates who looks; verdict gates where it goes.

**Revise round**:
One relaunch of a session against its existing worktree with a **named defect**, under a fresh brief and a fresh session. Capped at one; the cap is a constant, not a setting.
_Avoid_: retry (a retry repeats the attempt; a revise round states what was wrong)

**Named defect**:
The observed failure a revise round must carry — gate output, a diffstat fact, a missed `Done when` item. Evidence, never the supervisor's diagnosis. A revise without one is an **escalation**.

**Escalation**:
Work handed back up because no automatic path is safe: a `critical` risk, a rejected brief, or a spent revise round. Escalation is a state a session can leave, not an ending.

**Teacher**:
The offline batch process that labels past decisions from their outcomes, after a run closes. Never the supervisor, never a child, never inside a live run.
_Avoid_: judge, reviewer (a teacher writes labels, never verdicts)

### Still cursor, living day

**Frame**:
One of the twelve images and the brief that produced it. Its id is its position in the day; positions are not reshuffled.
_Avoid_: photo, shot (a frame is a brief and an artefact, and the collection is judged on both)

**Invariant clause**:
The two sentences — the cursor's coordinate, the black non-emitting panel — carried verbatim by every prompt. Plan-level by construction: a frame that writes its own has already broken The Constant.

**Trace**:
A physical object in the room and its state at one hour. **Transition**: that state changing between frames. The collection is made of transitions; the frames are where they are observed.
_Avoid_: counting frames as continuity

**Breakage**:
How many transitions the removal of a frame would destroy. A frame at zero is a **batch member** — deletable without loss, which is the difference between a collection and twelve files in a folder.

**Route capability**:
Whether a generation route can produce an image here: `probed` (proved on this machine), `declared` (a CLI asked to reach an image model it may not hold), `absent` (refused). A requirement discovered of the work, never a permission granted to it.

**Blind pass**:
The judging pass that sees twelve shuffled, unlabelled images and no prompts, rates each against the pillars, and orders the day. **Informed pass** is the second, which sees the chronology and the trace chain and answers the collection questions.
_Avoid_: running them in one pass (an informed judge cannot un-know the order)

**Tau**:
The rank correlation between the blind pass's ordering and the true chronology. It measures whether The Variable survived generation, not whether any frame is good.

**Proposal**:
The judge's named defect plus a suggested action. It is never an action: nothing is regenerated, discarded or reordered without the owner.
_Avoid_: auto-discard

### System One

**Scorer**:
A small local model returning a typed decision with a calibrated probability, used where a step is judgment that repeats. It decides who looks and what runs next — never whether work is correct.
_Avoid_: classifier (a classifier has fixed classes; a scorer's option list is data)

**Choice / Score / Noul**:
The three decision shapes. **Choice** picks one of N options. **Score** rates against ordered levels. **Noul** returns the probability that the answer is yes. The shape is chosen by the question: unordered alternatives, ordered levels, or an independent yes/no.
_Avoid_: modelling non-exclusive requirements as a Choice

**Abstention**:
A scorer declining because no option cleared its threshold. A first-class outcome with a declared destination — the graph gate, the supervisor, or the permissive default — never a guess.

**Floor**:
The rule a scorer replaces, kept as the bound it cannot cross. The scorer may only widen the permissive side, so the worst case of adopting one is today's behaviour.

**Shadow log**:
The append-only record of every scorer call — context, options, chosen, probability — opened at decision time and **resolved** with its outcome when the run closes. An unresolved record is unlabelled data, never a wrong label.

**Free label**:
An outcome that is itself the answer: a session that blocked on a socket required the `unix-socket` capability. Costs nothing and is mined before any teacher runs.

**Inferred label**:
A label the **teacher** wrote from hindsight artefacts, for decisions whose outcome was silent. Kept distinguishable from a free label, and outranked by one wherever they disagree.

**Silent half**:
The decisions whose failure leaves no trace — an over-declared capability, a permitted read that was waste. Free labels are biased by construction because only the loud half announces itself; labelling the silent half is the teacher's actual job.

**Trivial baseline**:
The majority answer at a decision site. A scorer that does not beat it has learned nothing, whatever its accuracy reads.

**Shuffled-context control**:
Scoring each option list against the wrong context. If accuracy barely drops, the scorer is reading option statistics rather than the task. Costs one flag and is the difference between knowing and assuming.

**Calibration**:
How closely a scorer's stated probability matches its observed hit rate, reported as expected calibration error. It is what licenses a threshold; an uncalibrated scorer may not suppress a review.

### Evaluation

**Metrics line**:
One JSON object per run appended by a skill to its history in the OS temp dir.

**Scope drift**:
A skill doing work its `description` does not claim, or another skill's work.

## Relationships

- **Shunt** produces **recover events** and **excerpts**; the ratio of the first to compressed reads is its failure rate.
- **Handoff** turns a plan into **sessions** on **slots**, gated once by the **graph gate**, reported through the **digest**.
- Every skill writes **metrics lines**; `skills-evaluate` reads them and never the other way round.
- **Still cursor, living day** locks its plan with a hash at one owner gate, the way **handoff** locks a graph; **breakage** is to a collection what a causal **dep** is to a graph.
- A **gate run** produces evidence; a **verdict** and a **risk level** read it; the **attention matrix** turns the pair into a **revise round**, an **escalation**, or an **accepted** session.
- **Scorers** write the **shadow log**; the **teacher** resolves what the outcome left silent; neither ever acts inside a run.

## Flagged ambiguities

- "Recovery" meant both expected excerpts and failed compression — resolved: only failures are **recover events**.
- "Done" meant both "the child finished" and "the work is good" — resolved: `done` is the child's claim, **accepted** is the system's conclusion.
- "Review" named both a session tier and the correction loop — resolved: a **review** session verifies and never edits; a **revise round** edits and never judges its own result.
- "Experiment" named both a **trial** under `docs/experiments/` and a shipped skill whose purpose is to measure — resolved: a **trial** ships nothing and stays unreachable from `skills/`; an **experiment skill** is installed and triggered like any other and earns its place with a number from real runs.
- "Judge" collided with **teacher**, which must never write verdicts — resolved: a **judge** grades artefacts against a declared axis and decides nothing about what runs next; a **teacher** labels past decisions from their outcomes and grades no work. Neither may act inside the run it observes.
- "Teacher" and **supervisor** were briefly the same role — resolved: they must not be. A supervisor labelling its own decisions trains a scorer to reproduce the supervisor's bias.

# Handoff mechanism — sequence, gates and the session graph

For whoever maintains the skill. How a handoff run actually behaves, end to end. Vocabulary is defined in [`CONTEXT.md`](../../CONTEXT.md); the roadmap these diagrams anticipate is [#31](https://github.com/MathBorgess/skills-catalog/issues/31).

> **Read this first.** What is marked **shipped** is what the skill does today. Roadmap boxes are the design, not a command. If a command or a state below is not in [`SKILL.md`](../../skills/handoff/SKILL.md), it does not exist yet.

| Part | Status |
| --- | --- |
| Phases 1–4, digest, scorecard | **shipped** |
| HITL-1 graph gate with hash lock | **shipped**, and mandatory |
| Capability gate | **shipped** — the supervisor reasons every yes/no; the script checks the shape and excludes sandboxes |
| Tier, size, read level, raw-vs-whole | **shipped as reasoning** — the model writes them; the shunt floor stays code |
| Phase 5 acceptance: gate run, verdict, risk, matrix | **shipped as reasoning** — the supervisor writes the verdict and the risk; `accept` applies the matrix. Only `accepted` unblocks a dependent |
| HITL-0 environment preflight | roadmap (#44) |
| Scorers at any site | not in the skill. A later scorer may fill the same fields and may not cross a floor. Trials live in [`docs/experiments/`](../experiments/README.md) |
| Teacher | roadmap (#47) |

## The three human gates

| Gate | Fires when | Today |
| --- | --- | --- |
| **HITL-0 — admission** | `route` refuses: write-set collision, no provider satisfies the declared capabilities, environment precondition unmet | partial; the environment half is #44 |
| **HITL-1 — graph gate** | after cutting and routing, **before any launch**. The owner grills the graph; `route --approve` locks the plan hash | **shipped and mandatory** |
| **HITL-2 — escalation** | `critical` risk, `rejected` verdict, `escalate`, or a spent revise round | **shipped** — `accept` sets `escalated`; the owner re-cuts |

HITL-1 is the defence against the one failure no per-session check can catch: a wrong premise propagated into every brief at once. The recorded case is a supervisor that oriented itself on a tree 37 commits behind `origin`, so six documents described the wrong milestone.

## Sequence

```mermaid
sequenceDiagram
    autonumber
    actor H as Owner
    participant S as Supervisor
    participant HF as handoff.mjs
    participant C as Child
    participant G as Gate run
    participant T as Teacher

    Note over H,S: PHASE 1 — activation
    alt human-invoked
        H->>S: /handoff, "fan this out", "compact this"
    else model-invoked
        Note over S: the skill description matches the<br/>request in flight; the model loads it
    end

    Note over S,HF: PHASE 2 — probe, cut, route
    S->>HF: probe --run
    HF-->>S: supply per lane and per window
    S->>S: reason tier, size, and one yes/no per capability
    Note over S: write them on the plan.<br/>An omission is a route refusal.<br/>No scorer answers these.
    S->>HF: write plan.json
    S->>HF: route --run
    HF->>HF: environment preflight and capability gate

    alt plan not admitted
        HF-->>S: refusal, with the remedy named
        S->>H: HITL-0
        H-->>S: fix the cut or the environment
    end

    HF-->>S: lanes, estimates, override warnings

    Note over S,H: PHASE 3 — graph gate, HITL-1, mandatory
    S->>H: graph, concurrency, lanes,<br/>reasoned needs
    H-->>S: grilling
    H->>S: approved
    S->>HF: route --approve, locks the plan hash

    Note over S,C: PHASE 4 — briefs and dispatch
    S->>S: write NN.md and NN.prompt.md
    S->>HF: dispatch --budget --settle

    loop each session whose deps are accepted
        HF->>C: launch on the assigned lane
        activate C
        C->>C: reason read level and raw-vs-whole,<br/>above the shunt floor
        C->>C: work, append to progress.md
        C-->>HF: exit, write result.md
        deactivate C
    end

    Note over HF,G: PHASE 5 — acceptance: where done becomes accepted
    HF->>G: run the plan's verify commands in the worktree
    G-->>HF: evidence, not a conclusion
    HF->>S: digest and gate evidence
    S->>S: reason verdict and risk
    S->>HF: accept / confirm
    HF->>HF: attention matrix

    alt approved, routine, gate ok
        HF->>HF: accepted — dependents may start
    else approved, notable or consequential
        HF->>S: reviewed
        S->>HF: confirm --agree yes or no
    else approved and critical
        HF->>HF: escalated
        S->>H: HITL-2
    else approved and the gate failed
        HF-->>S: refused — revise, reject, or escalate
    else revise, with a named defect
        HF->>C: fresh session, same worktree, new brief
        activate C
        C-->>HF: correction
        deactivate C
        HF->>G: re-run the gates
        Note over HF: one round only.<br/>The second revise escalates
    else rejected, escalate, or round spent
        HF->>S: escalate
        S->>H: HITL-2
        H-->>S: re-cut, approve, or abort
    end

    Note over HF,T: PHASE 6 — scorecard and learning
    HF->>HF: score: write metrics.jsonl<br/>refuses pending, running, done, gated, reviewed
    Note over T: after the run, batched,<br/>on the abundant lane — roadmap
    T->>T: mine free labels from outcomes
    T->>T: label only the silent half
```

## A session node

The change that matters is not the happy path: it is that **`done` stops being terminal**. `done` in the result file is the child's claim. Dispatch records it as `gated`. Only `accepted` unblocks a dependent.

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> running: deps accepted, slot has quota
    running --> gated: child exited with result.md
    running --> dead: exited without result.md

    dead --> pending: quota or auth — reroute,<br/>resume from progress.md
    dead --> escalated: real task failure,<br/>or three attempts

    gated --> accepted: approved, routine, gate ok
    gated --> reviewed: approved, notable or consequential
    gated --> pending: revise, named defect, first round
    gated --> escalated: rejected, escalate, critical,<br/>or a second revise

    reviewed --> accepted: supervisor confirms
    reviewed --> escalated: supervisor disagrees

    escalated --> pending: owner re-cuts and re-approves
    escalated --> [*]: owner aborts

    accepted --> [*]: dependents unblocked

    note right of accepted
        Only accepted unblocks a dependent.
    end note
```

Three properties follow:

1. **A dependent never starts behind an unaccepted session.** Strictly stronger than `status === "done"`.
2. **`dead` is not `failed`.** Three sessions in one run exited without a result while holding real work — 711 lines in one case. Relaunching from a clean worktree would destroy it, so `dead → pending` **resumes from progress**.
3. **`escalated` is a state, not an ending.** The owner re-cuts and the node returns to `pending` under a re-approved hash.

## Every session is a fresh session

`dispatch` launches a child as a new CLI process reading `NN.prompt.md`. **No conversation survives a relaunch** — what persists is the worktree and `progress.md`. That is a property to preserve deliberately, not an accident:

- **A revise round gets a new brief, not the original one.** Re-sending the original re-injects the supervisor's first hypothesis, and the run record shows that hypothesis being wrong while the child was right: *the diagnosis written in the brief is a hypothesis; the child was correct to follow the evidence instead of the supervisor's theory.* The revise brief carries the **named defect** — gate output, a diffstat fact, a missed `Done when` item — and states that a previous attempt is on disk.
- **A review session is never the author's session, and should not be the author's model.** Read-only, artefacts only, never the child's transcript. Running it on a different provider from the author is the cheapest independence available, and run `20260915T182254Z` got it by accident: the review ran on Codex and returned NO-GO on a tree with 159 green tests.

## Where context is spent, and where it is not

The design's answer to long-context degradation is not better retrieval. It is **shorter contexts and state on disk**. `plan.json`, `NN.md`, `progress.md`, `result.md`, `state.json` and `decisions.jsonl` are the memory; a model's context is a working set.

**Child.** It starts near-empty — `references/brief.md` requires pointers, never pasted artefacts, and the child has no supervisor context. The child reasons, in the brief, which commands return whole output and at which level a file is read. The shunt floor is not part of that reasoning. `progress.md` is external memory, so a resumed session re-reads a short file instead of a transcript.

**Supervisor.** It reads the digest and is forbidden from opening `logs/`, a child transcript, or `wt/`. The acceptance phase removes it from the routine path entirely — and that changes the scaling, not the constant. Today its context grows with the **number of sessions**, because it reads every digest and makes every call. With the matrix it grows with the **number of escalations**.

The honest gaps: nothing caps a single child's context growth mid-session — `--budget` bounds wall time, not tokens — and a `critical` session deliberately sends a diff up. The design concentrates context spend on the risky minority rather than eliminating it.

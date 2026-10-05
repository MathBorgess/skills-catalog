---
name: domain-modeling
description: Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or editing a GLOSSARY.md, or recording or editing an ADR.
metadata:
  author: Matt Pocock
  version: 1.0.0
---

# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the *active* discipline: challenging terms, inventing edge-case scenarios, and writing the glossary and decisions down the moment they crystallise. (Merely *reading* `GLOSSARY.md` for vocabulary is not this skill: that is a one-line habit any skill can do. This skill is for when you are changing the model, not just consuming it.)

## File structure

Most repositories have a single context:

```
/
├── GLOSSARY.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `GLOSSARY-MAP.md` exists at the root, the repository has multiple contexts. The map points to where each one lives:

```
/
├── GLOSSARY-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── GLOSSARY.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── GLOSSARY.md
│       └── docs/adr/
```

Create files lazily: only when you have something to write. If no `GLOSSARY.md` exists, create one when the first term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

## Steps during the session

1. **Challenge against the glossary.** When the user uses a term that conflicts with existing language in `GLOSSARY.md` (or `CONTEXT.md`), call it out immediately: "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?"
2. **Sharpen fuzzy language.** When the user uses vague or overloaded terms, propose a precise canonical term: "You are saying 'account': do you mean the Customer or the User? Those are different things."
3. **Discuss concrete scenarios.** When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about boundaries between concepts.
4. **Cross-reference with code.** When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"
5. **Update GLOSSARY.md inline.** When a term is resolved, update `GLOSSARY.md` right there. Do not batch these up: capture them as they happen. Use the format in [references/glossary-format.md](references/glossary-format.md). `GLOSSARY.md` must remain devoid of implementation details, code snippets, specs, or scratch pad notes. It is a glossary and nothing else.
6. **Offer ADRs sparingly.** Only offer to create an ADR when all three criteria are met:
   - **Hard to reverse**: the cost of changing your mind later is meaningful.
   - **Surprising without context**: a future reader will wonder "why did they do it this way?".
   - **The result of a real trade-off**: there were genuine alternatives and you picked one for specific reasons.
   If any of the three is missing, skip the ADR. Use the format in [references/adr-format.md](references/adr-format.md).

## Done-check

- [ ] Every resolved domain concept is defined in `GLOSSARY.md` following [references/glossary-format.md](references/glossary-format.md).
- [ ] Conflicting or ambiguous terms have explicit `_Avoid_` directives.
- [ ] `GLOSSARY.md` contains purely domain definitions without implementation details.
- [ ] Any ADR created meets all three gating criteria and uses the standard template in [references/adr-format.md](references/adr-format.md).

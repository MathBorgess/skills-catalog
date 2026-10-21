---
name: create-domain-skill
description: "Use when the user wants to create a reusable skill for an activity, turn an expert's public methods into an agent workflow, or prepare a bot or agent for a specific job with a domain personality and practical evaluations. Produces a skill named after the activity, a working personality profile, cited methods and review criteria. Not for performing an existing skill's activity or merely role-playing a famous person."
metadata:
  author: Matheus Borges
  version: 1.0.0
---

# Create domain skill

Turn demonstrated domain practice into a reusable activity. The activity is the public interface; the personality supplies working habits and judgment behind it.

## Steps

1. **Define the activity.** Read the destination's conventions, glossary and existing skills before creating anything. Reuse or extend an overlapping skill when appropriate. Follow [intake](references/intake.md); write the activity, audience, inputs, outputs, constraints, target harness and acceptance criteria to `<workspace>/brief.md`. Ask only for decisions the request and repository cannot settle.
2. **Name the work.** Choose a lowercase activity name such as `write-sales-copy` or `review-api-design`. Use it for the directory, frontmatter, display name and trigger description. Keep practitioner names inside references. Enable model invocation in both harnesses by omitting `disable-model-invocation` and `policy`; include realistic task phrases in the description.
3. **Research practitioners.** Follow [research](references/research.md). Select two or three practitioners with relevant, documented work and complementary methods, unless the user specifies the references. Record demonstrated success, limits and sources actually inspected. If a named practitioner lacks usable evidence, document the gap and use a supported alternative or leave the package unvalidated; do not invent their method.
4. **Extract decisions.** Give each method an ID, source locator, applicable condition, action, observable check and exception. Distinguish a documented method from an inferred adaptation. Resolve conflicting advice against the brief's constraints. Build at least two complementary review lenses from this evidence; a review lens applies documented criteria and never claims the real person reviewed the work.
5. **Build the package.** Fill [the package contract](references/package-contract.md): `SKILL.md`, `agents/openai.yaml`, four references and `evals/evals.json`. Write ordered actions, explicit outputs and a done-check. Make the generated workflow load its personality, methods and review rubric. Adapt the personality into a bot's native configuration only when the target is known, preserving its existing permissions and unrelated instructions.
6. **Exercise and revise.** Run `node <skill-home>/scripts/check-package.mjs <out>`. Then follow [evaluation](references/evaluation.md): test activity-based discovery, run practical cases against a baseline, and critique the outputs through both domain lenses. Save actual outputs, failures and revisions outside the installable package. Use up to two revision rounds by default; report remaining defects and unavailable runs honestly. Structural success alone is not domain validation.
7. **Integrate and deliver.** Register the package in the destination's existing catalog and manifest, follow its version and PR rules, and run its required checks. For a standalone destination, deliver the directory without inventing a second catalog. Report the activity name, package and profile paths, how it is discovered, validation status and unresolved limits. Do not install globally or activate a live bot unless requested.

Origin and format references: [sources](references/sources.md).

## Done-check

- [ ] The factory and generated skill are reachable by model or user through activity names; visible metadata does not require knowing a practitioner.
- [ ] The package checker and destination checks passed; generated instructions load their bundled references and use only available tools.
- [ ] Personality, methods and two complementary review lenses have inspectable evidence, explicit adaptations and scope limits.
- [ ] Practical outputs, baseline comparison, domain critiques and revisions exist, or the delivery explicitly says which validation remains unrun.
- [ ] No invented endorsement, source, success metric or test result appears; the delivery distinguishes structural checks from observed domain performance.

# Review packet and evidence ledger

Use the repository's PR template when it has one.
Otherwise use these sections, translated into the requested language:

```markdown
# <Problem and resulting behavior>

PR: <identifier>; base: <revision>; head: <revision>; review cutoff: <time or current>

## Change
<Who encounters the problem, what changes, and one concrete before/after example.>

## Evidence
<Checks actually run, outcomes, scope, and links to raw evidence.>

## Risks and unknowns
<Material risks, recovery limits, and checks that failed or did not run.>

## Review path
<The few files or behaviors that deserve attention first, with source links.>
<Questions that still need a human decision.>
```

Scale the text to the change.
A typo fix can fit in one paragraph under the repository's template.
Use a diagram only when it makes a relationship easier to assess.
Do not hide a material risk in an appendix to make the packet look simple.
Do not claim an unavailable before/after test run occurred.

Keep the evidence ledger machine-readable:

```json
{
  "version": 1,
  "pr_id": "task-local-id",
  "base_revision": "exact-base",
  "head_revision": "exact-head",
  "review_cutoff": null,
  "language": "en",
  "claims": [
    {
      "id": "claim-1",
      "text": "The unit check passed.",
      "kind": "observed",
      "sources": [{"path": "unit.log", "revision": "exact-head", "locator": "lines 1-3"}],
      "limits": "Offline unit tests only."
    }
  ],
  "checks": [{"command": "exact-command", "status": "pass", "exit_code": 0, "source": "unit.log"}],
  "unknowns": ["Live integration has no evidence."],
  "artifact_hashes": {"packet.md": "sha256-of-actual-bytes"}
}
```

Use `observed`, `inferred`, or `unknown` for claim kinds.
Use `pass`, `fail`, `not_run`, or `unavailable` for check status.
Keep missing denominators and missing results explicit.
Never replace a raw failure with a wrapper's success message.

This design adapts the separation of evidence and targeted questions from Warp's triage workflows.
See [Warp core triage](https://github.com/warpdotdev/oz-for-oss/blob/a2bb45f231fd56ea28c1b381999d11b277a0b0e2/.agents/skills/triage-issue/SKILL.md).
It uses original prose; it does not import Warp's labels or issue-mutation rules.

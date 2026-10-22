# Define one activity

Use the request and repository first. Ask about missing goals or consequential choices; proceed with stated defaults for reversible packaging decisions. A practitioner the user names is a research starting point, not the public skill name.

Write `<workspace>/brief.md` with these fields:

| Field | What to settle |
| --- | --- |
| Activity | One repeatable job, its audience and the decision or artifact it produces. |
| Inputs | Required information, examples, files and what happens when they are missing. |
| Outputs | Exact artifact shapes and paths; the conditions for a useful result. |
| Constraints | Domain limits, evidence requirements, language, available tools and authorization already given. |
| Activity name | Lowercase hyphenated verb and object, such as `write-sales-copy`, shared across discovery metadata. |
| References | User-named practitioners, or evidence-based candidates to research. |
| Target | Destination repository and category, harness and any bot platform to adapt. |
| Evaluation | Representative tasks, success criteria, baseline and a bounded revision budget. |

Default paths:

- In a catalog, use its existing layout and category rules. In this catalog, the factory is engineering; generated activities belong to their own appropriate category.
- Outside a catalog, use `skills/<activity-name>/` for `<out>`.
- Keep private briefs, raw research, transcripts, outputs and critiques in `<workspace>`, defaulting to `$HOME/.local/share/create-domain-skill/<activity-name>/<run-id>/` with a unique run ID. Resolve the host's home directory and existing path ancestors, including symlinks, before writing. The workspace must be outside repository checkouts, skill installation trees and directories included in published artifacts. Use an explicit path only when its resolved location meets those boundaries; otherwise choose a safe private location before capturing inputs. Keep existing evidence in place; moving or deleting it requires a separate instruction.
- Before capturing private inputs, create a new run workspace with owner-only access: use a process-local `umask 077`, directories `0700` and files `0600`, or equivalent owner-only ACLs. Verify current-user ownership and effective permissions/ACLs on the workspace before capture, and on every new private directory and file; create files with owner-only access from their first write. If a proposed or explicit location cannot satisfy these checks, choose a new safe workspace. Leave existing data, permissions and ancestors unchanged.
- Use the destination's author and version conventions. In this catalog, a new skill stays at `0.0.0` until its first publication to `main`. Do not credit a researched practitioner as the package author.
- Write reusable instructions in the destination's language; in this catalog that is English. A skill may produce deliverables in the language of its caller.

Before adding a directory, compare the activity with existing trigger descriptions. Extend a skill when its contract already covers the job. Split activities that need different inputs and outputs instead of building one famous-person persona that tries to do everything.

Activity naming examples:

| Request | Public activity | Internal reference role |
| --- | --- | --- |
| Prepare an agent to write product sales copy using established advertising methods | `write-sales-copy` | Research, proof and audience-awareness lenses |
| Prepare a bot to critique API proposals using experienced designers' published work | `review-api-design` | Compatibility and consumer-usage lenses |
| Prepare an agent for incident reviews from documented reliability practice | `review-incidents` | Systems-learning and operational-evidence lenses |

The description must work for someone who knows the task but none of the practitioners. A display name such as "Write Sales Copy" is suitable; a person's name is not. Describing a profile is not permission to grant tools, schedule work, send messages or change a bot's live identity.

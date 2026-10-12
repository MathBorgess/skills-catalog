# Reference animation and catalog categories

[`reference-animation`](../../skills/creativity/reference-animation/SKILL.md) produces an animation or a collection of distinct spatial studies. Exploration prioritizes interesting content, causal dynamics and depth; refinement later adapts selected scenes to the author. Logos are not default protagonists. It loads selected design profiles, derives a work-specific composition from the author's original DESIGN.md, explains the expected result, then generates and inspects the work. [`motion-identity`](../../skills/creativity/motion-identity/SKILL.md) continues to own durable brand motion design.

The original wins over reference advice; explicit current author overrides are recorded with their scope. `compose.mjs` snapshots its exact bytes, source path, asset base and hash; the temporary working DESIGN.md preserves that source as its prefix and appends the composition. Each selected profile is also snapshotted with its source revision and hash. The Mindful Movement core is always loaded and snapshotted, including with custom reference registries; schema 3 adds an explicit exploration/refinement stage, collection, spatial direction and refinement sections. Supporting reference resources and the spatial guide are snapshotted too. Schema 1 and 2 runs retain their earlier contracts. This makes drift detectable while leaving the authoring decisions with the agent and user. Structural validation does not judge style or verify that pixels match prose.

Mindful Movement treats objects as performers with intention, an emotional pivot, weight, gravity, friction, bounded elasticity and spatial bubbles. Its transformation vocabulary includes arcs, weight shifts, squash/stretch, bend/fold, ripple, scatter/regroup and percussive/vibratory motion. Calm sustained/suspended and energetic punk/funk duets demonstrate causal relationships and readable recovery. These are directing choices supplied in the creative brief, not measured outcome claims.

Apple fluid design, Disney's animation principles and LottieFiles motion design are the default external profiles. LottieFiles contributes a full distillation plus all 17 original Markdown documents (1,628 lines), pinned coverage hashes and its MIT license. UI timing, attention rules, spring units and performance claims are explicitly adapted for spatial films. These are documented practices, not measured outcomes for a new work. Additional documented, observed or measured references use the same registry schema without changing the composing workflow. A one-off registry is accepted separately from the installed skill.

## Layout migration

The catalog now stores operators under `skills/engineering/` and `skills/creativity/`, and shipped experiment skills under `skills/experiments/`. Unshipped trials remain in `docs/experiments/`. The leaf folder remains the skill name used for invocation and installation. README.md remains the sole catalog index; the plugin manifest contains explicit categorized paths.

The migration updates catalog validation, the maintainer list/link scripts, post-merge relinking, plugin guard paths, CI commands, sibling discovery and active documentation links. Sibling discovery accepts both categorized source trees and flat installed directories, including symlinks. The post-merge hook recognizes moved SKILL.md files so existing maintainer links are rebuilt after a merge on main.

## Validation scope

- `npm run check` runs the existing workflow suites plus categorized discovery/link migration and composition provenance tests.
- The layout fixture proves unchanged installed names, repair of old links, removal of stale catalog links and preservation of unrelated links. It installs only into temporary fixture directories.
- The composition fixture proves source preservation, rejection of source/profile/core-guideline drift, required cast/score/override/collection/spatial/refinement sections, stages, supporting-resource drift, legacy compatibility, delivery-record validation and one-off reference extension with the core method retained. Synthetic delivery files test the record contract; they do not claim visual success.
- skills.sh discovery and npm package dry-run inspect the actual categorized catalog. They do not install skills or publish a package.
- A caller-owned brand proof is generated in an OS temporary directory with real design assets. Deterministic frame sampling, clipping checks, playback controls, reduced motion and export decoding establish the bounded technical result. Visual assessment and user approval remain separate. Private brand sources, prompts and outputs stay outside this public repository.

The code route is suitable for protected logos and exact typography. Image/video model routes are supported by the workflow but are not exercised by a code-only proof; their continuity and identity still require inspection on a later run.

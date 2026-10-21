# Deprecated Skills

Skills in this directory are deprecated and no longer maintained or accessible as active skills in the catalog. They have been moved out of `skills/` so they are not indexed by package managers, plugins, or agent harnesses.

These files are retained for historical context and architectural traceability.

## Deprecated Skills List

- **[`co-direct-animation`](./co-direct-animation/)**: Previously used for 5-gate animation co-direction and Flow shot generation. Deprecated in favor of the streamlined `skills/media/` workflow (`brand-dna` + `social-video-director` with separated `moodboard.md` and `storyboard.md`).
- **[`handoff`](./handoff/)**: Previously used for cut-work dependency graphs and cross-provider sessions. Deprecated and removed from active catalog.
- **[`motion-identity`](./motion-identity/)**: Previously used as a standalone grilling workflow to write motion keys into `DESIGN.md`. Deprecated and folded into [`brand-dna`](../skills/media/brand-dna/) and [`social-video-director`](../skills/media/social-video-director/).
- **[`shunt`](./shunt/)**: Previously used to keep large models off heavy I/O via read thresholds and run wrappers. Deprecated and removed from active catalog.

## Skills Under Analysis

- **[`video-reference`](../skills/creativity/video-reference/)**: Currently in *analysis* status while `social-video-director` and `social-post-director` operate on `viral-rag` to evaluate whether deep 7-layer local video extraction remains necessary or should be deprecated.

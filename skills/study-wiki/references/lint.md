# Lint — graph hygiene

Run on request, and after any batch that touched more than a handful of files. Report findings by severity: **broken link > orphan > missing from index > contested > stale > style**. Confirm with the user before changing ten or more files in one pass.

1. **Broken links.** Every `[[Note_Id]]` resolves to a file whose frontmatter `id` matches exactly. A link to a removed file becomes plain text in a code span — `Topic_Name (removed)` — never a dead link left to rot.
2. **Orphans.** Every note has at least one incoming link. A note reachable only by knowing its path is a note that will never be read again.
3. **Index completeness.** Every file under `wiki/<track>/` appears in `wiki/README.md`, under the right domain, with a descriptor. Counts in the index header match reality.
4. **Frontmatter.** `id`, `title`, `category`, `certs`, `last_updated` present on every note; `certs` values are real exam codes from `wiki/_meta/profile.md`.
5. **Template.** Every note has all five sections, section 4 (exam relevance) included and non-empty.
6. **Outgoing links.** Minimum two per note.
7. **Error log integrity.** Every `→ [[Note_Id]]` in `wiki/_log/errors.md` points at a note that exists. A miss pointing nowhere means the note was never written — that is a content gap, not a formatting problem, and it is the most valuable finding this pass produces.
8. **Coverage against weights.** Domains from the profile with zero notes, ranked by exam weight. An untouched 30% domain outranks every style finding in this list.
9. **Staleness.** `last_updated` far older than the newest source on the same topic, or older than a vendor change you know about.
10. **Size.** A content note over ~200 lines gets split by subtopic and cross-linked. The index, the logs and the question banks are registers and are exempt.
11. **Contradictions.** Two notes asserting incompatible things about the same mechanism. Resolve it or mark both `contested: true` with a line saying what the disagreement is — never leave it silent.
12. **Empty scaffolding.** A directory containing only a README explaining that it is empty, a `.gitkeep`, or a placeholder "for later": delete it.
13. **Stale paths.** References to files that moved or were removed, in notes and in the generated `CLAUDE.md` alike.
14. **Leakage.** Grep the whole repository for client names, employer names, account identifiers, hostnames and currency figures. Anything found is removed and generalized in the same pass, before anything else in this list is reported.
15. **Log rotation.** `errors.md` past ~500 lines rolls over to `errors-YYYY.md`, current year stays live.

Finish by stating what was fixed and what was left for the user to decide. Never silently rewrite a note's substance during a lint pass — lint fixes structure; content changes go through the ingest flow, where the user sees them.

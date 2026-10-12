# Layouts — where the plan lives

Detect once per session. Do not scaffold the other layout into this vault.

## Canonical (study-wiki Flow 1)

All of `wiki/README.md` and `wiki/_log/errors.md` exist, and `estudos/certificacoes/` does **not**.

| Role | Path |
|---|---|
| Profile | `wiki/_meta/profile.md` |
| Roadmap | `wiki/_meta/roadmap.md` |
| Overlap | `wiki/_meta/overlap.md` |
| Errors | `wiki/_log/errors.md` |
| Score | `wiki/_log/score.md` |
| Index | `wiki/README.md` |
| Session note | `wiki/sessions/YYYY-MM-DD-<slug>.md` — create `wiki/sessions/` on the first session |
| Lesson HTML | `wiki/sessions/YYYY-MM-DD-<slug>.html` — same slug |
| Lesson assets | `wiki/assets/lesson.css`, `wiki/assets/quiz.js` — copy from this skill on first lesson |
| Question bank | `wiki/questions/<exam>-batch-NN.md` |

If overlap or roadmap is missing, **build the ranking in memory for this session**, then call the Skill tool with `"study-wiki"` so those files get written. Do not re-bootstrap. Do not create `MISSION.md`.

## Foreign (MathAI-style vault)

`estudos/certificacoes/` exists, or both `wiki/index.md` and `estudos/` exist.

Do **not** create `wiki/_meta/profile.md`, `wiki/_log/errors.md`, `wiki/_meta/roadmap.md`, or `MISSION.md`. This vault already has a study layout. Follow its `CLAUDE.md` orientation (`CLAUDE.md` → `wiki/index.md` → MOC → note → `wiki/log.md`).

| Role | Path |
|---|---|
| Allocation / hub | `estudos/certificacoes/README.md` |
| Active-track plan | `estudos/<track>/README.md` and any `estudo-plano.md` it links. Gates and sessions already there are the roadmap. Dates are not copied into a new file. |
| Overlap | Rank live from the two (or more) track READMEs and error ledgers. Write a table into `estudos/certificacoes/README.md` only when that file has no overlap section yet **and** the user is operating this vault for study, not as a drive-by question. |
| Errors | `estudos/<track>/registro.md` or `estudos/<track>/estudo-registro.md` — append to the **active** track. Do not append to a parked track's ledger. |
| Session note | `estudos/certificacoes/sessoes/YYYY-MM-DD-<slug>.md` |
| Lesson HTML | `estudos/certificacoes/sessoes/YYYY-MM-DD-<slug>.html` — same slug |
| Lesson assets | `estudos/certificacoes/assets/lesson.css`, `estudos/certificacoes/assets/quiz.js` — copy from this skill on first lesson |
| Compiled wiki | `wiki/` as this vault defines it (often `wiki/index.md`, `wiki/MOC/`, `wiki/log.md`) |
| Daily | `daily/YYYY-MM-DD.md` when the vault uses it |

Parked and trigger-inactive trails: if the hub or the track README says parked / trigger / no slice, that exam is off-limits for topic pick even when the user asks to "feel progress on both".

## Ambiguous

If neither layout matches, ask which repository is the study wiki. Do not scaffold a canonical wiki inside a random project, and do not invent `estudos/`.

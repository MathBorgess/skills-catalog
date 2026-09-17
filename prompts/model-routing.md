# Model Routing Specification & Rubric

A versionable, model-agnostic decision guide for allocating tasks to model classes, sizing session scope, declaring environment capabilities, and avoiding wasteful frontier quota consumption.

---

## 1. Core Model Classes

Agents and orchestrators categorize candidate models into two fundamental classes:

| Class | Profile | Archetypal Roles | Typical Models |
|---|---|---|---|
| `fast_cheap_own` | High throughput, minimal token/quota cost, lower reasoning depth, fast execution. Universal worker in Antigravity. | Outlines, summaries, mechanical file generation, lint fixes, repetitive tests, boilerplate, syntactic renames. Universal worker for Antigravity. | Gemini 3.8 Flash (universal in Agy), Claude Haiku 4.5 / 3.5 Haiku, Cursor Grok 4.6, Composer, GPT-5.6 Luna (minor) / GPT-5.4 Mini. |
| `frontier_reasoning` | High reasoning capacity, complex constraint satisfaction, expensive token/quota budget. | Architecture design, ambiguous specification analysis, cross-module integration, root-cause debugging, security and logic review. | GPT-6 Astra (BIGGEST tasks only), GPT-5.6 Sol/Terra, Claude Opus 5, Claude Opus 4.8 Thinking, Claude Sonnet 5, Gemini 3.8 Flash (with `--effort high` in Agy). |

---

## 2. Task Taxonomy

Every delegated task or session must be classified across three dimensions:

### Tier (Cognitive Demand)
- **`mechanical`**: Clear, unambiguous contract. No architectural decisions left open. Input and output shapes are already defined.
- **`design`**: Involves open choices, API boundary definition, trade-off evaluation, or solving novel structural problems.
- **`review`**: Read-only verification, audit of invariant preservation, finding subtle regressions, or security inspection.

### Size (Scope & Blast Radius)
- **`s`**: Touches 1–2 files, localized edits, fast feedback loop (< 5 min).
- **`m`**: Touches one module or subsystem (3–6 files), established interfaces, standard test suite.
- **`l`**: Cross-cutting subsystem, deep refactoring, or foundational contracts affecting multiple downstream consumers.

### Capabilities (`needs`)
Declared environment requirements that execution slots must guarantee:
- **`network`**: Outbound HTTP/API access (e.g. dependency download, remote API tests).
- **`unix-socket`**: Binding local IPC/Unix domain sockets or loopback servers during tests.
- **`git-write`**: Creating git commits, worktrees, branches, or mutating git state.
- **`pty`**: Interactive terminal / pseudoterminal allocation.
- **`disk-write`**: Standard filesystem mutation permissions.
- **`high-memory`**: Large compilation units or heavy build pipelines (> 4 GB RAM).

---

## 3. Decision Matrix (Agnostic Routing)

| Tier | Size | Primary Model Class | Fallback Rule | Quota / Token Principle |
|---|---|---|---|---|
| `mechanical` | `s` | `fast_cheap_own` | — | Never burn metered frontier quota on localized mechanical tasks. In Agy, use Gemini 3.8 Flash (`--effort low`). |
| `mechanical` | `m` | `fast_cheap_own` | `frontier_reasoning` (only if own pool is 0%) | Prefer own/cheap model even if multiple turns are needed. In Agy, use Gemini 3.8 Flash. |
| `mechanical` | `l` | `fast_cheap_own` | `frontier_reasoning` (downgrade alert) | Keep reasoning effort low; if split is possible, decompose into smaller `mechanical` tasks. |
| `design` | `s` | `frontier_reasoning` (Sonnet 5, GPT-5.6 Sol/Terra) | `fast_cheap_own` (with human warning) | High reasoning saves rework. Never assign Astra to small scope. In Agy: Gemini 3.8 Flash (`--effort high`). |
| `design` | `m` | `frontier_reasoning` (Opus 5, GPT-5.6 Sol/Terra) | — | Solid frontier reasoning. Do not spend Astra on module-level scope. In Agy: Gemini 3.8 Flash (`--effort high`). |
| `design` | `l` | `frontier_reasoning` (**GPT-6 Astra** only for the BIGGEST tasks) | `Claude Opus 5` / `GPT-5.6 Sol` | **Astra is reserved ONLY for the BIGGEST tasks** (system-wide contracts, foundational architecture, massive blast radius). |
| `review` | Any | `frontier_reasoning` (Opus 5, GPT-5.6 Sol) | — | Review requires invariant catching; cheap models produce false confidence. In Agy: Gemini 3.8 Flash (`--effort medium`). |

---

## 4. Capability Filtering (`needs` Gate)

Before assigning a task to any slot/sandbox, check intersection against known sandbox constraints:

1. If task declares `needs: ["unix-socket"]` or `needs: ["network"]`:
   - Exclude any sandbox running under restricted isolation (e.g. sandboxed workspace-write runners with forbidden loopback/sockets).
2. If task declares `needs: ["git-write"]`:
   - Exclude runners whose working directory cannot mutate parent git state or where `.git` is outside writable roots.
3. If no slot satisfies all `needs`:
   - Fail early during planning. Do **not** dispatch and hope the child ignores the requirement.

---

## 5. Consumption Rules by Skill

### Single-Provider Context (`shunt`)
- **Read Path (Summarization)**: When an outline is insufficient, spawn a subagent with `fast_cheap_own`. The parent large model retains context space for judgment.
- **Write Path (Boilerplate/Tests)**: Always use `fast_cheap_own` for `track-write` tasks. Never compose mechanical blobs in the frontier parent's context.

### Multi-Provider Context (`handoff`)
- Maps the classes above into concrete provider slots, multi-window quotas (5h vs 7d), and lane kinds (`own` vs `frontier`).
- See [`skills/handoff/references/routing.md`](skills/handoff/references/routing.md) for provider-specific slot tables and CLI bindings.

---

## 6. Multi-Harness Model Catalog

A concrete mapping of supported harnesses to their respective model classes and live CLI selectors.

### OpenAI / Codex Harness (`codex`)
- **Frontier Reasoning (`frontier_reasoning`)**:
  - `gpt-6-astra` — **Reserved strictly for the BIGGEST tasks** (system-wide foundational architecture, cross-cutting contracts, massive blast radius). Never assign to small/medium scoped sessions.
  - `gpt-5.6-sol`, `gpt-5.6-terra` — Primary frontier reasoning models for standard design sessions, complex algorithms, and deep refactors.
  - `gpt-5.6-luna` — **The minor model** within the 5.6 family, tailored for lighter reasoning, fast iterations, and minor subtasks.
  - `o3`, `o4` series — Deep chain-of-thought verification.
- **Fast / Worker / Cheap (`fast_cheap_own`)**:
  - `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5-mini` — Lightweight subagent workers for boilerplate, doc updates, and mechanical unit tests.

### Anthropic / Claude Code Harness (`claude`)
- **Frontier Reasoning (`frontier_reasoning`)**:
  - `claude-opus-5` (CLI alias: `opus`) — Flagship architectural model, invariant audits, complex refactorings.
  - `claude-opus-4-8-thinking` — High-effort extended thinking model.
  - `claude-sonnet-5` (CLI alias: `sonnet`) — Primary workhorse balancing top reasoning capabilities and rapid feedback.
  - `claude-fable-5-1-thinking` — Specialized reasoning tier.
- **Fast / Cheap / Own (`fast_cheap_own`)**:
  - `claude-haiku-4-5` / `claude-3-5-haiku` (CLI alias: `haiku`) — High-throughput mechanical transforms and summaries.
  - `claude-fable-5-1-low` — Low-overhead file generator.

### Google / Antigravity Harness (`agy`)
- **Universal Engine (`own` Gemini lane)**:
  - **`gemini-3.8-flash` should be used for ALL tasks in Antigravity** (`gemini-3.8-flash-high`, `gemini-3.8-flash-medium`, `gemini-3.8-flash-low`). It acts as the single universal workhorse across mechanical, review, and design workloads.
  - **Effort Flag Scaling**: Reasoning depth is adjusted purely via the CLI effort flag rather than changing model tiers:
    - `--effort low` → `mechanical` tasks (file transforms, lint fixes, boilerplate).
    - `--effort medium` → `review` tasks (audit, invariant checks, regression scan).
    - `--effort high` → `design` tasks (subsystem contracts, interfaces, architectural decisions).
- **Auxiliary / Fallback Tiers**:
  - `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.1-pro-high/low` (when explicitly mandated).
- **Third-Party Lane (`3p`)**:
  - `claude-opus-4-6-thinking`, `claude-sonnet-4-6`, `gpt-oss-120b-medium`.

### Cursor Harness (`cursor-agent`)
- **Included / Own Models (`cursor-models` lane)**:
  - `cursor-grok-4.6` (`cursor-grok-4.6-medium`, `cursor-grok-4.6-low`) — High-speed reasoning with zero API markup.
  - `composer`, `auto` — Native cursor IDE agent tiers.
- **Other Models (`other-models` metered API lane)**:
  - `gpt-6-astra` — Reserved strictly for the BIGGEST tasks.
  - `claude-opus-5`, `claude-opus-4-8-thinking-*`, `claude-sonnet-5-*`.
  - `gpt-5.6-sol-*`, `gpt-5.6-terra-*`, `gpt-5.6-luna-*` (minor model).
  - `gemini-3.8-flash-*`, `gpt-5.4-mini-*`.

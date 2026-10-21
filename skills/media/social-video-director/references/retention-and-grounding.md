# Retention beats, concept grounding, and Arena delta loop

Use this reference in Step 5 to write and revise `<out>/script.md`.

## 1. Three-track Retention Beat table

Every short-form script is a sequence of **Retention Beats** (`2–4 seconds` each, typically `7–12` beats for a `25–35s` video). Write `<out>/script.md` as a table where each row locks three tracks plus its grounding state:

| Beat ID | Time (`s`) | Grounding (`requires -> grounds`) | Track 1: Audio / Speech (`<= 18` words) | Track 2: Visual Stage (`camera / screen / b-roll / stage`) | Track 3: Overlay / Motion (Headline, Card, Ease) |
|---|---|---|---|---|---|
| `B01` | `0–3s` | `req: [LLM chat] -> gnd: [context bloat]` | "Toda vez que você cola um arquivo inteiro no chat, o modelo perde o fio." | `camera`: tight framing, holding up the raw log | Headline `"CONTEXTO CHEIO = CEGUEIRA"` (`expo.out`) |

## 2. Concept Grounding (from `writing-beats`)

Viewers scroll away the instant a beat leans on an ungrounded concept:

- **Prerequisites:** In `brief.md` / `brand-dna.md`, list what the target audience already knows walking in.
- **One grounding move per beat:** A beat may only rely on concepts that are either **Prerequisites** or **Grounded by an earlier beat**, and it introduces at most **one** new concept or term.
- **No forward references:** Never use a jargon term in Beat 2 that is only explained in Beat 5. Ground the idea and its plain name together on the beat where it first appears.

## 3. Pacing and micro-resets (`2–4s` rule)

- **Visual change every `2–4s`:** No frame stays static longer than `Max Static Hold` (`2.0s` default from `brand-dna.md`). A visual reset can be a progressive card entrance, a zoom/crop shift, a switch from camera to screen/B-roll, or a highlighted keyword.
- **Escalation arc:**
  - `0–3s`: **Hook Triad** (tension + visual proof/contrast)
  - `3–8s`: **Anchor Beat** (grounds the core problem and why it matters now)
  - `8–22s`: **Mechanism / Friction Beats** (each beat advances with *"because of that..."* or *"but when we tried..."*, never a flat *"and then..."* list)
  - `22–28s`: **Payoff + Honest Limit** (delivers the concrete result and names its real boundary, which builds trust)
  - `28–32s`: **Dominant CTA or Seamless Loop**:
    - *Dominant CTA:* One clear action and keyword on screen, synchronized with speech, zero competing labels, held for `0.3s/word + 0.5s`.
    - *Seamless Loop:* The final spoken clause flows syntactically into the first word of `B01` so the viewer replays the hook before noticing the loop.

## 4. Arena-style fast delta commands

The human coordinates through fast natural-language or shorthand commands. Never regenerate the whole file when the human asks for a targeted change:

- `variar hook` / `vary hook <trigger>`: propose 3 new `B01` Hook Triads while keeping `B02..Bn` intact.
- `revisar beat <N> <instruction>`: patch only beat `B<N>` and re-check grounding for downstream beats.
- `encurtar para <X>s`: merge or cut low-leverage beats, preserving the hook, payoff, and grounding chain.
- `mudar moodboard <change>`: update `moodboard.md` and show which beats/visuals shift as a consequence.
- `trocar CTA por loop` (or vice versa): rewrite only the final beat (`Bn`) and its visual/audio bridge to `B01`.

# STE-Lite: 80% of ASD-STE100

A language-agnostic structural subset of the ASD-STE100 Simplified Technical English specification. It drops the proprietary 900-word English-only dictionary while strictly preserving the cognitive, syntactic, and structural rules that make technical text readable.

## Core Rules

### 1. Sentence Length Ceilings
- **Descriptive sentences**: maximum **25 words**.
- **Procedural / step sentences**: maximum **20 words**.
- If a sentence exceeds the ceiling, split it at the conjunction or causal boundary.

### 2. Paragraph Limits
- Maximum **6 sentences** per paragraph.
- One central concept per paragraph. Break multi-stage mechanisms into separate paragraphs or numbered points.

### 3. Active Voice
- Keep the actor as the subject performing the action.
- *Avoid*: "The message is validated by the broker before routing."
- *Prefer*: "The broker validates the message before routing."

### 4. One Idea per Sentence
- State one operation, state transition, or condition per sentence.
- Do not chain multiple `and`, `while`, or `because` clauses together.

### 5. Strict Terminology Consistency (One Word, One Meaning)
- Choose a canonical term and stick to it verbatim.
- Never use synonyms for variety. Swapping terms confuses the learner into looking for a non-existent difference.
- *Avoid*: alternating between "instance", "node", "server", "host", and "machine".
- *Prefer*: define "node" once and use "node" throughout the entire explanation.

### 6. Zero Vague Metaphors
- Explain the physical, algorithmic, or structural reality.
- *Avoid*: "The cache drinks from the firehose."
- *Prefer*: "The cache buffers incoming stream chunks in memory."

### 7. Explicit Conditions and Quantifiers
- State conditions before the action: "If parameter X exceeds 10, the engine aborts the render."
- Avoid vague qualifiers like "very fast", "almost always", "quite large". State numbers, boundaries, or orders of magnitude.

## Verification with `ste-lint.mjs`

Run the deterministic linter across any markdown text:

```bash
node skills/explain-me/scripts/ste-lint.mjs --file <path-to-markdown>
```

The linter flags:
- Sentences exceeding 25 words (or 20 in procedural blocks).
- Paragraphs with more than 6 sentences.
- Term drift when a glossary is provided.

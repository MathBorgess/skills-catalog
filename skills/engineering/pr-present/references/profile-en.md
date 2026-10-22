# English profile: ASD-STE100

Use this profile when the text is in English. It adds the grammar and word rules of ASD-STE100 Simplified Technical English on top of [`ste-lite.md`](ste-lite.md). Lint with `--lang en`.

This page is a working summary in our own words. The specification is the authority. Read it at <https://www.asd-ste100.org/>.

The approved-word dictionary is on that site too. Get it there. We do not copy it into this repository and we ship no part of it. The word list in `scripts/profiles/en.mjs` is our own plain-language list. It does not replace the dictionary.

## The writing rules, grouped

**Words**
- Choose one word for one meaning, and keep it for the whole text.
- Use a word as one part of speech only: do not use a noun as a verb.
- Prefer a short common word to a formal one: "use", not "utilize".
- Use a number, a unit or a name instead of a vague word.

**Noun clusters**
- Keep a noun cluster to three nouns or fewer.
- Split a longer cluster with "of", "for" or a verb.
- Use an article ("the", "a") so the reader sees where the cluster starts.

**Verbs**
- Use the simple tenses: simple present, simple past, simple future.
- Do not use the progressive tense ("is sending").
- Use the active voice. Keep the passive for the rare case where the actor is unknown.
- Do not use an -ing word as a noun or an adjective, except in a fixed technical name.
- Use "must" for a requirement and "can" for a possibility. Do not use "should", "may", "might", "could" or "would".
- Use a single verb, not a phrasal verb: "do", not "carry out".

**Sentences**
- One idea per sentence.
- Keep the full form of the sentence: do not drop articles or verbs.
- Put the condition before the action.
- Keep a descriptive sentence to 25 words and a procedure step to 20 words.

**Procedures**
- Write each step as one instruction in the imperative.
- Put one action in each step. Put the result in its own sentence.
- Number the steps in the order the reader does them.

**Descriptive writing**
- Open each paragraph with its topic sentence.
- Keep a paragraph to six sentences and to one topic.
- Describe the mechanism. Do not use a figure of speech.

**Warnings and cautions**
- Put the warning before the step it protects.
- Say what to do and what happens if the reader does not do it.
- Keep it short and specific.

**Punctuation**
- Keep punctuation plain.
- Do not use punctuation to pack a second idea into a sentence.

## What the linter checks

| Rule id | Severity | What it finds |
| --- | --- | --- |
| `passive-voice` | error | A form of "be", up to two adverbs, then a past participle: "is validated", "has been restarted". |
| `noun-cluster` | warning | Four or more nouns in a row. The check is a heuristic: it has no part-of-speech tagger. |
| `ing-noun` | warning | An -ing word right after "the", "a", "each" and similar: "the routing table". |
| `progressive-tense` | warning | A form of "be" and an -ing word: "is sending". |
| `ambiguous-modal` | warning | "should", "may", "might", "could", "would", "shall". |
| `vague-qualifier` | warning | "very", "quite", "rather", "fairly", "really", "somewhat", "basically", "extremely", "relatively", "slightly". |
| `phrasal-verb` | warning | "set up", "carry out", "find out" and others. The message names a replacement. |
| `lexicon` | warning | A formal word or phrase from our list. The message names a plain replacement. |

The passive-voice rule is an error because it rarely fires on a correct sentence. A participle that names a state, such as a closed valve, still matches when it follows "be". Rewrite the sentence around the state or the actor.

The core rules (`sentence-length`, `paragraph-length`, `term-lock`) and the narration rules apply as well. See [`ste-lite.md`](ste-lite.md).

## What you must still check

The linter does not know the dictionary or the part of speech of a word. Check these yourself:

- Each word keeps one meaning and one part of speech.
- A noun cluster that the heuristic missed is no longer than three nouns.
- Each procedure step holds one instruction, in the imperative, in the order of the work.
- Each warning comes before its step and says the consequence.
- Each paragraph has a topic sentence and one topic.
- The text has no figure of speech, even one that is not in the lexicon.
- Articles and units are present.

## Extend the word list

Add `{ avoid, use, note? }` to `lexicon` in `scripts/profiles/en.mjs`. Write the entry in your own words. Add `verb: true` to match "utilizes", "utilized" and "utilizing" as well. Add a test in `scripts/ste-lint.test.mjs`. Make both changes in the canonical copy: see [`ste-lite.md`](ste-lite.md).

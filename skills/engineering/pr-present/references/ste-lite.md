# STE-lite: the shared writing core

STE-lite is the structural core that every text for a reader obeys, in any language. It sets ceilings for sentences and paragraphs. It locks one term to one concept. A **language profile** adds grammar and word rules on top of it, for one language.

`scripts/ste-lint.mjs` checks the core and the profile. Run it on every text you write: prose, diagram labels, subtitles and narration.

## Core rules

These rules apply in every language. A breach is an **error**.

| Rule id | Limit | Fix |
| --- | --- | --- |
| `sentence-length` | Descriptive sentence: 25 words. List item or procedure step: 20 words. | Split at the conjunction or at the cause. |
| `paragraph-length` | 6 sentences per paragraph. | Give each idea its own paragraph. |
| `term-lock` | An avoided word from the glossary never appears. | Use the canonical term. |

The linter counts words between spaces. A hyphenated word is one word. A number is one word. Markdown marks and loose symbols are not words.

The linter cannot check these rules. Check them yourself:

- One idea per sentence. Do not chain `and`, `while` or `because` clauses.
- Put the condition before the action: "If the size exceeds 10, the engine stops."
- State the mechanism, not a figure of speech.
- Give a number or a limit instead of a vague word.

## Narration

Narration is text a voice will read aloud. A listener cannot reread a sentence. A listener cannot see a bracket, a symbol or a letter. The Senado plain-language page asks for extra care with spoken text for the same reason.

Pass `--narration` for narration. The linter then reads plain text, one beat per paragraph: it skips no markdown. It adds these **errors**:

| Rule id | Limit | Fix |
| --- | --- | --- |
| `narration-sentence-length` | 18 words per sentence. | Split the sentence. One beat is one sentence. |
| `narration-parentheses` | No parentheses, square brackets or braces. | Move the aside into its own sentence. |
| `narration-symbol` | No `/ & % + = < > # * _ \| ~ ^ @ $` or arrows, math signs and backticks. | Write the symbol as a word: "por cento", "percent". |
| `narration-acronym` | No all-caps word of 2 to 6 letters. | Write it as it is spoken. The author picks the form: "A P I" or "a pi". |

Whole numbers can stay as digits: the voice reads "37" as "trinta e sete". Write decimals, versions, dates and units the way the voice must say them ("dois vírgula cinco"), because the voice reads "2.5" as "dois cinco".

## Severities

- **Error** means the text fails. The exit code is 1.
- **Warning** means a person looks at it. The exit code stays 0.
- `--strict` turns every warning into an error.

A rule is an error only when it almost never fires on correct technical prose. Heuristic rules, word lists and style preferences are warnings. A profile lists its rules and their severities.

## Run the linter

`<skill>` is the folder that holds the skill's `SKILL.md`.

```bash
node <skill>/scripts/ste-lint.mjs (--file <path> | --text <string>) \
  [--lang en|pt|<other>] [--narration] [--strict] [--glossary <path>] [--json]
```

| Flag | Meaning |
| --- | --- |
| `--file`, `--text` | The input. Give exactly one. |
| `--lang` | `en` loads the English profile. `pt` or `pt-BR` loads the Portuguese profile. Any other tag loads the core only. |
| `--narration` | Apply the narration rules. |
| `--strict` | Promote warnings to errors. |
| `--glossary` | A markdown glossary in the `GLOSSARY.md` format. Turns on the term lock. |
| `--json` | Print one JSON object: `ok`, `source`, `lang`, `errors`, `warnings`. |

Exit codes: `0` no errors, `1` errors found, `2` usage error.

```bash
node <skill>/scripts/ste-lint.mjs --lang pt --narration \
  --text "O servidor (um broker) guarda 50% dos pacotes."
```

```text
Errors (2)
  line 1  [narration-parentheses]  Parentheses and brackets cannot be spoken. ...
  line 1  [narration-symbol]  Symbols cannot be spoken: "%". Write them as words.
FAIL: 2 errors, 0 warnings.
```

Scripts import the same function: `lintText(text, { lang, narration, strict, glossary })` returns `{ errors, warnings }`. Each finding is `{ rule, severity, message, line, sample }`.

## Term lock

Pass the project glossary with `--glossary`. The linter reads each `**Term**:` entry and its `_Avoid_:` line. An avoided word that appears in the text is an error that names the canonical term. Matching ignores case, matches whole words, and skips inline code. A parenthesis after an avoided word is a comment: the linter drops it.

## Which profile applies

The language of the text picks the profile. A text is in the language of the request message, unless the user or a caller names another language.

| Language of the text | `--lang` | Profile | Reference |
| --- | --- | --- | --- |
| English | `en` | ASD-STE100 writing rules | [`profile-en.md`](profile-en.md) |
| Brazilian Portuguese | `pt` or `pt-BR` | ISO 24495-1 and Senado plain language | [`profile-pt-br.md`](profile-pt-br.md) |
| Any other language | the language tag | None: the core only | This file |

A language without a profile gets the core and the narration rules. Say so in the delivery. Apply the same ideas by judgment: active voice, short words, one term per concept.

## Change the rules

This file, `profile-en.md`, `profile-pt-br.md`, `scripts/ste-lint.mjs` and the two files in `scripts/profiles/` have one canonical copy, in the `easy-to-read` skill. A skill that ships its own copy, such as `explain-me`, keeps each file byte-identical to the canonical copy. Change the canonical copy first, then copy the file over. The contract test in `easy-to-read/scripts/ste-lint.test.mjs` fails while the two copies differ.

---
name: easy-to-read
description: "Use when the user wants plain, easy-to-read language in what you write for them: 'easy to read', 'plain language', 'plain English', 'write simply', 'simplify this text', 'shorter sentences', 'Simplified Technical English', 'ASD-STE100', 'linguagem simples', 'linguagem clara', 'escreve simples', 'fala mais simples', 'texto fácil de ler', 'simplifica esse texto', 'responde de forma simples', 'ISO 24495', 'manual do Senado'. Once active, it stays on for the rest of the session: every chat reply, document, note, summary, and PR or issue body written for a person follows STE-lite and the Language Profile of the text's language (English: ASD-STE100; Brazilian Portuguese: ABNT NBR ISO 24495-1 and the Senado style; other languages: the core only). Documents pass the bundled linter before delivery, and long replies are linted as drafts. Code, commands, paths, identifiers and quoted text are never rewritten."
metadata:
  author: Matheus Borges
  version: 1.0.0
---

# Easy to Read

Write every text that a person reads in plain language. The rules are **STE-lite**, a structural core for any language, plus the **Language Profile** of the text's language. The English profile follows ASD-STE100. The profile for Brazilian Portuguese takes its rules from ABNT NBR ISO 24495-1 and the Senado style. Other languages get the core only. A linter checks the core and the profile.

`<skill>` is the folder that holds this SKILL.md: `skills/easy-to-read` in this repository, the folder where the plugin installed it elsewhere. Below, `ste-lint.mjs` means `node <skill>/scripts/ste-lint.mjs`.

## Scope

- **When.** The rules apply from the moment this skill activates to the end of the session. Stop only when the user tells you to stop.
- **What.** Every reader text: chat replies, documents, notes, summaries, PR and issue bodies. Any other text for a person counts too.
- **Exempt spans.** Never rewrite code, commands, file paths, identifiers, URLs, error messages or quoted source text. Never rewrite anything inside backticks or a code fence. Keep each span byte for byte. Details: [`references/replies-and-documents.md`](references/replies-and-documents.md).

## Steps

1. **Load the rules.** Read [`references/ste-lite.md`](references/ste-lite.md) once per session. Then read the profile of each language you write in: [`references/profile-en.md`](references/profile-en.md) or [`references/profile-pt-br.md`](references/profile-pt-br.md).
2. **Pick the language and the profile.** A reply is in the language of the last user message. A document is in the language that the user names, else in the language of the request. Use `--lang en` for English and `--lang pt` for Portuguese. For any other language, use its tag: the linter then applies the core only. Tell the user this once, in the first reply.
3. **Write under the rules.** Put the answer or the action first. Then use:
   - one idea per sentence, with the condition before the action;
   - 25 words at most in a descriptive sentence, and 20 in a list item or a step;
   - 6 sentences at most in a paragraph;
   - the active voice, simple tenses, short common words, and a number instead of a vague word;
   - backticks around each command, path and identifier.
4. **Lock the terms.** Use one word for one concept in the whole text. Explain each technical term once, in plain words, on first use. A project can have a glossary such as `GLOSSARY.md`, with `**Term**:` and `_Avoid_:` lines. If one exists, use its terms and add `--glossary <path>` to every lint.
5. **Lint every document before you deliver it.** Run `ste-lint.mjs --file <path> --lang <tag>`. Fix every error. Fix every warning too, unless it flags a quoted example or a fixed name. Run the linter again until it exits 0. A text that the user asks you to simplify is a document. Keep its facts, its intent and every exempt span.
6. **Check every reply before you send it.** Apply the rules while you write. Lint the draft if it has more than three paragraphs or a list of steps. Also lint it when you doubt a rule. Write the draft to a scratch file outside the project, and run `ste-lint.mjs --file <draft> --lang <tag>`. For a short draft, `--text "<draft>"` also works. Fix every error, then send the reply.
7. **Lint spoken text with `--narration`.** Spoken text is a script or any other text that a voice reads aloud. The limit is 18 words per sentence, with no brackets and no symbols. Write each acronym as it sounds.
8. **Follow an explicit instruction for one text.** The user can name a style or a fixed structure for one text. The user can also ask you to keep their own text. That instruction wins over these rules, for that text only. The rules stay on for every other text.

## Done-check

Before you deliver a document or send a reply:

- [ ] The text follows STE-lite and the profile of its language. If its language has no profile, the text follows the core, and the user knows it.
- [ ] Each document passed `ste-lint.mjs` with exit 0. The lint used `--glossary` when a glossary exists, and `--narration` for spoken text.
- [ ] Each long reply passed the linter as a draft. You checked each short reply against the rules.
- [ ] Each exempt span is byte for byte as before: code, commands, paths, identifiers, URLs, quotes and fenced blocks.
- [ ] Each concept has one term in the whole text.
- [ ] The rules stay on for the next text, until the session ends or the user says stop.

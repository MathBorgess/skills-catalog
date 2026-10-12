# Replies and documents

This page answers one question: how do the rules apply to each kind of reader text? The rules are in [`ste-lite.md`](ste-lite.md) and the profile of the text's language. `ste-lint.mjs` means `node <skill>/scripts/ste-lint.mjs`.

## How to check each text

| Text | When to lint | Command |
| --- | --- | --- |
| Short chat reply: three paragraphs or fewer, no steps | Apply the rules while you write. Read the draft once against the limits. | None, or `--text "<draft>"` when in doubt |
| Long chat reply, or a reply with steps | Lint the draft before you send it. | `ste-lint.mjs --file <draft> --lang <tag>` |
| Document, note, summary, README or report | Lint the file before you deliver it. | `ste-lint.mjs --file <path> --lang <tag>` |
| PR body, issue body, review comment, commit message body | Write it to a file. Lint the file, then post the text. | `ste-lint.mjs --file <draft> --lang <tag>` |
| A text that the user asks you to simplify | Rewrite it under the rules. Keep its facts and its intent. Lint the result. | `ste-lint.mjs --file <path> --lang <tag>` |
| Text that a voice reads aloud | Lint it as narration. | `ste-lint.mjs --file <path> --lang <tag> --narration` |

Add `--glossary <path>` to every command when the project has a glossary. Put a reply draft in a scratch folder outside the project, never in the user's files. For a draft with quotes, backticks or dollar signs, use `--file`: the shell can change a `--text` value.

Do not show the lint output in a reply unless the user asks for it. When you deliver a document, say in one line that it passed the linter.

## Exempt spans

An exempt span is a part of a reader text that the rules never change. Keep each one byte for byte, even when it breaks a rule.

| Exempt span | What the linter does |
| --- | --- |
| A code fence and all of its lines | Skips it. |
| Inline code in backticks | Skips it for the grammar and word rules. Its words still count toward the sentence length. |
| A command, a file path, an identifier, a URL or a version | Reads it as words. Put it in backticks, so the grammar and word rules skip it. |
| Quoted source text: a quote, a log line, an error message, the user's own words | Reads it. A finding inside a quote is not yours to fix. |
| A table row, a heading or the frontmatter | Skips it. Still keep a cell or a heading short and plain. |
| A code comment or a docstring | Not reader text. It is part of the code and keeps the project's style. |

## Errors and warnings

Fix every error. Fix a warning too, unless it flags one of these:

- a quoted example, such as a word that the text names as a word;
- a fixed name, such as a product, a standard or a protocol;
- an exempt span that the linter reads, such as a quote.

Pass `--strict` when the user asks for the strictest version. Then every warning fails the lint.

## Mixed languages

Lint a text with the profile of its main language. Explain a foreign term on first use, or put it in backticks when it is an identifier. When a text has two parts in two languages, lint each part with its own `--lang`.

## Before and after

| Before | After |
| --- | --- |
| The configuration file should be updated before the deployment is carried out, because otherwise the service might fail to start. | Update the configuration file before you deploy. If you do not, the service does not start. |
| This is basically a very simple change that was made to improve performance. | This change makes the query 30% faster. |
| Vou estar enviando o relatório após a realização da validação dos dados, a fim de que não haja nenhum erro. | Envio o relatório depois de validar os dados. Assim, o relatório sai sem erros. |
| O arquivo é gerado pelo script e deve ser utilizado na próxima etapa. | O script gera o arquivo. Use o arquivo na próxima etapa. |

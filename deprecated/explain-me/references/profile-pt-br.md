# Portuguese profile: ISO 24495-1 and Senado plain language

Use this profile when the text is in Brazilian Portuguese. It adds grammar and word rules on top of [`ste-lite.md`](ste-lite.md). Lint with `--lang pt` or `--lang pt-BR`.

Two sources shape it. This page paraphrases both.

- **ABNT NBR ISO 24495-1**, plain language. The standard is a paid document: buy it from ABNT and do not copy it into this repository.
- **The Senado Federal style page** on simpler words: <https://www12.senado.leg.br/manualdecomunicacao/estilos/palavras-mais-simples>.

The word list in `scripts/profiles/pt-br.mjs` is our own.

## Review checklist: the four principles of ISO 24495-1

Ask these four questions about every text. The linter cannot answer them.

1. **Relevant.** Does the text give the reader what the reader needs for this task, and nothing else?
2. **Findable.** Can the reader reach the part they need fast? Check the order, the titles and the signposts.
3. **Understandable.** Can the reader grasp each sentence on the first read? Check the words, the sentence length and the defined terms.
4. **Usable.** Can the reader act with the text? Check for a concrete example, the steps in order and the next action.

## The six principles of the Senado style

1. Use simple words.
2. Explain technical terms, jargon, foreign words and acronyms.
3. Use the direct order: subject, verb, complement.
4. Use the affirmative form.
5. Write short paragraphs with one subject each.
6. Take extra care with text that a voice will speak.

## What the linter checks

| Rule id | Severity | What it finds | Before | After |
| --- | --- | --- | --- | --- |
| `voz-passiva` | error | A form of "ser", up to two adverbs, a participle, and an optional "por", "pelo" or "pela". | O pacote é validado pelo broker. | O broker valida o pacote. |
| `gerundismo` | error | "vai", "vou" or "vamos" and "estar" with a gerund. | Vou estar enviando o arquivo. | Vou enviar o arquivo. |
| `dupla-negacao` | error | "não", "nunca" or "jamais", then "nenhum", "nada", "ninguém" or another negative, in one clause. | A tabela não aceita nenhum valor vazio. | A tabela exige todos os valores. |
| `progressivo` | warning | "estar" with a gerund. | O servidor está enviando dados. | O servidor envia dados. |
| `passiva-sintetica` | warning | A verb with the enclitic "-se". | Valida-se o pacote. | O broker valida o pacote. |
| `nominalizacao` | warning | "realizar", "efetuar", "fazer", "proceder a" or "promover" with a noun in -ção or -mento. The message names the verb. | O sistema faz a validação do pacote. | O sistema valida o pacote. |
| `frase-negativa` | warning | "não", "nunca", "nenhum" and similar. "Não só" and "não apenas" do not count. | O cache não guarda dados antigos. | O cache descarta dados antigos. |
| `sigla-nao-explicada` | warning | An acronym of 2 to 6 capitals with no expansion on first use. | O HTTP leva o pacote. | O protocolo de transferência (HTTP) leva o pacote. |
| `qualificador-vago` | warning | "muito", "bastante", "extremamente", "praticamente", "basicamente", "realmente", and "bem" before an adjective or adverb. | O servidor é muito rápido. | O servidor responde em 20 milissegundos. |
| `lexicon` | warning | A formal word or phrase from our list, such as "utilizar", "efetuar", "a fim de", "visando". | O sistema utiliza o broker a fim de enviar. | O sistema usa o broker para enviar. |

An acronym counts as explained in three cases. A parenthesis or a dash follows it. It sits inside a parenthesis after its full name. The glossary defines it. The linter checks the first use only.

Three rules are errors because they rarely fire on a correct sentence. Every other rule is a warning, because the rule is a heuristic or a style preference. Use `--strict` to fail on warnings.

The core rules (`sentence-length`, `paragraph-length`, `term-lock`) and the narration rules apply as well. See [`ste-lite.md`](ste-lite.md).

## Narration in Portuguese

A listener cannot see a letter or a symbol. In narration, write each acronym as it sounds ("agá tê tê pê") and each symbol as a word ("por cento", "barra"). Keep each sentence to 18 words. When a subtitle file carries the same text, write the text once, as the voice says it.

## What stays a judgment call

The linter does not check these. Check them yourself.

- **Direct order.** The sentence starts with the subject and goes on to the verb. No long aside sits between them.
- **One subject per paragraph.** Each paragraph answers one question.
- **Terms.** Explain each technical term once, in plain words, on first use.
- **Foreign words.** Use the Portuguese word, or explain the foreign word on first use.
- **The four principles.** Relevance, findability and usability need a person who reads the text as its reader does.

#!/usr/bin/env node
// Tests for the canonical ste-lint, its profiles and the easy-to-read texts, plus the
// contract that keeps explain-me's byte copies equal. Run: node skills/easy-to-read/scripts/ste-lint.test.mjs

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  extractParagraphs,
  splitSentences,
  countWords,
  lintSteLite,
  lintText,
  parseGlossary,
} from "./ste-lint.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = join(HERE, "..");
const SIBLING = join(SKILL, "..", "explain-me");

let passed = 0;
let failed = 0;

function assert(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL ${name}${detail === undefined ? "" : `\n     ${detail}`}`);
  }
}

const rules = (list) => list.map((f) => f.rule);
const has = (list, rule) => list.some((f) => f.rule === rule);

// -----------------------------------------------------------------------------
// 1. Sentence splitting & abbreviations
// -----------------------------------------------------------------------------

const textWithAbbr = "This is a test, e.g. for testing purposes. It works well vs. older methods! What do you think?";
const sentences = splitSentences(textWithAbbr);
assert("splitSentences: correctly splits into 3 sentences", sentences.length === 3);
assert("splitSentences: preserves e.g. without splitting", sentences[0].includes("e.g."));
assert("splitSentences: preserves vs. without splitting", sentences[1].includes("vs."));

// -----------------------------------------------------------------------------
// 2. Word counting
// -----------------------------------------------------------------------------

assert("countWords: basic sentence", countWords("The client sends a network packet.") === 6);
assert("countWords: ignores markdown asterisks and backticks", countWords("The `client` sends **one packet**.") === 5);
assert("countWords: counts link anchor text properly", countWords("Read the [glossary specification](GLOSSARY.md) now.") === 5);

// -----------------------------------------------------------------------------
// 3. Sentence length linting
// -----------------------------------------------------------------------------

const shortDesc = "The broker validates incoming packets before routing. It discards malformed frames immediately.";
assert("lintSteLite: passes short descriptive sentences", lintSteLite(shortDesc).length === 0);

const longDescSentence = "This is an extraordinarily verbose descriptive sentence that continues going on and on without any punctuation or pause until it finally exceeds the maximum ceiling of twenty-five words specified by the standard.";
const violationsLong = lintSteLite(longDescSentence);
assert("lintSteLite: catches sentence exceeding 25 words", violationsLong.some((v) => v.type === "sentence_length"));

const proceduralStep = "1. Execute the build command and verify that every single generated asset is placed in the designated distribution folder immediately without errors.";
const violationsProc = lintSteLite(proceduralStep);
assert("lintSteLite: catches procedural step exceeding 20 words", violationsProc.some((v) => v.type === "sentence_length" && v.limit === 20));

// -----------------------------------------------------------------------------
// 4. Paragraph limit linting
// -----------------------------------------------------------------------------

const paragraphWith7Sentences = [
  "Sentence one is here.",
  "Sentence two follows.",
  "Sentence three arrives.",
  "Sentence four is short.",
  "Sentence five continues.",
  "Sentence six finishes.",
  "Sentence seven breaks limit.",
].join(" ");

const violationsPara = lintSteLite(paragraphWith7Sentences);
assert("lintSteLite: catches paragraph exceeding 6 sentences", violationsPara.some((v) => v.type === "paragraph_length"));

// -----------------------------------------------------------------------------
// 5. Code block and table immunity
// -----------------------------------------------------------------------------

const docWithTableAndCode = `
# Title

Here is a short paragraph. It explains the concept cleanly.

| Col A | Col B | Col C |
| --- | --- | --- |
| Long cell content that might otherwise look like a sentence with lots of words | Cell 2 | Cell 3 |

\`\`\`bash
# Long shell script comment with more than thirty words that should never ever be counted by the linter as an STE violation
npm run check
\`\`\`

Final concluding sentence.
`;

const violationsDoc = lintSteLite(docWithTableAndCode);
assert("lintSteLite: ignores tables and code blocks", violationsDoc.length === 0);

// -----------------------------------------------------------------------------
// 6. Unicode: Portuguese sentences and words
// -----------------------------------------------------------------------------

const ptSentences = splitSentences("Isso funciona. É simples. Às vezes falha. Ótimo resultado.");
assert("splitSentences: splits before É, Á, Ó", ptSentences.length === 4 && ptSentences[1] === "É simples.");
assert("splitSentences: keeps Sr. and Dra. attached", splitSentences("Fale com o Sr. Silva e com a Dra. Rocha. Depois siga.").length === 2);
assert("splitSentences: keeps p. ex. and art. attached", splitSentences("Use p. ex. o modo seguro, conforme o art. 5. Depois siga.").length === 2);
assert("splitSentences: keeps pág. attached", splitSentences("Veja a pág. 10 do manual. Depois siga.").length === 2);
assert("splitSentences: etc. before a new sentence ends it", splitSentences("Veja a lista, etc. Depois siga.").length === 2);
assert("splitSentences: etc. inside a sentence does not end it", splitSentences("Veja a lista etc. e siga.").length === 1);
assert("splitSentences: list numbers do not split", splitSentences("1. Abra o arquivo. 2. Leia o texto.").length === 2);
assert("countWords: counts accented words (é, às)", countWords("Isso é bom às vezes.") === 5);
assert("countWords: counts a sentence that starts with É", countWords("É um pacote.") === 3);

// -----------------------------------------------------------------------------
// 7. lintText: core rules in any language
// -----------------------------------------------------------------------------

const core = lintText("The broker validates the packet. It routes the frame.", {});
assert("lintText: clean text has no findings", core.errors.length === 0 && core.warnings.length === 0);

const coreLong = lintText(longDescSentence, {});
assert("lintText: sentence over 25 words is an error", has(coreLong.errors, "sentence-length"));

const coreProc = lintText(`- ${proceduralStep.slice(3)}`, {});
assert("lintText: list item over 20 words is an error", has(coreProc.errors, "sentence-length"));

assert("lintText: paragraph over 6 sentences is an error", has(lintText(paragraphWith7Sentences, {}).errors, "paragraph-length"));

const spanish = lintText("El paquete es validado por el broker.", { lang: "es" });
assert("lintText: a language without a profile gets the core only", spanish.errors.length === 0 && spanish.warnings.length === 0);

const finding = lintText("Primeira linha curta.\n\nA terceira linha é enviada pelo servidor.", { lang: "pt" }).errors[0];
assert("lintText: finding has rule, message, line and sample", finding && finding.rule && finding.message && finding.line === 3 && finding.sample);

const frontmatter = lintText("---\nname: x\n---\n\nUma frase.\n\nO pacote é validado pelo broker.\n", { lang: "pt" });
assert("lintText: line numbers count the frontmatter", frontmatter.errors[0]?.line === 7);

assert("extractParagraphs: each list item is its own procedural paragraph",
  extractParagraphs("- one\n- two\n- three").length === 3 && extractParagraphs("- one\n- two").every((p) => p.procedural));

// -----------------------------------------------------------------------------
// 8. pt-BR profile
// -----------------------------------------------------------------------------

const ptPassive = lintText("O pacote é validado pelo broker.", { lang: "pt" });
assert("pt: passive voice with ser is an error", has(ptPassive.errors, "voz-passiva"));
assert("pt: passive sample shows the agent", ptPassive.errors[0]?.sample === "é validado pelo broker");
assert("pt: the lang tag pt-BR selects the same profile", has(lintText("O pacote é validado pelo broker.", { lang: "pt-BR" }).errors, "voz-passiva"));

const ptActive = lintText("O broker valida o pacote.", { lang: "pt" });
assert("pt: active sentence is clean", ptActive.errors.length === 0 && ptActive.warnings.length === 0);
assert("pt: tem sido + participle is an error", has(lintText("O pacote tem sido validado.", { lang: "pt" }).errors, "voz-passiva"));
assert("pt: irregular participle after ser is an error", has(lintText("O relatório é feito pelo broker.", { lang: "pt" }).errors, "voz-passiva"));
assert("pt: nouns ending in -ado/-ido are not passives", lintText("O resultado é o estado do sistema. Isso é um dado.", { lang: "pt" }).errors.length === 0);
assert("pt: ser with an adjective is not a passive", lintText("A chave é única e o pacote é pequeno.", { lang: "pt" }).errors.length === 0);

const gerundismo = lintText("Vamos estar verificando o pacote.", { lang: "pt" });
assert("pt: gerundismo is an error", has(gerundismo.errors, "gerundismo"));
assert("pt: gerundismo is not also reported as progressive", !has(gerundismo.warnings, "progressivo"));

const progressive = lintText("O servidor está enviando dados.", { lang: "pt" });
assert("pt: estar + gerund is a warning", has(progressive.warnings, "progressivo") && progressive.errors.length === 0);

const nominal = lintText("O sistema faz a validação do pacote.", { lang: "pt" });
assert("pt: nominalization is a warning", has(nominal.warnings, "nominalizacao") && nominal.errors.length === 0);
assert("pt: nominalization names the verb to use", nominal.warnings.find((w) => w.rule === "nominalizacao")?.message.includes('"validar"'));
assert("pt: proceder a + noun is a nominalization", has(lintText("O servidor procede à verificação dos campos.", { lang: "pt" }).warnings, "nominalizacao"));

const acronym = lintText("O HTTP leva o pacote. O HTTP responde.", { lang: "pt" });
assert("pt: unexplained acronym is a warning, once", acronym.warnings.filter((w) => w.rule === "sigla-nao-explicada").length === 1);
assert("pt: acronym with a parenthesis expansion is clean", !has(lintText("O HTTP (protocolo de transferência) leva o pacote.", { lang: "pt" }).warnings, "sigla-nao-explicada"));
assert("pt: acronym after its full name is clean", !has(lintText("O protocolo de transferência (HTTP) leva o pacote.", { lang: "pt" }).warnings, "sigla-nao-explicada"));
assert("pt: acronym with a dash expansion is clean", !has(lintText("O HTTP - protocolo de transferência - leva o pacote.", { lang: "pt" }).warnings, "sigla-nao-explicada"));
assert("pt: acronym in the glossary is clean", !has(lintText("O HTTP leva o pacote.", { lang: "pt", glossary: "**HTTP**:\nProtocolo de transferência.\n" }).warnings, "sigla-nao-explicada"));

assert("pt: negative sentence is a warning", has(lintText("O servidor não responde.", { lang: "pt" }).warnings, "frase-negativa"));
assert("pt: não só is not a negation", !has(lintText("O broker não só valida como também envia.", { lang: "pt" }).warnings, "frase-negativa"));
const doubleNegation = lintText("Não existe nenhum limite.", { lang: "pt" });
assert("pt: double negation is an error", has(doubleNegation.errors, "dupla-negacao"));
assert("pt: double negation is not also a negative-sentence warning", !has(doubleNegation.warnings, "frase-negativa"));

assert("pt: enclitic -se passive is a warning", has(lintText("Valida-se o pacote antes do envio.", { lang: "pt" }).warnings, "passiva-sintetica"));
assert("pt: vague qualifier is a warning", has(lintText("O servidor é muito rápido.", { lang: "pt" }).warnings, "qualificador-vago"));
assert("pt: bem como is not an intensifier", !has(lintText("O broker valida bem como envia.", { lang: "pt" }).warnings, "qualificador-vago"));

const ptLexicon = lintText("O sistema utiliza o broker a fim de enviar dados.", { lang: "pt" });
assert("pt: lexicon hit is a warning", has(ptLexicon.warnings, "lexicon") && ptLexicon.errors.length === 0);
assert("pt: lexicon matches inflected verbs", ptLexicon.warnings.some((w) => w.message.includes('"usar"')));
assert("pt: lexicon matches multi-word phrases", ptLexicon.warnings.some((w) => w.message.includes('"para"')));

const strictPt = lintText("O sistema utiliza o broker.", { lang: "pt", strict: true });
assert("strict: a warning becomes an error", strictPt.errors.some((e) => e.rule === "lexicon") && strictPt.warnings.length === 0);

// -----------------------------------------------------------------------------
// 9. Narration
// -----------------------------------------------------------------------------

const narrationLong = "Esta frase de narração tem muitas palavras porque o autor continuou escrevendo até passar de dezoito palavras no total.";
assert("narration: sentence over 18 words is an error", has(lintText(narrationLong, { lang: "pt", narration: true }).errors, "narration-sentence-length"));
assert("narration: the same sentence passes as written text", !has(lintText(narrationLong, { lang: "pt" }).errors, "narration-sentence-length"));
assert("narration: 18 words pass", lintText("Uma tabela hash guarda pares de chave e valor para achar cada valor com rapidez em uma busca.", { lang: "pt", narration: true }).errors.length === 0);
assert("narration: parentheses are an error", has(lintText("O servidor (um broker) envia o pacote.", { lang: "pt", narration: true }).errors, "narration-parentheses"));
assert("narration: symbols are an error", has(lintText("O servidor envia 50% dos dados.", { lang: "pt", narration: true }).errors, "narration-symbol"));
assert("narration: an arrow is a symbol", has(lintText("O dado vai → para o disco.", { lang: "pt", narration: true }).errors, "narration-symbol"));
assert("narration: an acronym is an error", has(lintText("O servidor usa o HTTP.", { lang: "pt", narration: true }).errors, "narration-acronym"));
assert("narration: an acronym written as spoken passes", lintText("O servidor usa o agá tê tê pê.", { lang: "pt", narration: true }).errors.length === 0);
assert("narration: the acronym rule also covers English", has(lintText("The client calls the API.", { lang: "en", narration: true }).errors, "narration-acronym"));
assert("narration: acronym rule needs no profile", has(lintText("El cliente llama a la API.", { lang: "es", narration: true }).errors, "narration-acronym"));

// -----------------------------------------------------------------------------
// 10. English profile
// -----------------------------------------------------------------------------

assert("en: passive voice is an error", has(lintText("The packet is validated by the broker.", { lang: "en" }).errors, "passive-voice"));
assert("en: passive with an adverb and negation is an error", has(lintText("The value is not set.", { lang: "en" }).errors, "passive-voice"));
assert("en: passive after a modal is an error", has(lintText("The file must be closed first.", { lang: "en" }).errors, "passive-voice"));
const enActive = lintText("The broker validates the packet.", { lang: "en" });
assert("en: active sentence is clean", enActive.errors.length === 0 && enActive.warnings.length === 0);
assert("en: a color word ending in -ed is not a passive", lintText("The warning is red.", { lang: "en" }).errors.length === 0);
assert("en: the lang tag en-US selects the English profile", has(lintText("The packet is validated.", { lang: "en-US" }).errors, "passive-voice"));

const modal = lintText("The broker should validate the packet.", { lang: "en" });
assert("en: ambiguous modal is a warning", has(modal.warnings, "ambiguous-modal") && modal.errors.length === 0);
assert("en: must is not an ambiguous modal", lintText("The broker must validate the packet.", { lang: "en" }).warnings.length === 0);
assert("en: vague qualifier is a warning", has(lintText("The cache is very large.", { lang: "en" }).warnings, "vague-qualifier"));
assert("en: phrasal verb is a warning with a replacement", lintText("Carry out the test.", { lang: "en" }).warnings.some((w) => w.rule === "phrasal-verb" && w.message.includes("perform")));
assert("en: noun cluster is a warning", has(lintText("Set the database connection pool size limit.", { lang: "en" }).warnings, "noun-cluster"));
assert("en: three nouns are not a cluster", !has(lintText("Check the connection pool size.", { lang: "en" }).warnings, "noun-cluster"));
assert("en: -ing as an adjective is a warning", has(lintText("The routing table stores each route.", { lang: "en" }).warnings, "ing-noun"));
assert("en: progressive tense is a warning", has(lintText("The server is sending data.", { lang: "en" }).warnings, "progressive-tense"));
assert("en: lexicon hit is a warning", has(lintText("Utilize the cache.", { lang: "en" }).warnings, "lexicon"));
assert("en: lexicon matches inflected verbs", lintText("The broker utilizes the cache.", { lang: "en" }).warnings.some((w) => w.message.includes('"use"')));
assert("en: strict turns a modal warning into an error", has(lintText("The broker should validate the packet.", { lang: "en", strict: true }).errors, "ambiguous-modal"));
assert("en: code spans are ignored by grammar rules", lintText("The `is_validated` flag marks the packet.", { lang: "en" }).errors.length === 0);

// -----------------------------------------------------------------------------
// 11. Glossary and term lock
// -----------------------------------------------------------------------------

const glossaryText = `# Demo

## Language

**Frame**:
One image of the collection.
_Avoid_: photo, shot (a shot is a camera action), the picture

**Run**:
One explanation produced end to end.
_Avoid_: job, \`session\`
`;

const parsed = parseGlossary(glossaryText);
assert("parseGlossary: reads terms and avoided words", parsed.length === 2 && parsed[0].term === "Frame" && parsed[1].term === "Run");
assert("parseGlossary: drops parenthesised comments", parsed[0].avoid.join("|") === "photo|shot|the picture");
assert("parseGlossary: strips backticks", parsed[1].avoid.join("|") === "job|session");

const locked = lintText("Each Photo is one shot. The photograph stays.", { glossary: glossaryText });
assert("term lock: avoided words are errors that name the term", locked.errors.length === 2 && locked.errors.every((e) => e.rule === "term-lock" && e.message.includes('"Frame"')));
assert("term lock: matching is case-insensitive", locked.errors.some((e) => e.sample === "Photo"));
assert("term lock: whole words only", !locked.errors.some((e) => /photograph/i.test(e.sample)));
assert("term lock: the canonical term passes", lintText("Each frame is one image.", { glossary: glossaryText }).errors.length === 0);
assert("term lock: works with parsed entries", has(lintText("A job runs.", { glossary: [{ term: "Run", avoid: ["job"] }] }).errors, "term-lock"));
assert("term lock: accented words match whole", has(lintText("A informação chega.", { glossary: [{ term: "Dado", avoid: ["informação"] }] }).errors, "term-lock"));
assert("term lock: ignores inline code", lintText("The `photo` field stays.", { glossary: glossaryText }).errors.length === 0);

// -----------------------------------------------------------------------------
// 12. CLI
// -----------------------------------------------------------------------------

const script = fileURLToPath(new URL("./ste-lint.mjs", import.meta.url));
const cli = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });

const cliClean = cli("--text", "The broker validates the packet.", "--lang", "en");
assert("cli: exit 0 when there are no errors", cliClean.status === 0 && cliClean.stdout.includes("ok:"));

const cliError = cli("--text", "The packet is validated by the broker.", "--lang", "en");
assert("cli: exit 1 on errors, with the rule and the line", cliError.status === 1 && cliError.stdout.includes("passive-voice") && cliError.stdout.includes("line 1"));

const cliWarn = cli("--text", "The broker should validate the packet.", "--lang", "en");
assert("cli: warnings print but do not fail", cliWarn.status === 0 && cliWarn.stdout.includes("Warnings (1)"));
assert("cli: --strict fails on warnings", cli("--text", "The broker should validate the packet.", "--lang", "en", "--strict").status === 1);

const cliPtNarration = cli("--text", "O servidor (um broker) envia 50% dos dados.", "--lang", "pt", "--narration");
assert("cli: narration errors fail", cliPtNarration.status === 1 && cliPtNarration.stdout.includes("narration-parentheses"));

const cliJson = JSON.parse(cli("--text", "O pacote é validado pelo broker.", "--lang", "pt", "--json").stdout);
assert("cli: --json prints one object", cliJson.ok === false && cliJson.lang === "pt-br" && cliJson.errors.length === 1 && Array.isArray(cliJson.warnings));

const cliCore = cli("--text", "El paquete es validado.", "--lang", "es");
assert("cli: an unknown language says it runs the core only", cliCore.status === 0 && cliCore.stdout.includes("core rules only"));

const dir = mkdtempSync(join(tmpdir(), "ste-lint-test-"));
try {
  const doc = join(dir, "doc.md");
  const glossary = join(dir, "glossary.md");
  writeFileSync(doc, "# Title\n\nEach photo is one image.\n");
  writeFileSync(glossary, glossaryText);

  const cliFile = cli("--file", doc, "--glossary", glossary);
  assert("cli: --glossary reports term lock errors with the line", cliFile.status === 1 && cliFile.stdout.includes("term-lock") && cliFile.stdout.includes("line 3"));
  assert("cli: --file without errors exits 0", cli("--file", doc).status === 0);

  const bareGlossary = join(dir, "glossary.txt");
  writeFileSync(bareGlossary, glossaryText);
  assert("term lock: lintText accepts a glossary file path, whatever its extension", has(lintText("Each photo is one image.", { glossary: bareGlossary }).errors, "term-lock"));
  assert("term lock: lintText accepts a markdown glossary path", has(lintText("Each photo is one image.", { glossary }).errors, "term-lock"));
  assert("cli: a missing glossary is a usage error", cli("--file", doc, "--glossary", join(dir, "missing.md")).status === 2);
  assert("cli: a missing file is a usage error", cli("--file", join(dir, "missing.md")).status === 2);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

assert("cli: no input is a usage error", cli().status === 2);
assert("cli: --file and --text together are a usage error", cli("--file", "a.md", "--text", "b").status === 2);
assert("cli: an unknown flag is a usage error", cli("--text", "x", "--nope").status === 2);
assert("cli: a flag without a value is a usage error", cli("--text").status === 2);

// -----------------------------------------------------------------------------
// 13. Reader texts: exempt spans pass through
// -----------------------------------------------------------------------------

const reply = `Run the check before you push.

\`\`\`bash
# The packet is validated by the broker, and this comment should never be read as prose by the linter at all.
npm run check
\`\`\`

| Flag | Meaning |
| --- | --- |
| \`--strict\` | Every warning is promoted to an error by the linter. |

The \`is_validated\` flag marks the packet. Edit \`skills/utilize/notes.md\` next.
`;
const replyLint = lintText(reply, { lang: "en" });
assert("reader text: a fence, a table and inline code raise no finding", replyLint.errors.length === 0 && replyLint.warnings.length === 0, JSON.stringify(replyLint));
assert("reader text: a bare path is read as words", has(lintText("Edit skills/utilize/notes.md next.", { lang: "en" }).warnings, "lexicon"));
assert("reader text: the same path in backticks is skipped", lintText("Edit `skills/utilize/notes.md` next.", { lang: "en" }).warnings.length === 0);
assert("reader text: a heading is skipped", lintText("# The packet is validated by the broker\n\nThe broker validates the packet.\n", { lang: "en" }).errors.length === 0);
assert("reader text: a blockquote is read, so a finding inside a quote shows", has(lintText("> The packet is validated by the broker.", { lang: "en" }).errors, "passive-voice"));
const replyPt = lintText("Rode o teste antes do push.\n\n```bash\n# O pacote é validado pelo broker.\nnpm test\n```\n\nO comando `vai_estar_enviando` existe.\n", { lang: "pt" });
assert("reader text: a Portuguese reply with a fence and inline code is clean", replyPt.errors.length === 0 && replyPt.warnings.length === 0, JSON.stringify(replyPt));

// -----------------------------------------------------------------------------
// 14. The skill's own texts follow its rules
// -----------------------------------------------------------------------------

const own = ["SKILL.md", "references/ste-lite.md", "references/profile-en.md", "references/profile-pt-br.md", "references/replies-and-documents.md"];
for (const rel of own) {
  const r = lintText(readFileSync(join(SKILL, rel), "utf8"), { lang: "en" });
  assert(`own text: ${rel} has no error under the English profile`, r.errors.length === 0, JSON.stringify(r.errors));
}

const examples = readFileSync(join(SKILL, "references", "replies-and-documents.md"), "utf8")
  .split("## Before and after")[1]
  .split(/\r?\n/)
  .filter((l) => l.startsWith("|") && !/^\|\s*(?:Before|-{3})/.test(l))
  .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
assert("examples: the before-and-after table has rows in English and in Portuguese", examples.length >= 4 && examples.some(([b]) => /[à-ú]/i.test(b)) && examples.some(([b]) => !/[à-ú]/i.test(b)));
for (const [before, after] of examples) {
  const lang = /[à-ú]/i.test(before + after) ? "pt" : "en";
  const b = lintText(before, { lang });
  const a = lintText(after, { lang });
  assert(`examples (${lang}): "${after.slice(0, 40)}..." is clean and its before fails`, b.errors.length > 0 && a.errors.length === 0 && a.warnings.length === 0, JSON.stringify({ before: b.errors.map((f) => f.rule), after: a }));
}

// -----------------------------------------------------------------------------
// 15. Contract: explain-me ships byte copies of the rules and the linter
// -----------------------------------------------------------------------------

const COPIES = [
  "scripts/ste-lint.mjs",
  "scripts/profiles/en.mjs",
  "scripts/profiles/pt-br.mjs",
  "references/ste-lite.md",
  "references/profile-en.md",
  "references/profile-pt-br.md",
];
if (existsSync(join(SIBLING, "scripts", "ste-lint.mjs"))) {
  for (const rel of COPIES) {
    const theirs = join(SIBLING, rel);
    const same = existsSync(theirs) && readFileSync(join(SKILL, rel)).equals(readFileSync(theirs));
    assert(`contract: explain-me's ${rel} is byte-identical to easy-to-read's`, same, `copy skills/easy-to-read/${rel} over skills/explain-me/${rel}`);
  }
} else {
  console.log("skip contract: explain-me is not installed next to this skill");
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

if (failed) {
  console.error(`\n${passed} passed, ${failed} failed.`);
  process.exit(1);
}

console.log(`\nok: all ${passed} easy-to-read ste-lint tests passed`);

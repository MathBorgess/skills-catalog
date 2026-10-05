#!/usr/bin/env node
// ste-lint: deterministic linter for STE-lite, the shared structural writing core,
// plus one language profile per requester language (en, pt-BR).
// Standard library only, zero dependencies.
//
//   node ste-lint.mjs (--file <path> | --text <string>) [--lang en|pt|<other>]
//                     [--narration] [--strict] [--glossary <path>] [--json]
//
// Exit codes: 0 no errors, 1 errors found, 2 usage error.

import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import enProfile from "./profiles/en.mjs";
import ptBrProfile from "./profiles/pt-br.mjs";

const LIMITS = {
  descriptive: 25,
  procedural: 20,
  narration: 18,
  sentencesPerParagraph: 6,
};

const WORD = "\\p{L}\\p{N}_";
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phraseRe = (text, flags = "giu") =>
  new RegExp(`(?<![${WORD}])(?:${escapeRe(text.trim()).replace(/\s+/g, "\\s+")})(?![${WORD}])`, flags);

// -----------------------------------------------------------------------------
// Paragraphs
// -----------------------------------------------------------------------------

const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/;

/**
 * Split text into paragraphs, skipping frontmatter, code fences, tables, headings
 * and HTML comments. Each list item is its own paragraph and is procedural.
 * With `{ plain: true }` the text is plain speech: nothing is skipped.
 * @returns {Array<{text: string, lineStart: number, procedural: boolean, lines: Array<{line: number, offset: number}>}>}
 */
export function extractParagraphs(markdown, options = {}) {
  const plain = Boolean(options.plain);
  const lines = String(markdown ?? "").split(/\r?\n/);
  const paragraphs = [];
  let current = null;
  let inCode = false;
  let i = 0;

  if (!plain && lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, n) => n > 0 && l.trim() === "---");
    if (end > 0) i = end + 1;
  }

  const flush = () => {
    if (current) paragraphs.push(current);
    current = null;
  };
  const add = (text, lineNo, procedural) => {
    if (!current) current = { text: "", lineStart: lineNo, procedural, lines: [] };
    const offset = current.text.length ? current.text.length + 1 : 0;
    current.text = current.text.length ? `${current.text} ${text}` : text;
    current.lines.push({ line: lineNo, offset });
  };

  for (; i < lines.length; i++) {
    let trimmed = lines[i].trim();
    const lineNo = i + 1;

    if (!plain) {
      if (/^(```|~~~)/.test(trimmed)) {
        flush();
        inCode = !inCode;
        continue;
      }
      if (inCode) continue;
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        flush();
        continue;
      }
      if (/^#{1,6}(\s|$)/.test(trimmed)) {
        flush();
        continue;
      }
      if (/^<!--.*-->$/.test(trimmed) || /^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        flush();
        continue;
      }
      if (trimmed.startsWith(">")) trimmed = trimmed.replace(/^>+\s?/, "");
    }

    if (trimmed === "") {
      flush();
      continue;
    }

    if (!plain && LIST_ITEM.test(lines[i])) {
      flush();
      add(trimmed, lineNo, true);
    } else {
      add(trimmed, lineNo, current ? current.procedural : false);
    }
  }
  flush();
  return paragraphs;
}

// -----------------------------------------------------------------------------
// Sentences and words
// -----------------------------------------------------------------------------

// A private-use character stands in for a period that does not end a sentence.
const DOT = "\uE000";

// Abbreviations whose period never ends a sentence (English and Portuguese).
const ABBREVIATIONS = [
  "e.g.", "i.e.", "vs.", "cf.", "Fig.", "approx.", "Mr.", "Mrs.", "Ms.", "Jr.",
  "Sr.", "Sra.", "Srs.", "Sras.", "Dr.", "Dra.", "Drs.", "Prof.", "Profa.",
  "p. ex.", "ex.", "art.", "arts.", "n.º", "nº.", "pág.", "págs.",
];
const ABBREVIATION_RES = ABBREVIATIONS.map(
  (abbr) =>
    new RegExp(
      `(?<![\\p{L}\\p{N}])${abbr.split(/\s+/).map(escapeRe).join("\\s+")}`,
      "giu",
    ),
);
// "etc." often ends a sentence: it only protects the period when no new sentence follows.
const SOFT_ETC = /(?<![\p{L}\p{N}])[Ee]tc\.(?!\s+\p{Lu})/gu;
const BOUNDARY = /(?<=[.!?…]["”’')\]]*)\s+(?=[\p{Lu}\p{N}`"“‘'\[(¿¡])/u;

/**
 * Split a paragraph into sentences, respecting common abbreviations and list numbers.
 */
export function splitSentences(paragraphText) {
  if (!paragraphText || !paragraphText.trim()) return [];

  let text = paragraphText;
  for (const re of ABBREVIATION_RES) text = text.replace(re, (m) => m.replaceAll(".", DOT));
  text = text
    .replace(SOFT_ETC, (m) => m.replaceAll(".", DOT))
    // Numbered markers: at the start, or right after a sentence end ("1. Do it. 2. Do that.").
    .replace(/^(\s*\d{1,3})\.(\s+)/, `$1${DOT}$2`)
    .replace(/(?<=[.!?]\s)(\d{1,3})\.(\s+)/g, `$1${DOT}$2`);

  return text
    .split(BOUNDARY)
    .map((s) => s.replaceAll(DOT, ".").trim())
    .filter((s) => s.length > 0);
}

const EMPHASIS_UNDERSCORE = /(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu;

/**
 * Count words in a sentence, ignoring markdown marks, list numbering and symbols.
 */
export function countWords(sentence) {
  const cleaned = String(sentence)
    .replace(/^\s*(?:\d+\.|\*|-|\+)\s+/, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*`#]/g, " ")
    .replace(EMPHASIS_UNDERSCORE, " ")
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * Prose view of a sentence for grammar and word rules: same length as the input,
 * with markdown marks blanked and inline code replaced by a neutral word, so a
 * match index maps straight back to the original text.
 */
function toProse(sentence) {
  return sentence
    .replace(/^(\s*)(?:[-*+]|\d+[.)])(\s+)/, (m) => " ".repeat(m.length))
    .replace(/`[^`]*`/g, (m) => "x".repeat(m.length))
    .replace(/\[([^\]]*)\]\([^)]*\)/g, (m, label) => ` ${label}${" ".repeat(m.length - label.length - 1)}`)
    .replace(/[*#]+/g, (m) => " ".repeat(m.length))
    .replace(EMPHASIS_UNDERSCORE, (m) => " ".repeat(m.length));
}

// -----------------------------------------------------------------------------
// Old API: structural violations only. Kept for existing callers.
// -----------------------------------------------------------------------------

/**
 * Lint markdown against the STE-lite structural rules (sentence and paragraph ceilings).
 * @returns {Array} violations `{ type, message, lineStart, sample, ... }`
 */
export function lintSteLite(markdownContent, options = {}) {
  const maxWordsDescriptive = options.maxWordsDescriptive || LIMITS.descriptive;
  const maxWordsProcedural = options.maxWordsProcedural || LIMITS.procedural;
  const maxSentencesPerParagraph = options.maxSentencesPerParagraph || LIMITS.sentencesPerParagraph;

  const violations = [];
  for (const para of extractParagraphs(markdownContent)) {
    const maxWords = para.procedural ? maxWordsProcedural : maxWordsDescriptive;
    const sentences = splitSentences(para.text);

    if (sentences.length > maxSentencesPerParagraph) {
      violations.push({
        type: "paragraph_length",
        message: `Paragraph has ${sentences.length} sentences (maximum allowed: ${maxSentencesPerParagraph}).`,
        lineStart: para.lineStart,
        sample: `${para.text.slice(0, 80)}...`,
      });
    }

    for (const sentence of sentences) {
      const words = countWords(sentence);
      if (words > maxWords) {
        violations.push({
          type: "sentence_length",
          message: `Sentence has ${words} words (maximum allowed: ${maxWords} for ${para.procedural ? "procedural" : "descriptive"}).`,
          lineStart: para.lineStart,
          sample: sentence,
          wordCount: words,
          limit: maxWords,
        });
      }
    }
  }
  return violations;
}

// -----------------------------------------------------------------------------
// Glossary and term lock
// -----------------------------------------------------------------------------

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if ((ch === "," || ch === ";") && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function parseAvoidList(text) {
  return splitTopLevel(text)
    .map((item) =>
      item
        .split("(")[0]
        .replace(/[`"“”]/g, "")
        .replace(/[.\s]+$/, "")
        .trim(),
    )
    .filter(Boolean);
}

/**
 * Parse a markdown glossary in the GLOSSARY.md format:
 * `**Term**:` then definition lines, then an optional `_Avoid_: a, b (comment)` line.
 * @returns {Array<{term: string, avoid: string[]}>}
 */
export function parseGlossary(markdown) {
  const entries = [];
  let current = null;
  for (const raw of String(markdown ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    const term = line.match(/^\*\*([^*]+)\*\*\s*:?\s*$/);
    if (term) {
      current = { term: term[1].trim(), avoid: [] };
      entries.push(current);
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      current = null;
      continue;
    }
    const avoid = line.match(/^_Avoid(?:_:|:_)\s*(.+)$/);
    if (avoid && current) current.avoid.push(...parseAvoidList(avoid[1]));
  }
  return entries;
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

// `glossary` is markdown text, the path of a glossary file, a list of
// { term, avoid[] } entries, or { terms: [...] }.
function normalizeGlossary(glossary) {
  let entries = [];
  if (typeof glossary === "string" && glossary.trim()) {
    const path = glossary.includes("\n") ? null : resolve(process.cwd(), glossary.trim());
    entries = parseGlossary(path && isFile(path) ? readFileSync(path, "utf8") : glossary);
  } else if (Array.isArray(glossary)) {
    entries = glossary;
  } else if (glossary && Array.isArray(glossary.terms)) {
    entries = glossary.terms;
  }
  entries = entries
    .filter((e) => e && typeof e.term === "string")
    .map((e) => ({ term: e.term, avoid: Array.isArray(e.avoid) ? e.avoid : [] }));
  return {
    entries,
    termSet: new Set(entries.map((e) => e.term.toLowerCase())),
  };
}

function compileTermLock(entries) {
  const locks = [];
  for (const { term, avoid } of entries) {
    for (const word of avoid) {
      if (word.toLowerCase() === term.toLowerCase()) continue;
      locks.push({ term, word, re: phraseRe(word) });
    }
  }
  return locks;
}

// -----------------------------------------------------------------------------
// Profiles and lexicon
// -----------------------------------------------------------------------------

/** `en` -> English profile, `pt`/`pt-BR`/`pt-br` -> Portuguese profile, anything else -> null (core only). */
export function resolveProfile(lang) {
  const tag = String(lang ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (tag === "en" || tag.startsWith("en-")) return enProfile;
  if (tag === "pt" || tag.startsWith("pt-")) return ptBrProfile;
  return null;
}

function compileLexicon(profile) {
  return (profile.lexicon ?? []).map((entry) => {
    const forms =
      entry.forms ?? (entry.verb && profile.inflect ? profile.inflect(entry.avoid) : [entry.avoid]);
    const source = forms.map((f) => escapeRe(f.trim()).replace(/\s+/g, "\\s+")).join("|");
    return { entry, re: new RegExp(`(?<![${WORD}])(?:${source})(?![${WORD}])`, "giu") };
  });
}

function lexiconHits(prose, compiled) {
  const found = [];
  for (const { entry, re } of compiled) {
    for (const m of prose.matchAll(re)) found.push({ entry, index: m.index, length: m[0].length });
  }
  // Longest phrase wins when two entries cover the same words.
  found.sort((a, b) => a.index - b.index || b.length - a.length);
  const hits = [];
  let end = -1;
  for (const hit of found) {
    if (hit.index < end) continue;
    hits.push(hit);
    end = hit.index + hit.length;
  }
  return hits;
}

// -----------------------------------------------------------------------------
// lintText
// -----------------------------------------------------------------------------

const PARENTHESES = /[()\[\]{}]/;
const SPOKEN_SYMBOLS = /[\/&%+=<>→←↑↓↔⇒#*_`|~^@$×÷≤≥≠≈\\]/gu;
const ACRONYM = /(?<![\p{L}\p{N}_])\p{Lu}{2,6}\p{N}{0,3}s?(?![\p{L}\p{N}_])/gu;

const clip = (text, max = 140) => {
  const flat = String(text).replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 3)}...` : flat;
};

function lineAt(paragraph, offset) {
  let line = paragraph.lineStart;
  for (const l of paragraph.lines) {
    if (l.offset <= offset) line = l.line;
    else break;
  }
  return line;
}

/**
 * Lint text against STE-lite and, when `lang` has one, a language profile.
 *
 * @param {string} text
 * @param {{ lang?: string, narration?: boolean, strict?: boolean,
 *           glossary?: string | Array<{term: string, avoid?: string[]}> }} [options]
 *   lang: `en` -> English profile; `pt`, `pt-BR`, `pt-br` -> Portuguese profile; anything else -> core only.
 *   narration: spoken text, one sentence at most 18 words, no brackets, no symbols, no acronyms.
 *   strict: every warning becomes an error.
 *   glossary: markdown glossary (text or file path) or parsed entries; an avoided word is an error.
 * @returns {{ errors: Finding[], warnings: Finding[] }}
 *   Finding: { rule, severity, message, line, sample }.
 */
export function lintText(text, options = {}) {
  const narration = Boolean(options.narration);
  const profile = resolveProfile(options.lang);
  const glossary = normalizeGlossary(options.glossary);
  const locks = compileTermLock(glossary.entries);
  const lexicon = profile ? compileLexicon(profile) : [];
  const ctx = {
    lang: profile ? profile.id : "core",
    narration,
    glossaryTerms: glossary.termSet,
    state: {},
  };

  const errors = [];
  const warnings = [];
  const report = (severity, rule, message, line, sample) => {
    (severity === "error" ? errors : warnings).push({ rule, severity, message, line, sample: clip(sample) });
  };

  for (const para of extractParagraphs(String(text ?? ""), { plain: narration })) {
    const sentences = splitSentences(para.text);

    if (sentences.length > LIMITS.sentencesPerParagraph) {
      report(
        "error",
        "paragraph-length",
        `Paragraph has ${sentences.length} sentences (maximum ${LIMITS.sentencesPerParagraph}). Give each idea its own paragraph.`,
        para.lineStart,
        para.text,
      );
    }

    let cursor = 0;
    for (const sentence of sentences) {
      const at = para.text.indexOf(sentence, cursor);
      if (at >= 0) cursor = at + sentence.length;
      const line = lineAt(para, Math.max(at, 0));

      const words = countWords(sentence);
      if (words === 0) continue;

      // Core: sentence length.
      const limit = narration ? LIMITS.narration : para.procedural ? LIMITS.procedural : LIMITS.descriptive;
      if (words > limit) {
        const kind = narration ? "narration" : para.procedural ? "procedure step" : "descriptive";
        report(
          "error",
          narration ? "narration-sentence-length" : "sentence-length",
          `Sentence has ${words} words (maximum ${limit} for ${kind}). Split it at the conjunction or the cause.`,
          line,
          sentence,
        );
      }

      // Narration: a listener cannot see brackets, symbols or letters.
      if (narration) {
        if (PARENTHESES.test(sentence)) {
          report(
            "error",
            "narration-parentheses",
            "Parentheses and brackets cannot be spoken. Move the aside into its own sentence.",
            line,
            sentence,
          );
        }
        const symbols = [...new Set(sentence.match(SPOKEN_SYMBOLS) ?? [])];
        if (symbols.length > 0) {
          report(
            "error",
            "narration-symbol",
            `Symbols cannot be spoken: ${symbols.map((s) => `"${s}"`).join(" ")}. Write them as words.`,
            line,
            sentence,
          );
        }
        for (const m of sentence.matchAll(ACRONYM)) {
          const spelled = m[0].replace(/s$/, "").split("").join(" ");
          report(
            "error",
            "narration-acronym",
            `Acronym "${m[0]}" cannot be read aloud. Write it as it is spoken, for example "${spelled}".`,
            line,
            m[0],
          );
        }
      }

      const prose = toProse(sentence);
      const original = (sample) => {
        const at = prose.indexOf(sample);
        return at >= 0 ? sentence.slice(at, at + sample.length) : sample;
      };

      // Term lock.
      for (const lock of locks) {
        lock.re.lastIndex = 0;
        const m = lock.re.exec(prose);
        if (m) {
          report(
            "error",
            "term-lock",
            `Avoided term "${lock.word}". Use the glossary term "${lock.term}".`,
            line,
            original(m[0]),
          );
        }
      }

      if (!profile) continue;

      // Profile grammar.
      for (const rule of profile.grammar) {
        const result = rule.test(prose, ctx);
        const hits = Array.isArray(result) ? result : result ? [result] : [];
        for (const hit of hits) {
          const sample = typeof hit === "string" ? hit : hit.sample;
          const message = typeof hit === "string" || !hit.message ? rule.message : hit.message;
          report(rule.severity, rule.rule, message, line, original(sample));
        }
      }

      // Profile lexicon (always warnings).
      for (const hit of lexiconHits(prose, lexicon)) {
        const found = prose.slice(hit.index, hit.index + hit.length);
        const note = hit.entry.note ? ` ${hit.entry.note}` : "";
        report(
          "warning",
          "lexicon",
          `Replace "${found.replace(/\s+/g, " ")}" with "${hit.entry.use}".${note}`,
          line,
          original(found),
        );
      }
    }
  }

  const byLine = (a, b) => a.line - b.line;
  errors.sort(byLine);
  warnings.sort(byLine);

  if (options.strict && warnings.length > 0) {
    errors.push(...warnings.splice(0).map((w) => ({ ...w, severity: "error" })));
    errors.sort(byLine);
  }
  return { errors, warnings };
}

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

const USAGE = `Usage: node ste-lint.mjs (--file <path> | --text <string>) [--lang en|pt|<other>] [--narration] [--strict] [--glossary <path>] [--json]

  --file <path>      Lint a text or markdown file.
  --text <string>    Lint a string.
  --lang <tag>       en -> English profile; pt, pt-BR -> Portuguese profile; any other tag -> core rules only.
  --narration        Spoken text: sentences of 18 words or fewer, no brackets, no symbols, no acronyms.
  --strict           Warnings become errors.
  --glossary <path>  Markdown glossary (GLOSSARY.md format); an avoided word is an error.
  --json             Print one JSON object.

Exit codes: 0 no errors, 1 errors found, 2 usage error.`;

function parseArgs(argv) {
  const args = { file: null, text: null, lang: null, narration: false, strict: false, glossary: null, json: false, help: false };
  const valued = { "--file": "file", "--text": "text", "--lang": "lang", "--glossary": "glossary" };
  const flags = { "--narration": "narration", "--strict": "strict", "--json": "json", "--help": "help", "-h": "help" };

  for (let i = 0; i < argv.length; i++) {
    const [name, inline] = argv[i].startsWith("--") && argv[i].includes("=")
      ? [argv[i].slice(0, argv[i].indexOf("=")), argv[i].slice(argv[i].indexOf("=") + 1)]
      : [argv[i], undefined];
    if (name in valued) {
      const value = inline !== undefined ? inline : argv[++i];
      if (value === undefined) return { error: `${name} needs a value.` };
      args[valued[name]] = value;
    } else if (name in flags && inline === undefined) {
      args[flags[name]] = true;
    } else {
      return { error: `Unknown argument: ${argv[i]}` };
    }
  }
  return args;
}

function usageError(message) {
  console.error(`${message}\n\n${USAGE}`);
  return 2;
}

function formatFinding(f) {
  return [`  line ${f.line}  [${f.rule}]  ${f.message}`, `      "${f.sample}"`].join("\n");
}

export function main(argv) {
  const args = parseArgs(argv);
  if (args.error) return usageError(args.error);
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if ((args.file === null) === (args.text === null)) {
    return usageError("Give exactly one of --file or --text.");
  }

  let source;
  let content;
  if (args.file !== null) {
    const path = resolve(process.cwd(), args.file);
    if (!existsSync(path)) return usageError(`File not found: ${path}`);
    source = args.file;
    content = readFileSync(path, "utf8");
  } else {
    source = "--text";
    content = args.text;
  }

  let glossary;
  if (args.glossary !== null) {
    const path = resolve(process.cwd(), args.glossary);
    if (!existsSync(path)) return usageError(`Glossary not found: ${path}`);
    glossary = readFileSync(path, "utf8");
  }

  const profile = resolveProfile(args.lang);
  const { errors, warnings } = lintText(content, {
    lang: args.lang,
    narration: args.narration,
    strict: args.strict,
    glossary,
  });
  const lang = profile ? profile.id : "core";
  const exitCode = errors.length > 0 ? 1 : 0;

  if (args.json) {
    console.log(
      JSON.stringify({
        ok: exitCode === 0,
        source,
        lang,
        narration: args.narration,
        strict: args.strict,
        errors,
        warnings,
      }),
    );
    return exitCode;
  }

  const mode = [`lang ${lang}`, args.narration ? "narration" : null, args.strict ? "strict" : null]
    .filter(Boolean)
    .join(", ");
  const note =
    args.lang && !profile ? `\nNo profile for "${args.lang}": core rules only.` : "";
  console.log(`ste-lint: ${source} (${mode})${note}`);

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length})`);
    for (const f of errors) console.log(formatFinding(f));
  }
  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length})`);
    for (const f of warnings) console.log(formatFinding(f));
  }

  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const summary = `${plural(errors.length, "error")}, ${plural(warnings.length, "warning")}`;
  console.log(`\n${exitCode === 0 ? "ok" : "FAIL"}: ${summary}.`);
  return exitCode;
}

const isMain = (() => {
  try {
    return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
})();

if (isMain) process.exit(main(process.argv.slice(2)));

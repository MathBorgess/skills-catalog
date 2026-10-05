#!/usr/bin/env node
// ste-lint: deterministic structural linter for STE-lite (80% ASD-STE100).
// Standard library only, zero dependencies.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Split text into paragraphs, skipping frontmatter, code fences, and markdown tables.
 */
export function extractParagraphs(markdown) {
  // Strip YAML frontmatter
  let text = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");

  const lines = text.split(/\r?\n/);
  const paragraphs = [];
  let currentPara = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Skip markdown tables
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      continue;
    }

    // Skip headings
    if (trimmed.startsWith("#")) {
      if (currentPara.length > 0) {
        paragraphs.push({ text: currentPara.join(" "), lineStart: i - currentPara.length + 1 });
        currentPara = [];
      }
      continue;
    }

    if (trimmed === "") {
      if (currentPara.length > 0) {
        paragraphs.push({ text: currentPara.join(" "), lineStart: i - currentPara.length + 1 });
        currentPara = [];
      }
    } else {
      currentPara.push(trimmed);
    }
  }

  if (currentPara.length > 0) {
    paragraphs.push({ text: currentPara.join(" "), lineStart: lines.length - currentPara.length + 1 });
  }

  return paragraphs;
}

/**
 * Split a paragraph into individual sentences, respecting common technical abbreviations.
 */
export function splitSentences(paragraphText) {
  if (!paragraphText || !paragraphText.trim()) return [];

  // Protect abbreviations and numbered list markers (e.g. "1. ", "2. ")
  const protectedText = paragraphText
    .replace(/(^|\s)(\d+)\.\s+/g, "$1$2___dot___ ")
    .replace(/\be\.g\./gi, "e__g__")
    .replace(/\bi\.e\./gi, "i__e__")
    .replace(/\bvs\./gi, "vs__")
    .replace(/\betc\./gi, "etc__")
    .replace(/\bFig\./gi, "Fig__");

  // Split on sentence boundaries: period, exclamation, question mark followed by space or end of string
  const rawSentences = protectedText.split(/(?<=[.!?])\s+(?=[A-Z0-9`"“'\[])/);

  return rawSentences
    .map((s) =>
      s
        .replace(/(\d+)___dot___\s+/g, "$1. ")
        .replace(/e__g__/g, "e.g.")
        .replace(/i__e__/g, "i.e.")
        .replace(/vs__/g, "vs.")
        .replace(/etc__/g, "etc.")
        .replace(/Fig__/g, "Fig.")
        .trim()
    )
    .filter((s) => s.length > 0);
}

/**
 * Count words in a sentence, excluding markdown punctuation and symbols.
 */
export function countWords(sentence) {
  // Strip leading list item numbering like "1. ", "- ", "* "
  let cleaned = sentence.replace(/^\s*(\d+\.|\*|-)\s+/, "");

  // Strip markdown formatting symbols like **, ``, [], ()
  cleaned = cleaned
    .replace(/[*_`#]/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // markdown links -> anchor text
    .trim();

  if (!cleaned) return 0;
  const words = cleaned.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w));
  return words.length;
}

/**
 * Lint markdown against STE-lite rules.
 * @param {string} markdownContent
 * @param {Object} options
 * @returns {Array} List of violations
 */
export function lintSteLite(markdownContent, options = {}) {
  const maxWordsDescriptive = options.maxWordsDescriptive || 25;
  const maxWordsProcedural = options.maxWordsProcedural || 20;
  const maxSentencesPerParagraph = options.maxSentencesPerParagraph || 6;

  const violations = [];
  const paragraphs = extractParagraphs(markdownContent);

  for (const para of paragraphs) {
    const isProcedural = /^\s*([0-9]+\.|\*|-)\s+/.test(para.text);
    const maxWords = isProcedural ? maxWordsProcedural : maxWordsDescriptive;

    const sentences = splitSentences(para.text);

    if (sentences.length > maxSentencesPerParagraph) {
      violations.push({
        type: "paragraph_length",
        message: `Paragraph has ${sentences.length} sentences (maximum allowed: ${maxSentencesPerParagraph}).`,
        lineStart: para.lineStart,
        sample: para.text.slice(0, 80) + "...",
      });
    }

    for (const sentence of sentences) {
      const words = countWords(sentence);
      if (words > maxWords) {
        violations.push({
          type: "sentence_length",
          message: `Sentence has ${words} words (maximum allowed: ${maxWords} for ${isProcedural ? "procedural" : "descriptive"}).`,
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
// CLI Execution
// -----------------------------------------------------------------------------

if (process.argv[1] && process.argv[1].endsWith("ste-lint.mjs")) {
  let targetFile = null;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--file" && process.argv[i + 1]) {
      targetFile = process.argv[++i];
    } else if (process.argv[i].startsWith("--file=")) {
      targetFile = process.argv[i].slice(7);
    }
  }

  if (!targetFile) {
    console.error("Usage: node ste-lint.mjs --file <path-to-markdown>");
    process.exit(1);
  }

  const absPath = resolve(process.cwd(), targetFile);
  if (!existsSync(absPath)) {
    console.error(`Error: File not found at ${absPath}`);
    process.exit(1);
  }

  const content = readFileSync(absPath, "utf8");
  const violations = lintSteLite(content);

  if (violations.length === 0) {
    console.log(`ok: ${targetFile} complies with STE-lite structural rules.`);
    process.exit(0);
  } else {
    console.error(`Found ${violations.length} STE-lite violation(s) in ${targetFile}:`);
    for (const v of violations) {
      console.error(`- [Line ~${v.lineStart}] ${v.message}`);
      console.error(`  "${v.sample}"\n`);
    }
    process.exit(1);
  }
}

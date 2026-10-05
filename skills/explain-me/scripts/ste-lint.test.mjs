#!/usr/bin/env node
// Tests for ste-lint script. Run: node skills/explain-me/scripts/ste-lint.test.mjs

import {
  extractParagraphs,
  splitSentences,
  countWords,
  lintSteLite,
} from "./ste-lint.mjs";

let failed = 0;

function assert(name, cond) {
  if (cond) {
    console.log(`ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL ${name}`);
  }
}

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
// Summary
// -----------------------------------------------------------------------------

if (failed) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
}

console.log("\nok: all ste-lint tests passed");

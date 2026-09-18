#!/usr/bin/env node
// Tests for skills-evaluate scripts. Run: node skills/skills-evaluate/scripts/evaluate.test.mjs

import {
  computeMedian,
  extractNumericMetrics,
  getSiblingSkills,
  parseMetricsLines,
  parseSkillFrontmatter,
  evaluateSkillMetrics,
} from "./evaluate.mjs";

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
// 1. Median computation tests
// -----------------------------------------------------------------------------

assert("median: null on empty array", computeMedian([]) === null);
assert("median: null on non-array", computeMedian(null) === null && computeMedian("abc") === null);
assert("median: single number", computeMedian([42]) === 42);
assert("median: odd count of numbers", computeMedian([5, 1, 9]) === 5);
assert("median: even count of numbers", computeMedian([1, 2, 3, 4]) === 2.5);
assert("median: handles negative numbers", computeMedian([-10, -5, 0, 5]) === -2.5);
assert("median: handles floats", computeMedian([1.2, 3.4, 2.3]) === 2.3);
assert(
  "median: filters out non-numbers and NaN",
  computeMedian([10, "foo", NaN, null, undefined, 20, 30]) === 20,
);
assert("median: null when array has only invalid items", computeMedian(["a", NaN, null]) === null);

// -----------------------------------------------------------------------------
// 2. Malformed line tolerance tests
// -----------------------------------------------------------------------------

assert("parseMetrics: empty string gives empty array", parseMetricsLines("").length === 0);
assert("parseMetrics: whitespace gives empty array", parseMetricsLines("   \n\n  ").length === 0);

const sampleLines = [
  '{"skill":"shunt","outlines":3,"recover":1}',
  "malformed json line here {{{",
  "",
  '{"skill":"shunt","outlines":5,"recover":0}',
  "12345",
  '"just a string"',
  "[1, 2, 3]",
  '{"skill":"shunt","outlines":4,"recover":2}',
].join("\n");

const parsed = parseMetricsLines(sampleLines);
assert("parseMetrics: extracts only valid objects and skips malformed", parsed.length === 3);
assert("parseMetrics: preserves fields of valid records", parsed[0].outlines === 3 && parsed[1].outlines === 5);

// Test defaultSkill tolerance for legacy handoff lines without `skill` field
const legacyHandoffLines = [
  '{"mode":"fan-out","n_sessions":4,"n_done":4}',
  '{"skill":"handoff","mode":"fan-out","n_sessions":2,"n_done":2}',
].join("\n");

const parsedLegacy = parseMetricsLines(legacyHandoffLines, "handoff");
assert("parseMetrics: assigns defaultSkill when skill field is missing", parsedLegacy[0].skill === "handoff");
assert("parseMetrics: preserves existing skill field", parsedLegacy[1].skill === "handoff");

// -----------------------------------------------------------------------------
// 3. Sibling description and frontmatter parsing tests
// -----------------------------------------------------------------------------

const singleLineFm = `---
name: test-skill
description: "Use when testing single line descriptions."
metadata:
  version: 0.0.0
---
# Test Skill
`;

const res1 = parseSkillFrontmatter(singleLineFm);
assert("frontmatter: parses name", res1.name === "test-skill");
assert("frontmatter: parses single line description", res1.description === "Use when testing single line descriptions.");

const multiLineFm = `---
name: folded-skill
description: >
  Use when testing multi-line descriptions
  folded across several lines in YAML
  with extra indentation.
metadata:
  author: Matheus Borges
---
`;

const res2 = parseSkillFrontmatter(multiLineFm);
assert("frontmatter: parses folded multi-line description", res2.description.includes("folded across several lines"));

const indentedFm = `---
name: indented-skill
description:
  Line one of description
  Line two of description
metadata:
  author: Matheus Borges
---
`;

const res3 = parseSkillFrontmatter(indentedFm);
assert("frontmatter: parses indented description", res3.description === "Line one of description Line two of description");

const invalidFm = "# No frontmatter at all";
const res4 = parseSkillFrontmatter(invalidFm);
assert("frontmatter: graceful on missing frontmatter", res4.name === "" && res4.description === "");

// -----------------------------------------------------------------------------
// 4. Numeric metrics extraction & evaluation tests
// -----------------------------------------------------------------------------

const testRecord = {
  skill: "shunt",
  ts: "2026-09-18T12:00:00Z",
  inspected: 10,
  outlines: 4,
  recover: 1,
  edit_bypass: { reads: 3, edited: 1 },
  providers: ["claude", "codex"], // should be ignored (array)
  flag: true, // should be ignored (boolean)
};

const extracted = extractNumericMetrics(testRecord);
assert("extractMetrics: extracts top-level numeric fields", extracted.inspected === 10 && extracted.outlines === 4);
assert("extractMetrics: flattens nested numeric fields", extracted["edit_bypass.reads"] === 3 && extracted["edit_bypass.edited"] === 1);
assert("extractMetrics: ignores non-numeric fields", extracted.skill === undefined && extracted.providers === undefined);

const telemetryBatch = [
  { outlines: 2, recover: 0, wall: 100 },
  { outlines: 4, recover: 1, wall: 200 },
  { outlines: 6, recover: 3, wall: 300 },
];

const evalResult = evaluateSkillMetrics(telemetryBatch, 10);
assert("evaluate: computes correct totalRuns and analyzedRuns", evalResult.totalRuns === 3 && evalResult.analyzedRuns === 3);
assert("evaluate: latest run matches last record", evalResult.latest.outlines === 6);
assert("evaluate: median matches expected", evalResult.medians.outlines === 4 && evalResult.medians.recover === 1 && evalResult.medians.wall === 200);

// -----------------------------------------------------------------------------
// 5. Live repo sibling skills test
// -----------------------------------------------------------------------------

const siblings = getSiblingSkills();
assert("siblingSkills: found sibling skills in repo", siblings.length >= 4);
const siblingNames = siblings.map((s) => s.name);
assert("siblingSkills: contains handoff", siblingNames.includes("handoff"));
assert("siblingSkills: contains shunt", siblingNames.includes("shunt"));
assert("siblingSkills: contains study-wiki", siblingNames.includes("study-wiki"));
assert("siblingSkills: contains teach-me", siblingNames.includes("teach-me"));
assert("siblingSkills: descriptions are populated", siblings.every((s) => s.description.length > 20));

// -----------------------------------------------------------------------------
// Exit check
// -----------------------------------------------------------------------------

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nok: all evaluate tests passed");

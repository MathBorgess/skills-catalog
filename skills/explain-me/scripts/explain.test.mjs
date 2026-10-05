#!/usr/bin/env node
// Tests for the explain-me driver. Run: node skills/explain-me/scripts/explain.test.mjs
// No network and no HyperFrames calls: resolution is tested with injected fakes, the voice flow
// with a fake synthesizer, the CLI with an empty PATH.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KIT_PRIMITIVES, deepMerge, diffOverrides, findProjectSpec, loadSpec, mergeProse, resolveDesign, splitFrontmatter, splitSections, tokensCss, validateSpec } from "./lib/design.mjs";
import { SLUG_RE, resolveRun, runStamp, skillHome, slugify, venvPython } from "./lib/home.mjs";
import { commandLine, quoteArg, scriptRef } from "./lib/hints.mjs";
import { firstJsonObject, hfEnv, lastJsonObject, summarizeCheck } from "./lib/hyperframes.mjs";
import { DEFAULT_LAYOUT, FRAME_SIZES, frameSize, normalizeOrientation, resolveLayout, runOrientation } from "./lib/orientation.mjs";
import { compareSemver, espeakInstallHint, findNpxCacheCopies, findOnPath, inspectEspeak, resolveEspeak, resolveHyperframes, resolvePython } from "./lib/resolve.mjs";
import { createRun, explanationLanguage, projectHash, readRun, appendMetrics, refreshDesign, scriptStaleness, sha256, starterExplanation, writeStarterExplanation } from "./lib/run.mjs";
import { AUDIO_END, AUDIO_START, applyOrientation, audioTags, buildExplainData, buildMotionJson, buildSrt, buildTimeline, entranceFrameTime, estimateDuration, formatSrtTime, frameTime, htmlLangTag, inspectionFrames, kokoroLang, lintLang, motionWindowEnd, hasTokensRegion, rewriteAudioRegion, rewriteComposition, rewriteHtmlLang, rewriteRootDuration, rewriteRootSize, rewriteStagePlaceholder, rewriteTokensRegion, stageFrameMismatch, validateScript, voiceFor, wavDurationSec, wrapCaption } from "./lib/timeline.mjs";
import { runVoice } from "./lib/voice.mjs";
import { lintText } from "./ste-lint.mjs";
import { YamlError, parse, stringify } from "./lib/yaml.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let failed = 0;
let passed = 0;

function assert(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL ${name}${detail === undefined ? "" : `\n     ${detail}`}`);
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function assertEq(name, actual, expected) {
  assert(name, same(actual, expected), `expected ${JSON.stringify(expected)}\n     got      ${JSON.stringify(actual)}`);
}
function throwsWith(fn, re) {
  try {
    fn();
  } catch (e) {
    return { threw: true, message: String(e.message), match: re ? re.test(e.message) : true, error: e };
  }
  return { threw: false };
}

const tmpRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "explain-me-test-")));
process.on("exit", () => fs.rmSync(tmpRoot, { recursive: true, force: true }));
const tmp = (name) => {
  const dir = path.join(tmpRoot, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

// ---------------------------------------------------------------------------
// 1. YAML subset
// ---------------------------------------------------------------------------

assertEq("yaml: block map with scalar types", parse("a: 1\nb: 2.5\nc: hello\nd: true\ne: off\nf: null\ng: ~\nh:\ni: yes\nj: No"), { a: 1, b: 2.5, c: "hello", d: true, e: false, f: null, g: null, h: null, i: true, j: false });
assertEq("yaml: quoted strings keep # and escapes", parse('a: "#58C4DD"\nb: \'it\'\'s\'\nc: "line\\nbreak \\u00e9"'), { a: "#58C4DD", b: "it's", c: "line\nbreak é" });
assertEq("yaml: comments full-line and trailing", parse("# top\na: 1 # trailing\n  # indented comment\nb: 'x # not a comment'"), { a: 1, b: "x # not a comment" });
assertEq("yaml: apostrophe inside a plain word is not a quote", parse("note: it's fine # c"), { note: "it's fine" });
assertEq("yaml: flow map", parse('m: { a: 1, b: "x, y", c: [1, two, {d: 3}], e: {} }'), { m: { a: 1, b: "x, y", c: [1, "two", { d: 3 }], e: {} } });
assertEq("yaml: flow list and empty list", parse("l: [a, b, 3]\ne: []"), { l: ["a", "b", 3], e: [] });
assertEq("yaml: flow map keys stay strings (on/true)", parse("m: { on: 1, pt-br: x }"), { m: { on: 1, "pt-br": "x" } });
assertEq("yaml: multi-line flow map", parse("m: {\n  a: 1,\n  b: 2\n}\nn: 3"), { m: { a: 1, b: 2 }, n: 3 });
assertEq("yaml: nested block maps", parse("a:\n  b:\n    c: 1\n  d: 2\ne: 3"), { a: { b: { c: 1 }, d: 2 }, e: 3 });
assertEq("yaml: block list of scalars (indented and same-indent)", parse("a:\n  - x\n  - 2\nb:\n- y\n- z"), { a: ["x", 2], b: ["y", "z"] });
assertEq("yaml: list of flow maps", parse("p:\n  - { primitive: morph, note: one }\n  - { primitive: draw }"), { p: [{ primitive: "morph", note: "one" }, { primitive: "draw" }] });
assertEq("yaml: list of block maps", parse("images:\n  - path: a.png\n    role: logo\n  - path: b.png\n    note: \"x: y\"\nafter: 1"), { images: [{ path: "a.png", role: "logo" }, { path: "b.png", note: "x: y" }], after: 1 });
assertEq("yaml: list item with nested block under a dash", parse("l:\n  -\n    a: 1\n    b: 2\n  - c"), { l: [{ a: 1, b: 2 }, "c"] });
assertEq("yaml: nested lists", parse("m:\n  - - 1\n    - 2\n  - - 3"), { m: [[1, 2], [3]] });
assertEq("yaml: literal block scalar", parse("t: |\n  line one\n    indented\n  line three\nnext: 1"), { t: "line one\n  indented\nline three\n", next: 1 });
assertEq("yaml: folded block scalar and strip chomp", parse("t: >\n  one\n  two\n\n  three\nu: |-\n  keep\nv: 1"), { t: "one two\nthree\n", u: "keep", v: 1 });
assertEq("yaml: block scalar inside a list item map", parse("l:\n  - note: |\n      a\n      b\n    id: 1"), { l: [{ note: "a\nb\n", id: 1 }] });
assertEq("yaml: empty document is null", parse("# only comments\n\n"), null);
assertEq("yaml: windows line endings", parse("a: 1\r\nb:\r\n  - x\r\n"), { a: 1, b: ["x"] });
assertEq("yaml: unquoted hex is a comment (empty value)", parse("c: #58C4DD"), { c: null });

{
  const e = throwsWith(() => parse("a: 1\nb: [oops\nc: 2"), /line 2/);
  assert("yaml: unterminated flow list reports its line", e.threw && e.match && e.error instanceof YamlError && e.error.line === 2, e.message);
}
{
  const e = throwsWith(() => parse("a: 1\n\tb: 2"), /line 2.*tabs/);
  assert("yaml: tab indentation is an error with the line", e.threw && e.match, e.message);
}
{
  const e = throwsWith(() => parse("a: 1\na: 2"), /line 2.*duplicate key "a"/);
  assert("yaml: duplicate key is an error", e.threw && e.match, e.message);
}
{
  const e = throwsWith(() => parse("a: 1\n  b: 2"), /line 2/);
  assert("yaml: stray indentation is an error", e.threw && e.match, e.message);
}
{
  const e = throwsWith(() => parse("a: &x 1"), /line 1.*anchor/);
  assert("yaml: anchors are rejected clearly", e.threw && e.match, e.message);
}
{
  const e = throwsWith(() => parse("a: 1\njust text"), /line 2/);
  assert("yaml: a line that is not key: value is an error", e.threw && e.match, e.message);
}
{
  const e = throwsWith(() => parse('a: "unterminated'), /line 1.*unterminated/);
  assert("yaml: unterminated quote is an error", e.threw && e.match, e.message);
}
{
  const e = throwsWith(() => parse("a: 1", { lineOffset: 4 }) && parse("x: 1\nb: {a: 1", { lineOffset: 4 }), /line 6/);
  assert("yaml: lineOffset makes errors point into the file", e.threw && e.match, e.message);
}

// serializer round-trips
const roundTrips = {
  scalars: { a: 1, b: 2.5, c: true, d: false, e: null, f: "plain", g: "" },
  "look-alike strings": { a: "true", b: "on", c: "123", d: "1.5", e: "null", f: "~", g: "yes" },
  "special strings": { a: "#58C4DD", b: "a: b", c: "x # y", d: "- dash", e: "[x]", f: "{y}", g: "with, comma", h: " lead", i: "trail ", j: "it's", k: 'say "hi"', l: "tab\there", m: "multi\nline", n: "é ç 日本" },
  "keys needing quotes": { "on": 1, "a b": 2, "pt-br": 3, "x.y": 4, "": 5 },
  "nested maps": { colors: { background: "#000000", blue: "#58C4DD" }, motion: { durations: { draw: 1.2, write: 0.9 }, deep: { a: { b: { c: 1 } } } } },
  lists: { a: [], b: ["x", "y"], c: [1, 2, 3], d: [[1, 2], [3]], e: [{ p: "morph", n: "one" }, { p: "draw" }], f: [{ path: "a", nested: { k: [1, 2] } }] },
  "empty containers": { a: {}, b: [], c: { d: {} } },
  "long flat map goes block": { v: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`key${i}`, `value-number-${i}`])) },
};
for (const [name, value] of Object.entries(roundTrips)) {
  let out;
  try {
    out = parse(stringify(value));
  } catch (e) {
    out = `THREW ${e.message}`;
  }
  assertEq(`yaml: round trip ${name}`, out, value);
}
assert("yaml: serializer writes small leaf maps as flow", /^display: \{ family: Inter, weight: 400 \}$/m.test(stringify({ display: { family: "Inter", weight: 400 } })));

// ---------------------------------------------------------------------------
// 2. Design spec: frontmatter, merge, overrides, prose
// ---------------------------------------------------------------------------

{
  const { data, body } = splitFrontmatter("---\nname: x\ncolors:\n  blue: \"#fff\"\n---\n\n# Title\n\ntext\n", "f.md");
  assertEq("design: frontmatter splits data and prose", { data, body }, { data: { name: "x", colors: { blue: "#fff" } }, body: "# Title\n\ntext" });
  assertEq("design: no frontmatter means empty data", splitFrontmatter("# only prose", "f.md"), { data: {}, body: "# only prose" });
  const e = throwsWith(() => splitFrontmatter("---\nname: x\n", "f.md"), /never closes/);
  assert("design: unclosed frontmatter is an error", e.threw && e.match, e.message);
  const e2 = throwsWith(() => splitFrontmatter("---\nname: x\nbad: [\n---\n", "/p/f.md"), /f\.md.*line/);
  assert("design: yaml error names the file and line", e2.threw && e2.match, e2.message);
}

assertEq("design: deepMerge merges maps key by key", deepMerge({ a: { b: 1, c: 2 }, d: 1 }, { a: { c: 9 }, e: 3 }), { a: { b: 1, c: 9 }, d: 1, e: 3 });
assertEq("design: deepMerge replaces arrays whole", deepMerge({ l: [1, 2, 3], m: { n: [1] } }, { l: [9], m: { n: [] } }), { l: [9], m: { n: [] } });
assertEq("design: deepMerge ignores null in the higher layer", deepMerge({ a: 1, b: { c: 2 } }, { a: null, b: null }), { a: 1, b: { c: 2 } });
assertEq("design: deepMerge scalar replaces map", deepMerge({ a: { b: 1 } }, { a: 5 }), { a: 5 });
{
  const base = { x: { y: 1 } };
  const merged = deepMerge(base, { x: { z: 2 } });
  merged.x.y = 99;
  assert("design: deepMerge does not alias its inputs", base.x.y === 1);
}

{
  const shipped = { rules: { hud: false, cardsAsLayout: false, maxWordsOnScreen: 7 }, motion: { maxStaticSec: 2, leadInSec: 0.5 }, colors: { blue: "#1" } };
  const merged = { rules: { hud: true, cardsAsLayout: false, maxWordsOnScreen: 12, extra: true }, motion: { maxStaticSec: 3, leadInSec: 9 }, colors: { blue: "#2" } };
  assertEq(
    "design: overrides list rules and maxStaticSec that differ (nothing else)",
    diffOverrides(merged, shipped),
    [
      { key: "rules.hud", default: false, value: true },
      { key: "rules.maxWordsOnScreen", default: 7, value: 12 },
      { key: "rules.extra", default: null, value: true },
      { key: "motion.maxStaticSec", default: 2, value: 3 },
    ]
  );
  assertEq("design: no overrides when equal", diffOverrides(shipped, shipped), []);
}

{
  const lowest = "# Default\n\nintro\n\n## Words on screen\n\ndefault words\n\n## Motion examples\n\ndefault examples\n\n## Voice\n\ndefault voice";
  const middle = "## Voice\n\npersonal voice\n\n## Pacing\n\npersonal pacing";
  const highest = "# Brand\n\nbrand intro\n\n## Words on screen\n\nbrand words";
  const merged = mergeProse([highest, middle, lowest]);
  const sections = splitSections(merged);
  assertEq("prose: preamble comes from the highest layer that has one", sections.preamble, "# Brand\n\nbrand intro");
  assertEq("prose: higher layer wins per heading", sections.sections.find((s) => s.key === "words on screen").text, "## Words on screen\n\nbrand words");
  assertEq("prose: headings only in lower layers are kept, highest layer first then in order", sections.sections.map((s) => s.heading), ["Words on screen", "Voice", "Pacing", "Motion examples"]);
  assertEq("prose: middle layer beats lowest for Voice", sections.sections.find((s) => s.key === "voice").text, "## Voice\n\npersonal voice");
  assertEq("prose: ## inside a code fence is not a heading", splitSections("## A\n\n```\n## not a heading\n```\n\n## B\n").sections.map((s) => s.heading), ["A", "B"]);
  assertEq("prose: heading match ignores case", mergeProse(["## Voice\n\nnew", "## voice\n\nold"]), "## Voice\n\nnew");
}

// design files on disk
const dd = tmp("design");
const shippedMd = `---
name: shipped
colors:
  background: "#000000"
  surface: "#1C1C1C"
  text: "#FFFFFF"
  muted: "#888888"
  blue: "#58C4DD"
typography:
  display: { family: "CMU Serif", weight: 500, fallback: serif }
  body: { family: Inter, weight: 400 }
  mono: { family: "JetBrains Mono", weight: 400 }
motion:
  gate: on
  maxStaticSec: 2
  leadInSec: 0.5
  beatGapSec: 0.3
  tailSec: 1.0
  ease: "power2.inOut"
  durations: { draw: 1.2, write: 0.9, morph: 1.0, move: 1.2, camera: 1.5, indicate: 0.6, count: 1.0, grow: 0.6, fade: 0.5 }
  preferred:
    - { primitive: morph, note: "transform one object into the next" }
  examples: []
rules:
  centralObject: true
  hud: false
  cardsAsLayout: false
  maxWordsOnScreen: 7
layout:
  landscape: { safe: [120, 120, 1800, 960], captions: [160, 900, 1760, 1030] }
  portrait: { safe: [60, 220, 960, 1380], captions: [60, 1400, 960, 1580] }
captions:
  burn: { landscape: false, portrait: true }
  maxWords: 6
narration:
  speed: 1.0
  voices: { pt-br: pf_dora, en-us: af_heart }
images: []
---

# Shipped

## Words on screen

At most seven.

## Motion examples

\`\`\`js
kit.beat("b01", (b) => {
  b.draw("#axis");
  b.at(1.2).morph("#square", "#circle");
});
\`\`\`
`;
fs.writeFileSync(path.join(dd, "shipped.md"), shippedMd);
fs.mkdirSync(path.join(dd, "brand", "img"), { recursive: true });
fs.writeFileSync(path.join(dd, "brand", "img", "logo.svg"), "<svg/>");
fs.writeFileSync(path.join(dd, "brand", "img", "ref.png"), "x");
fs.writeFileSync(
  path.join(dd, "brand", "DESIGN.md"),
  `---
colors:
  blue: "#0A84FF"
  brandPink: "#FF2D95"
motion:
  maxStaticSec: 3
rules:
  hud: true
images:
  - { path: img/logo.svg, role: logo, note: mark }
  - { path: img/ref.png, role: reference }
---

## Words on screen

Brand words.
`
);
{
  const shipped = loadSpec(path.join(dd, "shipped.md"));
  assert("design: shipped fixture validates", validateSpec(shipped).errors.length === 0, JSON.stringify(validateSpec(shipped).errors));
  const r = resolveDesign({ explicit: path.join(dd, "brand", "DESIGN.md"), personal: path.join(dd, "no-personal.md"), shipped: path.join(dd, "shipped.md") });
  assertEq("design: layers are explicit then shipped (missing personal skipped)", r.layers.map((l) => l.kind), ["explicit", "shipped"]);
  assertEq("design: explicit color wins, others stay", [r.data.colors.blue, r.data.colors.brandPink, r.data.colors.text], ["#0A84FF", "#FF2D95", "#FFFFFF"]);
  assertEq("design: overrides reported (hud, maxStaticSec)", r.overrides.map((o) => o.key), ["rules.hud", "motion.maxStaticSec"]);
  assert("design: image paths are absolutised against their own spec", r.data.images[0].path === path.join(dd, "brand", "img", "logo.svg"));
  assert("design: prose merged per heading", r.body.includes("Brand words.") && !r.body.includes("At most seven.") && r.body.includes("## Motion examples"));
  assertEq("design: gate stays on after merge", r.data.motion.gate, true);

  const personal = path.join(dd, "personal.md");
  fs.writeFileSync(personal, "---\nrules:\n  hud: true\n  maxWordsOnScreen: 9\nnarration:\n  speed: 0.9\n---\n");
  const three = resolveDesign({ explicit: path.join(dd, "brand", "DESIGN.md"), personal, shipped: path.join(dd, "shipped.md") });
  assertEq("design: three layers in priority order", three.layers.map((l) => l.kind), ["explicit", "personal", "shipped"]);
  assertEq("design: personal layer applies where explicit is silent", [three.data.rules.maxWordsOnScreen, three.data.narration.speed], [9, 0.9]);
  const missing = throwsWith(() => resolveDesign({ explicit: path.join(dd, "nope.md"), personal, shipped: path.join(dd, "shipped.md") }), /not found/);
  assert("design: missing explicit spec is an error", missing.threw && missing.match, missing.message);
}

// design check failures
{
  const bad = `---
name: bad
colors:
  blue: "#58C4DD"
  red: FC6255
  teal: "#notahex"
  gold: #F0AC5F
motion:
  gate: off
  maxStaticSec: 0
  preferred:
    - { primitive: explode, note: nope }
  examples: [missing/example.html]
rules:
  hud: maybe
images:
  - { path: nope.png, role: reference }
  - { path: ../shipped.md, role: banner }
---

## Motion examples

\`\`\`js
kit.beat("b01", (b) => {
  b.draw("#a");
  b.at(1).explode("#b");
  b.spin("#c");
});
\`\`\`
`;
  const file = path.join(dd, "brand", "bad.md");
  fs.writeFileSync(file, bad);
  const { errors } = validateSpec(loadSpec(file));
  const has = (p, re) => errors.some((e) => e.path === p && re.test(e.message));
  assert("check: gate off is an error", has("motion.gate", /cannot be off/));
  assert("check: maxStaticSec 0 is an error", has("motion.maxStaticSec", /greater than 0/));
  assert("check: unquoted hex explains the comment trap", has("colors.gold", /unquoted #/));
  assert("check: non-hex color is an error", has("colors.red", /hex/) && has("colors.teal", /hex/));
  assert("check: unknown preferred primitive is an error", has("motion.preferred[0].primitive", /not a kit primitive/));
  assert("check: missing example path is an error", has("motion.examples[0]", /not found/));
  assert("check: rule of the wrong type is an error", has("rules.hud", /true or false/));
  assert("check: missing image is an error", has("images[0].path", /not found/));
  assert("check: image role must be known", has("images[1].role", /reference, asset, logo/));
  assert("check: unknown primitive in Motion examples code is an error", has("## Motion examples", /b\.explode\(/) && has("## Motion examples", /b\.spin\(/));
  assert("check: kit primitives and b.at() in examples are accepted", !errors.some((e) => /b\.(draw|at|morph)\(/.test(e.message)));

  const gateString = validateSpec({ path: file, data: { motion: { gate: "maybe" } }, body: "" });
  assert("check: non-boolean gate is an error", gateString.errors.some((e) => e.path === "motion.gate"));
  const ok = validateSpec({ path: file, data: { motion: { gate: true, maxStaticSec: 4 } }, body: "" });
  assert("check: a loosened maxStaticSec is allowed", ok.errors.length === 0);
  const unknown = validateSpec({ path: file, data: { colour: {}, rules: { huddle: true } }, body: "" });
  assert("check: unknown keys are warnings, not errors", unknown.errors.length === 0 && unknown.warnings.length === 2);
  assert("check: KIT_PRIMITIVES is the contract list", same(KIT_PRIMITIVES, ["draw", "write", "morph", "move", "camera", "indicate", "count", "grow", "fade"]));
}

// layout and captions (orientation)
{
  const file = path.join(dd, "brand", "layout.md");
  const check = (data) => validateSpec({ path: file, data, body: "" });
  const has = (data, p, re) => check(data).errors.some((e) => e.path === p && re.test(e.message));
  const shipped = { layout: { landscape: { safe: [120, 120, 1800, 960], captions: [160, 900, 1760, 1030] }, portrait: { safe: [60, 220, 960, 1380], captions: [60, 1400, 960, 1580] } }, captions: { burn: { landscape: false, portrait: true }, maxWords: 6 } };
  const ok = check(shipped);
  assert("check: layout and captions as shipped validate with no warning", ok.errors.length === 0 && ok.warnings.length === 0, JSON.stringify(ok));
  assert("check: a box needs four numbers", has({ layout: { portrait: { safe: [1, 2, 3] } } }, "layout.portrait.safe", /box \[x0, y0, x1, y1\] of 4 numbers/) && has({ layout: { portrait: { captions: [1, 2, 3, "x"] } } }, "layout.portrait.captions", /4 numbers/) && has({ layout: { landscape: { safe: "all" } } }, "layout.landscape.safe", /4 numbers/));
  assert("check: a box needs x0 < x1 and y0 < y1", has({ layout: { portrait: { safe: [500, 0, 500, 100] } } }, "layout.portrait.safe", /x0 < x1/) && has({ layout: { portrait: { safe: [0, 900, 100, 100] } } }, "layout.portrait.safe", /y0 < y1/));
  assert("check: a box must sit inside the frame of its orientation", has({ layout: { portrait: { safe: [60, 220, 1200, 1380] } } }, "layout.portrait.safe", /inside the 1080 x 1920 portrait frame/) && has({ layout: { landscape: { captions: [160, 900, 1760, 1100] } } }, "layout.landscape.captions", /inside the 1920 x 1080 landscape frame/) && has({ layout: { portrait: { safe: [-1, 0, 100, 100] } } }, "layout.portrait.safe", /inside/));
  assert("check: the same box is fine in one orientation and wrong in the other", check({ layout: { landscape: { safe: [0, 0, 1920, 1080] } } }).errors.length === 0 && has({ layout: { portrait: { safe: [0, 0, 1920, 1080] } } }, "layout.portrait.safe", /inside/));
  assert("check: a box exactly the frame is accepted", check({ layout: { portrait: { safe: [0, 0, 1080, 1920] } } }).errors.length === 0);
  assert("check: layout must be a map of orientations, each a map", has({ layout: [1] }, "layout", /must be a map/) && has({ layout: { portrait: [1, 2] } }, "layout.portrait", /must be a map with safe and captions boxes/));
  const unknown = check({ layout: { square: { safe: [0, 0, 1, 1] }, portrait: { safe: [0, 0, 10, 10], extra: [1] } }, captions: { burn: { square: true }, wordsPerChunk: 4 } });
  assert("check: unknown orientations and keys are warnings", unknown.errors.length === 0 && ["layout.square", "layout.portrait.extra", "captions.burn.square", "captions.wordsPerChunk"].every((p) => unknown.warnings.some((w) => w.path === p)), JSON.stringify(unknown));
  assert("check: captions.burn must be a map of booleans", has({ captions: { burn: true } }, "captions.burn", /must be a map/) && has({ captions: { burn: { portrait: "yes" } } }, "captions.burn.portrait", /true or false/));
  assert("check: captions.maxWords is a whole number from 1 to 20", [0, 21, 2.5, "6", -3, null].every((v) => has({ captions: { maxWords: v } }, "captions.maxWords", /whole number from 1 to 20/)) && [1, 6, 20].every((v) => check({ captions: { maxWords: v } }).errors.length === 0));
  assert("check: captions must be a map", has({ captions: "on" }, "captions", /must be a map/));
  assertEq(
    "overrides: a changed captions.burn.* is listed like rules.*, an unchanged one is not",
    diffOverrides({ captions: { burn: { landscape: true, portrait: true }, maxWords: 3 } }, { captions: { burn: { landscape: false, portrait: true }, maxWords: 6 } }),
    [{ key: "captions.burn.landscape", default: false, value: true }]
  );
  assertEq("overrides: captions.burn against a default that has none", diffOverrides({ captions: { burn: { portrait: false } } }, {}), [{ key: "captions.burn.portrait", default: null, value: false }]);
  assertEq("overrides: rules, then maxStaticSec, then captions.burn", diffOverrides({ rules: { hud: true }, motion: { maxStaticSec: 3 }, captions: { burn: { portrait: false } } }, { rules: { hud: false }, motion: { maxStaticSec: 2 }, captions: { burn: { portrait: true } } }).map((o) => o.key), ["rules.hud", "motion.maxStaticSec", "captions.burn.portrait"]);

  // through the layers: a brand that turns portrait captions off, and one box of its own
  const brand = path.join(dd, "brand", "no-burn.md");
  fs.writeFileSync(brand, "---\ncaptions:\n  burn:\n    portrait: false\nlayout:\n  portrait:\n    safe: [80, 300, 1000, 1300]\n---\n");
  const merged = resolveDesign({ explicit: brand, personal: path.join(dd, "none.md"), shipped: path.join(dd, "shipped.md") });
  assertEq("design: a brand switches portrait burn off, the rest of the block stays", [merged.data.captions, merged.data.layout.portrait], [{ burn: { landscape: false, portrait: false }, maxWords: 6 }, { safe: [80, 300, 1000, 1300], captions: [60, 1400, 960, 1580] }]);
  assertEq("design: the burn change is an override", merged.overrides.map((o) => o.key), ["captions.burn.portrait"]);
}

assertEq("findProjectSpec: frame.md beats design.md beats DESIGN.md", (() => {
  const d = tmp("find-spec");
  fs.writeFileSync(path.join(d, "DESIGN.md"), "");
  const a = path.basename(findProjectSpec(d));
  fs.writeFileSync(path.join(d, "design.md"), "");
  const entries = fs.readdirSync(d);
  const b = entries.includes("design.md") && entries.includes("DESIGN.md") ? path.basename(findProjectSpec(d)) : "design.md"; // a case-insensitive file system holds one file
  fs.writeFileSync(path.join(d, "frame.md"), "");
  const c = path.basename(findProjectSpec(d));
  return [a, b, c, findProjectSpec(tmp("find-spec-empty"))];
})(), ["DESIGN.md", "design.md", "frame.md", null]);

// tokens css
{
  const css = tokensCss({
    colors: { background: "#000000", surface: "#1C1C1C", text: "#FFFFFF", muted: "#888888", blue: "#58C4DD", brandPink: "#FF2D95" },
    typography: { display: { family: "CMU Serif", weight: 500, fallback: "serif" }, body: { family: "Inter" }, mono: { family: "JetBrains Mono, Menlo", weight: 400 } },
  });
  assert("tokens: :root block with aliases", css.startsWith(":root {") && css.includes("--em-bg: #000000;") && css.includes("--em-surface: #1C1C1C;") && css.includes("--em-text: #FFFFFF;") && css.includes("--em-muted: #888888;"));
  assert("tokens: one property per color key, kebab-case", css.includes("--em-blue: #58C4DD;") && css.includes("--em-brand-pink: #FF2D95;") && css.includes("--em-background: #000000;"));
  assert("tokens: --em-weight-<role> only for roles that define a weight, next to the font line", css.includes("--em-weight-display: 500;") && css.includes("--em-weight-mono: 400;") && !css.includes("--em-weight-body") && css.indexOf("--em-font-display") < css.indexOf("--em-weight-display") && css.indexOf("--em-weight-display") < css.indexOf("--em-font-body"));
  assert("tokens: fonts get a quoted family and a generic fallback", css.includes('--em-font-display: "CMU Serif", serif;') && css.includes("--em-font-body: Inter, sans-serif;") && css.includes('--em-font-mono: "JetBrains Mono", Menlo, monospace;'));
}

// ---------------------------------------------------------------------------
// 3. Language, timeline, subtitles, sidecar, markers
// ---------------------------------------------------------------------------

assertEq(
  "lang: tag to Kokoro language",
  ["pt", "pt-BR", "pt_br", "en", "en-US", "en-GB", "es", "es-MX", "fr", "fr-CA", "it", "ja", "ja-JP", "zh", "zh-CN", "hi", "de", "pt-PT", "en-AU", "ko", "", undefined].map(kokoroLang),
  ["pt-br", "pt-br", "pt-br", "en-us", "en-us", "en-gb", "es", "es", "fr-fr", "fr-fr", "it", "ja", "ja", "zh", "zh", "hi", null, "pt-br", "en-us", null, null, null]
);
assertEq("lang: ste-lint profile is the primary subtag", [lintLang("pt-BR"), lintLang("en-GB"), lintLang("de"), lintLang("ES")], ["pt", "en", "de", "es"]);
assertEq("lang: voice comes from the design by Kokoro language", [voiceFor({ narration: { voices: { "pt-br": "pf_dora" } } }, "pt-br"), voiceFor({ narration: { voices: {} } }, "pt-br"), voiceFor({}, null)], ["pf_dora", null, null]);

assertEq(
  "timeline: lead-in, gaps, tail from durations",
  buildTimeline([{ id: "b01", dur: 3.6 }, { id: "b02", dur: 2.0 }, { id: "b03", dur: 4.123 }], { leadInSec: 0.5, beatGapSec: 0.3, tailSec: 1 }),
  { beats: [{ id: "b01", start: 0.5, end: 4.1, dur: 3.6 }, { id: "b02", start: 4.4, end: 6.4, dur: 2 }, { id: "b03", start: 6.7, end: 10.823, dur: 4.123 }], total: 11.823 }
);
assertEq("timeline: no float drift over many beats", buildTimeline(Array.from({ length: 50 }, (_, i) => ({ id: `b${String(i + 1).padStart(2, "0")}`, dur: 1.1 })), { leadInSec: 0.1, beatGapSec: 0.1, tailSec: 0.1 }).total, 60.1);
assertEq("timeline: defaults when the design omits timings", buildTimeline([{ id: "b01", dur: 1 }]), { beats: [{ id: "b01", start: 0.5, end: 1.5, dur: 1 }], total: 2.5 });
assertEq("estimate: 150 wpm, floor of one second", [estimateDuration("one two three four five six seven eight nine ten"), estimateDuration("Hi."), estimateDuration("one two three four five six seven eight nine ten", { speed: 2 })], [4, 1, 2]);

{
  const wav = (sec, rate = 24000) => {
    const data = Buffer.alloc(Math.round(sec * rate) * 2);
    const h = Buffer.alloc(44);
    h.write("RIFF", 0);
    h.writeUInt32LE(36 + data.length, 4);
    h.write("WAVEfmt ", 8);
    h.writeUInt32LE(16, 16);
    h.writeUInt16LE(1, 20);
    h.writeUInt16LE(1, 22);
    h.writeUInt32LE(rate, 24);
    h.writeUInt32LE(rate * 2, 28);
    h.writeUInt16LE(2, 32);
    h.writeUInt16LE(16, 34);
    h.write("data", 36);
    h.writeUInt32LE(data.length, 40);
    return Buffer.concat([h, data]);
  };
  assertEq("wav: duration from the header", [wavDurationSec(wav(2.944)), wavDurationSec(wav(0.5, 16000)), wavDurationSec(Buffer.from("nope"))], [2.944, 0.5, null]);
  globalThis.__makeWav = wav;
}

assertEq("srt: time format", [formatSrtTime(0), formatSrtTime(0.5), formatSrtTime(3.4444), formatSrtTime(61.001), formatSrtTime(3600.9996)], ["00:00:00,000", "00:00:00,500", "00:00:03,444", "00:01:01,001", "01:00:01,000"]);
assertEq("srt: short caption stays on one line", wrapCaption("Uma tabela hash guarda pares."), "Uma tabela hash guarda pares.");
assertEq("srt: long caption wraps evenly under 42 characters", wrapCaption("Uma tabela hash guarda pares de chave e valor.").split("\n").map((l) => l.length <= 42), [true, true]);
assert("srt: wrap keeps every word", wrapCaption("A função hash transforma a chave em uma posição da tabela.").replace(/\n/g, " ") === "A função hash transforma a chave em uma posição da tabela.");
assert("srt: a word longer than the width is cut", wrapCaption("a".repeat(100)).split("\n").every((l) => l.length <= 42));
{
  const beats = [
    { id: "b01", start: 0.5, end: 3.444, narration: "Uma tabela hash guarda pares." },
    { id: "b02", start: 3.744, end: 7.243, narration: "A função hash escolhe a posição." },
  ];
  assertEq("srt: one numbered cue per beat, blank line between, newline at end", buildSrt(beats), "1\n00:00:00,500 --> 00:00:03,444\nUma tabela hash guarda pares.\n\n2\n00:00:03,744 --> 00:00:07,243\nA função hash escolhe a posição.\n");
  const m = buildMotionJson([{ ...beats[0], subject: "#table" }, { ...beats[1], subject: "#fn" }, { id: "b03", start: 8, end: 9, subject: null }], { maxStaticSec: 3 });
  assertEq("motion.json: keepsMoving with the design limit, one appearsBy per subject at start + 0.5, judged up to the last beat's end", m, {
    duration: 9,
    assertions: [
      { kind: "keepsMoving", maxStaticSec: 3 },
      { kind: "appearsBy", selector: "#table", bySec: 1 },
      { kind: "appearsBy", selector: "#fn", bySec: 4.244 },
    ],
  });
  assertEq("motion.json: default static limit is 2", buildMotionJson([], {}).assertions[0], { kind: "keepsMoving", maxStaticSec: 2 });
  // the Motion Gate stops at the end of the last beat: the closing tail is a deliberate hold, never judged
  const withTail = [{ id: "b01", start: 0.5, end: 3, subject: "#a" }, { id: "b02", start: 3.3, end: 7.25, subject: "#b" }];
  assertEq("motion.json: duration is the end of the last beat, not the end of the video", buildMotionJson(withTail, { maxStaticSec: 2 }).duration, 7.25);
  assertEq("motion.json: the window does not move with the tail (a longer tail changes nothing)", [motionWindowEnd(withTail), motionWindowEnd(withTail)], [7.25, 7.25]);
  assertEq("motion.json: the last beat is the one that counts, whatever the order of the list", motionWindowEnd([withTail[1], withTail[0]]), 7.25);
  assertEq("motion.json: duration is rounded to the millisecond", motionWindowEnd([{ id: "b01", start: 0.5, end: 3.4870000001 }]), 3.487);
  assert("motion.json: no beats means no duration key (HyperFrames then uses the composition's length)", !("duration" in buildMotionJson([], { maxStaticSec: 2 })) && motionWindowEnd([]) === null);
  assert("motion.json: a beat without a usable end is ignored, and a list of them gives no duration", motionWindowEnd([{ id: "b01", start: 0.5 }, { id: "b02", start: 1, end: NaN }]) === null && motionWindowEnd([{ id: "b01", start: 0.5 }, { id: "b02", start: 1, end: 4 }]) === 4);
  assert("motion.json: HyperFrames takes a positive finite duration, and every duration built here is one", [withTail, [{ id: "b01", start: 0.5, end: 1.5 }]].every((bs) => { const d = buildMotionJson(bs, {}).duration; return Number.isFinite(d) && d > 0; }));

  const data = buildExplainData({ lang: "pt-BR", silent: false, total: 8.243, beats: beats.map((b, i) => ({ ...b, scene: "s1", dur: 1, subject: i ? "#fn" : "#table" })), design: { colors: { blue: "#fff" }, rules: { hud: false } } });
  const sandbox = { window: {} };
  new Function("window", data)(sandbox.window);
  assert("explain-data.js: defines window.EXPLAIN with lang, silent, total, beats, design", sandbox.window.EXPLAIN.lang === "pt-BR" && sandbox.window.EXPLAIN.silent === false && sandbox.window.EXPLAIN.total === 8.243 && sandbox.window.EXPLAIN.beats.length === 2 && sandbox.window.EXPLAIN.design.colors.blue === "#fff");
  assertEq("explain-data.js: beat fields", Object.keys(sandbox.window.EXPLAIN.beats[0]), ["id", "scene", "start", "end", "dur", "narration", "subject"]);

  const tags = audioTags([{ id: "b01", start: 0.5, dur: 2.944 }]);
  assertEq("audio tags: id, src, timing, track, no crossorigin", tags, ['<audio id="vo-b01" src="audio/b01.wav" data-start="0.5" data-duration="2.944" data-track-index="10" data-volume="1"></audio>']);
  assert("audio tags: never crossorigin", !tags.join("").includes("crossorigin"));
}

const COMPOSITION = `<!doctype html>
<html><head><title>x</title>
    <!-- explain:tokens:start -->
    <style>
      :root { --em-blue: #stale; }
    </style>
    <!-- explain:tokens:end -->
</head>
<body>
    <div
      id="root"
      data-composition-id="explain"
      data-start="0"
      data-width="1920"
      data-height="1080"
      data-duration="10"
    >
      <!-- explain:audio:start -->
      <!-- explain:audio:end -->

      <!-- explain:stage:start -->
      <svg id="stage" viewBox="0 0 1920 1080"><circle id="dot"/></svg>
      <!-- explain:stage:end -->
    </div>
    <!-- explain:scene:start -->
    <script>/* scene */</script>
    <!-- explain:scene:end -->
</body></html>
`;
{
  const tags = ['<audio id="vo-b01" src="audio/b01.wav" data-start="0.5" data-duration="1"></audio>', '<audio id="vo-b02" src="audio/b02.wav" data-start="2" data-duration="1"></audio>'];
  const out = rewriteAudioRegion(COMPOSITION, tags);
  assert("markers: audio tags land between the markers with the marker's indent", out.includes(`${AUDIO_START}\n      ${tags[0]}\n      ${tags[1]}\n      ${AUDIO_END}`));
  assert("markers: nothing outside the audio region changes", out.replace(/<audio[^>]*><\/audio>\s*/g, "").replace(/\s+/g, "") === COMPOSITION.replace(/\s+/g, ""));
  assertEq("markers: rewriting is idempotent", rewriteAudioRegion(out, tags), out);
  assert("markers: an empty tag list clears the region", !rewriteAudioRegion(out, []).includes("<audio"));
  assert("markers: stage and scene regions are untouched", out.includes('<circle id="dot"/>') && out.includes("/* scene */"));
  const e = throwsWith(() => rewriteAudioRegion("<div></div>", tags), /markers/);
  assert("markers: missing markers is a clear error", e.threw && e.match, e.message);

  const dur = rewriteRootDuration(COMPOSITION, 31.4);
  assert("root: data-duration rewritten on the explain root only", /data-composition-id="explain"[\s\S]*data-duration="31.4"/.test(dur) && !dur.includes('data-duration="10"'));
  assertEq("root: other attributes survive", dur.replace('data-duration="31.4"', 'data-duration="10"'), COMPOSITION);
  const added = rewriteRootDuration('<div id="root" data-composition-id="explain" data-width="1920">', 5);
  assert("root: data-duration is added when missing", added === '<div id="root" data-composition-id="explain" data-width="1920" data-duration="5">', added);
  const single = rewriteRootDuration("<div data-composition-id='explain' data-duration='3'>", 7.5);
  assert("root: single-quoted attribute is rewritten", single.includes('data-duration="7.5"'), single);
  const noRoot = throwsWith(() => rewriteRootDuration("<div></div>", 1), /data-composition-id/);
  assert("root: missing root is a clear error", noRoot.threw && noRoot.match, noRoot.message);
  const both = rewriteComposition(COMPOSITION, { tags, total: 12.5 });
  assert("markers: rewriteComposition does both", both.includes('data-duration="12.5"') && both.includes("vo-b02"));

  const css = ":root {\n  --em-blue: #58C4DD;\n  --em-font-display: \"EB Garamond\", serif;\n}\n";
  const inlined = rewriteTokensRegion(COMPOSITION, css);
  assert("tokens: the region holds a <style> with the exact text of tokens.css, markers kept", inlined.includes(`<!-- explain:tokens:start -->\n    <style>\n${css}    </style>\n    <!-- explain:tokens:end -->`) && !inlined.includes("#stale"));
  assertEq("tokens: rewriting is idempotent", rewriteTokensRegion(inlined, css), inlined);
  assert("tokens: nothing outside the region changes", inlined.replace(/<!-- explain:tokens:start -->[\s\S]*<!-- explain:tokens:end -->/, "") === COMPOSITION.replace(/<!-- explain:tokens:start -->[\s\S]*<!-- explain:tokens:end -->/, ""));
  assert("tokens: css without a final newline is still closed on its own line", rewriteTokensRegion(COMPOSITION, ":root {}").includes("<style>\n:root {}\n    </style>"));
  const noTokens = throwsWith(() => rewriteTokensRegion("<head></head>", css), /explain:tokens/);
  assert("tokens: missing markers is a clear error", noTokens.threw && noTokens.match, noTokens.message);
  assert("tokens: hasTokensRegion", hasTokensRegion(COMPOSITION) && !hasTokensRegion("<head></head>"));
  const withTokens = rewriteComposition(COMPOSITION, { tags, total: 3, tokens: css });
  assert("tokens: rewriteComposition inlines them when given, leaves the region alone when not", withTokens.includes("--em-font-display") && withTokens.includes('data-duration="3"') && rewriteComposition(COMPOSITION, { tags, total: 3 }).includes("#stale"));
  assert("tokens: rewriteComposition without markers is not an error", rewriteComposition("<div data-composition-id=\"explain\"><!-- explain:audio:start --><!-- explain:audio:end --></div>", { tags: [], total: 1, tokens: css }).includes('data-duration="1"'));
}

{
  const ok = validateScript({ lang: "pt-BR", beats: [{ id: "b01", narration: " Uma  frase. ", subject: "#table" }, { id: "b02", scene: "s2", narration: "Outra frase." }] });
  assertEq("script: valid script normalises beats", ok, { errors: [], beats: [{ id: "b01", scene: "s1", narration: "Uma frase.", subject: "#table" }, { id: "b02", scene: "s2", narration: "Outra frase.", subject: null }] });
  const msgs = (s) => validateScript(s).errors.join(" | ");
  assert("script: empty beats", /non-empty beats/.test(msgs({ beats: [] })));
  assert("script: bad id", /must look like b01/.test(msgs({ beats: [{ id: "x1", narration: "a" }] })));
  assert("script: duplicate id", /appears twice/.test(msgs({ beats: [{ id: "b01", narration: "a" }, { id: "b01", narration: "b" }] })));
  assert("script: ids must ascend", /out of order/.test(msgs({ beats: [{ id: "b02", narration: "a" }, { id: "b01", narration: "b" }] })));
  assert("script: empty narration", /no narration/.test(msgs({ beats: [{ id: "b01", narration: "  " }] })));
  assert("script: subject must be a CSS id selector", /CSS id selector/.test(msgs({ beats: [{ id: "b01", narration: "a", subject: ".cls" }] })));
  assert("script: three-digit ids are fine", validateScript({ beats: [{ id: "b100", narration: "a" }] }).errors.length === 0);
}

// ---------------------------------------------------------------------------
// 3a. The starter explanation.md that `new` writes for every format
// ---------------------------------------------------------------------------

{
  const headings = (text) => text.split("\n").filter((l) => l.startsWith("## "));
  const oneLineComments = (text) => text.split("\n").filter((l) => /^<!--.*-->$/.test(l));
  const pt = starterExplanation("pt-BR");
  assertEq("explanation: a Portuguese request gets the three Portuguese sections, in order", headings(pt), ["## Distinção central", "## Glossário", "## Pergunta de explicação"]);
  assert("explanation: the glossary is a three-column table header (simple term, formal name, example) with its separator row", pt.includes("| termo simples | nome formal | exemplo |\n| --- | --- | --- |\n"));
  const en = starterExplanation("en");
  assertEq("explanation: an English request gets the three English sections, in order", headings(en), ["## Load-bearing distinction", "## Glossary", "## Explain-back question"]);
  assert("explanation: the English glossary header is plain name | formal name | example", en.includes("| plain name | formal name | example |\n| --- | --- | --- |\n"));
  for (const [name, text] of [["pt", pt], ["en", en]]) {
    const lines = text.split("\n");
    const comments = oneLineComments(text);
    assert(`explanation: ${name}: each section is followed by its own one-line HTML comment saying what goes there`, comments.length === 3 && headings(text).every((h) => /^<!-- .{12,} -->$/.test(lines[lines.indexOf(h) + 2] ?? "")), JSON.stringify(comments));
    assert(`explanation: ${name}: the file ends with one newline and has no unfilled marker besides the comments`, text.endsWith("-->\n") && !text.endsWith("\n\n") && !/TODO|XXX/.test(text));
  }
  assertEq("explanation: pt, pt-PT, pt_BR and PT are Portuguese; every other language is English", ["pt", "pt-PT", "pt_BR", "PT", "pt-br", "en", "en-GB", "es", "fr-FR", "ja", "", undefined, null].map(explanationLanguage), ["pt", "pt", "pt", "pt", "pt", "en", "en", "en", "en", "en", "en", "en", "en"]);
  assert("explanation: a language with no profile gets the English sections", starterExplanation("es") === en && starterExplanation("ja") === en && starterExplanation("zh-CN") === en);
  assert("explanation: the starter text is stable (same call, same text)", starterExplanation("pt-BR") === pt);
  // ste-lint skips headings, one-line comments and tables, so the starter is clean in every profile
  const clean = (r) => r.errors.length === 0 && r.warnings.length === 0;
  assert("explanation: the Portuguese starter lints clean under the pt profile", clean(lintText(pt, { lang: "pt" })), JSON.stringify(lintText(pt, { lang: "pt" })));
  assert("explanation: the English starter lints clean under the en profile and under the core rules", clean(lintText(en, { lang: "en" })) && clean(lintText(en, { lang: "es" })), JSON.stringify(lintText(en, { lang: "en" })));

  // never overwritten
  const dir = tmp("explanation-write");
  const file = writeStarterExplanation(dir, "pt-BR");
  assert("explanation: writeStarterExplanation writes <run>/explanation.md and returns its path", file === path.join(dir, "explanation.md") && fs.readFileSync(file, "utf8") === pt);
  fs.writeFileSync(file, "## Distinção central\n\nJuros sobre juros.\n");
  const again = writeStarterExplanation(dir, "pt-BR");
  assert("explanation: a file that is already there is never overwritten", again === file && fs.readFileSync(file, "utf8") === "## Distinção central\n\nJuros sobre juros.\n");
  const other = tmp("explanation-write-en");
  fs.writeFileSync(path.join(other, "explanation.md"), "mine");
  writeStarterExplanation(other, "en");
  assert("explanation: not even by a call in another language", fs.readFileSync(path.join(other, "explanation.md"), "utf8") === "mine");
  const bad = throwsWith(() => writeStarterExplanation(path.join(dir, "no", "such", "folder"), "en"), /ENOENT/);
  assert("explanation: any other write error is not swallowed", bad.threw && bad.match, bad.message);
}

// ---------------------------------------------------------------------------
// 3b. Frames, hints, language tag, orientation (pure functions)
// ---------------------------------------------------------------------------

// frames: one per beat, just before the beat ends and never outside it
assertEq("frames: 0.1 s before the beat ends", [frameTime({ start: 0.5, end: 4.1 }), frameTime({ start: 4.4, end: 6.4 }), frameTime({ start: 6.7, end: 10.823 })], [4, 6.3, 10.723]);
assertEq("frames: a beat shorter than 0.1 s is clamped to its start", [frameTime({ start: 2, end: 2.05 }), frameTime({ start: 2, end: 2 })], [2, 2]);
assert("frames: always inside [start, end]", [[0, 1], [0.5, 1.5], [3.3, 3.31], [10, 17.25]].every(([start, end]) => { const t = frameTime({ start, end }); return t >= start && t <= end; }));

// two inspection frames per beat: the entrance at start + min(1.0, 0.4 x dur), the settled one 0.1 s before the end
assertEq("frames: the entrance is 1.0 s in for a beat of 2.5 s or more", [entranceFrameTime({ start: 0.5, end: 3.487 }), entranceFrameTime({ start: 3.787, end: 6.347 }), entranceFrameTime({ start: 24.147, end: 26.814 })], [1.5, 4.787, 25.147]);
assertEq("frames: the entrance is 40 percent in for a shorter beat", [entranceFrameTime({ start: 0, end: 2 }), entranceFrameTime({ start: 10, end: 11 }), entranceFrameTime({ start: 4, end: 5.5 })], [0.8, 10.4, 4.6]);
assertEq("frames: the entrance of a beat with no length is its start", entranceFrameTime({ start: 2, end: 2 }), 2);
assert("frames: both frames are always inside [start, end]", [[0, 1], [0.5, 1.5], [3.3, 3.31], [10, 17.25], [2, 2], [7, 7.05]].every(([start, end]) => [entranceFrameTime({ start, end }), frameTime({ start, end })].every((t) => t >= start && t <= end)));
assert("frames: the entrance comes before the settled frame for every beat of a real length", [[0.5, 3.487], [3.787, 6.347], [10, 11], [1, 1.5]].every(([start, end]) => entranceFrameTime({ start, end }) < frameTime({ start, end })));
{
  const frames = inspectionFrames([{ id: "b01", start: 0.5, end: 3.487 }, { id: "b02", start: 3.787, end: 6.347 }]);
  assertEq("frames: two per beat in order, the entrance first, named <id>-in and <id>", frames.map((f) => [f.name, f.kind, f.id]), [["b01-in", "in", "b01"], ["b01", "settled", "b01"], ["b02-in", "in", "b02"], ["b02", "settled", "b02"]]);
  assertEq("frames: the times of those four", frames.map((f) => f.at), [1.5, 3.387, 4.787, 6.247]);
  assertEq("frames: no beats, no frames", inspectionFrames([]), []);
}

// hints: the script path as the user can run it from where they are
{
  const script = "/repo/skills/explain-me/scripts/explain.mjs";
  const posix = path.posix;
  assertEq("hints: relative to the current folder", scriptRef(script, "/repo", posix), "skills/explain-me/scripts/explain.mjs");
  assertEq("hints: a folder below it", scriptRef(script, "/repo/skills", posix), "explain-me/scripts/explain.mjs");
  assertEq("hints: two levels up is still relative", scriptRef(script, "/repo/a/b", posix), "../../skills/explain-me/scripts/explain.mjs");
  assertEq("hints: more than two levels up is absolute", scriptRef(script, "/repo/a/b/c", posix), script);
  assertEq("hints: a different tree is absolute", scriptRef(script, "/home/u/project/deep/er", posix), script);
  assertEq("hints: quoting only when needed", [quoteArg("/a/b/run-1"), quoteArg("/a b/run"), quoteArg('x"y$z')], ["/a/b/run-1", '"/a b/run"', '"x\\"y\\$z"']);
  assertEq("hints: a full command line", commandLine(script, `voice ${quoteArg("/r r")}`, "/repo", posix), 'node skills/explain-me/scripts/explain.mjs voice "/r r"');
  assertEq("hints: no arguments", commandLine(script, "", "/repo", posix), "node skills/explain-me/scripts/explain.mjs");
}

// <html lang>
{
  const page = '<!doctype html>\n<html lang="en" data-x="1"><head></head></html>';
  assertEq("lang tag: pt_BR is written pt-BR, junk is refused", [htmlLangTag("pt_BR"), htmlLangTag("pt-BR"), htmlLangTag(" en "), htmlLangTag("zh-Hans-CN"), htmlLangTag("not a tag"), htmlLangTag(""), htmlLangTag(undefined)], ["pt-BR", "pt-BR", "en", "zh-Hans-CN", null, null, null]);
  assertEq("html lang: replaces the template's lang and keeps the other attributes", rewriteHtmlLang(page, "pt-BR"), '<!doctype html>\n<html lang="pt-BR" data-x="1"><head></head></html>');
  assertEq("html lang: adds the attribute when there is none", rewriteHtmlLang("<html><head></head></html>", "es"), '<html lang="es"><head></head></html>');
  assertEq("html lang: idempotent", rewriteHtmlLang(rewriteHtmlLang(page, "fr"), "fr"), rewriteHtmlLang(page, "fr"));
  assertEq("html lang: a bad tag or a page without <html> is left alone", [rewriteHtmlLang(page, "??"), rewriteHtmlLang("<div></div>", "en")], [page, "<div></div>"]);
  assert("html lang: rewriteComposition sets it, and leaves it alone when no lang is given", rewriteComposition(COMPOSITION.replace("<html>", '<html lang="en">'), { tags: [], total: 3, lang: "pt-BR" }).includes('<html lang="pt-BR">') && rewriteComposition(COMPOSITION.replace("<html>", '<html lang="en">'), { tags: [], total: 3 }).includes('<html lang="en">'));
}

// orientation: names, sizes, layout resolution
assertEq("orientation: aliases", ["landscape", "horizontal", "16:9", "Portrait", "vertical", "9:16", "reels", "SHORTS", " tiktok "].map(normalizeOrientation), ["landscape", "landscape", "landscape", "portrait", "portrait", "portrait", "portrait", "portrait", "portrait"]);
assertEq("orientation: anything else is null", ["square", "", "4:3", undefined, 16, null].map(normalizeOrientation), [null, null, null, null, null, null]);
assertEq("orientation: frame sizes", [frameSize("landscape"), frameSize("portrait"), frameSize("nope")], [{ width: 1920, height: 1080 }, { width: 1080, height: 1920 }, { width: 1920, height: 1080 }]);
assertEq("orientation: a run.json without the field is landscape", [runOrientation({}), runOrientation(undefined), runOrientation({ orientation: "portrait" }), runOrientation({ orientation: "bogus" })], ["landscape", "landscape", "portrait", "landscape"]);
{
  const design = { layout: { portrait: { safe: [10, 20, 30, 40], captions: [1, 2, 3, 4] } }, captions: { burn: { portrait: false, landscape: true }, maxWords: 4 } };
  assertEq("layout: the design's boxes, burn switch and chunk size for the run's orientation", resolveLayout(design, "portrait"), { layout: { safe: [10, 20, 30, 40], captions: [1, 2, 3, 4] }, captions: { burn: false, maxWords: 4 } });
  assertEq("layout: burn is resolved per orientation", resolveLayout(design, "landscape").captions.burn, true);
  assertEq("layout: a design without layout or captions falls back to the built-in defaults", resolveLayout({}, "portrait"), { layout: DEFAULT_LAYOUT.portrait, captions: { burn: true, maxWords: 6 } });
  assertEq("layout: landscape does not burn by default", resolveLayout({}, "landscape").captions.burn, false);
  assertEq("layout: wrong shapes fall back instead of breaking the build", resolveLayout({ layout: { portrait: { safe: [1, 2, 3] } }, captions: { burn: { portrait: "yes" }, maxWords: 0 } }, "portrait"), { layout: DEFAULT_LAYOUT.portrait, captions: { burn: true, maxWords: 6 } });
  const copy = resolveLayout({}, "portrait");
  copy.layout.safe[0] = 999;
  assert("layout: the defaults are copied, not shared", DEFAULT_LAYOUT.portrait.safe[0] === 60);
}

// orientation in the composition: root size, viewport meta, placeholder stage and its comment
{
  const page = `<html><head><meta name="viewport" content="width=1920, height=1080" /></head><body>
<div id="root" data-composition-id="explain" data-start="0" data-width="1920" data-height="1080" data-duration="10">
  <!-- explain:stage:start -->
  <!-- STAGE: one <svg id="stage"> in a 1920 x 1080 viewBox. Replace everything below. -->
  <svg id="stage" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg"><circle id="subject" cx="960" cy="500" r="170"/><text id="t">1920 x 1080 stays</text></svg>
  <!-- explain:stage:end -->
</div></body></html>`;
  const portrait = applyOrientation(page, "portrait");
  assert("orientation: the root carries the portrait size", /data-composition-id="explain" data-start="0" data-width="1080" data-height="1920"/.test(portrait));
  assert("orientation: the viewport meta follows", portrait.includes('content="width=1080, height=1920"'));
  assert("orientation: the placeholder stage has the portrait viewBox", portrait.includes('<svg id="stage" viewBox="0 0 1080 1920" xmlns='));
  assert("orientation: the stage comment names the portrait size and still mentions the svg tag", portrait.includes('<!-- STAGE: one <svg id="stage"> in a 1080 x 1920 viewBox.'));
  assert("orientation: the agent's elements and text are not touched", portrait.includes('<circle id="subject" cx="960" cy="500" r="170"/>') && portrait.includes("1920 x 1080 stays"));
  // the comment may name the stage without writing the literal <svg id="stage"> in it: the size is still rewritten, the real element too
  const quiet = page.replace('one <svg id="stage"> in a 1920 x 1080 viewBox', 'one svg element with id "stage", in a 1920 x 1080 viewBox');
  const quietPortrait = applyOrientation(quiet, "portrait");
  assert("orientation: a stage comment that names no literal svg tag gets the portrait size, the element gets the viewBox", quietPortrait.includes('<!-- STAGE: one svg element with id "stage", in a 1080 x 1920 viewBox.') && quietPortrait.includes('<svg id="stage" viewBox="0 0 1080 1920" xmlns=') && !quietPortrait.includes("in a 1920 x 1080"));
  assertEq("orientation: and landscape is still the identity for that wording", applyOrientation(quiet, "landscape"), quiet);
  {
    const real = fs.readFileSync(path.join(HERE, "..", "assets", "composition.html"), "utf8");
    const stageOf = (h) => h.slice(h.indexOf("<!-- explain:stage:start -->"), h.indexOf("<!-- explain:stage:end -->"));
    const realPortrait = applyOrientation(real, "portrait");
    assert("orientation: the shipped template becomes a portrait project (root size, stage viewBox, size named in its comment)", /data-width="1080"/.test(realPortrait) && /data-height="1920"/.test(realPortrait) && /<svg id="stage" viewBox="0 0 1080 1920"/.test(realPortrait) && !stageOf(realPortrait).includes("1920 x 1080") && (!stageOf(real).includes("1920 x 1080") || stageOf(realPortrait).includes("1080 x 1920")));
    assertEq("orientation: landscape is the identity on the shipped template", applyOrientation(real, "landscape"), real);
  }
  assertEq("orientation: landscape is the identity on the template", applyOrientation(page, "landscape"), page);
  assertEq("orientation: switching back and forth is stable", applyOrientation(applyOrientation(page, "portrait"), "landscape"), page);
  assert("orientation: a page with no stage region only gets the root size", applyOrientation('<div data-composition-id="explain" data-width="1920" data-height="1080"></div>', "portrait") === '<div data-composition-id="explain" data-width="1080" data-height="1920"></div>');
  assert("orientation: a stage without a viewBox gets one", rewriteStagePlaceholder("<!-- explain:stage:start --><svg id=\"stage\"></svg><!-- explain:stage:end -->", 1080, 1920).includes('<svg id="stage" viewBox="0 0 1080 1920"></svg>'));
  assert("orientation: missing stage markers leave the page alone", rewriteStagePlaceholder("<svg id=\"stage\" viewBox=\"0 0 1 1\"></svg>", 1080, 1920) === "<svg id=\"stage\" viewBox=\"0 0 1 1\"></svg>");
  assert("orientation: root size is added when the attributes are missing", rewriteRootSize('<div data-composition-id="explain">', 1080, 1920) === '<div data-composition-id="explain" data-width="1080" data-height="1920">');
  assertEq("stage check: a stage in the frame's shape passes", [stageFrameMismatch(page, "landscape"), stageFrameMismatch(portrait, "portrait"), stageFrameMismatch('<svg id="stage" viewBox="0 0 1920 1081"></svg>', "landscape")], [null, null, null]);
  const mismatch = stageFrameMismatch(page, "portrait");
  assert("stage check: a landscape stage in a portrait run is named, with the viewBox to use", /1920 x 1080/.test(mismatch) && /portrait run \(1080 x 1920\)/.test(mismatch) && /viewBox 0 0 1080 1920/.test(mismatch) && /letterboxed/.test(mismatch), mismatch);
  assert("stage check: the reverse mismatch is named too", /1080 x 1920/.test(stageFrameMismatch(portrait, "landscape")));
  assertEq("stage check: no stage, no viewBox or a comment that mentions the svg tag is not a verdict", [stageFrameMismatch("<div></div>", "portrait"), stageFrameMismatch('<svg id="stage"></svg>', "portrait"), stageFrameMismatch('<!-- <svg id="stage" viewBox="0 0 1920 1080"> --><svg id="stage" viewBox="0 0 1080 1920"></svg>', "portrait")], [null, null, null]);
  const noRoot = throwsWith(() => rewriteRootSize("<div></div>", 1, 1), /data-composition-id/);
  assert("orientation: a page with no root is a clear error", noRoot.threw && noRoot.match, noRoot.message);
}

// explain-data.js and the motion sidecar carry the orientation
{
  const beats = [{ id: "b01", scene: "s1", start: 0.5, end: 3, dur: 2.5, narration: "Uma frase.", subject: "#a" }];
  const evalData = (src) => {
    const w = {};
    new Function("window", src)(w);
    return w.EXPLAIN;
  };
  const layout = { safe: [60, 220, 960, 1380], captions: [60, 1400, 960, 1580] };
  const portraitData = evalData(buildExplainData({ lang: "pt-BR", silent: false, total: 4, beats, design: { rules: {} }, orientation: "portrait", layout, captions: { burn: true, maxWords: 6 } }));
  assertEq("explain-data.js: orientation, size, layout and captions", [portraitData.orientation, portraitData.width, portraitData.height, portraitData.layout, portraitData.captions], ["portrait", 1080, 1920, layout, { burn: true, maxWords: 6 }]);
  const plain = evalData(buildExplainData({ lang: "en", silent: true, total: 4, beats, design: {} }));
  assertEq("explain-data.js: defaults to landscape 1920x1080 and omits what it was not given", [plain.orientation, plain.width, plain.height, "layout" in plain, "captions" in plain, plain.beats.length], ["landscape", 1920, 1080, false, false, 1]);
  assertEq("explain-data.js: the beat fields did not change", Object.keys(portraitData.beats[0]), ["id", "scene", "start", "end", "dur", "narration", "subject"]);
  assertEq("motion.json: burned captions limit keepsMoving to #stage", buildMotionJson([{ id: "b01", start: 0.5, end: 3, subject: "#a" }], { maxStaticSec: 2, withinSelector: "#stage" }).assertions, [{ kind: "keepsMoving", maxStaticSec: 2, withinSelector: "#stage" }, { kind: "appearsBy", selector: "#a", bySec: 1 }]);
  assert("motion.json: no withinSelector key without burned captions", !("withinSelector" in buildMotionJson([], { maxStaticSec: 2 }).assertions[0]));
}

// espeak-ng in doctor: always a verdict, with the install command when it is missing
{
  const py = { ok: true, path: "/py" };
  const noPy = { ok: false, path: null };
  const mk = (platform, files, works) => fakeDeps({ platform, files, env: { PATH: "" }, exec: (cmd, args, opts) => ({ status: works(opts.env) ? 0 : 1, stdout: "", stderr: "Error processing file phontab" }) }).deps;
  let r = inspectEspeak(mk("darwin", {}, () => true), py);
  assertEq("espeak doctor: bundled loader that works", [r.status, r.ok, r.tested], ["bundled", true, true]);
  r = inspectEspeak(mk("darwin", { "/opt/homebrew/lib/libespeak-ng.dylib": "" }, (env) => Boolean(env.PHONEMIZER_ESPEAK_LIBRARY)), py);
  assertEq("espeak doctor: the system library when the bundled one is broken", [r.status, r.library, r.ok], ["system", "/opt/homebrew/lib/libespeak-ng.dylib", true]);
  r = inspectEspeak(mk("darwin", {}, () => false), py);
  assert("espeak doctor: neither works is missing, with the phonemizer's error", r.status === "missing" && r.ok === false && /phontab/.test(r.error));
  r = inspectEspeak(mk("linux", { "/usr/lib/x86_64-linux-gnu/libespeak-ng.so.1": "" }, () => false), noPy);
  assertEq("espeak doctor: with no Python only the system library can be seen, and it says it was not tried", [r.status, r.tested, r.library], ["system", false, "/usr/lib/x86_64-linux-gnu/libespeak-ng.so.1"]);
  r = inspectEspeak(mk("linux", {}, () => false), noPy);
  assertEq("espeak doctor: with no Python and no library it is missing", [r.status, r.ok, r.tested], ["missing", false, false]);
  assertEq("espeak doctor: the install command per platform", [espeakInstallHint("darwin"), /apt install espeak-ng/.test(espeakInstallHint("linux")), /releases/.test(espeakInstallHint("win32"))], ["install espeak-ng with: brew install espeak-ng", true, true]);
}

// ---------------------------------------------------------------------------
// 4. Resolution order with injected fakes
// ---------------------------------------------------------------------------

function fakeDeps({ files = {}, dirs = {}, exec, env = {}, platform = "linux", homedir = "/home/u" } = {}) {
  const fsApi = {
    existsSync: (p) => p in files || p in dirs,
    readdirSync: (p) => {
      if (!(p in dirs)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      return dirs[p];
    },
    readFileSync: (p) => {
      if (!(p in files)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      return files[p];
    },
    statSync: () => ({ isFile: () => true }),
  };
  const calls = [];
  return {
    deps: { env, platform, homedir, nodePath: "/usr/bin/node", fs: fsApi, exec: (cmd, args, opts) => (calls.push([cmd, ...args]), exec ? exec(cmd, args, opts) : { status: 0, stdout: "", stderr: "" }) },
    calls,
  };
}
const npxPkg = (version) => JSON.stringify({ name: "hyperframes", version });
const cacheFiles = (root, entries) => {
  const files = {};
  const dirs = { [root]: Object.keys(entries) };
  for (const [entry, version] of Object.entries(entries)) {
    files[`${root}/${entry}/node_modules/hyperframes/bin/hyperframes.mjs`] = "";
    files[`${root}/${entry}/node_modules/hyperframes/package.json`] = npxPkg(version);
  }
  return { files, dirs };
};

assertEq("semver: ordering", [compareSemver("0.8.134", "0.8.105"), compareSemver("0.9.0", "0.10.0"), compareSemver("1.0.0", "1.0.0-rc.1"), compareSemver("x", "0.0.1"), compareSemver("2.0.0", "2.0.0")], [1, -1, 1, -1, 0]);

{
  // tier 1: PATH wins over the npx cache
  const cache = cacheFiles("/home/u/.npm/_npx", { aaa: "0.8.105" });
  const { deps, calls } = fakeDeps({
    env: { PATH: "/bin:/opt/bin" },
    files: { ...cache.files, "/opt/bin/hyperframes": "" },
    dirs: cache.dirs,
    exec: () => ({ status: 0, stdout: "0.9.1\n", stderr: "" }),
  });
  const r = resolveHyperframes(deps);
  assertEq("hyperframes: PATH beats the npx cache", [r.tier, r.command, r.version], ["path", "/opt/bin/hyperframes", "0.9.1"]);
  assert("hyperframes: the --version probe runs quiet (no telemetry, no auto-update)", calls[0][0] === "/opt/bin/hyperframes" && calls[0][1] === "--version");
}
{
  // tier 2: highest cached copy, run with node
  const cache = cacheFiles("/home/u/.npm/_npx", { aaa: "0.8.105", bbb: "0.8.134", ccc: "0.7.0" });
  const { deps, calls } = fakeDeps({ env: { PATH: "/bin" }, ...cache });
  const r = resolveHyperframes(deps);
  assertEq("hyperframes: npx cache picks the highest version", [r.tier, r.version, r.command, r.prefixArgs], ["npx-cache", "0.8.134", "/usr/bin/node", ["/home/u/.npm/_npx/bbb/node_modules/hyperframes/bin/hyperframes.mjs"]]);
  assert("hyperframes: reading the npx cache runs nothing", calls.length === 0);
  assertEq("hyperframes: findNpxCacheCopies sorts newest first", findNpxCacheCopies(deps).map((c) => c.version), ["0.8.134", "0.8.105", "0.7.0"]);
}
{
  // npm_config_cache is honoured; a corrupt entry is skipped
  const cache = cacheFiles("/custom/_npx", { good: "0.8.1" });
  cache.files["/custom/_npx/bad/node_modules/hyperframes/bin/hyperframes.mjs"] = "";
  cache.files["/custom/_npx/bad/node_modules/hyperframes/package.json"] = "{not json";
  cache.dirs["/custom/_npx"].push("bad");
  const { deps } = fakeDeps({ env: { PATH: "", npm_config_cache: "/custom" }, ...cache });
  assertEq("hyperframes: npm_config_cache is searched and bad entries skipped", findNpxCacheCopies(deps).map((c) => c.version), ["0.8.1"]);
}
{
  // tier 3: latest only when nothing is installed
  const { deps, calls } = fakeDeps({ env: { PATH: "/bin" }, files: { "/bin/npx": "" } });
  const r = resolveHyperframes(deps);
  assertEq("hyperframes: npx@latest only when nothing is installed", [r.tier, r.command, r.prefixArgs, r.version], ["npx-latest", "/bin/npx", ["--yes", "hyperframes@latest"], null]);
  assert("hyperframes: doctor-style resolution never runs npx", calls.length === 0);
  const probing = fakeDeps({ env: { PATH: "/bin" }, files: { "/bin/npx": "" }, exec: () => ({ status: 0, stdout: "0.8.134", stderr: "" }) });
  const p = resolveHyperframes(probing.deps, { probeNpx: true });
  assertEq("hyperframes: probeNpx records the downloaded version", [p.tier, p.version], ["npx-latest", "0.8.134"]);
  const none = resolveHyperframes(fakeDeps({ env: { PATH: "/bin" } }).deps);
  assert("hyperframes: nothing installed and no npx is a clear failure", none.ok === false && /npx/.test(none.reason) && none.fix);
}
{
  // windows .cmd shim is run through its sibling script with node
  const { deps } = fakeDeps({
    platform: "win32",
    homedir: "C:\\Users\\u",
    env: { PATH: "C:\\npm", PATHEXT: ".EXE;.CMD" },
    files: { "C:\\npm\\hyperframes.CMD": "", "C:\\npm\\node_modules\\hyperframes\\bin\\hyperframes.mjs": "" },
    exec: () => ({ status: 0, stdout: "0.8.105", stderr: "" }),
  });
  const r = resolveHyperframes(deps);
  assertEq("hyperframes: Windows shim runs through node and the package script", [r.tier, r.command, r.prefixArgs.length], ["path", "/usr/bin/node", 1]);
}
{
  const e = hfEnv({ PATH: "/bin" });
  assertEq("env: quiet defaults set", [e.HYPERFRAMES_NO_TELEMETRY, e.HYPERFRAMES_NO_UPDATE_CHECK, e.HYPERFRAMES_NO_AUTO_INSTALL], ["1", "1", "1"]);
  const keep = hfEnv({ HYPERFRAMES_NO_TELEMETRY: "0" }, { HYPERFRAMES_PYTHON: "/p" });
  assertEq("env: a value the user already set is kept; extras are added", [keep.HYPERFRAMES_NO_TELEMETRY, keep.HYPERFRAMES_PYTHON], ["0", "/p"]);
}

{
  const kokoroOk = new Set();
  const exec = (cmd, args) => (args[0] === "-c" ? { status: kokoroOk.has(cmd) ? 0 : 1, stdout: "", stderr: "" } : { status: 0, stdout: "", stderr: "" });
  const home = "/home/u/.cache/explain-me";
  const venv = venvPython(home, "linux");
  const base = { env: { PATH: "/bin" }, files: { "/bin/python3": "", "/envpy/bin/python": "", [venv]: "" }, exec };

  // env > python3 > venv
  kokoroOk.clear();
  kokoroOk.add("/envpy/bin/python").add("/bin/python3").add(venv);
  let r = resolvePython(fakeDeps({ ...base, env: { PATH: "/bin", HYPERFRAMES_PYTHON: "/envpy/bin/python" } }).deps, { home });
  assertEq("python: HYPERFRAMES_PYTHON wins when it has kokoro", [r.ok, r.tier, r.path], [true, "env", "/envpy/bin/python"]);
  kokoroOk.delete("/envpy/bin/python");
  r = resolvePython(fakeDeps({ ...base, env: { PATH: "/bin", HYPERFRAMES_PYTHON: "/envpy/bin/python" } }).deps, { home });
  assertEq("python: env without kokoro falls through to python3", [r.tier, r.path], ["python3", "/bin/python3"]);
  kokoroOk.delete("/bin/python3");
  r = resolvePython(fakeDeps(base).deps, { home });
  assertEq("python: python3 without kokoro falls through to the venv", [r.tier, r.path], ["venv", venv]);
  kokoroOk.delete(venv);
  r = resolvePython(fakeDeps(base).deps, { home });
  assert("python: none has kokoro -> not ok, candidates listed", r.ok === false && r.candidates.length === 2 && r.candidates.every((c) => c.kokoro === false));
  r = resolvePython(fakeDeps({ env: { PATH: "/bin" }, exec }).deps, { home });
  assert("python: a venv that was never created is listed as absent and not probed", r.ok === false && r.candidates.length === 1 && r.candidates[0].present === false);
  assertEq("home: venv python path per platform", [venvPython("/h", "linux"), venvPython("C:\\h", "win32").endsWith("python.exe")], ["/h/venv/bin/python", true]);
}
{
  // espeak: user variable respected > bundled > system library
  const py = "/py";
  let call = 0;
  const mk = (works, env = {}) => fakeDeps({ env: { PATH: "", ...env }, platform: "darwin", files: { "/opt/homebrew/lib/libespeak-ng.dylib": "" }, exec: (cmd, args, opts) => (call++, { status: works(opts.env) ? 0 : 1, stdout: "", stderr: "Error processing file phontab" }) });
  let r = resolveEspeak(mk(() => true).deps, py);
  assertEq("espeak: bundled library used when it works", [r.ok, r.via, r.env], [true, "bundled", {}]);
  r = resolveEspeak(mk((env) => Boolean(env.PHONEMIZER_ESPEAK_LIBRARY)).deps, py);
  assertEq("espeak: falls back to the system library and exports it", [r.ok, r.via, r.env], [true, "system", { PHONEMIZER_ESPEAK_LIBRARY: "/opt/homebrew/lib/libespeak-ng.dylib" }]);
  r = resolveEspeak(mk(() => false).deps, py);
  assert("espeak: nothing works -> not ok with the error", r.ok === false && /phontab/.test(r.error));
  r = resolveEspeak(mk(() => true, { PHONEMIZER_ESPEAK_LIBRARY: "/mine/lib.so" }).deps, py);
  assertEq("espeak: a library the user set is respected, not replaced", [r.ok, r.via, r.env], [true, "user", {}]);
}
assertEq("findOnPath: finds the first match on PATH", findOnPath("tool", fakeDeps({ env: { PATH: "/a:/b" }, files: { "/b/tool": "" } }).deps), "/b/tool");

assertEq("summarizeCheck: counts errors and warnings across sections, keeps motion_frozen", (() => {
  const s = summarizeCheck({
    ok: false,
    lint: { errorCount: 0, warningCount: 0, findings: [] },
    layout: { errorCount: 0, warningCount: 1, findings: [{ code: "rotation_pivot_drift", severity: "warning", selector: "#box", message: "m" }] },
    motion: { errorCount: 1, warningCount: 0, findings: [{ code: "motion_frozen", severity: "error", message: "frozen" }] },
    _meta: { version: "0.8.105" },
  });
  return [s.ok, s.errors, s.warnings, s.frozen, s.findings.map((f) => f.code), s.version];
})(), [false, 1, 1, 1, ["rotation_pivot_drift", "motion_frozen"], "0.8.105"]);
assert("summarizeCheck: ok only when the envelope is ok and there are no errors", summarizeCheck({ ok: true, lint: { findings: [] } }).ok === true && summarizeCheck({ ok: true, lint: { errorCount: 1, findings: [] } }).ok === false);
assertEq("json: last JSON line wins, noise ignored", lastJsonObject('progress\n{"a":1}\nnotice\n{"ok":true,"durationSeconds":2.5}\n'), { ok: true, durationSeconds: 2.5 });
assertEq("json: first balanced object in pretty output with trailing text", firstJsonObject('x\n{\n "a": {"b": "}"}\n}\ntrailing {nope'), { a: { b: "}" } });

// ---------------------------------------------------------------------------
// 5. Home, runs, createRun, voice (fake synthesis), gate hash, metrics
// ---------------------------------------------------------------------------

assertEq("home: EXPLAIN_ME_HOME wins", skillHome({ env: { EXPLAIN_ME_HOME: "/x/y", XDG_CACHE_HOME: "/c" }, platform: "linux", homedir: "/h" }), { dir: path.resolve("/x/y"), source: "EXPLAIN_ME_HOME" });
assertEq("home: XDG_CACHE_HOME next", skillHome({ env: { XDG_CACHE_HOME: "/c" }, platform: "linux", homedir: "/h" }), { dir: path.join("/c", "explain-me"), source: "XDG_CACHE_HOME" });
assertEq("home: default is ~/.cache/explain-me", skillHome({ env: {}, platform: "linux", homedir: "/h" }), { dir: path.join("/h", ".cache", "explain-me"), source: "default" });
assertEq("home: Windows uses %LOCALAPPDATA%\\explain-me", skillHome({ env: { LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local" }, platform: "win32", homedir: "C:\\Users\\u" }), { dir: "C:\\Users\\u\\AppData\\Local\\explain-me", source: "LOCALAPPDATA" });
assertEq("home: Windows without LOCALAPPDATA falls back under the profile", skillHome({ env: {}, platform: "win32", homedir: "C:\\Users\\u" }).dir, "C:\\Users\\u\\AppData\\Local\\explain-me");
assertEq("slug: slugify folds accents and punctuation", [slugify("Como uma Tabela Hash acha uma chave?"), slugify("  --Ação!! "), slugify("")], ["como-uma-tabela-hash-acha-uma-chave", "acao", ""]);
assert("slug: SLUG_RE", SLUG_RE.test("hash-table-2") && !SLUG_RE.test("Hash") && !SLUG_RE.test("-x") && !SLUG_RE.test("a b"));
assertEq("runs: stamp is YYYYMMDD-HHMMSS in local time", runStamp(new Date(2026, 9, 5, 7, 3, 9)), "20261005-070309");

const fx = tmp("fixture-assets");
fs.writeFileSync(path.join(fx, "DESIGN.md"), shippedMd);
fs.writeFileSync(path.join(fx, "composition.html"), COMPOSITION);
fs.writeFileSync(path.join(fx, "kit.js"), "// kit");

{
  const home = tmp("home1");
  const when = new Date(2026, 9, 5, 12, 0, 0);
  const created = createRun({ home, slug: "tabela-hash", lang: "pt-BR", title: "T", designPath: path.join(dd, "brand", "DESIGN.md"), dest: path.join(home, "out"), assetsDir: fx, hyperframes: { tier: "npx-cache", version: "0.8.105" }, now: when });
  const { runDir, projectDir } = created;
  assertEq("run: folder is <home>/runs/<stamp>-<slug>", path.relative(home, runDir), path.join("runs", "20261005-120000-tabela-hash"));
  for (const f of ["run.json", "script.json", "project/index.html", "project/kit.js", "project/frame.md", "project/tokens.css", "project/assets/logo.svg"]) assert(`run: wrote ${f}`, fs.existsSync(path.join(runDir, f)));
  const tokensCss = fs.readFileSync(path.join(projectDir, "tokens.css"), "utf8");
  assert("run: index.html is the asset with the tokens inlined, kit.js is a copy", fs.readFileSync(path.join(projectDir, "index.html"), "utf8") === rewriteHtmlLang(rewriteTokensRegion(COMPOSITION, tokensCss), "pt-BR") && fs.readFileSync(path.join(projectDir, "kit.js"), "utf8") === "// kit");
  assert("run: new inlines the resolved tokens (brand color, no stale text)", fs.readFileSync(path.join(projectDir, "index.html"), "utf8").includes(`<style>\n${tokensCss}    </style>`) && tokensCss.includes("--em-blue: #0A84FF;") && !fs.readFileSync(path.join(projectDir, "index.html"), "utf8").includes("#stale"));
  const run = readRun(runDir);
  assertEq("run.json: slug, lang, voice, dest, hyperframes", [run.slug, run.lang, run.voice, run.dest, run.hyperframes], ["tabela-hash", "pt-BR", "pf_dora", path.join(home, "out"), { tier: "npx-cache", version: "0.8.105" }]);
  assertEq("run.json: design sources and overrides", [run.design.sources.length, run.design.overrides.map((o) => o.key)], [2, ["rules.hud", "motion.maxStaticSec"]]);
  const frame = splitFrontmatter(fs.readFileSync(path.join(projectDir, "frame.md"), "utf8"), "frame.md");
  assert("frame.md: resolved spec parses back, with merged prose and project-relative logo", frame.data.colors.blue === "#0A84FF" && frame.data.motion.maxStaticSec === 3 && frame.data.images[0].path === "assets/logo.svg" && frame.body.includes("Brand words.") && frame.body.includes("## Motion examples"));
  assert("frame.md: reference images keep an absolute path", path.isAbsolute(frame.data.images[1].path));
  assert("tokens.css: from the resolved design", fs.readFileSync(path.join(projectDir, "tokens.css"), "utf8").includes("--em-blue: #0A84FF;"));
  const script = JSON.parse(fs.readFileSync(path.join(runDir, "script.json"), "utf8"));
  assertEq("script.json: starter has lang, title and one beat", [script.lang, script.title, script.beats.length, script.beats[0].id], ["pt-BR", "T", 1, "b01"]);

  const second = createRun({ home, slug: "tabela-hash", lang: "en", assetsDir: fx, now: when });
  assert("run: a clash in the same second gets a suffix, never reuses a folder", second.runDir !== runDir && second.runDir.endsWith("-tabela-hash-2"));
  assertEq("run: resolveRun by path, by slug (latest wins) and by name", [resolveRun(home, runDir), resolveRun(home, "tabela-hash"), resolveRun(home, path.basename(runDir))], [runDir, second.runDir, runDir]);
  const miss = throwsWith(() => resolveRun(home, "no-such-slug"), /no run found/);
  assert("run: unknown slug is a clear error", miss.threw && miss.match, miss.message);
  const htmlRun = createRun({ home, slug: "slider", lang: "pt-BR", assetsDir: fx, format: "html", now: when });
  assert("run: an html run has run.json and tokens.css but no HyperFrames project", htmlRun.projectDir === null && fs.existsSync(path.join(htmlRun.runDir, "tokens.css")) && !fs.existsSync(path.join(htmlRun.runDir, "project")) && readRun(htmlRun.runDir).format === "html");
  const textRun = createRun({ home, slug: "termos", lang: "en", assetsDir: fx, format: "text", now: when });
  assert("run: a text run has only run.json", !fs.existsSync(path.join(textRun.runDir, "tokens.css")) && readRun(textRun.runDir).format === "text");
  const badFormat = throwsWith(() => createRun({ home, slug: "x", lang: "en", assetsDir: fx, format: "gif" }), /invalid --format/);
  assert("run: an unknown format is rejected", badFormat.threw && badFormat.match, badFormat.message);
  const badSlug = throwsWith(() => createRun({ home, slug: "Bad Slug", lang: "en", assetsDir: fx }), /invalid slug/);
  assert("run: invalid slug is rejected", badSlug.threw && badSlug.match, badSlug.message);
  const badDesign = (() => {
    const f = path.join(dd, "brand", "gate-off.md");
    fs.writeFileSync(f, "---\nmotion:\n  gate: off\n---\n");
    try {
      createRun({ home, slug: "x", lang: "en", designPath: f, assetsDir: fx });
    } catch (e) {
      return e;
    }

// `new` writes the starter explanation.md for every format
{
  const pt = starterExplanation("pt-BR");
  const en = starterExplanation("en");
  const home = tmp("home-explanation");
  const video = createRun({ home, slug: "expl-video", lang: "pt-BR", assetsDir: fx });
  assert("explanation: a video run has explanation.md in the run folder, next to script.json", video.explanation === path.join(video.runDir, "explanation.md") && fs.readFileSync(video.explanation, "utf8") === pt && fs.existsSync(path.join(video.runDir, "script.json")));
  for (const format of ["svg", "html", "text", "mermaid", "image"]) {
    const made = createRun({ home, slug: `expl-${format}`, lang: "en", assetsDir: fx, format });
    assert(`explanation: a ${format} run has it too, in English for en`, made.explanation === path.join(made.runDir, "explanation.md") && fs.readFileSync(made.explanation, "utf8") === en);
  }
  const spanish = createRun({ home, slug: "expl-es", lang: "es", assetsDir: fx, format: "text" });
  assert("explanation: a Spanish run gets the English sections", fs.readFileSync(spanish.explanation, "utf8") === en);
}
    return null;
  })();
  assert("run: new refuses a design whose gate is off", badDesign?.name === "DesignInvalid" && badDesign.problems.some((p) => p.path === "motion.gate"));
  assert("run: nothing is created for an invalid design", fs.readdirSync(path.join(home, "runs")).length === 4);

  // --- voice with a fake synthesizer
  const synthCalls = [];
  const synth = (beat, out, opts) => {
    synthCalls.push({ id: beat.id, voice: opts.voice, lang: opts.lang, speed: opts.speed });
    const dur = 2 + beat.narration.length / 100;
    fs.writeFileSync(out, globalThis.__makeWav(dur));
    return { ok: true, durationSeconds: dur };
  };
  const lint = (text) => (text.includes("BAD") ? { errors: [{ rule: "r", message: "no", line: 1, sample: "BAD" }], warnings: [] } : { errors: [], warnings: text.includes("WARN") ? [{ rule: "w", message: "hmm", line: 1, sample: "WARN" }] : [] });
  const writeScript = (beats, lang = "pt-BR") => fs.writeFileSync(path.join(runDir, "script.json"), JSON.stringify({ lang, title: "Tabela", beats }));

  writeScript([{ id: "b01", narration: "Uma tabela BAD guarda pares.", subject: "#dot" }, { id: "b02", narration: "Outra frase.", subject: "#dot" }]);
  const htmlBefore = fs.readFileSync(path.join(projectDir, "index.html"), "utf8");
  let r = await runVoice({ runDir, synth, lint });
  assert("voice: lint errors stop the command before any audio exists", r.ok === false && r.stage === "lint" && r.lintFailures.length === 1 && r.lintFailures[0].beat === "b01" && synthCalls.length === 0 && !fs.existsSync(path.join(projectDir, "audio")) && fs.readFileSync(path.join(projectDir, "index.html"), "utf8") === htmlBefore);

  writeScript([{ id: "b01", narration: "Uma tabela guarda pares WARN.", subject: "#dot" }, { id: "b02", narration: "Outra frase.", subject: "#dot" }]);
  r = await runVoice({ runDir, synth, lint });
  assert("voice: succeeds, one synth call per beat with the design voice, language and speed", r.ok && synthCalls.length === 2 && synthCalls.every((c) => c.voice === "pf_dora" && c.lang === "pt-br" && c.speed === 1), JSON.stringify(synthCalls));
  assert("voice: lint warnings are returned, not blocking", r.warnings.some((w) => w.rule === "w" && w.beat === "b01"));
  const total = r.total;
  assertEq("voice: timeline = lead-in + beats + gaps + tail (from the design)", [r.beats[0].start, +(r.beats[1].start - r.beats[0].end).toFixed(3), +(total - r.beats[1].end).toFixed(3)], [0.5, 0.3, 1]);
  assert("voice: one wav per beat", fs.existsSync(path.join(projectDir, "audio", "b01.wav")) && fs.existsSync(path.join(projectDir, "audio", "b02.wav")));
  const html = fs.readFileSync(path.join(projectDir, "index.html"), "utf8");
  assert("voice: audio tags written between the markers and the root duration rewritten", html.includes('id="vo-b01"') && html.includes('id="vo-b02"') && html.includes(`data-duration="${total}"`) && html.includes('<circle id="dot"/>'));
  const data = fs.readFileSync(path.join(projectDir, "explain-data.js"), "utf8");
  assert("voice: explain-data.js has the beats and the resolved design", data.includes('"silent": false') && data.includes('"id":"b02"') && data.includes('"maxStaticSec": 3'));
  const motion = JSON.parse(fs.readFileSync(path.join(projectDir, "index.motion.json"), "utf8"));
  assertEq("voice: motion sidecar uses the design's maxStaticSec and one appearsBy per beat", [motion.assertions[0], motion.assertions.length, motion.assertions[1].bySec], [{ kind: "keepsMoving", maxStaticSec: 3 }, 3, +(r.beats[0].start + 0.5).toFixed(3)]);
  assert("voice: the sidecar judges motion up to the end of the last beat, before the closing tail", motion.duration === r.beats[1].end && motion.duration < total && r.motionUntil === r.beats[1].end, JSON.stringify([motion.duration, r.beats[1].end, total]));
  const srt = fs.readFileSync(path.join(runDir, "tabela-hash.srt"), "utf8");
  assert("voice: srt has one cue per beat from the same timeline", srt.startsWith("1\n00:00:00,500 -->") && (srt.match(/-->/g) ?? []).length === 2);
  assertEq("voice: run.json records the timeline", [readRun(runDir).timeline, readRun(runDir).silent], [{ total, beats: 2 }, false]);

  // cache: same text -> no synth; changed text -> only that beat
  synthCalls.length = 0;
  r = await runVoice({ runDir, synth, lint });
  assert("voice: unchanged beats reuse their audio", r.ok && synthCalls.length === 0 && r.reused === 2);
  writeScript([{ id: "b01", narration: "Uma tabela guarda pares WARN.", subject: "#dot" }, { id: "b02", narration: "Outra frase nova.", subject: "#dot" }]);
  r = await runVoice({ runDir, synth, lint });
  assert("voice: a changed beat is the only one synthesized again", r.ok && synthCalls.length === 1 && synthCalls[0].id === "b02" && r.reused === 1);

  // gate hash changes with the files it protects
  const h1 = projectHash(projectDir);
  assert("hash: stable for unchanged files", h1 === projectHash(projectDir) && /^[0-9a-f]{64}$/.test(h1));
  fs.appendFileSync(path.join(projectDir, "index.html"), "<!-- x -->");
  const h2 = projectHash(projectDir);
  fs.appendFileSync(path.join(projectDir, "explain-data.js"), "// x");
  const h3 = projectHash(projectDir);
  fs.writeFileSync(path.join(projectDir, "index.motion.json"), '{"assertions":[]}');
  const h4 = projectHash(projectDir);
  fs.appendFileSync(path.join(projectDir, "tokens.css"), "/* x */");
  const h5 = projectHash(projectDir);
  fs.appendFileSync(path.join(projectDir, "kit.js"), "// x");
  const h6 = projectHash(projectDir);
  assert("hash: index.html, explain-data.js, the motion sidecar, tokens.css and kit.js each change it", new Set([h1, h2, h3, h4, h5, h6]).size === 6);

  // synthesis failure
  fs.rmSync(path.join(projectDir, "audio"), { recursive: true });
  writeScript([{ id: "b01", narration: "Falha aqui.", subject: "#dot" }]);
  r = await runVoice({ runDir, synth: () => ({ ok: false, error: "kokoro exploded" }), lint });
  assert("voice: a synthesis failure names the beat and the error, writes nothing", r.ok === false && r.stage === "tts" && r.beat === "b01" && /exploded/.test(r.error));

  // script problems
  writeScript([{ id: "b02", narration: "a" }, { id: "b01", narration: "b" }]);
  r = await runVoice({ runDir, synth, lint });
  assert("voice: script errors stop before lint", r.ok === false && r.stage === "script" && /out of order/.test(r.errors.join()));

  // silent: language without a Kokoro voice
  synthCalls.length = 0;
  fs.mkdirSync(path.join(projectDir, "audio"), { recursive: true });
  fs.writeFileSync(path.join(projectDir, "audio", "b01.wav"), "stale");
  writeScript([{ id: "b01", narration: "Eine Hashtabelle speichert Paare aus Schlüssel und Wert.", subject: "#dot" }, { id: "b02", narration: "Fertig.", subject: "#dot" }], "de");
  r = await runVoice({ runDir, synth, lint });
  assert("voice: unsupported language is silent, estimated at 150 wpm, no synth, no audio tags", r.ok && r.silent === true && synthCalls.length === 0 && /no Kokoro voice for de/.test(r.silentReason) && r.beats[0].dur === 3.2 && r.beats[1].dur === 1 && !fs.readFileSync(path.join(projectDir, "index.html"), "utf8").includes("<audio"));
  assertEq("voice: silent run.json", [readRun(runDir).silent, readRun(runDir).voice, readRun(runDir).lang], [true, null, "de"]);
  assert("voice: silent data and srt still written", fs.readFileSync(path.join(projectDir, "explain-data.js"), "utf8").includes('"silent": true') && fs.readFileSync(path.join(runDir, "tabela-hash.srt"), "utf8").includes("Hashtabelle"));
  assert("voice: stale wav files are removed on a silent run", !fs.existsSync(path.join(projectDir, "audio", "b01.wav")));

  // --silent on a supported language
  writeScript([{ id: "b01", narration: "Uma frase curta aqui.", subject: "#dot" }]);
  r = await runVoice({ runDir, synth, lint, forceSilent: true });
  assert("voice: forceSilent skips synthesis even for a supported language", r.ok && r.silent && synthCalls.length === 0 && r.silentReason === "requested");

  // metrics
  const metricsDir = tmp("metrics-tmp");
  const file = appendMetrics({ skill: "explain-me", run: "r1", beats: 2 }, { tmpdir: metricsDir });
  appendMetrics({ skill: "explain-me", run: "r2", beats: 3 }, { tmpdir: metricsDir });
  const lines = fs.readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert("metrics: appends one JSON line per call under <tmpdir>/explain-me/metrics.jsonl", file === path.join(metricsDir, "explain-me", "metrics.jsonl") && lines.length === 2 && lines[0].run === "r1" && lines[1].run === "r2");
}

// ---------------------------------------------------------------------------
// 5b. Restyle: refreshDesign re-resolves the recorded layers
// ---------------------------------------------------------------------------

{
  const home = tmp("home-restyle");
  const spec = path.join(dd, "brand", "restyle.md");
  const writeSpec = (blue, extra = "") => fs.writeFileSync(spec, `---\ncolors:\n  blue: "${blue}"\nmotion:\n  maxStaticSec: 3\n${extra}---\n\n## Words on screen\n\nv-${blue}\n`);
  writeSpec("#111111");
  const created = createRun({ home, slug: "restyle", lang: "pt-BR", designPath: spec, assetsDir: fx });
  const { runDir, projectDir } = created;
  assertEq("restyle: run.json records the explicit spec", readRun(runDir).design.explicit, spec);
  assertEq("restyle: unchanged spec -> nothing rewritten", [refreshDesign({ runDir, home, assetsDir: fx }).changed], [false]);

  const hashBeforeRestyle = projectHash(projectDir);
  assert("restyle: the inline tokens start at the first spec's color", fs.readFileSync(path.join(projectDir, "index.html"), "utf8").includes("--em-blue: #111111;"));
  writeSpec("#222222", "rules:\n  hud: true\n");
  let r = refreshDesign({ runDir, home, assetsDir: fx });
  const frame = fs.readFileSync(path.join(projectDir, "frame.md"), "utf8");
  assert("restyle: frame.md and tokens.css follow the edited spec", r.changed && frame.includes("#222222") && frame.includes("v-#222222") && fs.readFileSync(path.join(projectDir, "tokens.css"), "utf8").includes("--em-blue: #222222;"));
  const restyledHtml = fs.readFileSync(path.join(projectDir, "index.html"), "utf8");
  assert("restyle: the inline tokens region of index.html follows the spec and equals tokens.css", restyledHtml.includes("--em-blue: #222222;") && !restyledHtml.includes("--em-blue: #111111;") && restyledHtml.includes(`<style>\n${fs.readFileSync(path.join(projectDir, "tokens.css"), "utf8")}    </style>`));
  assert("restyle: the gate hash moves with the inline tokens", projectHash(projectDir) !== hashBeforeRestyle);
  assertEq("restyle: overrides are recomputed and recorded in run.json", [r.overrides.map((o) => o.key), r.overridesChanged, readRun(runDir).design.overrides.map((o) => o.key)], [["rules.hud", "motion.maxStaticSec"], true, ["rules.hud", "motion.maxStaticSec"]]);

  fs.writeFileSync(path.join(home, "DESIGN.md"), '---\ncolors:\n  teal: "#333333"\n---\n');
  r = refreshDesign({ runDir, home, assetsDir: fx });
  assertEq("restyle: a personal DESIGN.md added later joins the layers", [r.layers.map((l) => l.kind), fs.readFileSync(path.join(projectDir, "tokens.css"), "utf8").includes("--em-teal: #333333;")], [["explicit", "personal", "shipped"], true]);

  // the rest of the pipeline reads the refreshed design
  const synth = (beat, out) => (fs.writeFileSync(out, globalThis.__makeWav(2)), { ok: true, durationSeconds: 2 });
  fs.writeFileSync(path.join(runDir, "script.json"), JSON.stringify({ lang: "pt-BR", title: "T", beats: [{ id: "b01", narration: "Uma frase.", subject: "#dot" }] }));
  const v = await runVoice({ runDir, synth, lint: () => ({ errors: [], warnings: [] }) });
  assert("restyle: voice builds explain-data and the sidecar from the refreshed design", v.ok && fs.readFileSync(path.join(projectDir, "explain-data.js"), "utf8").includes('"blue": "#222222"') && JSON.parse(fs.readFileSync(path.join(projectDir, "index.motion.json"), "utf8")).assertions[0].maxStaticSec === 3);

  // voice keeps index.html in sync with tokens.css even when the region went stale
  const staleHtml = fs.readFileSync(path.join(projectDir, "index.html"), "utf8").replace(/--em-blue: #\w+;/, "--em-blue: #stale0;");
  fs.writeFileSync(path.join(projectDir, "index.html"), staleHtml);
  await runVoice({ runDir, synth, lint: () => ({ errors: [], warnings: [] }) });
  assert("restyle: voice re-inlines tokens.css over a stale region", fs.readFileSync(path.join(projectDir, "index.html"), "utf8").includes("--em-blue: #222222;") && !fs.readFileSync(path.join(projectDir, "index.html"), "utf8").includes("#stale0"));

  // a composition without the tokens markers still works, with a warning that names the consequence
  const fxNoTokens = tmp("fixture-assets-no-tokens");
  for (const f of ["DESIGN.md", "kit.js"]) fs.copyFileSync(path.join(fx, f), path.join(fxNoTokens, f));
  fs.writeFileSync(path.join(fxNoTokens, "composition.html"), COMPOSITION.replace(/<!-- explain:tokens:start -->[\s\S]*<!-- explain:tokens:end -->/, ""));
  const plain = createRun({ home: tmp("home-no-tokens"), slug: "plain", lang: "en", assetsDir: fxNoTokens });
  assert("tokens: new warns when index.html has no tokens markers", plain.warnings.some((w) => w.path === "explain:tokens" && /fonts/.test(w.message)));
  fs.writeFileSync(path.join(plain.runDir, "script.json"), JSON.stringify({ lang: "en", title: "T", beats: [{ id: "b01", narration: "One short line.", subject: "#dot" }] }));
  const plainVoice = await runVoice({ runDir: plain.runDir, synth, lint: () => ({ errors: [], warnings: [] }), forceSilent: true });
  assert("tokens: voice warns about the missing region and still succeeds", plainVoice.ok && plainVoice.warnings.some((w) => w.rule === "tokens-region-missing"));

  // a restyle must be re-checked: the gate hash moves
  const before = projectHash(projectDir);
  writeSpec("#444444", "rules:\n  hud: true\n");
  refreshDesign({ runDir, home, assetsDir: fx });
  await runVoice({ runDir, synth, lint: () => ({ errors: [], warnings: [] }) });
  assert("restyle: a changed spec changes the gate hash", projectHash(projectDir) !== before);

  // invalid spec blocks and leaves the project as it was
  const good = fs.readFileSync(path.join(projectDir, "frame.md"), "utf8");
  fs.writeFileSync(spec, "---\nmotion:\n  gate: off\n---\n");
  const bad = throwsWith(() => refreshDesign({ runDir, home, assetsDir: fx }));
  assert("restyle: an invalid spec is refused and frame.md is untouched", bad.threw && bad.error.name === "DesignInvalid" && fs.readFileSync(path.join(projectDir, "frame.md"), "utf8") === good);
  fs.rmSync(spec);
  const gone = throwsWith(() => refreshDesign({ runDir, home, assetsDir: fx }), /not found/);
  assert("restyle: a missing explicit spec is a clear error", gone.threw && gone.match && gone.error.name === "SpecError", gone.message);

  // runs created before design.explicit existed: inferred from the sources
  writeSpec("#555555");
  const run = readRun(runDir);
  delete run.design.explicit;
  fs.writeFileSync(path.join(runDir, "run.json"), JSON.stringify(run));
  r = refreshDesign({ runDir, home, assetsDir: fx });
  assertEq("restyle: explicit spec is inferred for an older run.json", [r.layers.map((l) => l.kind), readRun(runDir).design.explicit], [["explicit", "personal", "shipped"], spec]);
}

// ---------------------------------------------------------------------------
// 5c. Orientation in a run, the script guard, <html lang>
// ---------------------------------------------------------------------------

{
  const home = tmp("home-orientation");
  const synth = (beat, out) => (fs.writeFileSync(out, globalThis.__makeWav(2)), { ok: true, durationSeconds: 2 });
  const lint = () => ({ errors: [], warnings: [] });
  const writeScript = (runDir, beats, lang = "pt-BR") => fs.writeFileSync(path.join(runDir, "script.json"), JSON.stringify({ lang, title: "T", beats }));
  const evalData = (project) => {
    const w = {};
    new Function("window", fs.readFileSync(path.join(project, "explain-data.js"), "utf8"))(w);
    return w.EXPLAIN;
  };
  const motionOf = (project) => JSON.parse(fs.readFileSync(path.join(project, "index.motion.json"), "utf8"));
  const beat = [{ id: "b01", narration: "Uma frase curta aqui.", subject: "#dot" }];

  // new --orientation portrait
  const portrait = createRun({ home, slug: "vertical", lang: "pt-BR", assetsDir: fx, orientation: "portrait" });
  const html = fs.readFileSync(path.join(portrait.projectDir, "index.html"), "utf8");
  assertEq("run: orientation is stored in run.json", [readRun(portrait.runDir).orientation, portrait.run.orientation], ["portrait", "portrait"]);
  assert("run: a portrait project is 1080x1920 at the root and in the placeholder stage", /data-width="1080"/.test(html) && /data-height="1920"/.test(html) && html.includes('<svg id="stage" viewBox="0 0 1080 1920">') && !html.includes("1920 1080"));
  assert("run: new sets <html lang> to the run's language", html.includes('<html lang="pt-BR">'));
  assert("run: the tokens region is still inlined next to the new size", html.includes("--em-blue:") && !html.includes("#stale"));
  const landscape = createRun({ home, slug: "horizontal", lang: "en", assetsDir: fx });
  const landHtml = fs.readFileSync(path.join(landscape.projectDir, "index.html"), "utf8");
  assertEq("run: landscape is the default and keeps 1920x1080", [readRun(landscape.runDir).orientation, /data-width="1920"/.test(landHtml), /data-height="1080"/.test(landHtml), landHtml.includes('viewBox="0 0 1920 1080"'), landHtml.includes('<html lang="en">')], ["landscape", true, true, true, true]);
  assertEq("run: an alias is understood", readRun(createRun({ home, slug: "tt", lang: "en", assetsDir: fx, orientation: "TikTok" }).runDir).orientation, "portrait");
  const badOrientation = throwsWith(() => createRun({ home, slug: "x", lang: "en", assetsDir: fx, orientation: "square" }), /invalid --orientation/);
  assert("run: an unknown orientation is rejected before anything is created", badOrientation.threw && badOrientation.match && !fs.readdirSync(path.join(home, "runs")).some((n) => n.endsWith("-x")), badOrientation.message);
  assert("run: a static format records no orientation", readRun(createRun({ home, slug: "page", lang: "en", assetsDir: fx, format: "html" }).runDir).orientation === undefined);

  // voice: explain-data, motion sidecar, html lang, stage untouched
  writeScript(portrait.runDir, beat);
  fs.writeFileSync(path.join(portrait.projectDir, "index.html"), html.replace('<circle id="dot"/>', '<circle id="dot" cx="540" cy="900" r="100"/>'));
  let r = await runVoice({ runDir: portrait.runDir, synth, lint });
  let data = evalData(portrait.projectDir);
  assert("voice: portrait explain-data has orientation, size, this orientation's boxes and the burn switch", r.ok && data.orientation === "portrait" && data.width === 1080 && data.height === 1920 && same(data.layout, { safe: [60, 220, 960, 1380], captions: [60, 1400, 960, 1580] }) && same(data.captions, { burn: true, maxWords: 6 }), JSON.stringify([data.orientation, data.width, data.layout, data.captions]));
  assertEq("voice: burned captions limit keepsMoving to #stage", motionOf(portrait.projectDir).assertions[0], { kind: "keepsMoving", maxStaticSec: 2, withinSelector: "#stage" });
  assertEq("voice: the result reports the orientation and captions", [r.orientation, r.captions], ["portrait", { burn: true, maxWords: 6 }]);
  const after = fs.readFileSync(path.join(portrait.projectDir, "index.html"), "utf8");
  assert("voice: the STAGE region and the root size are not touched", after.includes('<circle id="dot" cx="540" cy="900" r="100"/>') && after.includes('viewBox="0 0 1080 1920"') && /data-width="1080"/.test(after) && /data-height="1920"/.test(after));
  assert("voice: <html lang> follows the language of the script", after.includes('<html lang="pt-BR">'));

  // landscape does not burn by default: the whole composition has to keep moving
  writeScript(landscape.runDir, beat, "en");
  r = await runVoice({ runDir: landscape.runDir, synth, lint });
  data = evalData(landscape.projectDir);
  assert("voice: landscape explain-data is 1920x1080 with the landscape boxes and no burn", data.orientation === "landscape" && data.width === 1920 && data.height === 1080 && same(data.layout.safe, [120, 120, 1800, 960]) && data.captions.burn === false);
  assertEq("voice: without burned captions keepsMoving has no withinSelector", motionOf(landscape.projectDir).assertions[0], { kind: "keepsMoving", maxStaticSec: 2 });

  // a brand decides: portrait without burned captions, landscape with them
  const brand = path.join(dd, "brand", "burn-swap.md");
  fs.writeFileSync(brand, "---\ncaptions:\n  burn:\n    landscape: true\n    portrait: false\n  maxWords: 4\nlayout:\n  portrait:\n    safe: [80, 300, 1000, 1300]\n---\n");
  const swappedP = createRun({ home, slug: "swap-p", lang: "pt-BR", assetsDir: fx, orientation: "portrait", designPath: brand });
  const swappedL = createRun({ home, slug: "swap-l", lang: "pt-BR", assetsDir: fx, designPath: brand });
  assertEq("run: both burn switches are recorded as overrides", swappedP.run.design.overrides.map((o) => o.key), ["captions.burn.landscape", "captions.burn.portrait"]);
  writeScript(swappedP.runDir, beat);
  writeScript(swappedL.runDir, beat);
  await runVoice({ runDir: swappedP.runDir, synth, lint });
  await runVoice({ runDir: swappedL.runDir, synth, lint });
  data = evalData(swappedP.projectDir);
  assert("voice: a brand's portrait box, burn switch and chunk size reach explain-data", same(data.layout.safe, [80, 300, 1000, 1300]) && data.captions.burn === false && data.captions.maxWords === 4 && !("withinSelector" in motionOf(swappedP.projectDir).assertions[0]));
  assertEq("voice: a brand that burns landscape captions gets withinSelector", motionOf(swappedL.projectDir).assertions[0].withinSelector, "#stage");

  // a run made before orientation existed is landscape and keeps working
  const legacy = createRun({ home, slug: "legacy", lang: "pt-BR", assetsDir: fx });
  const legacyRun = readRun(legacy.runDir);
  delete legacyRun.orientation;
  fs.writeFileSync(path.join(legacy.runDir, "run.json"), JSON.stringify(legacyRun));
  writeScript(legacy.runDir, beat);
  const legacyBefore = fs.readFileSync(path.join(legacy.projectDir, "index.html"), "utf8").replace(/<audio[^>]*><\/audio>\s*/g, "");
  r = await runVoice({ runDir: legacy.runDir, synth, lint });
  data = evalData(legacy.projectDir);
  assert("run: a run.json without orientation voices as landscape 1920x1080", r.ok && r.orientation === "landscape" && data.orientation === "landscape" && data.width === 1920 && data.height === 1080 && data.captions.burn === false);
  assert("run: voice does not rewrite the size of an older project", /data-width="1920"/.test(fs.readFileSync(path.join(legacy.projectDir, "index.html"), "utf8")) && runOrientation(readRun(legacy.runDir)) === "landscape" && legacyBefore.includes('viewBox="0 0 1920 1080"'));

  // the script guard
  const run0 = readRun(landscape.runDir);
  assert("guard: voice records the sha256 of script.json", run0.scriptHash === sha256(fs.readFileSync(path.join(landscape.runDir, "script.json"), "utf8")) && /^[0-9a-f]{64}$/.test(run0.scriptHash));
  assertEq("guard: an unchanged script is not stale", scriptStaleness(landscape.runDir), { stale: false, missing: false, recorded: true });
  writeScript(landscape.runDir, [{ id: "b01", narration: "Uma frase curta aqui.", subject: "#other" }], "en");
  assertEq("guard: editing a subject makes it stale", scriptStaleness(landscape.runDir).stale, true);
  writeScript(landscape.runDir, beat, "en");
  assertEq("guard: restoring the script makes it fresh again", scriptStaleness(landscape.runDir).stale, false);
  fs.appendFileSync(path.join(landscape.runDir, "script.json"), "\n");
  assertEq("guard: a whitespace-only edit is also a change", scriptStaleness(landscape.runDir).stale, true);
  r = await runVoice({ runDir: landscape.runDir, synth, lint });
  assertEq("guard: voice again makes it fresh", [r.ok, scriptStaleness(landscape.runDir).stale], [true, false]);
  fs.rmSync(path.join(landscape.runDir, "script.json"));
  assertEq("guard: a script that is gone is stale and says so", [scriptStaleness(landscape.runDir).stale, scriptStaleness(landscape.runDir).missing], [true, true]);
  assertEq("guard: a run voiced before the guard existed is not refused", scriptStaleness(legacy.runDir, { slug: "x" }), { stale: false, recorded: false });
  // a voice that fails keeps the old hash, so the script it did not build from stays stale
  writeScript(swappedL.runDir, [{ id: "b01", narration: "BAD frase.", subject: "#dot" }]);
  const hashBefore = readRun(swappedL.runDir).scriptHash;
  r = await runVoice({ runDir: swappedL.runDir, synth, lint: (t) => (t.includes("BAD") ? { errors: [{ rule: "r", message: "no" }], warnings: [] } : { errors: [], warnings: [] }) });
  assert("guard: a failed voice leaves the recorded hash alone", r.ok === false && readRun(swappedL.runDir).scriptHash === hashBefore && scriptStaleness(swappedL.runDir).stale === true);

  // <html lang> in a silent run for a language Kokoro lacks
  writeScript(legacy.runDir, [{ id: "b01", narration: "Eine kurze Zeile hier.", subject: "#dot" }], "de");
  await runVoice({ runDir: legacy.runDir, synth, lint });
  assert("voice: <html lang> follows a language without a Kokoro voice too", fs.readFileSync(path.join(legacy.projectDir, "index.html"), "utf8").includes('<html lang="de">'));
}

// ---------------------------------------------------------------------------
// 6. CLI (spawned with an empty PATH: no hyperframes, no network)
// ---------------------------------------------------------------------------

{
  // a private copy of the driver next to fixture assets, to prove it runs from any install path
  const tree = tmp("skill-tree");
  const scripts = path.join(tree, "skills", "explain-me", "scripts");
  const assets = path.join(tree, "skills", "explain-me", "assets");
  fs.mkdirSync(scripts, { recursive: true });
  fs.mkdirSync(assets, { recursive: true });
  fs.copyFileSync(path.join(HERE, "explain.mjs"), path.join(scripts, "explain.mjs"));
  fs.cpSync(path.join(HERE, "lib"), path.join(scripts, "lib"), { recursive: true });
  fs.copyFileSync(path.join(fx, "DESIGN.md"), path.join(assets, "DESIGN.md"));
  fs.copyFileSync(path.join(fx, "composition.html"), path.join(assets, "composition.html"));
  fs.copyFileSync(path.join(fx, "kit.js"), path.join(assets, "kit.js"));
  fs.writeFileSync(path.join(scripts, "ste-lint.mjs"), "export function lintText() { return { errors: [], warnings: [] }; }\n"); // the real linter has its own tests
  const home = tmp("cli-home");
  const fakeHome = tmp("cli-userhome");
  const env = { PATH: "", HOME: fakeHome, USERPROFILE: fakeHome, EXPLAIN_ME_HOME: home, TMPDIR: tmp("cli-tmp") };
  const cli = (...args) => {
    const r = spawnSync(process.execPath, [path.join(scripts, "explain.mjs"), ...args], { env, encoding: "utf8", timeout: 60000 });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  const json = (...args) => {
    const r = cli(...args, "--json");
    try {
      return { ...r, json: JSON.parse(r.out) };
    } catch {
      return { ...r, json: null };
    }
  };

  let r = cli("--help");
  assert("cli: --help lists every command and exits 0", r.code === 0 && ["doctor", "setup", "design", "tokens", "new", "voice", "check", "render"].every((c) => r.out.includes(`  ${c}`)) && /Exit codes/.test(r.out));
  r = cli("render", "--help");
  assert("cli: <command> --help shows its usage and exits 0", r.code === 0 && /Usage: node \S*explain\.mjs render <run>/.test(r.out));
  r = cli("frobnicate");
  assert("cli: unknown command is a usage error (exit 2)", r.code === 2 && /unknown command/.test(r.err));
  r = cli("new", "--slug", "x");
  assert("cli: new without --lang is a usage error (exit 2)", r.code === 2 && /--lang/.test(r.err));
  r = cli("new", "--bogus");
  assert("cli: unknown flag is a usage error (exit 2)", r.code === 2);
  r = cli("check");
  assert("cli: check without <run> is a usage error (exit 2)", r.code === 2 && /<run>/.test(r.err));
  r = json("new", "--slug", "x");
  assert("cli: --json errors are JSON on stdout", r.code === 2 && r.json && r.json.ok === false && typeof r.json.error === "string");

  r = cli("tokens", "--css");
  assert("cli: tokens --css prints :root with --em-bg", r.code === 0 && r.out.startsWith(":root {") && r.out.includes("--em-bg: #000000;"));
  r = json("tokens", "--css", "--design", path.join(dd, "brand", "DESIGN.md"));
  assert("cli: tokens --json carries css and overrides", r.code === 0 && r.json.css.includes("--em-blue: #0A84FF;") && r.json.overrides.some((o) => o.key === "rules.hud"));

  r = json("design", "resolve", "--design", path.join(dd, "brand", "DESIGN.md"));
  assert("cli: design resolve prints layers, overrides, design and prose", r.code === 0 && r.json.layers.length === 2 && r.json.overrides.length === 2 && r.json.design.colors.brandPink === "#FF2D95" && r.json.prose.includes("Brand words."));
  r = cli("design", "find", "--project", tmp("proj-empty"));
  assert("cli: design find reports none when no spec is there", r.code === 0 && /^none/.test(r.out));
  const projWithSpec = tmp("proj-with-spec");
  fs.writeFileSync(path.join(projWithSpec, "DESIGN.md"), "---\nname: p\n---\n");
  r = json("design", "find", "--project", projWithSpec);
  assert("cli: design find returns the spec path", r.code === 0 && path.basename(r.json.found) === "DESIGN.md");
  r = cli("design", "check", path.join(dd, "brand", "bad.md"));
  assert("cli: design check on a bad spec exits 1 and lists errors", r.code === 1 && /motion\.gate/.test(r.out) && /not a kit primitive/.test(r.out));
  r = cli("design", "check", path.join(dd, "brand", "DESIGN.md"));
  assert("cli: design check on a good spec exits 0", r.code === 0 && /^ok/.test(r.out));
  r = cli("design", "check");
  assert("cli: design check with no path checks the shipped default", r.code === 0 && r.out.includes(path.join(assets, "DESIGN.md")));
  r = cli("design", "bogus");
  assert("cli: unknown design subcommand is a usage error", r.code === 2);

  r = json("new", "--slug", "cli-run", "--lang", "pt-BR", "--title", "Titulo");
  assert("cli: new creates the run and prints its path", r.code === 0 && r.json.ok && fs.existsSync(path.join(r.json.run, "project", "frame.md")) && r.json.voice === "pf_dora" && r.json.silent === false);
  const runPath = r.json.run;
  r = cli("new", "--slug", "cli-de", "--lang", "de");
  assert("cli: new for an unsupported language says plainly it will be silent", r.code === 0 && /silent/.test(r.out));
  r = cli("new", "--slug", "cli-bad", "--lang", "en", "--design", path.join(dd, "brand", "bad.md"));
  assert("cli: new with an invalid design exits 1, names the keys, creates nothing", r.code === 1 && /motion\.gate/.test(r.err) && !fs.readdirSync(path.join(home, "runs")).some((n) => n.endsWith("cli-bad")));
  r = json("voice", "cli-run");
  assert("cli: voice on the starter script fails on the empty narration (exit 1)", r.code === 1 && r.json.ok === false && /not valid/.test(r.json.error));
  // restyle through the CLI: edit the spec, run voice (silent, no engine), the design follows
  const cliSpec = path.join(tmp("cli-brand"), "DESIGN.md");
  const writeCliSpec = (blue) => fs.writeFileSync(cliSpec, `---\ncolors:\n  blue: "${blue}"\n---\n`);
  writeCliSpec("#0A0A0A");
  r = json("new", "--slug", "cli-restyle", "--lang", "pt-BR", "--design", cliSpec);
  const restyleRun = r.json.run;
  fs.writeFileSync(path.join(restyleRun, "script.json"), JSON.stringify({ lang: "pt-BR", title: "T", beats: [{ id: "b01", narration: "Uma frase curta aqui.", subject: "#dot" }] }));
  r = json("voice", "cli-restyle", "--silent");
  assert("cli: voice reports an unchanged design on the first call", r.code === 0 && r.json.design.changed === false && /--em-blue: #0A0A0A;/.test(fs.readFileSync(path.join(restyleRun, "project", "tokens.css"), "utf8")));
  writeCliSpec("#0B0B0B");
  r = cli("voice", "cli-restyle", "--silent");
  assert("cli: voice after a spec edit rewrites frame.md and tokens.css and says so", r.code === 0 && /restyled/.test(r.out) && /--em-blue: #0B0B0B;/.test(fs.readFileSync(path.join(restyleRun, "project", "tokens.css"), "utf8")) && fs.readFileSync(path.join(restyleRun, "project", "explain-data.js"), "utf8").includes("#0B0B0B"));
  fs.writeFileSync(cliSpec, "---\nmotion:\n  gate: off\n---\n");
  r = json("voice", "cli-restyle", "--silent");
  assert("cli: voice refuses an invalid spec and names the key", r.code === 1 && r.json.stage === "design" && r.json.problems.some((p) => p.path === "motion.gate"));

  r = cli("render", "cli-run");
  assert("cli: render refuses with the gate closed when no check is on record", r.code === 1 && /Motion Gate closed/.test(r.err));
  r = cli("check", "no-such-run");
  assert("cli: an unknown run is a clear error", r.code === 1 && /no run found/.test(r.err));

  // the gate against run.json state, without ever calling hyperframes
  const goodHash = (() => {
    fs.writeFileSync(path.join(runPath, "project", "explain-data.js"), "window.EXPLAIN={};");
    fs.writeFileSync(path.join(runPath, "project", "index.motion.json"), "{}");
    return projectHash(path.join(runPath, "project"));
  })();
  const setCheck = (check) => {
    const run = JSON.parse(fs.readFileSync(path.join(runPath, "run.json"), "utf8"));
    fs.writeFileSync(path.join(runPath, "run.json"), JSON.stringify({ ...run, check }));
  };
  setCheck({ ok: false, errors: 2, warnings: 0, hash: goodHash, at: "x" });
  r = cli("render", runPath);
  assert("cli: render refuses when the latest check found errors", r.code === 1 && /2 error/.test(r.err));
  setCheck({ ok: true, errors: 0, warnings: 0, hash: "0".repeat(64), at: "x" });
  r = cli("render", runPath);
  assert("cli: render refuses when the files changed since the check", r.code === 1 && /changed since the last check/.test(r.err));
  r = cli("render", runPath, "--quality", "ultra");
  assert("cli: render validates --quality", r.code === 2);

  // --- orientation through the CLI
  r = json("new", "--slug", "cli-portrait", "--lang", "pt-BR", "--orientation", "portrait");
  const portraitRun = r.json?.run;
  assert("cli: new --orientation portrait reports the size, the layout and the burn switch", r.code === 0 && r.json.orientation === "portrait" && r.json.width === 1080 && r.json.height === 1920 && same(r.json.layout.safe, [60, 220, 960, 1380]) && r.json.captions.burn === true && r.json.captions.maxWords === 6, r.out);
  assert("cli: the portrait project is 1080x1920 and run.json says portrait", /data-width="1080"/.test(fs.readFileSync(path.join(portraitRun, "project", "index.html"), "utf8")) && readRun(portraitRun).orientation === "portrait");
  r = cli("new", "--slug", "cli-portrait-text", "--lang", "pt-BR", "--orientation", "9:16");
  assert("cli: the text output names the frame and the safe box", r.code === 0 && /frame:\s+portrait 1080x1920/.test(r.out) && /safe box \[60, 220, 960, 1380\]/.test(r.out) && /burned in at \[60, 1400, 960, 1580\]/.test(r.out), r.out);
  r = json("new", "--slug", "cli-vertical", "--lang", "en", "--orientation", "vertical");
  assert("cli: an alias is accepted", r.code === 0 && r.json.orientation === "portrait");
  r = json("new", "--slug", "cli-horizontal", "--lang", "en", "--orientation", "16:9");
  assert("cli: 16:9 is landscape", r.code === 0 && r.json.orientation === "landscape" && r.json.width === 1920);
  r = json("new", "--slug", "cli-default-orientation", "--lang", "en");
  assert("cli: landscape is the default", r.code === 0 && r.json.orientation === "landscape" && r.json.height === 1080);
  r = json("new", "--slug", "cli-square", "--lang", "en", "--orientation", "square");
  assert("cli: an unknown orientation is a usage error (exit 2) that lists the valid ones", r.code === 2 && r.json.ok === false && /landscape or portrait/.test(r.json.error) && /reels/.test(r.json.error) && !fs.readdirSync(path.join(home, "runs")).some((n) => n.endsWith("cli-square")));
  r = cli("new", "--slug", "cli-svg-portrait", "--lang", "en", "--format", "svg", "--orientation", "portrait");
  assert("cli: --orientation with a format other than video is a usage error (exit 2)", r.code === 2 && /only applies to --format video/.test(r.err));
  r = cli("new", "--help");
  assert("cli: new --help documents --orientation", r.code === 0 && /--orientation landscape\|portrait/.test(r.out) && /1080x1920/.test(r.out));

  // --- the starter explanation.md
  r = json("new", "--slug", "cli-expl", "--lang", "pt-BR");
  assert("cli: new reports explanation.md in files and writes the Portuguese sections", r.code === 0 && r.json.files.explanation === path.join(r.json.run, "explanation.md") && /^## Distinção central$/m.test(fs.readFileSync(r.json.files.explanation, "utf8")), r.out);
  r = cli("new", "--slug", "cli-expl-text", "--lang", "pt-BR");
  assert("cli: the text output names explanation.md and a runnable lint command for it", r.code === 0 && /explain:\s+\S+explanation\.md/.test(r.out) && /lint:\s+node \S*ste-lint\.mjs --file \S+explanation\.md --lang pt$/m.test(r.out), r.out);
  r = json("new", "--slug", "cli-expl-svg", "--lang", "es", "--format", "svg");
  assert("cli: a static run lists explanation.md in files too, in English for a language with no profile", r.code === 0 && fs.readFileSync(r.json.files.explanation, "utf8").startsWith("## Load-bearing distinction"), r.out);
  r = cli("new", "--slug", "cli-expl-es", "--lang", "es", "--format", "text");
  assert("cli: the lint hint uses the core language for a language with no profile", /--lang es$/m.test(r.out), r.out);
  r = cli("new", "--help");
  assert("cli: new --help mentions explanation.md", r.code === 0 && /explanation\.md/.test(r.out) && /never overwritten/.test(r.out));

  // --- hints are runnable as printed from the folder the user is in
  {
    const inTree = (...args) => {
      const out = spawnSync(process.execPath, [path.join(scripts, "explain.mjs"), ...args], { env, encoding: "utf8", timeout: 60000, cwd: tree });
      return { code: out.status, out: out.stdout, err: out.stderr };
    };
    r = inTree("new", "--slug", "cli-hint", "--lang", "en");
    const hintRun = /^(.*cli-hint)$/m.exec(r.out)?.[1];
    assert("hints: from the folder that holds the skill the script path is relative", r.code === 0 && r.out.includes(`next: edit script.json, then: node skills/explain-me/scripts/explain.mjs voice ${hintRun}`), r.out);
    r = inTree("check");
    assert("hints: an error's fix uses the same path", r.code === 2 && r.err.includes("fix: run: node skills/explain-me/scripts/explain.mjs --help"), r.err);
    r = inTree("--help");
    assert("hints: the help's usage line uses it too", /Usage: node skills\/explain-me\/scripts\/explain\.mjs <command> \[flags\]/.test(r.out));
    r = cli("new", "--slug", "cli-hint-far", "--lang", "en");
    assert("hints: from far away the path is absolute", r.out.includes(`then: node ${path.join(scripts, "explain.mjs")} voice `), r.out);
  }

  // --- the script guard: check and render refuse a script that changed after voice
  {
    r = json("new", "--slug", "cli-guard", "--lang", "pt-BR");
    const guardRun = r.json.run;
    const scriptFile = path.join(guardRun, "script.json");
    const writeGuardScript = (subject) => fs.writeFileSync(scriptFile, JSON.stringify({ lang: "pt-BR", title: "T", beats: [{ id: "b01", narration: "Uma frase curta aqui.", subject }] }));
    writeGuardScript("#dot");
    r = json("voice", "cli-guard", "--silent");
    assert("guard: voice --silent builds and records the script hash", r.code === 0 && /^[0-9a-f]{64}$/.test(readRun(guardRun).scriptHash));
    r = json("check", "cli-guard");
    assert("guard: with the script as voiced, check goes on to the engine (not installed here)", r.code === 1 && /HyperFrames is not installed/.test(r.json.error), r.out);
    writeGuardScript("#other");
    r = json("check", "cli-guard");
    assert("guard: check refuses a script edited after voice, with the exact message", r.code === 1 && r.json.error === "script.json changed since voice: run voice again" && /voice/.test(r.json.fix) && r.json.stale === true, r.out);
    r = cli("check", "cli-guard");
    assert("guard: the text output says it and names the command", /error: script\.json changed since voice: run voice again/.test(r.err) && /fix: run: node \S*explain\.mjs voice /.test(r.err), r.err);
    // render with a good gate record still refuses a stale script
    const proj = path.join(guardRun, "project");
    const gateHash = projectHash(proj);
    const withCheck = JSON.parse(fs.readFileSync(path.join(guardRun, "run.json"), "utf8"));
    fs.writeFileSync(path.join(guardRun, "run.json"), JSON.stringify({ ...withCheck, check: { ok: true, errors: 0, warnings: 0, hash: gateHash, at: "x" } }));
    r = json("render", "cli-guard");
    assert("guard: render refuses it first, even with a passing check on record", r.code === 1 && r.json.error === "script.json changed since voice: run voice again", r.out);
    r = json("voice", "cli-guard", "--silent");
    assert("guard: voice again rebuilds", r.code === 0 && scriptStaleness(guardRun).stale === false);
    r = json("render", "cli-guard");
    assert("guard: after voice the gate hash is what refuses render (the files changed), not the script", r.code === 1 && /Motion Gate closed/.test(r.json.error), r.out);
    // a run voiced before the guard existed is not refused
    const old = JSON.parse(fs.readFileSync(path.join(guardRun, "run.json"), "utf8"));
    delete old.scriptHash;
    fs.writeFileSync(path.join(guardRun, "run.json"), JSON.stringify(old));
    writeGuardScript("#third");
    r = json("check", "cli-guard");
    assert("guard: no recorded hash means no refusal", r.code === 1 && /HyperFrames is not installed/.test(r.json.error), r.out);
  }

  // --- doctor always gives a verdict on espeak-ng
  r = json("doctor", "--offline");
  assert("cli: doctor always reports espeak-ng with a status", r.json && ["bundled", "system", "user", "missing"].includes(r.json.espeak?.status) && typeof r.json.espeak.ok === "boolean" && (r.json.espeak.ok || (/espeak-ng/.test(r.json.espeak.install) && r.json.problems.some((p) => /espeak-ng/.test(p.message) && p.fix))));
  r = cli("doctor", "--offline");
  assert("cli: doctor's text names espeak-ng on every machine", /espeak-ng:/.test(r.out));

  r = json("doctor", "--offline");
  assert("cli: doctor reports as JSON, never installs, exit reflects blocking problems only", r.json && r.json.home.path === home && Array.isArray(r.json.problems) && r.json.hyperframes && "tier" in r.json.hyperframes);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

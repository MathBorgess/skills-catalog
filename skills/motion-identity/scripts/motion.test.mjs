#!/usr/bin/env node
// Tests for the motion-identity driver. Run: node skills/motion-identity/scripts/motion.test.mjs
// No network and no HyperFrames: the render path runs against a fake exec.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEFAULT_DURATIONS, MAX_WORDS, buildPage, lintSignature, motionJson, normalizeOrientation, planProof, runProof, slugify, summarizeCheck, tokensCss } from "./lib/proof.mjs";
import { AMBIENT_LEVELS, EASE_ROLES, KIT_PRIMITIVES, MOTION_PERSONALITIES, PROJECT_SPEC_NAMES, briefFor, briefLines, checkIdentity, contrastRatio, easeHint, findProjectSpec, identityStatus, isGsapEase, pickAccent, splitFrontmatter } from "./lib/spec.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.join(HERE, "..");
const SIBLING = path.join(SKILL, "..", "explain-me");
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
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const assertEq = (name, a, b) => assert(name, same(a, b), `expected ${JSON.stringify(b)}\n     got      ${JSON.stringify(a)}`);
const tmp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `motion-identity-${name}-`));

const FRONT = `---
name: Test brand
colors: { background: "#0B1020", text: "#F4F6FF", muted: "#8A93B2", brandBlue: "#4F8CFF", brandPink: "#FF5C8A", deep: "#1A1F3A" }
typography:
  display: { family: "Inter", weight: 800, fallback: sans-serif }
  body: { family: "Inter", weight: 500 }
motion:
  personality: playful
  ease: "power2.inOut"
  eases: { enter: "back.out(1.6)", exit: "power3.in", emphasis: "back.out(2.2)" }
  durations: { grow: 0.6, indicate: 0.7, fade: 0.5, draw: 0.9, move: 1.0 }
  ambient: subtle
  signature: { name: "ribbon sweep", note: "a stroke sweeps under the key word" }
---
`;
const BODY = `
# Test brand

## Motion identity

**Status:** draft (proof not seen)

Warm and playful.

## Motion examples

\`\`\`js
kit.beat("b01", (b) => {
  b.grow("#dot");
  b.at(0.6).indicate("#dot");
});
\`\`\`

## Brief block

- Motion: playful; enter back.out(1.6), exit power3.in.
- Emphasis: back.out(2.2) on one word.
- Ambient: subtle.
`;
const FULL = FRONT + BODY;

// ------------------------------------------------------------------ reading
{
  const { data, body, hasFrontmatter } = splitFrontmatter(FULL);
  assert("spec: frontmatter and body split", hasFrontmatter && data.name === "Test brand" && body.startsWith("# Test brand"));
  assertEq("spec: no frontmatter is an empty map", splitFrontmatter("# Only prose").data, {});
  let threw = false;
  try {
    splitFrontmatter("---\nname: x\n");
  } catch (e) {
    threw = /never closes/.test(e.message);
  }
  assert("spec: an unclosed frontmatter is an error", threw);
  const dir = tmp("find");
  fs.writeFileSync(path.join(dir, "DESIGN.md"), FULL);
  assert("find: DESIGN.md alone is found", findProjectSpec(dir) === path.join(dir, "DESIGN.md"));
  fs.writeFileSync(path.join(dir, "frame.md"), FULL);
  assert("find: frame.md wins over DESIGN.md (HyperFrames order)", findProjectSpec(dir) === path.join(dir, "frame.md"));
  assert("find: none in an empty folder", findProjectSpec(tmp("empty")) === null);
  assertEq("find: the precedence list", PROJECT_SPEC_NAMES, ["frame.md", "design.md", "DESIGN.md"]);
}

// ------------------------------------------------------------------ the check
const check = (front, body = BODY) => checkIdentity({ path: "x.md", ...splitFrontmatter(front + body) });
const errorAt = (r, p) => r.errors.some((e) => e.path === p);
{
  const ok = check(FRONT);
  assert("check: a complete identity has no error and no warning", ok.errors.length === 0 && ok.warnings.length === 0, JSON.stringify(ok));
  const noFloor = check("---\nmotion: { personality: playful }\n---\n");
  assert("check: the floor is required (background, text, display and body families)", ["colors.background", "colors.text", "typography.display.family", "typography.body.family"].every((p) => errorAt(noFloor, p)));
  assert("check: the floor message forbids inventing", noFloor.errors.find((e) => e.path === "colors.background").message.includes("never invent"));
  const lowContrast = check(FRONT.replace('text: "#F4F6FF"', 'text: "#2A2F4A"'));
  assert("check: text below 4.5:1 on the background is an error", errorAt(lowContrast, "colors.text") && /4\.5:1/.test(lowContrast.errors.find((e) => e.path === "colors.text").message));
  const css = check(FRONT.replace('enter: "back.out(1.6)"', 'enter: "ease-out-back"'));
  assert("check: a CSS ease name is an error that names the GSAP one", errorAt(css, "motion.eases.enter") && /back\.out\(1\.7\)/.test(css.errors.find((e) => e.path === "motion.eases.enter").message));
  assert("check: a cubic-bezier gets a hint about CustomEase", /CustomEase/.test(easeHint("cubic-bezier(0.4, 0, 0.2, 1)")));
  const noRoles = check(FRONT.replace(/  eases: .*\n/, ""));
  assert("check: eases are required", errorAt(noRoles, "motion.eases"));
  const oneRole = check(FRONT.replace('exit: "power3.in", ', ""));
  assert("check: each role is required", errorAt(oneRole, "motion.eases.exit"));
  const sameCurve = check(FRONT.replace('exit: "power3.in"', 'exit: "back.out(1.6)"'));
  assert("check: an exit with the entrance curve is a warning", sameCurve.errors.length === 0 && sameCurve.warnings.some((w) => w.path === "motion.eases.exit"));
  assert("check: ambient must be a level", errorAt(check(FRONT.replace("ambient: subtle", "ambient: loud")), "motion.ambient") && errorAt(check(FRONT.replace("  ambient: subtle\n", "")), "motion.ambient"));
  assert("check: a signature needs a name", errorAt(check(FRONT.replace(/  signature: .*\n/, "")), "motion.signature"));
  assert("check: an archetype outside the four is a warning", check(FRONT.replace("personality: playful", "personality: editorial")).warnings.some((w) => w.path === "motion.personality"));
  assert("check: the gate can never be off", errorAt(check(FRONT.replace("motion:\n", "motion:\n  gate: off\n")), "motion.gate"));
  const noProse = check(FRONT, "\n# Nothing\n");
  assert("check: the Motion identity section and the brief block are required", errorAt(noProse, "## Motion identity") && errorAt(noProse, "## Brief block"));
  assert("check: the Motion identity needs a status line", errorAt(check(FRONT, BODY.replace("**Status:** draft (proof not seen)", "Draft.")), "## Motion identity"));
  const longBrief = BODY.replace("- Ambient: subtle.", Array.from({ length: 7 }, (_, i) => `- line ${i}`).join("\n"));
  assert("check: a brief block over 8 lines is an error", errorAt(check(FRONT, longBrief), "## Brief block"));
  assert("check: a motion example outside the kit is an error", errorAt(check(FRONT, BODY.replace("b.grow(", "b.spin(")), "## Motion examples"));
  assertEq("check: the status line reads draft and approved", [identityStatus(BODY).status, identityStatus(BODY.replace("draft (proof not seen)", "approved on 2026-10-06 by the designer")).status], ["draft", "approved"]);
}

// ------------------------------------------------------------------ eases and colors
{
  assert("ease: GSAP names pass", ["power2.inOut", "back.out(1.6)", "elastic.out(1, 0.5)", "expo.out", "sine.inOut", "none", "linear", "steps(5)", "quad.out", "back.out"].every(isGsapEase));
  assert("ease: CSS names, beziers, springs and nonsense fail", !["ease-out-back", "cubic-bezier(0.4,0,0.2,1)", "spring(300, 20)", "power2.sideways", "", null].some(isGsapEase));
  assert("contrast: white on black is 21:1", Math.abs(contrastRatio("#FFFFFF", "#000000") - 21) < 0.01);
  const colors = splitFrontmatter(FULL).data.colors;
  assertEq("accent: the non-neutral color with the best contrast on the background", pickAccent(colors).key, "brandPink");
  assertEq("accent: a named key wins", pickAccent(colors, "brandBlue"), { key: "brandBlue", value: "#4F8CFF" });
  assert("accent: an unknown key is null", pickAccent(colors, "nope") === null);
  assertEq("accent: with only neutrals, the text color", pickAccent({ background: "#000000", text: "#FFFFFF", muted: "#888888" }).key, "text");
}

// ------------------------------------------------------------------ brief
{
  const spec = { path: "x.md", ...splitFrontmatter(FULL) };
  assertEq("brief: the prose block, as written", briefFor(spec), { lines: ["- Motion: playful; enter back.out(1.6), exit power3.in.", "- Emphasis: back.out(2.2) on one word.", "- Ambient: subtle."], drafted: false });
  const drafted = briefFor({ path: "x.md", ...splitFrontmatter(FRONT) });
  assert("brief: drafted from the keys when the prose has none", drafted.drafted && drafted.lines.some((l) => l.includes("back.out(1.6)")) && drafted.lines.some((l) => l.includes("ribbon sweep")));
  assert("brief: a fenced block is read without its fence", same(briefLines("## Brief block\n\n```\n- a\n- b\n```\n"), ["- a", "- b"]));
}

// ------------------------------------------------------------------ the plan
{
  const data = splitFrontmatter(FULL).data;
  const a = planProof(data, { text: "Make it move", sub: "a line", hasSignature: true });
  const b = planProof(data, { text: "Make it move", sub: "a line", hasSignature: true });
  assert("plan: the same spec gives the same plan", same(a, b));
  assertEq("plan: portrait by default, with explain-me's safe box", [a.orientation, a.width, a.height, a.safe], ["portrait", 1080, 1920, [60, 220, 960, 1380]]);
  assertEq("plan: the role eases and the base ease", a.eases, { enter: "back.out(1.6)", exit: "power3.in", emphasis: "back.out(2.2)", move: "power2.inOut" });
  assert("plan: the first motion waits a beat (no t=0 jump cut)", a.times.enter > 0);
  assert("plan: exits are shorter than entrances", a.exitDur < a.durations.grow);
  assert("plan: the total stagger stays under half a second", a.stagger * (a.words.length - 1) <= 0.5 && planProof(data, { text: "a b c d e f" }).stagger * 5 <= 0.5 + 1e-9);
  assert("plan: the accent word is the last by default", a.accentIndex === 2 && planProof(data, { text: "a b c", accentWord: "1" }).accentIndex === 0);
  assert("plan: every frame sits inside the video, in order", a.frames.every((f, i) => f.t > 0 && f.t < a.total && (i === 0 || f.t > a.frames[i - 1].t)), JSON.stringify(a.frames));
  assert("plan: the signature frame only with a signature", a.frames.some((f) => f.name === "signature") && !planProof(data, { text: "x" }).frames.some((f) => f.name === "signature"));
  assert("plan: the gate stops before the end hold", a.gateEnd < a.total);
  assertEq("plan: missing durations fall back to the kit's", planProof({ colors: data.colors }, { text: "x" }).durations, DEFAULT_DURATIONS);
  assertEq("plan: orientation aliases", ["reels", "9:16", "16:9", "Landscape", "square"].map(normalizeOrientation), ["portrait", "portrait", "landscape", "landscape", null]);
  const throws = (fn, re) => {
    try {
      fn();
      return false;
    } catch (e) {
      return re.test(e.message);
    }
  };
  assert("plan: too many words is refused", throws(() => planProof(data, { text: Array.from({ length: MAX_WORDS + 1 }, (_, i) => `w${i}`).join(" ") }), /at most/));
  assert("plan: an accent word out of range is refused", throws(() => planProof(data, { text: "a b", accentWord: "3" }), /accent-word/));
  assert("plan: a bad language tag is refused", throws(() => planProof(data, { text: "a", lang: "pt br" }), /language tag/));
  assert("plan: a brand box for the orientation is used", same(planProof({ ...data, layout: { portrait: { safe: [80, 300, 1000, 1300] } } }, { text: "x" }).safe, [80, 300, 1000, 1300]));
}

// ------------------------------------------------------------------ the page
{
  const data = splitFrontmatter(FULL).data;
  const template = fs.readFileSync(path.join(SKILL, "assets", "proof.html"), "utf8");
  const plan = planProof(data, { text: "Make <it> move", lang: "pt-BR" });
  const page = buildPage(template, data, plan, null);
  assert("page: tokens are inlined", page.includes("--mi-bg: #0B1020;") && page.includes("--mi-accent: #FF5C8A;") && page.includes('--mi-font-display: Inter, sans-serif;'));
  assert("page: words are escaped and the accent word is marked", page.includes("&lt;it&gt;") && page.includes('class="mi-word mi-accent-word" id="mi-w3"'));
  assert("page: the plan, size, duration and language are written", page.includes("window.MOTION_PROOF =") && page.includes('data-duration="' + plan.total + '"') && page.includes('<html lang="pt-BR">') && page.includes('data-width="1080"'));
  assert("page: no marker is left behind", ["<!-- mi:tokens -->", "<!-- mi:headline -->", "/* mi:plan */", "/* mi:signature */"].every((m) => !page.includes(m)));
  assert("page: the supporting line uses muted only when it is readable", tokensCss(data, plan).includes("--mi-sub: #8A93B2;") && tokensCss({ ...data, colors: { ...data.colors, muted: "#303550" } }, plan).includes("--mi-sub: #F4F6FF;"));
  let threw = false;
  try {
    buildPage("<html>", data, plan, null);
  } catch (e) {
    threw = /marker/.test(e.message);
  }
  assert("page: a template without its markers is refused", threw);
  assertEq("page: the motion sidecar watches the stage until the exit ends", motionJson(plan), { duration: plan.gateEnd, assertions: [{ kind: "keepsMoving", maxStaticSec: 2, withinSelector: "#mi-stage" }, { kind: "appearsBy", selector: "#mi-w1", bySec: plan.times.enter + 0.5 }] });
  assertEq("signature: deterministic code passes", lintSignature("tl.fromTo(p, {opacity: 0}, {opacity: 1, duration: dur}, at);"), []);
  assertEq("signature: play, infinite repeats, clocks, random, timers and bare tweens are refused", lintSignature("tl.play(); gsap.to(x, {repeat: -1}); Date.now(); Math.random(); setTimeout(f); gsap.to(y, {});").length, 6);
}

// ------------------------------------------------------------------ running (fake exec)
{
  const data = splitFrontmatter(FULL).data;
  const plan = planProof(data, { text: "Make it move" });
  const template = fs.readFileSync(path.join(SKILL, "assets", "proof.html"), "utf8");
  const page = buildPage(template, data, plan, null);
  const env = { PATH: path.dirname(process.execPath) + path.delimiter + (process.env.PATH ?? "") };
  const calls = [];
  const okEnvelope = JSON.stringify({ ok: true, lint: { findings: [] }, runtime: { findings: [] }, _meta: { version: "9.9.9" } });
  const fakeExec = (cmd, args) => {
    calls.push([path.basename(cmd), ...args]);
    if (args.includes("check")) return { status: 0, stdout: `notice\n${okEnvelope}\n`, stderr: "", error: null };
    if (args.includes("render")) {
      fs.writeFileSync(args[args.indexOf("-o") + 1], "mp4");
      return { status: 0, stdout: "", stderr: "", error: null };
    }
    fs.writeFileSync(args[args.length - 1], "png");
    return { status: 0, stdout: "", stderr: "", error: null };
  };
  const dir = tmp("run");
  const r = runProof({ dir, page, plan, exec: fakeExec, env });
  assert("run: check, render, one frame per moment and a contact sheet", r.rendered && r.frames.length === plan.frames.length && r.contact && r.problems.length === 0, JSON.stringify(r.problems));
  assert("run: the project holds the page and its motion sidecar", fs.existsSync(path.join(dir, "project", "index.html")) && fs.existsSync(path.join(dir, "project", "index.motion.json")) && fs.existsSync(path.join(dir, "plan.json")));
  assert("run: check runs before render", calls.findIndex((c) => c.includes("check")) < calls.findIndex((c) => c.includes("render")));
  const failingExec = (cmd, args) => (args.includes("check") ? { status: 1, stdout: JSON.stringify({ ok: false, runtime: { findings: [{ severity: "error", code: "runtime_error", message: "boom" }] } }), stderr: "", error: null } : fakeExec(cmd, args));
  const bad = runProof({ dir: tmp("bad"), page, plan, exec: failingExec, env });
  assert("run: a failing check stops before the render", !bad.rendered && bad.check.errors === 1 && /fix them before the render/.test(bad.problems[0]));
  const none = runProof({ dir: tmp("norender"), page, plan, render: false, exec: () => assert("run: no exec without render", false), env });
  assert("run: --no-render only writes the project", !none.rendered && none.problems.length === 0 && fs.existsSync(none.page));
  const lost = runProof({ dir: tmp("nohf"), page, plan, exec: fakeExec, env: { PATH: "" } });
  assert("run: no hyperframes and no npx is reported, not thrown", !lost.rendered && /not reachable/.test(lost.problems[0]));
  assertEq("run: the check envelope is summarized", summarizeCheck({ ok: true, contrast: { findings: [{ severity: "warning", code: "contrast_aa_failure", message: "m" }] } }).warnings, 1);
  assertEq("slug: from a brand name", slugify("We Brand Ação!"), "we-brand-acao");
}

// ------------------------------------------------------------------ the CLI
{
  const cli = (...args) => spawnSync(process.execPath, [path.join(HERE, "motion.mjs"), ...args], { encoding: "utf8", env: { ...process.env, MOTION_IDENTITY_HOME: tmp("home") } });
  const dir = tmp("cli");
  const file = path.join(dir, "DESIGN.md");
  fs.writeFileSync(file, FULL);
  assert("cli: check passes a complete spec", cli("check", file).status === 0);
  assert("cli: check accepts the project folder", cli("check", dir).status === 0);
  const broken = path.join(dir, "broken.md");
  fs.writeFileSync(broken, FRONT.replace('exit: "power3.in"', 'exit: "ease-in"') + BODY);
  const r = cli("check", broken, "--json");
  assert("cli: check fails with the path of the error, as JSON", r.status === 1 && JSON.parse(r.stdout).errors.some((e) => e.path === "motion.eases.exit"));
  assert("cli: brief prints the block and the spec path", /Brand spec: /.test(cli("brief", file).stdout));
  const p = cli("proof", file, "--text", "Make it move", "--no-render", "--dest", path.join(dir, "proof"), "--json");
  assert("cli: proof --no-render writes the page", p.status === 0 && fs.existsSync(path.join(dir, "proof", "project", "index.html")), p.stderr || p.stdout);
  const refused = cli("proof", broken, "--no-render");
  assert("cli: proof refuses an incomplete identity", refused.status === 1 && /not complete/.test(refused.stdout));
  const sig = path.join(dir, "sig.js");
  fs.writeFileSync(sig, "tl.play();");
  assert("cli: proof refuses a signature that breaks determinism", /play\(\)/.test(cli("proof", file, "--signature", sig, "--no-render").stdout));
  assert("cli: an unknown command exits 2", cli("spin").status === 2);
  assert("cli: find reports none with exit 1", cli("find", "--project", tmp("nofind")).status === 1);
}

// ------------------------------------------------------------------ the contract with explain-me
if (fs.existsSync(path.join(SIBLING, "scripts", "lib", "design.mjs"))) {
  const em = await import(pathToFileURL(path.join(SIBLING, "scripts", "lib", "design.mjs")).href);
  assertEq("contract: the key lists match explain-me's", [MOTION_PERSONALITIES, EASE_ROLES, AMBIENT_LEVELS, KIT_PRIMITIVES], [em.MOTION_PERSONALITIES, em.EASE_ROLES, em.AMBIENT_LEVELS, em.KIT_PRIMITIVES]);
  const samples = ["power2.inOut", "back.out(1.6)", "elastic.out(1, 0.5)", "steps(5)", "ease-out-back", "cubic-bezier(0,0,1,1)", "power2.sideways", "linear", "sine"];
  assertEq("contract: both skills accept the same ease names", samples.map(isGsapEase), samples.map(em.isGsapEase));
  const ours = fs.readFileSync(path.join(HERE, "lib", "yaml.mjs"), "utf8");
  const theirs = fs.readFileSync(path.join(SIBLING, "scripts", "lib", "yaml.mjs"), "utf8");
  assert("contract: lib/yaml.mjs is byte-identical to explain-me's", ours === theirs, "copy skills/explain-me/scripts/lib/yaml.mjs over skills/motion-identity/scripts/lib/yaml.mjs");
  const emCheck = em.validateSpec({ path: "x.md", ...splitFrontmatter(FULL) });
  assert("contract: a spec this skill passes is also clean for explain-me", emCheck.errors.length === 0 && emCheck.warnings.length === 0, JSON.stringify(emCheck));
} else {
  console.log("skip contract: explain-me is not installed next to this skill");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;

#!/usr/bin/env node
// Tests for still-cursor-living-day.
// Run: node skills/still-cursor-living-day/scripts/collection.test.mjs

import { execFileSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validate, transitions, breakage, kendallTau, inspectImage, lexicon,
  shuffled, planHash, clockMinutes, CURSOR_CLAUSE, SURFACE_CLAUSE, IDS,
} from "./collection.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "collection.mjs");
let failed = 0;

function assert(name, cond) {
  if (cond) console.log(`ok  ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); }
}

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// A real 8x8 PNG, so inspectImage is tested against bytes and not a stub.
function png(width, height, seed) {
  const raw = [];
  for (let y = 0; y < height; y += 1) {
    raw.push(0);
    for (let x = 0; x < width; x += 1) raw.push((x * y + seed) % 256, seed % 256, (x + seed) % 256);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.from(raw))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// A plan that obeys the axis: twelve frames, a clock that advances, and at least
// one object changing state at every frame.
function goodPlan(route = "manual") {
  const objects = ["mug", "jacket", "keys", "curtain", "notebook", "plate"];
  const frames = IDS.map((id, i) => {
    const object = objects[i % objects.length];
    return {
      id,
      clock: `${String(6 + i).padStart(2, "0")}:${i % 2 ? "40" : "10"}`,
      room: `the room at hour ${i}`,
      light: `light state ${i}`,
      human: `a reflected shoulder, ${i} hours in`,
      traces: [
        { object, state: `state-${i}` },
        { object: objects[(i + 1) % objects.length], state: `carry-${i}` },
      ],
      route,
      prompt: `${SURFACE_CLAUSE}. ${CURSOR_CLAUSE}. The room at hour ${i}, seen only as a reflection.`,
    };
  });
  return { axis: "still-cursor-living-day", frame_count: 12, invariants: { cursor_clause: CURSOR_CLAUSE, surface_clause: SURFACE_CLAUSE }, frames };
}

const ROUTES = [
  { id: "manual", kind: "manual", capability: "probed", note: "drop files" },
  { id: "cli:codex", kind: "cli", capability: "declared", note: "codex on PATH" },
  { id: "api:openai", kind: "api", capability: "absent", note: "no key" },
];

// ---------------------------------------------------------------- unit tests

assert("clock: parses HH:MM", clockMinutes("07:45") === 465);
assert("clock: refuses 24:00 and garbage", clockMinutes("24:00") === null && clockMinutes("7:45") === null);

const ok = validate(goodPlan(), ROUTES);
assert("validate: a plan that obeys the axis passes", ok.errors.length === 0);

const short = goodPlan();
short.frames.pop();
assert("validate: eleven frames is refused", validate(short, ROUTES).errors.some((e) => e.includes("exactly 12")));

const backwards = goodPlan();
backwards.frames[5].clock = "06:00";
assert("validate: a clock that goes backwards is refused", validate(backwards, ROUTES).errors.some((e) => e.includes("does not advance")));

const unanchored = goodPlan();
unanchored.frames[2].prompt = "a dark room reflected in glass";
const unanchoredErrors = validate(unanchored, ROUTES).errors;
assert("validate: a prompt missing the cursor clause is refused", unanchoredErrors.some((e) => e.includes("cursor_clause verbatim")));
assert("validate: a prompt missing the surface clause is refused", unanchoredErrors.some((e) => e.includes("surface_clause verbatim")));

const lit = goodPlan();
lit.frames[4].prompt += " a small notification appears in the corner";
assert("validate: a prompt asking for a notification is refused", validate(lit, ROUTES).errors.some((e) => e.includes("notification")));

const staged = goodPlan();
staged.frames[7].prompt += " lit by a softbox, the person posing";
const stagedErrors = validate(staged, ROUTES).errors;
assert("validate: studio light is refused", stagedErrors.some((e) => e.includes("softbox")));
assert("validate: a posed reflection is refused", stagedErrors.some((e) => e.includes("posing")));

assert(
  "validate: the invariant clause may name what it forbids",
  validate(goodPlan(), ROUTES).errors.every((e) => !e.includes("wallpaper")),
);

const ambiguous = goodPlan();
ambiguous.frames[1].prompt += " light falls through the window onto the desk";
const ambOut = validate(ambiguous, ROUTES);
assert("validate: a room window warns and does not refuse", ambOut.errors.length === 0 && ambOut.warnings.some((w) => w.includes("window")));

const sterile = goodPlan();
sterile.frames[3].traces = [{ object: "mug", state: "absent" }, { object: "keys", state: "absent" }];
assert("validate: a room with only absent traces is refused", validate(sterile, ROUTES).errors.some((e) => e.includes("recently here")));

const frozen = goodPlan();
frozen.frames[6].traces = [{ object: "mug", state: "state-5" }];
frozen.frames[5].traces = [{ object: "mug", state: "state-5" }];
frozen.frames[7].traces = [{ object: "mug", state: "state-5" }];
assert(
  "validate: a frame where nothing changes state is refused as a batch member",
  validate(frozen, ROUTES).errors.some((e) => e.includes("definition of a batch member")),
);

const noRoute = goodPlan("api:openai");
assert("validate: a route without image-generation is refused", validate(noRoute, ROUTES).errors.some((e) => e.includes("cannot generate an image here")));
assert("validate: a declared route warns", validate(goodPlan("cli:codex"), ROUTES).warnings.some((w) => w.includes("declared, not probed")));
assert("validate: an unknown route is refused", validate(goodPlan("api:midjourney"), ROUTES).errors.some((e) => e.includes("not a known route")));
assert("validate: routes.json missing is refused", validate(goodPlan(), undefined).errors.some((e) => e.includes("routes.json is missing")));

const perFrameCursor = goodPlan();
perFrameCursor.frames[0].cursor_clause = "somewhere else";
assert("validate: a per-frame cursor clause is refused", validate(perFrameCursor, ROUTES).errors.some((e) => e.includes("plan-level")));

// --------------------------------------------------------------- continuity

const links = transitions(goodPlan());
assert("transitions: a changing object produces links", links.length > 0);
assert("transitions: every link names its object and target state", links.every((l) => l.object && l.state && l.to > l.from));
const brk = breakage(goodPlan());
assert("breakage: every frame carries at least one transition", brk.per.every((n) => n > 0));
assert("breakage: nine four-frame windows over twelve frames", brk.windows.length === 9);
assert("breakage: removing four frames destroys transitions", brk.windows.every((w) => w.destroyed > 0));

// -------------------------------------------------------------------- judge

const truth = ["A", "B", "C", "D"];
assert("tau: a perfect order scores 1", kendallTau(["A", "B", "C", "D"], truth) === 1);
assert("tau: a reversed order scores -1", kendallTau(["D", "C", "B", "A"], truth) === -1);
assert("tau: one swap is below 1", kendallTau(["B", "A", "C", "D"], truth) < 1);

assert("shuffle: deterministic for the same run", shuffled(IDS, "run-x").join() === shuffled(IDS, "run-x").join());
assert("shuffle: different for another run", shuffled(IDS, "run-x").join() !== shuffled(IDS, "run-y").join());
assert("shuffle: keeps every frame exactly once", new Set(shuffled(IDS, "run-x")).size === 12);

assert("hash: stable for the same plan", planHash(goodPlan()) === planHash(goodPlan()));
assert("hash: changes when a prompt changes", planHash(goodPlan()) !== planHash(lit));

assert("lexicon: finds a forbidden token", lexicon("a glowing screen").forbidden.includes("glowing screen"));
assert("lexicon: finds an ambiguous token", lexicon("light from the window").ambiguous.includes("window"));

// ------------------------------------------------------------ image evidence

const sandbox = mkdtempSync(join(tmpdir(), "scld-test-"));
const pngPath = join(sandbox, "a.png");
writeFileSync(pngPath, png(8, 8, 1));
const info = inspectImage(pngPath);
assert("inspect: reads a PNG's real dimensions", info.ok && info.format === "png" && info.width === 8 && info.height === 8);
const junkPath = join(sandbox, "b.png");
writeFileSync(junkPath, Buffer.from('{"error":"quota"}'));
assert("inspect: a JSON error body is not an image", inspectImage(junkPath).ok === false);
writeFileSync(join(sandbox, "c.png"), Buffer.alloc(0));
assert("inspect: an empty file is not an image", inspectImage(join(sandbox, "c.png")).ok === false);

// --------------------------------------------------------- end-to-end, manual

const ENV = { ...process.env, SCLD_ROOT: join(sandbox, "root") };

function run(...argv) {
  return execFileSync(process.execPath, [SCRIPT, ...argv], { encoding: "utf8", env: ENV });
}
function runFails(...argv) {
  try {
    execFileSync(process.execPath, [SCRIPT, ...argv], { encoding: "utf8", stdio: "pipe", env: ENV });
    return null;
  } catch (err) {
    return String(err.stdout ?? "") + String(err.stderr ?? "");
  }
}

const RUN = join(sandbox, "run");
run("init", "--run", RUN);
assert("init: writes a twelve-frame skeleton", JSON.parse(readFileSync(join(RUN, "plan.json"), "utf8")).frames.length === 12);
assert("init: pre-writes both invariant clauses", JSON.parse(readFileSync(join(RUN, "plan.json"), "utf8")).invariants.cursor_clause === CURSOR_CLAUSE);
assert("route: refuses a skeleton still full of TODO", (runFails("route", "--run", RUN) ?? "").includes("still TODO"));

run("probe", "--run", RUN);
assert("probe: manual is always available", JSON.parse(readFileSync(join(RUN, "routes.json"), "utf8")).routes.some((r) => r.id === "manual" && r.capability === "probed"));

writeFileSync(join(RUN, "plan.json"), JSON.stringify(goodPlan(), null, 2));
assert("route: accepts the filled plan", run("route", "--run", RUN).includes("plan accepted"));
assert("dispatch: refuses an unapproved plan", (runFails("dispatch", "--run", RUN) ?? "").includes("never approved"));
run("route", "--run", RUN, "--approve");

const edited = goodPlan();
edited.frames[0].room = "a different room";
writeFileSync(join(RUN, "plan.json"), JSON.stringify(edited, null, 2));
assert("dispatch: refuses a plan edited after approval", (runFails("dispatch", "--run", RUN) ?? "").includes("changed since approval"));
writeFileSync(join(RUN, "plan.json"), JSON.stringify(goodPlan(), null, 2));

const dispatched = run("dispatch", "--run", RUN);
assert("dispatch: manual route reports where to drop each file", dispatched.includes("drop the files exactly here"));
assert("dispatch: writes every prompt to disk", IDS.every((id) => existsSync(join(RUN, "prompts", `${id}.txt`))));

assert("collect: refuses when frames are missing", (runFails("collect", "--run", RUN) ?? "").includes("no file"));
mkdirSync(join(RUN, "frames"), { recursive: true });
IDS.forEach((id, i) => writeFileSync(join(RUN, "frames", `${id}.png`), png(64, 64, i + 1)));
writeFileSync(join(RUN, "frames", "05.png"), readFileSync(join(RUN, "frames", "04.png")));
assert("collect: catches two byte-identical frames", (runFails("collect", "--run", RUN) ?? "").includes("byte-identical"));
writeFileSync(join(RUN, "frames", "05.png"), png(48, 48, 99));
assert("collect: catches a frame in another geometry", (runFails("collect", "--run", RUN) ?? "").includes("differs from the series"));
writeFileSync(join(RUN, "frames", "05.png"), png(64, 64, 5));
assert("collect: passes with twelve distinct frames of one geometry", run("collect", "--run", RUN).includes("12/12 frames ready"));

assert("judge: informed refuses to open before the blind pass", (runFails("judge", "open", "--phase", "informed", "--run", RUN) ?? "").includes("blind pass has not been submitted"));
run("judge", "open", "--phase", "blind", "--run", RUN);
const key = JSON.parse(readFileSync(join(RUN, "judge", "key.json"), "utf8"));
assert("judge: the blind pass hides the order behind labels", key.pairs.length === 12 && key.pairs.every((p) => existsSync(join(RUN, "judge", "blind", `${p.label}.png`))));
assert("judge: the blind task never names a frame id", !readFileSync(join(RUN, "judge", "blind", "task.md"), "utf8").includes("frames/07"));

const labelsInTruth = key.pairs.slice().sort((a, b) => a.id.localeCompare(b.id)).map((p) => p.label);
const blindFile = join(sandbox, "blind.json");
writeFileSync(blindFile, JSON.stringify({
  order: labelsInTruth,
  frames: key.pairs.map((p) => ({ label: p.label, restriction: "clean", constant: "anchored", presence: "traced", evidence: "black glass, one arrow, a mug left on the desk" })),
}));
assert("judge: a perfect blind order scores tau 1", run("judge", "submit", "--phase", "blind", "--run", RUN, "--file", blindFile).includes("tau = 1"));

const badFile = join(sandbox, "bad.json");
writeFileSync(badFile, JSON.stringify({
  order: labelsInTruth,
  frames: key.pairs.map((p) => ({ label: p.label, restriction: "fine", constant: "anchored", presence: "traced", evidence: "x" })),
}));
assert("judge: an off-enum verdict is refused", (runFails("judge", "submit", "--phase", "blind", "--run", RUN, "--file", badFile) ?? "").includes("restriction must be one of"));

const noEvidence = join(sandbox, "noev.json");
writeFileSync(noEvidence, JSON.stringify({
  order: labelsInTruth,
  frames: key.pairs.map((p) => ({ label: p.label, restriction: "clean", constant: "anchored", presence: "traced", evidence: "" })),
}));
assert("judge: a level with no evidence is refused", (runFails("judge", "submit", "--phase", "blind", "--run", RUN, "--file", noEvidence) ?? "").includes("no evidence"));

run("judge", "open", "--phase", "informed", "--run", RUN);
const infFile = join(sandbox, "informed.json");
writeFileSync(infFile, JSON.stringify({
  frames: IDS.map((id) => ({ id, chronology: id === "07" ? "out-of-line" : "in-line", continuity: "consistent", evidence: "the mug is where the previous frame left it" })),
  collection: {
    shape: "collection",
    link_3_to_9: "the mug filled at 08:10 is the one abandoned cold under the window at 21:40",
    four_deleted: "the jacket never reaches the chair and the sun never crosses the wall",
    discard_proposals: [{ id: "07", reason: "reads like late afternoon at a midday clock", proposal: "regenerate" }],
  },
}));
run("judge", "submit", "--phase", "informed", "--run", RUN, "--file", infFile);

const stub = join(sandbox, "stub.json");
writeFileSync(stub, JSON.stringify({
  frames: IDS.map((id) => ({ id, chronology: "in-line", continuity: "consistent", evidence: "ok" })),
  collection: { shape: "collection", link_3_to_9: "time", four_deleted: "less" },
}));
assert("judge: a stubbed defence answer is refused", (runFails("judge", "submit", "--phase", "informed", "--run", RUN, "--file", stub) ?? "").includes("empty or a stub"));

const scored = run("score", "--run", RUN);
assert("score: writes the report", existsSync(join(RUN, "report.md")));
assert("score: carries the blind tau into the report", scored.includes("Kendall tau"));
assert("score: proposes without acting", scored.includes("Nothing was regenerated") && scored.includes("nothing was regenerated"));
const verdicts = JSON.parse(readFileSync(join(RUN, "verdicts.json"), "utf8"));
assert("score: the judge's own proposal survives into the verdicts", verdicts.proposals.some((p) => p.id === "07" && p.proposal === "regenerate"));
assert("score: an out-of-line frame becomes a proposal", verdicts.proposals.some((p) => p.id === "07" && p.reason.includes("hour it claims")));
assert("score: appends one metrics line", readFileSync(join(sandbox, "root", "metrics.jsonl"), "utf8").trim().split("\n").length >= 1);

const OUT = join(sandbox, "delivery");
run("export", "--run", RUN, "--to", OUT);
assert("export: the deliverable carries frames, report and verdicts", existsSync(join(OUT, "frames", "01.png")) && existsSync(join(OUT, "report.md")) && existsSync(join(OUT, "verdicts.json")));

run("clean", "--run", RUN);
assert("clean: removes a scored run", !existsSync(RUN));
// -------------------------------------------------------------------- guard

const GUARD = join(dirname(fileURLToPath(import.meta.url)), "guard.mjs");
const guardRoot = join(sandbox, "guard-root");
const guardRun = join(guardRoot, "r1");
mkdirSync(guardRun, { recursive: true });

function guard(phase, toolInput, toolName = "Read") {
  writeFileSync(join(guardRun, "state.json"), JSON.stringify({ phase, frames: {} }));
  const out = execFileSync(process.execPath, [GUARD], {
    encoding: "utf8",
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput }),
    env: { ...process.env, SCLD_ROOT: guardRoot },
  });
  return out.trim();
}

assert(
  "guard: seals the plan while the blind pass is open",
  guard("judging-blind", { file_path: join(guardRun, "plan.json") }).includes("blind judging pass"),
);
assert(
  "guard: seals the answer key while the blind pass is open",
  guard("judging-blind", { file_path: join(guardRun, "judge", "key.json") }).includes('"deny"'),
);
assert(
  "guard: leaves the blind task itself readable",
  guard("judging-blind", { file_path: join(guardRun, "judge", "blind", "task.md") }) === "",
);
assert(
  "guard: unseals the plan once the blind pass is submitted",
  guard("judged-blind", { file_path: join(guardRun, "plan.json") }) === "",
);
assert(
  "guard: refuses a hand-edited verdict while the run is live",
  guard("judged", { file_path: join(guardRun, "verdicts.json") }, "Edit").includes("authors one"),
);
assert(
  "guard: lets the judge's own file be read",
  guard("judged", { file_path: join(guardRun, "verdicts.json") }) === "",
);
assert(
  "guard: blocks a shell read of the sealed plan",
  guard("judging-blind", { command: `cat ${join(guardRun, "plan.json")}` }, "Bash").includes('"deny"'),
);
assert(
  "guard: never blocks the skill's own script",
  guard("judging-blind", { command: `node collection.mjs judge submit --run ${guardRun} --file x.json` }, "Bash") === "",
);
assert(
  "guard: is inert once the run is scored",
  guard("scored", { file_path: join(guardRun, "plan.json") }) === "",
);

rmSync(sandbox, { recursive: true, force: true });

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nok: all still-cursor-living-day tests passed");

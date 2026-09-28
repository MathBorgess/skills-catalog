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
  shuffled, planHash, clockMinutes, cursorProblems, SURFACE_CLAUSE, OPTICS_CLAUSE,
  DEFAULT_CURSOR, MIN_CURSOR_PX, SCALES, VIEWS, IDS,
} from "./collection.mjs";
import {
  decodePng, encodePng, homography, project, projectGlyph, drawCursor, quadProblems,
} from "./cursor.mjs";

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

// A plan that obeys the axis: twelve frames, a clock that advances, a laptop
// that travels, framing that changes, and at least one object changing state at
// every frame.
const PLACES = ["kitchen table", "bus seat", "cafe counter", "park bench", "bedroom floor", "shared office desk"];

function goodPlan(route = "manual") {
  const objects = ["mug", "jacket", "keys", "charger", "notebook", "plate"];
  const frames = IDS.map((id, i) => {
    const object = objects[i % objects.length];
    return {
      id,
      clock: `${String(6 + i).padStart(2, "0")}:${i % 2 ? "40" : "10"}`,
      place: PLACES[i % PLACES.length],
      room: `the room at hour ${i}`,
      light: `light state ${i}`,
      human: `a reflected shoulder, ${i} hours in`,
      framing: { scale: SCALES[i % SCALES.length], view: VIEWS[i % VIEWS.length] },
      traces: [
        { object, state: `state-${i}` },
        { object: objects[(i + 1) % objects.length], state: `carry-${i}` },
      ],
      route,
      prompt: `${SURFACE_CLAUSE}. ${OPTICS_CLAUSE}. The room at hour ${i}, seen only as a reflection.`,
    };
  });
  return {
    axis: "still-cursor-living-day",
    frame_count: 12,
    invariants: { surface_clause: SURFACE_CLAUSE, optics_clause: OPTICS_CLAUSE },
    cursor: JSON.parse(JSON.stringify(DEFAULT_CURSOR)),
    frames,
  };
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
assert("validate: a prompt missing the surface clause is refused", unanchoredErrors.some((e) => e.includes("surface_clause verbatim")));

const obsolete = goodPlan();
obsolete.invariants.cursor_clause = "a white arrow with its tip at 61.5% of the width";
assert("validate: the obsolete cursor clause is refused", validate(obsolete, ROUTES).errors.some((e) => e.includes("cursor_clause is obsolete")));

const askedForCursor = goodPlan();
askedForCursor.frames[6].prompt += " a white mouse pointer resting on the screen";
assert("validate: a prompt that asks the generator for a cursor is refused", validate(askedForCursor, ROUTES).errors.some((e) => e.includes("never be asked for a cursor")));

const noCursor = goodPlan();
delete noCursor.cursor;
assert("validate: a plan with no cursor block is refused", validate(noCursor, ROUTES).errors.some((e) => e.includes("plan.cursor is missing")));
assert("cursor: a pointer size outside macOS's range is refused", cursorProblems({ ...DEFAULT_CURSOR, pointer_size: 6 }).some((e) => e.includes("pointer_size")));
assert("cursor: an anchor at the panel edge is refused", cursorProblems({ ...DEFAULT_CURSOR, anchor: [1500, 970] }).some((e) => e.includes("too close to the panel edge")));
assert("cursor: an anchor under the notch is refused", cursorProblems({ ...DEFAULT_CURSOR, anchor: [756, 20] }).some((e) => e.includes("too close to the panel edge")));
assert("cursor: the default block is valid", cursorProblems(DEFAULT_CURSOR).length === 0);

const perFrameCursorBlock = goodPlan();
perFrameCursorBlock.frames[3].cursor = { anchor: [100, 100] };
assert("validate: a per-frame cursor block is refused", validate(perFrameCursorBlock, ROUTES).errors.some((e) => e.includes("plan-level")));

const distantWarn = goodPlan();
distantWarn.frames[0].framing = { scale: "distant", view: "low" };
assert("validate: a distant framing warns that the cursor will be unreadable", validate(distantWarn, ROUTES).warnings.some((w) => w.includes("under the 6px floor")));

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

const noOptics = goodPlan();
delete noOptics.invariants.optics_clause;
assert("validate: a plan with no optics clause is refused", validate(noOptics, ROUTES).errors.some((e) => e.includes("optics_clause is missing")));

const opticsDropped = goodPlan();
opticsDropped.frames[8].prompt = `${SURFACE_CLAUSE}. a bus at dusk`;
assert("validate: a prompt missing the optics clause is refused", validate(opticsDropped, ROUTES).errors.some((e) => e.includes("optics_clause verbatim")));

const perFrameOptics = goodPlan();
perFrameOptics.frames[1].optics_clause = "a bit shinier here";
assert("validate: a per-frame optics clause is refused", validate(perFrameOptics, ROUTES).errors.some((e) => e.includes("plan-level")));

const mirrored = goodPlan();
mirrored.frames[2].prompt += " the panel has a mirror finish and a crystal clear reflection";
const mirroredErrors = validate(mirrored, ROUTES).errors;
assert("validate: asking for a mirror finish is refused", mirroredErrors.some((e) => e.includes("mirror finish")));
assert("validate: asking for a crystal clear reflection is refused", mirroredErrors.some((e) => e.includes("crystal clear reflection")));

const matte = goodPlan();
matte.frames[3].prompt += " a matte black screen filling the middle";
assert("validate: asking for a matte black screen is refused", validate(matte, ROUTES).errors.some((e) => e.includes("matte black screen")));

assert(
  "validate: the optics clause may name both failure modes it forbids",
  validate(goodPlan(), ROUTES).errors.length === 0,
);

const noPlace = goodPlan();
noPlace.frames[4].place = "TODO";
assert("validate: a frame with no place is refused", validate(noPlace, ROUTES).errors.some((e) => e.includes("place is empty or still TODO")));

const oneRoom = goodPlan();
oneRoom.frames.forEach((f) => { f.place = "the same desk"; });
const oneRoomErrors = validate(oneRoom, ROUTES).errors;
assert("validate: twelve frames in one place are refused", oneRoomErrors.some((e) => e.includes("distinct place")));
assert("validate: and the same place four times running is refused", oneRoomErrors.some((e) => e.includes("consecutive frames may share a place")));

const camping = goodPlan();
["02", "03", "04", "05"].forEach((id) => {
  camping.frames.find((f) => f.id === id).place = "kitchen table";
});
assert("validate: four consecutive frames in one place are refused", validate(camping, ROUTES).errors.some((e) => e.includes("4 times in a row")));

const oneCrop = goodPlan();
oneCrop.frames.forEach((f) => { f.framing = { scale: "dominant", view: "frontal" }; });
const oneCropErrors = validate(oneCrop, ROUTES).errors;
assert("validate: a single scale across the series is refused", oneCropErrors.some((e) => e.includes("framing.scale value")));
assert("validate: a single view across the series is refused", oneCropErrors.some((e) => e.includes("framing.view value")));
assert("validate: three identical framings in a row are refused", oneCropErrors.some((e) => e.includes("same scale and view")));

const badScale = goodPlan();
badScale.frames[5].framing = { scale: "huge", view: "frontal" };
assert("validate: an off-vocabulary scale is refused", validate(badScale, ROUTES).errors.some((e) => e.includes("framing.scale must be one of")));
const badView = goodPlan();
badView.frames[5].framing = { scale: "small", view: "dutch" };
assert("validate: an off-vocabulary view is refused", validate(badView, ROUTES).errors.some((e) => e.includes("framing.view must be one of")));

assert("lexicon: finds a mirror-finish request", lexicon("a mirror finish on the lid").forbidden.includes("mirror finish"));
assert("lexicon: warns on a bare mirror", lexicon("beside the bathroom mirror").ambiguous.includes("mirror"));
assert("lexicon: a narrow hallway is not an arrow", lexicon("a narrow hallway").forbidden.length === 0);
assert("lexicon: a filled cup is not an LED", lexicon("a filled cup").ambiguous.length === 0);
assert("lexicon: an arrow is refused", lexicon("an arrow on the glass").forbidden.includes("arrow"));

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

// ------------------------------------------------------------------ cursor

// A PNG whose rows cycle through all five filter types, as real encoders mix
// them: decodePng has to undo every one.
function pngAllFilters(width, height, channels = 3) {
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = (i * 37 + (i >> 5) * 11) & 0xff;
  const raw = Buffer.alloc((stride + 1) * height);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < height; y += 1) {
    const f = y % 5;
    raw[y * (stride + 1)] = f;
    for (let i = 0; i < stride; i += 1) {
      const x = pixels[y * stride + i];
      const a = i >= channels ? pixels[y * stride + i - channels] : 0;
      const b = y ? pixels[(y - 1) * stride + i] : 0;
      const c = y && i >= channels ? pixels[(y - 1) * stride + i - channels] : 0;
      const pred = [0, a, b, (a + b) >> 1, paeth(a, b, c)][f];
      raw[y * (stride + 1) + 1 + i] = (x - pred) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2;
  const file = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
  return { file, pixels };
}

const filtered = pngAllFilters(23, 17);
const decoded = decodePng(filtered.file);
let filtersOk = decoded.width === 23 && decoded.height === 17;
for (let p = 0; p < 23 * 17 && filtersOk; p += 1) {
  for (let c = 0; c < 3; c += 1) if (decoded.data[p * 4 + c] !== filtered.pixels[p * 3 + c]) filtersOk = false;
}
assert("png: decodes rows filtered with None, Sub, Up, Average and Paeth", filtersOk);
const rgba = pngAllFilters(9, 7, 4);
const rgbaBack = decodePng(encodePng(decodePng(rgba.file)));
assert("png: RGBA survives a decode-encode-decode round trip, alpha included", rgbaBack.hasAlpha && rgbaBack.data.equals(decodePng(rgba.file).data));
let refusedJpeg = false;
try { decodePng(Buffer.from([0xff, 0xd8, 0xff, 0xe0])); } catch { refusedJpeg = true; }
assert("png: a JPEG is refused, not guessed at", refusedJpeg);

const frontal = { tl: [100, 50], tr: [400, 50], br: [400, 245], bl: [100, 245] };
const Hf = homography(1512, 982, frontal);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
assert("homography: the panel's corners land exactly on the marked corners",
  [[0, 0, "tl"], [1512, 0, "tr"], [1512, 982, "br"], [0, 982, "bl"]].every(([x, y, k]) => {
    const [u, v] = project(Hf, [x, y]);
    return near(u, frontal[k][0]) && near(v, frontal[k][1]);
  }));
const skew = { tl: [120, 40], tr: [380, 70], br: [360, 230], bl: [140, 260] };
const Hs = homography(1512, 982, skew);
const [cx, cy] = project(Hs, [756, 491]);
const inter = (() => {
  const [x1, y1] = skew.tl, [x2, y2] = skew.br, [x3, y3] = skew.tr, [x4, y4] = skew.bl;
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  const a = x1 * y2 - y1 * x2, b = x3 * y4 - y3 * x4;
  return [(a * (x3 - x4) - (x1 - x2) * b) / d, (a * (y3 - y4) - (y1 - y2) * b) / d];
})();
assert("homography: the panel's centre lands where the diagonals cross, as perspective demands", near(cx, inter[0], 1e-6) && near(cy, inter[1], 1e-6));

const big = projectGlyph(Hf, DEFAULT_CURSOR.anchor, DEFAULT_CURSOR.pointer_size);
const half = projectGlyph(homography(1512, 982, { tl: [100, 50], tr: [250, 50], br: [250, 147.5], bl: [100, 147.5] }), DEFAULT_CURSOR.anchor, DEFAULT_CURSOR.pointer_size);
assert("cursor: half the panel, half the cursor — the size is coherent with the laptop", near(half.height * 2, big.height, 1e-6));
const [tipU, tipV] = big.tip;
assert("cursor: the tip lands at the same fraction of the panel it was anchored to",
  near((tipU - 100) / 300, 1080 / 1512, 1e-9) && near((tipV - 50) / 195, 410 / 982, 1e-9));
assert("cursor: pointer size scales the glyph linearly",
  near(projectGlyph(Hf, DEFAULT_CURSOR.anchor, 4).height, big.height * 2, 1e-6));

assert("quad: a front-facing convex panel passes", quadProblems(frontal, 500, 300).length === 0);
assert("quad: corners given counter-clockwise are refused", quadProblems({ tl: frontal.tl, tr: frontal.bl, br: frontal.br, bl: frontal.tr }, 500, 300).some((p) => p.includes("counter-clockwise")));
assert("quad: a bow-tie of corners is refused", quadProblems({ tl: frontal.tl, tr: frontal.tr, br: frontal.bl, bl: frontal.br }, 500, 300).length > 0);
assert("quad: a corner outside the image is refused", quadProblems({ ...frontal, br: [600, 245] }, 500, 300).some((p) => p.includes("outside")));

const canvas = { width: 500, height: 300, data: Buffer.alloc(500 * 300 * 4, 20), hasAlpha: false };
const before = Buffer.from(canvas.data);
const litCount = drawCursor(canvas, big.poly);
const tipPx = (Math.round(big.tip[1] + 3) * 500 + Math.round(big.tip[0] + 1)) * 4;
assert("draw: the arrow lights pixels just inside its tip", litCount > 0 && canvas.data[tipPx] > 200);
assert("draw: nothing outside the arrow's box is touched", canvas.data.subarray(0, 40 * 500 * 4).equals(before.subarray(0, 40 * 500 * 4)));
const again = { ...canvas, data: Buffer.from(before) };
drawCursor(again, big.poly);
assert("draw: compositing is deterministic, byte for byte", encodePng(again).equals(encodePng(canvas)));

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
const skeleton = JSON.parse(readFileSync(join(RUN, "plan.json"), "utf8"));
assert("init: pre-writes both invariant clauses and no cursor clause", !skeleton.invariants.cursor_clause && skeleton.invariants.surface_clause === SURFACE_CLAUSE && skeleton.invariants.optics_clause === OPTICS_CLAUSE);
assert("init: pre-writes the cursor block", JSON.stringify(skeleton.cursor) === JSON.stringify(DEFAULT_CURSOR));
assert("init: every frame gets a place and a framing to fill", skeleton.frames.every((f) => "place" in f && SCALES.includes(f.framing.scale) && VIEWS.includes(f.framing.view)));
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
IDS.forEach((id, i) => writeFileSync(join(RUN, "frames", `${id}.png`), png(640, 400, i + 1)));
writeFileSync(join(RUN, "frames", "05.png"), readFileSync(join(RUN, "frames", "04.png")));
assert("collect: catches two byte-identical frames", (runFails("collect", "--run", RUN) ?? "").includes("byte-identical"));
writeFileSync(join(RUN, "frames", "05.png"), png(48, 48, 99));
assert("collect: catches a frame in another geometry", (runFails("collect", "--run", RUN) ?? "").includes("differs from the series"));
writeFileSync(join(RUN, "frames", "05.png"), png(640, 400, 5));
assert("collect: passes with twelve distinct frames of one geometry", run("collect", "--run", RUN).includes("12/12 frames ready"));

assert("judge: the blind pass refuses to open before the cursor is composited", (runFails("judge", "open", "--phase", "blind", "--run", RUN) ?? "").includes("No composite"));

run("panel", "open", "--run", RUN);
assert("panel: open writes the marking page, its data and the agent task",
  ["mark.html", "frames.js", "task.md"].every((f) => existsSync(join(RUN, "panels", f))));
assert("panel: frames.js carries the anchor the page previews", readFileSync(join(RUN, "panels", "frames.js"), "utf8").includes("1080"));

// Twelve poses of the panel: it moves and shrinks, the anchor on it does not.
const poses = IDS.map((id, i) => {
  const s = 1 - (i % 4) * 0.12;
  const x = 20 + (i % 3) * 16;
  const y = 16 + (i % 2) * 12;
  const w = 580 * s;
  const h = 364 * s;
  const lean = (i % 3) * 12;
  return { id, corners: { tl: [x + lean, y], tr: [x + w, y + lean], br: [x + w - lean, y + h], bl: [x, y + h - lean] }, clean_panel: true, anchor_occluded: false };
});
const cornersFile = join(sandbox, "corners.json");
const writeCorners = (frames) => writeFileSync(cornersFile, JSON.stringify({ frames }));

writeCorners(poses.slice(0, 6));
assert("panel: a partial submission is kept and reported as incomplete", (runFails("panel", "submit", "--run", RUN, "--file", cornersFile) ?? "").includes("6/12 panels accepted"));

const flawed = poses.map((p) => ({ ...p }));
flawed[6] = { ...poses[6], clean_panel: false };
flawed[7] = { ...poses[7], anchor_occluded: true };
flawed[8] = { ...poses[8], corners: { tl: poses[8].corners.tl, tr: poses[8].corners.bl, br: poses[8].corners.br, bl: poses[8].corners.tr } };
flawed[9] = { ...poses[9], corners: { tl: [300, 180], tr: [360, 180], br: [360, 218], bl: [300, 218] } };
writeCorners(flawed);
const flawedOut = runFails("panel", "submit", "--run", RUN, "--file", cornersFile) ?? "";
assert("panel: a panel the generator drew on is refused", flawedOut.includes("two cursors on one screen"));
assert("panel: an occluded anchor is refused", flawedOut.includes("float the arrow in front of it"));
assert("panel: corners in the wrong order are refused", flawedOut.includes("counter-clockwise"));
assert("panel: a panel too small to carry a readable cursor is refused", flawedOut.includes(`under the ${MIN_CURSOR_PX}px floor`));
assert("composite: refuses while any frame lacks accepted corners", (runFails("composite", "--run", RUN) ?? "").includes("no accepted corners"));

writeCorners(poses);
assert("panel: twelve good panels are accepted", run("panel", "submit", "--run", RUN, "--file", cornersFile).includes("12/12 panels accepted"));

const composed = run("composite", "--run", RUN);
assert("composite: reports one panel point for all twelve", composed.includes("identical in all 12") && IDS.every((id) => composed.includes(`| ${id} | 1080, 410 |`)));
const manifest = JSON.parse(readFileSync(join(RUN, "composited", "manifest.json"), "utf8"));
const tips = IDS.map((id) => manifest.frames[id].tip.join());
assert("composite: the tip moves through the image as the laptop does", new Set(tips).size === 12);
const heights = IDS.map((id) => manifest.frames[id].cursor_px);
assert("composite: the cursor's size follows the panel's size", Math.max(...heights) > Math.min(...heights) * 1.3);
assert("composite: every frame gets its cursor drawn", IDS.every((id) => manifest.frames[id].lit_pixels > 0));
const firstShas = IDS.map((id) => manifest.frames[id].sha).join();
run("composite", "--run", RUN);
assert("composite: re-running produces byte-identical frames", JSON.parse(readFileSync(join(RUN, "composited", "manifest.json"), "utf8")).frames && IDS.map((id) => JSON.parse(readFileSync(join(RUN, "composited", "manifest.json"), "utf8")).frames[id].sha).join() === firstShas);
const raw01 = decodePng(readFileSync(join(RUN, "frames", "01.png")));
const out01 = decodePng(readFileSync(join(RUN, "composited", "01.png")));
assert("composite: the raw generation is left untouched as provenance", !raw01.data.equals(out01.data) && existsSync(join(RUN, "frames", "01.png")));

writeFileSync(join(RUN, "frames", "03.png"), png(640, 400, 303));
assert("composite: a frame regenerated after marking must be marked again", (runFails("composite", "--run", RUN) ?? "").includes("regenerated after their corners were marked"));
writeCorners([poses[2]]);
run("panel", "submit", "--run", RUN, "--file", cornersFile);
run("composite", "--run", RUN);

assert("judge: informed refuses to open before the blind pass", (runFails("judge", "open", "--phase", "informed", "--run", RUN) ?? "").includes("blind pass has not been submitted"));
run("judge", "open", "--phase", "blind", "--run", RUN);
const key = JSON.parse(readFileSync(join(RUN, "judge", "key.json"), "utf8"));
assert("judge: the blind pass hides the order behind labels", key.pairs.length === 12 && key.pairs.every((p) => existsSync(join(RUN, "judge", "blind", `${p.label}.png`))));
assert("judge: the blind task never names a frame id", !readFileSync(join(RUN, "judge", "blind", "task.md"), "utf8").includes("frames/07"));

const labelsInTruth = key.pairs.slice().sort((a, b) => a.id.localeCompare(b.id)).map((p) => p.label);
const blindFile = join(sandbox, "blind.json");
writeFileSync(blindFile, JSON.stringify({
  order: labelsInTruth,
  frames: key.pairs.map((p) => ({ label: p.label, restriction: "clean", opacity: "in-band", object: "same", constant: "anchored", presence: "traced", evidence: "dim room readable in the panel, one arrow, a mug left beside it" })),
}));
assert("judge: a perfect blind order scores tau 1", run("judge", "submit", "--phase", "blind", "--run", RUN, "--file", blindFile).includes("tau = 1"));

const badFile = join(sandbox, "bad.json");
writeFileSync(badFile, JSON.stringify({
  order: labelsInTruth,
  frames: key.pairs.map((p) => ({ label: p.label, restriction: "fine", opacity: "in-band", object: "same", constant: "anchored", presence: "traced", evidence: "x" })),
}));
assert("judge: an off-enum verdict is refused", (runFails("judge", "submit", "--phase", "blind", "--run", RUN, "--file", badFile) ?? "").includes("restriction must be one of"));

const noEvidence = join(sandbox, "noev.json");
writeFileSync(noEvidence, JSON.stringify({
  order: labelsInTruth,
  frames: key.pairs.map((p) => ({ label: p.label, restriction: "clean", opacity: "in-band", object: "same", constant: "anchored", presence: "traced", evidence: "" })),
}));
assert("judge: a level with no evidence is refused", (runFails("judge", "submit", "--phase", "blind", "--run", RUN, "--file", noEvidence) ?? "").includes("no evidence"));

const noOpacity = join(sandbox, "noop.json");
writeFileSync(noOpacity, JSON.stringify({
  order: labelsInTruth,
  frames: key.pairs.map((p) => ({ label: p.label, restriction: "clean", constant: "anchored", presence: "traced", evidence: "a dim room in the panel" })),
}));
const noOpacityOut = runFails("judge", "submit", "--phase", "blind", "--run", RUN, "--file", noOpacity) ?? "";
assert("judge: a blind verdict with no opacity level is refused", noOpacityOut.includes("opacity must be one of"));
assert("judge: a blind verdict with no object level is refused", noOpacityOut.includes("object must be one of"));

// One frame outside the reflectivity band, so score has to propose it.
const mirroredLabel = key.pairs.find((p) => p.id === "02").label;
const withMirror = join(sandbox, "mirror.json");
writeFileSync(withMirror, JSON.stringify({
  order: labelsInTruth,
  frames: key.pairs.map((p) => ({
    label: p.label,
    restriction: "clean",
    opacity: p.label === mirroredLabel ? "too-mirrored" : "in-band",
    object: "same",
    constant: "anchored",
    presence: "traced",
    evidence: p.label === mirroredLabel ? "the window frame reads crisply in the panel, as in a mirror" : "a dim room in the panel",
  })),
}));
run("judge", "submit", "--phase", "blind", "--run", RUN, "--file", withMirror);

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
assert("score: a panel outside the band becomes a proposal", verdicts.proposals.some((p) => p.id === "02" && p.reason.includes("clean mirror")));
assert("score: the tally counts the out-of-band panel", verdicts.tally.opacity_too_mirrored === 1 && verdicts.tally.opacity_too_matte === 0);
const metricsLines = readFileSync(join(sandbox, "root", "metrics.jsonl"), "utf8").trim().split("\n");
assert("score: appends one metrics line", metricsLines.length >= 1);
const metrics = JSON.parse(metricsLines[metricsLines.length - 1]);
assert("score: the metrics line records how far the laptop travelled", metrics.places === 6 && metrics.scales === 4 && metrics.views === 5);
assert("score: the metrics line records the cursor's anchor and its size range", metrics.cursor.anchor.join() === "1080,410" && metrics.cursor.px_min >= MIN_CURSOR_PX && metrics.cursor.px_max > metrics.cursor.px_min);

const OUT = join(sandbox, "delivery");
run("export", "--run", RUN, "--to", OUT);
assert("export: the deliverable carries frames, report and verdicts", existsSync(join(OUT, "frames", "01.png")) && existsSync(join(OUT, "report.md")) && existsSync(join(OUT, "verdicts.json")));
assert("export: the delivered frame is the composited one", readFileSync(join(OUT, "frames", "01.png")).equals(readFileSync(join(RUN, "composited", "01.png"))));
assert("export: raw generations, corners and the composite manifest travel with it",
  existsSync(join(OUT, "raw", "01.png")) && existsSync(join(OUT, "panels.json")) && existsSync(join(OUT, "composite.json")));

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
  "guard: seals the composited frames while the blind pass is open",
  guard("judging-blind", { file_path: join(guardRun, "composited", "07.png") }).includes('"deny"'),
);
assert(
  "guard: seals the panel corners while the blind pass is open",
  guard("judging-blind", { file_path: join(guardRun, "panels", "panels.json") }).includes('"deny"'),
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

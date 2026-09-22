#!/usr/bin/env node
// still-cursor-living-day — the collection's procedure.
//
// What is judgment stays in SKILL.md and in the model: what a frame shows, what
// the day is doing at 14:20, whether a reflection reads as a person who has been
// sitting there for nine hours. What is procedure lives here: proving the plan
// obeys the axis, proving a frame carries a continuity transition, launching
// twelve generations in parallel, verifying twelve files actually landed,
// shuffling them so the judge cannot read the order off a filename, and the
// arithmetic that turns verdicts into a scorecard.
//
// Node ESM, standard library only, runs from a plugin install path.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AXIS = "still-cursor-living-day";
const FRAME_COUNT = 12;
const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// SCLD_ROOT exists so the test suite does not append to the metrics history
// that skills-evaluate reads. Runs use the OS temp dir.
const ROOT = process.env.SCLD_ROOT ? resolve(process.env.SCLD_ROOT) : join(tmpdir(), AXIS);
const IDS = Array.from({ length: FRAME_COUNT }, (_, i) => String(i + 1).padStart(2, "0"));
const LABELS = "ABCDEFGHIJKL".split("");

// The Restriction, as tokens. A prompt carrying one of these asks the generator
// for a lit display or a staged scene, which is the one thing the axis forbids.
const FORBIDDEN = [
  "wallpaper", "desktop icon", "taskbar", "task bar", "menu bar", "notification",
  "tooltip", "dialog box", "login screen", "blue screen", "glowing screen",
  "backlit screen", "screen glow", "lit display", "screen light", "monitor light",
  "ui element", "user interface", "open window on the screen", "application window",
  "browser window", "studio light", "softbox", "ring light", "key light",
  "three-point lighting", "selfie", "posing", "posed smile", "looking into the camera",
  "looking at the camera", "smiling at the camera",
];

// Ambiguous by nature: a room has windows and lamps, and the axis lives or dies
// on which kind you meant. Never refused, always raised at the gate.
const AMBIGUOUS = ["window", "lamp", "bulb", "led", "neon", "phone", "tablet", "television", "tv "];

const VERDICT_ENUMS = {
  restriction: ["clean", "suspect", "violated"],
  constant: ["anchored", "drifted", "absent"],
  chronology: ["in-line", "ambiguous", "out-of-line"],
  presence: ["traced", "sterile"],
};
const INFORMED_ENUMS = { continuity: ["consistent", "broken"] };
const COLLECTION_ENUMS = { shape: ["collection", "batch"] };

// ---------------------------------------------------------------- utilities

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    die(`${path} is not readable JSON: ${err.message}`);
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i += 1;
      }
    } else out._.push(a);
  }
  return out;
}

function runDir(args) {
  const dir = args.run ?? process.env.SCLD_RUN;
  if (!dir) die("--run <dir> is required (or set SCLD_RUN).");
  return resolve(String(dir));
}

const P = (dir) => ({
  plan: join(dir, "plan.json"),
  routes: join(dir, "routes.json"),
  approval: join(dir, "approval.json"),
  state: join(dir, "state.json"),
  prompts: join(dir, "prompts"),
  frames: join(dir, "frames"),
  logs: join(dir, "logs"),
  judge: join(dir, "judge"),
  key: join(dir, "judge", "key.json"),
  verdicts: join(dir, "verdicts.json"),
  report: join(dir, "report.md"),
  metrics: join(ROOT, "metrics.jsonl"),
});

function loadState(dir) {
  return readJson(P(dir).state, { phase: "planning", frames: {}, started: null });
}

function saveState(dir, state) {
  state.updated = new Date().toISOString();
  writeJson(P(dir).state, state);
}

function planHash(plan) {
  return sha256(Buffer.from(JSON.stringify(plan))).slice(0, 16);
}

function loadPlan(dir) {
  const plan = readJson(P(dir).plan);
  if (!plan) die(`No plan.json in ${dir}. Run \`init\` first.`);
  return plan;
}

// Deterministic shuffle: the same run always produces the same blind order, so a
// re-opened blind pass cannot be gamed by reshuffling until the labels look easy.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, seedText) {
  const seed = parseInt(sha256(Buffer.from(seedText)).slice(0, 8), 16);
  const rnd = mulberry32(seed);
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ------------------------------------------------------- image file evidence

// A generator that wrote a JSON error page to frames/07.png is a generator that
// produced nothing, and the only way to know is to read the bytes.
function inspectImage(path) {
  const buf = readFileSync(path);
  if (buf.length === 0) return { ok: false, reason: "empty file" };
  const hex = buf.subarray(0, 12);
  if (hex.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return {
      ok: true, format: "png", bytes: buf.length,
      width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), hash: sha256(buf),
    };
  }
  if (hex[0] === 0xff && hex[1] === 0xd8 && hex[2] === 0xff) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) { off += 1; continue; }
      const marker = buf[off + 1];
      const len = buf.readUInt16BE(off + 2);
      const isSOF = marker >= 0xc0 && marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSOF) {
        return {
          ok: true, format: "jpeg", bytes: buf.length,
          height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7), hash: sha256(buf),
        };
      }
      off += 2 + len;
    }
    return { ok: true, format: "jpeg", bytes: buf.length, width: 0, height: 0, hash: sha256(buf) };
  }
  if (hex.subarray(0, 4).toString("ascii") === "RIFF" && hex.subarray(8, 12).toString("ascii") === "WEBP") {
    return { ok: true, format: "webp", bytes: buf.length, width: 0, height: 0, hash: sha256(buf) };
  }
  return { ok: false, reason: `not a PNG, JPEG or WebP (starts with ${hex.subarray(0, 4).toString("hex")})` };
}

function framePath(dir, id) {
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const p = join(P(dir).frames, `${id}.${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

// ------------------------------------------------------------------- routes

// A route is eligible only when it can produce an image. `probed` means this
// machine proved it (a key is present, a binary is on PATH); `declared` means a
// CLI child is being asked to reach an image model it may or may not hold —
// honest, because collect will prove it either way.
function probeRoutes() {
  const routes = [];
  const cliTargets = [
    { id: "cli:codex", bin: "codex", argv: ["exec"] },
    { id: "cli:gemini", bin: "gemini", argv: ["-p"] },
    { id: "cli:antigravity", bin: "agy", argv: ["--prompt"] },
  ];
  for (const t of cliTargets) {
    const found = onPath(t.bin);
    routes.push({
      id: t.id, kind: "cli", bin: t.bin,
      argv: envArgv(t.bin) ?? t.argv,
      capability: found ? "declared" : "absent",
      note: found
        ? `${t.bin} is on PATH; it must reach an image model itself and write the file it is told to write`
        : `${t.bin} is not on PATH`,
    });
  }
  const apis = [
    { id: "api:openai", env: ["OPENAI_API_KEY"], model: process.env.SCLD_OPENAI_MODEL ?? "gpt-image-1" },
    { id: "api:gemini", env: ["GEMINI_API_KEY", "GOOGLE_API_KEY"], model: process.env.SCLD_GEMINI_MODEL ?? "gemini-2.5-flash-image" },
  ];
  for (const a of apis) {
    const key = a.env.find((e) => process.env[e]);
    routes.push({
      id: a.id, kind: "api", model: a.model, key_env: key ?? a.env[0],
      capability: key ? "probed" : "absent",
      note: key ? `key in $${key}, model ${a.model}` : `set $${a.env.join(" or $")}`,
    });
  }
  routes.push({
    id: "manual", kind: "manual", capability: "probed",
    note: "prompts are written to disk; you drop the files at the paths collect expects",
  });
  return routes;
}

function envArgv(bin) {
  const raw = process.env[`SCLD_CLI_${bin.toUpperCase()}_ARGV`];
  return raw ? raw.split(" ").filter(Boolean) : null;
}

function onPath(bin) {
  const r = spawnSync("command", ["-v", bin], { encoding: "utf8", shell: true });
  return r.status === 0 && String(r.stdout).trim().length > 0;
}

// ------------------------------------------------ the axis contract, as code

function clockMinutes(clock) {
  const m = /^([0-2]\d):([0-5]\d)$/.exec(String(clock ?? ""));
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  return h * 60 + Number(m[2]);
}

// Object transitions are the spine of the collection. A frame that moves no
// object is a frame you can delete without anyone noticing — which is the whole
// of the "it's a batch" attack, answered arithmetically instead of rhetorically.
function transitions(plan) {
  const byObject = new Map();
  plan.frames.forEach((frame, i) => {
    for (const trace of frame.traces ?? []) {
      const key = String(trace.object ?? "").trim().toLowerCase();
      if (!key) continue;
      if (!byObject.has(key)) byObject.set(key, []);
      byObject.get(key).push({ i, state: String(trace.state ?? "").trim().toLowerCase() });
    }
  });
  const links = [];
  for (const [object, seq] of byObject) {
    for (let k = 1; k < seq.length; k += 1) {
      if (seq[k].state !== seq[k - 1].state) {
        links.push({ object, from: seq[k - 1].i, to: seq[k].i, state: seq[k].state });
      }
    }
  }
  return links;
}

function breakage(plan) {
  const links = transitions(plan);
  const per = plan.frames.map(() => 0);
  for (const l of links) {
    per[l.from] += 1;
    per[l.to] += 1;
  }
  const windows = [];
  for (let start = 0; start + 4 <= plan.frames.length; start += 1) {
    const inWindow = (i) => i >= start && i < start + 4;
    windows.push({
      start,
      destroyed: links.filter((l) => inWindow(l.from) || inWindow(l.to)).length,
    });
  }
  return { links, per, windows };
}

function lexicon(text) {
  const low = String(text).toLowerCase();
  return {
    forbidden: FORBIDDEN.filter((t) => low.includes(t)),
    ambiguous: AMBIGUOUS.filter((t) => low.includes(t)),
  };
}

function validate(plan, routes) {
  const errors = [];
  const warnings = [];
  const byRoute = new Map((routes ?? []).map((r) => [r.id, r]));

  if (plan.axis !== AXIS) errors.push(`plan.axis must be "${AXIS}", got ${JSON.stringify(plan.axis)}`);
  if (!Array.isArray(plan.frames) || plan.frames.length !== FRAME_COUNT) {
    errors.push(`plan.frames must hold exactly ${FRAME_COUNT} frames, got ${plan.frames?.length ?? 0}`);
    return { errors, warnings, breaks: null };
  }

  const cursor = String(plan.invariants?.cursor_clause ?? "");
  const surface = String(plan.invariants?.surface_clause ?? "");
  if (cursor.trim().length < 30) errors.push("invariants.cursor_clause is missing or too short to pin a coordinate — that clause is The Constant.");
  if (surface.trim().length < 30) errors.push("invariants.surface_clause is missing or too short — that clause is The Restriction.");

  let previous = null;
  plan.frames.forEach((frame, i) => {
    const id = frame.id ?? `#${i + 1}`;
    const at = `frame ${id}`;
    if (frame.id !== IDS[i]) errors.push(`${at}: id must be "${IDS[i]}" (frames are ordered and ids are positions).`);
    if (frame.cursor_clause || frame.surface_clause) {
      errors.push(`${at}: carries its own cursor/surface clause. The Constant is plan-level and identical in all ${FRAME_COUNT} frames.`);
    }

    const minutes = clockMinutes(frame.clock);
    if (minutes === null) errors.push(`${at}: clock must be "HH:MM", got ${JSON.stringify(frame.clock)}.`);
    else if (previous !== null && minutes <= previous) {
      errors.push(`${at}: clock ${frame.clock} does not advance past the previous frame. The Variable is one day moving forward.`);
    } else if (minutes !== null) previous = minutes;

    for (const field of ["room", "light", "human", "prompt"]) {
      const value = String(frame[field] ?? "").trim();
      if (!value || value === "TODO") errors.push(`${at}: ${field} is empty or still TODO.`);
    }

    const prompt = String(frame.prompt ?? "");
    if (cursor.length >= 30 && !prompt.includes(cursor)) {
      errors.push(`${at}: prompt does not carry invariants.cursor_clause verbatim.`);
    }
    if (surface.length >= 30 && !prompt.includes(surface)) {
      errors.push(`${at}: prompt does not carry invariants.surface_clause verbatim.`);
    }
    // The invariant clauses name the forbidden things in order to negate them,
    // so they are stripped before the lexicon runs. Per-frame text must not
    // repeat the negations: a frame that says "no glowing screen" is scanned.
    const body = prompt.split(cursor).join(" ").split(surface).join(" ");
    const hits = lexicon(body);
    for (const token of hits.forbidden) {
      errors.push(`${at}: prompt says "${token}" outside the invariant clause. The Restriction forbids any lit pixel outside the cursor and any staged light — and its negations belong in invariants.surface_clause, not repeated per frame.`);
    }
    for (const token of hits.ambiguous) {
      warnings.push(`${at}: prompt says "${token.trim()}" — a room window and lamp are the axis; a screen or a second lit device is not. Resolve at the gate.`);
    }

    const traces = Array.isArray(frame.traces) ? frame.traces : [];
    if (!traces.length) errors.push(`${at}: no traces. A room with no object left behind is the sterile catalogue frame the axis discards.`);
    if (traces.length && !traces.some((t) => String(t.state ?? "").trim().toLowerCase() !== "absent")) {
      errors.push(`${at}: every trace is "absent" — nothing in the room says a person was recently here.`);
    }

    const routeId = String(frame.route ?? "");
    const route = byRoute.get(routeId);
    if (!routes) errors.push(`${at}: routes.json is missing. Run \`probe\` before \`route\`.`);
    else if (!route) errors.push(`${at}: route ${JSON.stringify(routeId)} is not a known route. Run \`probe\` to list them.`);
    else if (route.capability === "absent") {
      errors.push(`${at}: route ${routeId} cannot generate an image here (${route.note}). A route without image-generation is refused, never silently downgraded to a text agent.`);
    } else if (route.capability === "declared") {
      warnings.push(`${at}: route ${routeId} is declared, not probed — ${route.note}. collect will prove it.`);
    }
  });

  const breaks = breakage(plan);
  breaks.per.forEach((count, i) => {
    if (count === 0) {
      errors.push(`frame ${plan.frames[i].id}: no object changes state at this frame. Delete it and the series loses nothing — which is the definition of a batch member.`);
    }
  });
  const weakest = breaks.windows.reduce((a, b) => (b.destroyed < a.destroyed ? b : a), breaks.windows[0]);
  if (weakest && weakest.destroyed === 0) {
    warnings.push(`frames ${plan.frames[weakest.start].id}–${plan.frames[weakest.start + 3].id} can be removed without breaking a single object transition.`);
  }

  return { errors, warnings, breaks };
}

// ------------------------------------------------------------- init / probe

const CURSOR_CLAUSE =
  "a single standard white arrow mouse cursor, monochrome, its tip anchored at exactly 61.5% of the frame width and 43.0% of the frame height, identical in size, angle and position in every image of the series";
const SURFACE_CLAUSE =
  "the computer display is a completely black, non-emitting reflective glass panel: no windows, icons, wallpaper, notifications or interface of any kind, no light leaving the panel, and what is seen on the glass is only the room reflected in it";

function cmdInit(args) {
  const id = args.id ? String(args.id) : new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
  const dir = args.run ? resolve(String(args.run)) : join(ROOT, id);
  if (existsSync(P(dir).plan) && !args.force) die(`${dir} already holds a plan.json. Pass --force to overwrite it.`);
  for (const sub of ["prompts", "frames", "logs", "judge"]) mkdirSync(join(dir, sub), { recursive: true });

  const frames = IDS.map((frameId) => ({
    id: frameId,
    clock: "TODO",
    room: "TODO",
    light: "TODO",
    human: "TODO",
    traces: [{ object: "TODO", state: "TODO" }],
    route: "manual",
    prompt: "TODO",
  }));
  writeJson(P(dir).plan, {
    axis: AXIS,
    frame_count: FRAME_COUNT,
    invariants: { cursor_clause: CURSOR_CLAUSE, surface_clause: SURFACE_CLAUSE },
    frames,
  });
  saveState(dir, { phase: "planning", frames: {}, started: new Date().toISOString() });
  console.log(`run: ${dir}`);
  console.log(`plan: ${P(dir).plan} — ${FRAME_COUNT} frames, every field TODO.`);
  console.log("The two invariant clauses are already written and are the same in all twelve; every prompt must carry them verbatim.");
  console.log(`next: node ${join(SKILL_DIR, "scripts", "collection.mjs")} probe --run ${dir}`);
}

function cmdProbe(args) {
  const dir = runDir(args);
  const routes = probeRoutes();
  writeJson(P(dir).routes, { probed: new Date().toISOString(), routes });
  const rows = routes.map((r) => `  ${r.capability === "absent" ? "·" : "✓"} ${r.id.padEnd(16)} ${r.capability.padEnd(9)} ${r.note}`);
  console.log("routes:");
  console.log(rows.join("\n"));
  const usable = routes.filter((r) => r.capability !== "absent");
  console.log(`\n${usable.length} usable route(s). "declared" means the binary exists and must reach an image model itself; collect is what proves it did.`);
}

// ---------------------------------------------------------- route / approve

function cmdRoute(args) {
  const dir = runDir(args);
  const plan = loadPlan(dir);
  const routesFile = readJson(P(dir).routes);
  const { errors, warnings, breaks } = validate(plan, routesFile?.routes);

  if (breaks) {
    console.log("| Frame | Clock | Route | Moves | Breaks if removed |");
    console.log("|---|---|---|---|---|");
    plan.frames.forEach((f, i) => {
      const moved = (f.traces ?? []).map((t) => t.object).join(", ");
      console.log(`| ${f.id} | ${f.clock} | ${f.route} | ${moved} | ${breaks.per[i]} |`);
    });
    const worst = breaks.windows.reduce((a, b) => (b.destroyed < a.destroyed ? b : a), breaks.windows[0]);
    console.log(`\n${breaks.links.length} object transitions across the series.`);
    if (worst) {
      console.log(`Weakest four-frame window: ${plan.frames[worst.start].id}–${plan.frames[worst.start + 3].id} destroys ${worst.destroyed} transitions.`);
    }
  }

  if (warnings.length) console.log("\nwarnings (raise every one at the gate):\n" + warnings.map((w) => `  ! ${w}`).join("\n"));
  if (errors.length) {
    console.error("\nrefused:\n" + errors.map((e) => `  ✗ ${e}`).join("\n"));
    process.exit(1);
  }

  const hash = planHash(plan);
  console.log(`\nplan accepted. hash ${hash}`);
  if (args.approve) {
    writeJson(P(dir).approval, { hash, approved: new Date().toISOString() });
    const state = loadState(dir);
    state.phase = "approved";
    saveState(dir, state);
    console.log("approved. dispatch will refuse any plan whose hash is not this one.");
  } else {
    console.log("not approved yet. Run the gate with the owner, then re-run with --approve.");
  }
}

function requireApproval(dir, plan) {
  const approval = readJson(P(dir).approval);
  if (!approval) die("This plan was never approved. The twelve frames are gated by the owner before anything is generated.");
  const hash = planHash(plan);
  if (approval.hash !== hash) {
    die(`plan.json changed since approval (approved ${approval.hash}, now ${hash}). Re-run \`route\`, take the changes back to the gate, then \`route --approve\`.`);
  }
}

// ----------------------------------------------------------------- dispatch

function childPrompt(frame, target) {
  return `${frame.prompt}\n\nWrite the generated image to ${target}. Write no other file, and change nothing else on disk.\n`;
}

async function generateApi(route, frame, target, logPath) {
  const key = process.env[route.key_env];
  if (!key) return { ok: false, reason: `$${route.key_env} is not set` };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  const log = (text) => writeFileSync(logPath, text);
  try {
    let res;
    let b64;
    if (route.id === "api:openai") {
      const endpoint = process.env.SCLD_OPENAI_ENDPOINT ?? "https://api.openai.com/v1/images/generations";
      res = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: route.model,
          prompt: frame.prompt,
          n: 1,
          size: process.env.SCLD_IMAGE_SIZE ?? "1536x1024",
        }),
      });
      const text = await res.text();
      log(text.slice(0, 4000));
      if (!res.ok) return { ok: false, reason: `${route.id} HTTP ${res.status}` };
      b64 = JSON.parse(text)?.data?.[0]?.b64_json;
    } else {
      const base = process.env.SCLD_GEMINI_ENDPOINT ?? "https://generativelanguage.googleapis.com/v1beta/models";
      res = await fetch(`${base}/${route.model}:generateContent`, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ parts: [{ text: frame.prompt }] }] }),
      });
      const text = await res.text();
      log(text.slice(0, 4000));
      if (!res.ok) return { ok: false, reason: `${route.id} HTTP ${res.status}` };
      const parts = JSON.parse(text)?.candidates?.[0]?.content?.parts ?? [];
      b64 = parts.find((p) => p.inlineData?.data)?.inlineData?.data;
    }
    if (!b64) return { ok: false, reason: `${route.id} returned no image data (see ${logPath})` };
    writeFileSync(target, Buffer.from(b64, "base64"));
    return { ok: true };
  } catch (err) {
    log(String(err?.message ?? err));
    return { ok: false, reason: `${route.id} ${err?.name === "AbortError" ? "timed out" : String(err?.message ?? err)}` };
  } finally {
    clearTimeout(timer);
  }
}

function generateCli(route, frame, target, logPath, budgetS) {
  return new Promise((done) => {
    const argv = [...route.argv, childPrompt(frame, target)];
    const child = spawn(route.bin, argv, { cwd: dirname(dirname(target)), stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const keep = (chunk) => {
      out += chunk;
      if (out.length > 200000) out = out.slice(-200000);
    };
    child.stdout.on("data", (c) => keep(String(c)));
    child.stderr.on("data", (c) => keep(String(c)));
    const timer = setTimeout(() => child.kill("SIGKILL"), budgetS * 1000);
    child.on("error", (err) => {
      clearTimeout(timer);
      writeFileSync(logPath, String(err?.message ?? err));
      done({ ok: false, reason: `${route.id} failed to launch: ${err?.message ?? err}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      writeFileSync(logPath, out);
      if (!existsSync(target)) done({ ok: false, reason: `${route.id} exited ${code} without writing the file (see ${logPath})` });
      else done({ ok: true });
    });
  });
}

async function pool(items, limit, worker) {
  const queue = items.slice();
  const running = [];
  const results = [];
  while (queue.length || running.length) {
    while (running.length < limit && queue.length) {
      const item = queue.shift();
      const task = worker(item).then((r) => {
        running.splice(running.indexOf(task), 1);
        results.push(r);
      });
      running.push(task);
    }
    if (running.length) await Promise.race(running);
  }
  return results;
}

async function cmdDispatch(args) {
  const dir = runDir(args);
  const plan = loadPlan(dir);
  requireApproval(dir, plan);
  const routesFile = readJson(P(dir).routes);
  const byRoute = new Map((routesFile?.routes ?? []).map((r) => [r.id, r]));
  const only = args.only ? String(args.only).split(",").map((s) => s.trim()) : null;
  const budgetS = Number(args.budget ?? 600);
  const limit = Math.max(1, Number(args.concurrency ?? 4));
  const state = loadState(dir);
  state.phase = "dispatching";
  saveState(dir, state);

  const targets = plan.frames.filter((f) => (!only || only.includes(f.id)));
  for (const frame of targets) {
    writeFileSync(join(P(dir).prompts, `${frame.id}.txt`), frame.prompt + "\n");
  }

  const manual = targets.filter((f) => f.route === "manual");
  const auto = targets.filter((f) => f.route !== "manual");

  const results = await pool(auto, limit, async (frame) => {
    const route = byRoute.get(frame.route);
    const target = join(P(dir).frames, `${frame.id}.png`);
    const logPath = join(P(dir).logs, `${frame.id}.log`);
    if (existsSync(target) && !args.force) return { id: frame.id, ok: true, reason: "already present" };
    const started = Date.now();
    const r = route?.kind === "api"
      ? await generateApi(route, frame, target, logPath)
      : await generateCli(route, frame, target, logPath, budgetS);
    return { id: frame.id, ...r, elapsed_s: Math.round((Date.now() - started) / 1000), route: frame.route };
  });

  results.sort((a, b) => a.id.localeCompare(b.id));
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.id}  ${r.route ?? ""}  ${r.ok ? `${r.elapsed_s ?? 0}s` : r.reason}`);
  }
  if (manual.length) {
    console.log("\nmanual route — generate these yourself and drop the files exactly here:");
    for (const f of manual) {
      console.log(`  ${f.id}  prompt ${join(P(dir).prompts, `${f.id}.txt`)}  →  ${join(P(dir).frames, `${f.id}.png`)}`);
    }
  }
  const after = loadState(dir);
  for (const r of results) after.frames[r.id] = { ...(after.frames[r.id] ?? {}), dispatch: r.ok ? "done" : "failed", reason: r.reason ?? null, route: r.route };
  after.phase = "dispatched";
  saveState(dir, after);
  console.log(`\nnext: collect --run ${dir}`);
}

// ------------------------------------------------------------------ collect

function cmdCollect(args) {
  const dir = runDir(args);
  const plan = loadPlan(dir);
  const state = loadState(dir);
  const seen = new Map();
  const rows = [];
  let ready = 0;

  for (const frame of plan.frames) {
    const path = framePath(dir, frame.id);
    if (!path) {
      rows.push({ id: frame.id, ok: false, reason: "no file" });
      state.frames[frame.id] = { ...(state.frames[frame.id] ?? {}), artifact: "missing" };
      continue;
    }
    const info = inspectImage(path);
    if (!info.ok) {
      rows.push({ id: frame.id, ok: false, reason: info.reason });
      state.frames[frame.id] = { ...(state.frames[frame.id] ?? {}), artifact: "invalid", reason: info.reason };
      continue;
    }
    const twin = seen.get(info.hash);
    if (twin) {
      rows.push({ id: frame.id, ok: false, reason: `byte-identical to frame ${twin}` });
      state.frames[frame.id] = { ...(state.frames[frame.id] ?? {}), artifact: "duplicate", reason: `same bytes as ${twin}` };
      continue;
    }
    seen.set(info.hash, frame.id);
    rows.push({ id: frame.id, ok: true, ...info, path });
    state.frames[frame.id] = { ...(state.frames[frame.id] ?? {}), artifact: "ready", format: info.format, bytes: info.bytes, width: info.width, height: info.height, hash: info.hash };
    ready += 1;
  }

  // The Constant is a coordinate. A frame in another aspect ratio puts the
  // cursor somewhere else in the room, whatever the prompt asked for.
  const geometries = new Map();
  for (const r of rows.filter((r) => r.ok && r.width)) {
    const key = `${r.width}x${r.height}`;
    geometries.set(key, (geometries.get(key) ?? 0) + 1);
  }
  const dominant = [...geometries.entries()].sort((a, b) => b[1] - a[1])[0];
  for (const r of rows.filter((r) => r.ok && r.width)) {
    if (dominant && `${r.width}x${r.height}` !== dominant[0]) {
      r.ok = false;
      r.reason = `geometry ${r.width}x${r.height} differs from the series (${dominant[0]}) — the cursor coordinate is not comparable`;
      state.frames[r.id].artifact = "off-geometry";
      state.frames[r.id].reason = r.reason;
      ready -= 1;
    }
  }

  for (const r of rows) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.id}  ${r.ok ? `${r.format} ${r.width}x${r.height} ${Math.round(r.bytes / 1024)}KB` : r.reason}`);
  }
  state.phase = ready === FRAME_COUNT ? "collected" : "dispatched";
  saveState(dir, state);
  console.log(`\n${ready}/${FRAME_COUNT} frames ready.`);
  if (ready !== FRAME_COUNT) {
    console.log("Re-dispatch the missing ids (`dispatch --only 03,07 --force`) before judging. A judge that grades eleven frames is grading a different collection.");
    process.exit(1);
  }
  console.log(`next: judge open --phase blind --run ${dir}`);
}

// -------------------------------------------------------------------- judge

function kendallTau(order, truth) {
  const rank = new Map(truth.map((v, i) => [v, i]));
  const seq = order.map((v) => rank.get(v));
  let inversions = 0;
  for (let i = 0; i < seq.length; i += 1) {
    for (let j = i + 1; j < seq.length; j += 1) if (seq[i] > seq[j]) inversions += 1;
  }
  const pairs = (seq.length * (seq.length - 1)) / 2;
  return Number((1 - (2 * inversions) / pairs).toFixed(3));
}

function cmdJudgeOpen(args) {
  const dir = runDir(args);
  const phase = String(args.phase ?? "");
  const plan = loadPlan(dir);
  const state = loadState(dir);
  const judging = join(SKILL_DIR, "references", "judging.md");

  if (phase === "blind") {
    const blindDir = join(P(dir).judge, "blind");
    mkdirSync(blindDir, { recursive: true });
    const pairs = shuffled(plan.frames.map((f) => f.id), dir).map((id, i) => ({ label: LABELS[i], id }));
    for (const pair of pairs) {
      const src = framePath(dir, pair.id);
      if (!src) die(`frame ${pair.id} has no file. Run \`collect\` — the blind pass needs all ${FRAME_COUNT}.`);
      copyFileSync(src, join(blindDir, `${pair.label}.${src.split(".").pop()}`));
    }
    writeJson(P(dir).key, { pairs });
    const task = [
      "# Blind pass",
      "",
      `Twelve images sit in \`${blindDir}\`, labelled A to L in an order that is not their order.`,
      "You have not seen the prompts and you will not be given them in this pass. Judge the artefacts, never the intention.",
      "",
      "## The axis you are judging against",
      "",
      `- **The Restriction**: ${plan.invariants.surface_clause}`,
      `- **The Constant**: ${plan.invariants.cursor_clause}`,
      "- **The Variable**: one day passing, read from ambient light, from the room, and from the traces a person left behind.",
      "- **The Discard**: any lit pixel outside the cursor; any posed or selfie-like reflection; any room with no trace of recent human presence.",
      "",
      `Full rubric, with what counts as evidence for each level: \`${judging}\``,
      "",
      "## What to return",
      "",
      "Write a JSON file and hand its path to `judge submit --phase blind --file <path>`:",
      "",
      "```json",
      JSON.stringify({
        order: ["<label earliest in the day>", "…", "<label latest in the day>"],
        frames: [{ label: "A", restriction: "clean", constant: "anchored", presence: "traced", evidence: "what you actually saw, naming the thing you saw" }],
      }, null, 2),
      "```",
      "",
      `\`order\` is all twelve labels, earliest to latest. Ordering them is the test: if the day does not read from the images alone, the Variable is not working, and the run's tau will say so.`,
      "Every frame needs an `evidence` sentence naming what you saw. A level without evidence is an opinion.",
    ].join("\n");
    writeFileSync(join(blindDir, "task.md"), task + "\n");
    state.phase = "judging-blind";
    saveState(dir, state);
    console.log(`blind pass open: ${join(blindDir, "task.md")}`);
    console.log(`Give that file to a fresh agent. Do not open ${P(dir).key} — the guard hook will refuse it while this phase is live.`);
    return;
  }

  if (phase === "informed") {
    const blind = readJson(join(P(dir).judge, "blind.verdicts.json"));
    if (!blind) die("The blind pass has not been submitted. It runs first, on purpose: an informed judge cannot un-know the order.");
    const infDir = join(P(dir).judge, "informed");
    mkdirSync(infDir, { recursive: true });
    const links = transitions(plan);
    const table = plan.frames.map((f, i) => {
      const moved = links.filter((l) => l.to === i).map((l) => `${l.object} → ${l.state}`).join("; ") || "—";
      return `| ${f.id} | ${f.clock} | ${framePath(dir, f.id)} | ${moved} |`;
    });
    const task = [
      "# Informed pass",
      "",
      "You now see the intended chronology and the trace chain. Two questions only, and both are about the series rather than any single image.",
      "",
      "| Frame | Clock | File | Objects that change state here |",
      "|---|---|---|---|",
      ...table,
      "",
      `Rubric: \`${judging}\``,
      "",
      "## What to return",
      "",
      "```json",
      JSON.stringify({
        frames: [{ id: "01", chronology: "in-line", continuity: "consistent", evidence: "…" }],
        collection: {
          shape: "collection",
          link_3_to_9: "the one sentence that ties frame 03 to frame 09 through cause and effect, not through the clock",
          four_deleted: "what is lost if frames 05 to 08 are deleted — name the object chain and the light that break",
          discard_proposals: [{ id: "07", reason: "…", proposal: "regenerate" }],
        },
      }, null, 2),
      "```",
      "",
      "`shape` is `collection` only if the series survives both questions. `discard_proposals` are proposals: you do not delete, regenerate or edit anything. The owner decides.",
    ].join("\n");
    writeFileSync(join(infDir, "task.md"), task + "\n");
    state.phase = "judging-informed";
    saveState(dir, state);
    console.log(`informed pass open: ${join(infDir, "task.md")}`);
    return;
  }

  die("--phase must be blind or informed.");
}

function checkEnums(entry, enums, where, errors) {
  for (const [field, allowed] of Object.entries(enums)) {
    const value = entry[field];
    if (!allowed.includes(value)) {
      errors.push(`${where}: ${field} must be one of ${allowed.join(" | ")}, got ${JSON.stringify(value)}`);
    }
  }
  if (!String(entry.evidence ?? "").trim()) errors.push(`${where}: no evidence sentence.`);
}

function cmdJudgeSubmit(args) {
  const dir = runDir(args);
  const phase = String(args.phase ?? "");
  const file = args.file ? resolve(String(args.file)) : die("--file <path to the judge's JSON> is required.");
  const submitted = readJson(file);
  if (!submitted) die(`${file} is not readable JSON.`);
  const plan = loadPlan(dir);
  const state = loadState(dir);
  const errors = [];

  if (phase === "blind") {
    const key = readJson(P(dir).key);
    if (!key) die("No judge/key.json — open the blind pass first.");
    const labels = key.pairs.map((p) => p.label);
    const order = Array.isArray(submitted.order) ? submitted.order.map(String) : [];
    if (new Set(order).size !== FRAME_COUNT || !order.every((l) => labels.includes(l))) {
      errors.push(`order must be all ${FRAME_COUNT} labels (${labels.join(", ")}) exactly once.`);
    }
    const byLabel = new Map((submitted.frames ?? []).map((f) => [String(f.label), f]));
    for (const label of labels) {
      const entry = byLabel.get(label);
      if (!entry) { errors.push(`frames: label ${label} is missing.`); continue; }
      checkEnums(entry, { restriction: VERDICT_ENUMS.restriction, constant: VERDICT_ENUMS.constant, presence: VERDICT_ENUMS.presence }, `label ${label}`, errors);
    }
    if (errors.length) { console.error("refused:\n" + errors.map((e) => `  ✗ ${e}`).join("\n")); process.exit(1); }

    const toId = new Map(key.pairs.map((p) => [p.label, p.id]));
    const truthLabels = key.pairs.slice().sort((a, b) => a.id.localeCompare(b.id)).map((p) => p.label);
    const resolved = {
      tau: kendallTau(order, truthLabels),
      guessed_order: order.map((l) => toId.get(l)),
      frames: labels.map((l) => ({ id: toId.get(l), label: l, ...byLabel.get(l) })).sort((a, b) => a.id.localeCompare(b.id)),
    };
    writeJson(join(P(dir).judge, "blind.verdicts.json"), resolved);
    state.phase = "judged-blind";
    saveState(dir, state);
    console.log(`blind verdicts recorded. ordering tau = ${resolved.tau} (1.0 = the day read perfectly from the images, 0 = no better than chance).`);
    console.log(`next: judge open --phase informed --run ${dir}`);
    return;
  }

  if (phase === "informed") {
    const byId = new Map((submitted.frames ?? []).map((f) => [String(f.id), f]));
    for (const frame of plan.frames) {
      const entry = byId.get(frame.id);
      if (!entry) { errors.push(`frames: ${frame.id} is missing.`); continue; }
      checkEnums(entry, { chronology: VERDICT_ENUMS.chronology, continuity: INFORMED_ENUMS.continuity }, `frame ${frame.id}`, errors);
    }
    const collection = submitted.collection ?? {};
    if (!COLLECTION_ENUMS.shape.includes(collection.shape)) errors.push(`collection.shape must be collection | batch, got ${JSON.stringify(collection.shape)}`);
    for (const field of ["link_3_to_9", "four_deleted"]) {
      if (String(collection[field] ?? "").trim().length < 20) errors.push(`collection.${field} is empty or a stub — that answer is the series' defence.`);
    }
    if (errors.length) { console.error("refused:\n" + errors.map((e) => `  ✗ ${e}`).join("\n")); process.exit(1); }
    writeJson(join(P(dir).judge, "informed.verdicts.json"), submitted);
    state.phase = "judged";
    saveState(dir, state);
    console.log(`informed verdicts recorded. shape = ${collection.shape}.`);
    console.log(`next: score --run ${dir}`);
    return;
  }

  die("--phase must be blind or informed.");
}

// ------------------------------------------------------------ score / close

function cmdScore(args) {
  const dir = runDir(args);
  const plan = loadPlan(dir);
  const blind = readJson(join(P(dir).judge, "blind.verdicts.json"));
  const informed = readJson(join(P(dir).judge, "informed.verdicts.json"));
  if (!blind || !informed) die("Both judge passes must be submitted before scoring.");
  const state = loadState(dir);
  const breaks = breakage(plan);

  const blindById = new Map(blind.frames.map((f) => [f.id, f]));
  const infById = new Map((informed.frames ?? []).map((f) => [String(f.id), f]));
  const count = (pick, value) => plan.frames.filter((f) => pick(f.id) === value).length;
  const b = (id) => blindById.get(id) ?? {};
  const inf = (id) => infById.get(id) ?? {};

  const tally = {
    restriction_violated: count((id) => b(id).restriction, "violated"),
    restriction_suspect: count((id) => b(id).restriction, "suspect"),
    constant_absent: count((id) => b(id).constant, "absent"),
    constant_drifted: count((id) => b(id).constant, "drifted"),
    presence_sterile: count((id) => b(id).presence, "sterile"),
    chronology_out: count((id) => inf(id).chronology, "out-of-line"),
    chronology_ambiguous: count((id) => inf(id).chronology, "ambiguous"),
    continuity_broken: count((id) => inf(id).continuity, "broken"),
  };

  const proposals = [];
  const add = (id, reason, proposal) => proposals.push({ id, reason, proposal });
  for (const frame of plan.frames) {
    const id = frame.id;
    if (b(id).restriction === "violated") add(id, "a lit pixel or interface element outside the cursor", "regenerate");
    else if (b(id).restriction === "suspect") add(id, "the judge could not rule out emitted light", "owner looks");
    if (b(id).constant === "absent") add(id, "no cursor on the glass", "regenerate");
    else if (b(id).constant === "drifted") add(id, "the cursor moved off the series coordinate", "regenerate");
    if (b(id).presence === "sterile") add(id, "no trace of a person having been there", "regenerate");
    if (inf(id).chronology === "out-of-line") add(id, "the image does not sit at the hour it claims", "owner looks");
    if (inf(id).continuity === "broken") add(id, "the trace chain does not survive this frame", "owner looks");
  }
  for (const p of informed.collection?.discard_proposals ?? []) {
    add(String(p.id), String(p.reason ?? "judge's own proposal"), String(p.proposal ?? "owner looks"));
  }

  const clean = plan.frames.filter((f) => !proposals.some((p) => p.id === f.id)).length;
  const report = [
    `# ${AXIS} — run ${basename(dir)}`,
    "",
    `Twelve frames, ${breaks.links.length} object transitions, generated through ${[...new Set(plan.frames.map((f) => f.route))].join(", ")}.`,
    "",
    "## The axis",
    "",
    `- **Restriction**: ${plan.invariants.surface_clause}`,
    `- **Constant**: ${plan.invariants.cursor_clause}`,
    "",
    "## Judge",
    "",
    `- Blind ordering fidelity (Kendall tau): **${blind.tau}**. The judge's order: ${blind.guessed_order.join(" → ")}.`,
    `- Collection shape: **${informed.collection?.shape ?? "?"}**`,
    `- Frame 03 → frame 09: ${informed.collection?.link_3_to_9 ?? "—"}`,
    `- If four are deleted: ${informed.collection?.four_deleted ?? "—"}`,
    "",
    "| Tally | Frames |",
    "|---|---|",
    ...Object.entries(tally).map(([k, v]) => `| ${k.replace(/_/g, " ")} | ${v} |`),
    `| untouched by any proposal | ${clean} |`,
    "",
    "## Proposals — the owner decides, nothing was regenerated",
    "",
    proposals.length ? "| Frame | Reason | Proposal |\n|---|---|---|" : "_None. Every frame cleared every pillar._",
    ...proposals.map((p) => `| ${p.id} | ${p.reason} | ${p.proposal} |`),
    "",
    "## Per-frame",
    "",
    "| Frame | Clock | Route | Restriction | Constant | Presence | Chronology | Continuity |",
    "|---|---|---|---|---|---|---|---|",
    ...plan.frames.map((f) => `| ${f.id} | ${f.clock} | ${f.route} | ${b(f.id).restriction ?? "—"} | ${b(f.id).constant ?? "—"} | ${b(f.id).presence ?? "—"} | ${inf(f.id).chronology ?? "—"} | ${inf(f.id).continuity ?? "—"} |`),
    "",
  ].join("\n");
  writeFileSync(P(dir).report, report);

  writeJson(P(dir).verdicts, {
    run: basename(dir), axis: AXIS, tau: blind.tau,
    shape: informed.collection?.shape ?? null, tally, proposals,
    frames: plan.frames.map((f) => ({ id: f.id, clock: f.clock, route: f.route, ...b(f.id), ...inf(f.id) })),
  });

  mkdirSync(ROOT, { recursive: true });
  const started = state.started ? Date.parse(state.started) : null;
  const metrics = {
    skill: AXIS,
    run: basename(dir),
    at: new Date().toISOString(),
    frames: FRAME_COUNT,
    routes: plan.frames.reduce((acc, f) => ({ ...acc, [f.route]: (acc[f.route] ?? 0) + 1 }), {}),
    transitions: breaks.links.length,
    weakest_window: breaks.windows.reduce((a, b2) => (b2.destroyed < a.destroyed ? b2 : a), breaks.windows[0])?.destroyed ?? null,
    tau: blind.tau,
    shape: informed.collection?.shape ?? null,
    tally,
    proposals: proposals.length,
    dispatch_failures: Object.values(state.frames ?? {}).filter((f) => f.dispatch === "failed").length,
    wall_clock_s: started ? Math.round((Date.now() - started) / 1000) : null,
  };
  writeFileSync(P(dir).metrics, JSON.stringify(metrics) + "\n", { flag: "a" });

  state.phase = "scored";
  saveState(dir, state);
  console.log(report);
  console.log(`report: ${P(dir).report}`);
  console.log(`metrics: ${P(dir).metrics}`);
  if (proposals.length) console.log(`\n${proposals.length} proposal(s). Nothing was regenerated: re-dispatch only what the owner approves, with \`dispatch --only <ids> --force\`.`);
}

function cmdExport(args) {
  const dir = runDir(args);
  const to = args.to ? resolve(String(args.to)) : die("--to <directory> is required.");
  const plan = loadPlan(dir);
  if (!existsSync(P(dir).report) && !args.force) die("No report.md — score the run before exporting, or pass --force to export the frames alone.");
  mkdirSync(join(to, "frames"), { recursive: true });
  mkdirSync(join(to, "prompts"), { recursive: true });
  const only = args.only ? String(args.only).split(",").map((s) => s.trim()) : null;
  let copied = 0;
  for (const frame of plan.frames) {
    if (only && !only.includes(frame.id)) continue;
    const src = framePath(dir, frame.id);
    if (!src) continue;
    copyFileSync(src, join(to, "frames", basename(src)));
    const prompt = join(P(dir).prompts, `${frame.id}.txt`);
    if (existsSync(prompt)) copyFileSync(prompt, join(to, "prompts", `${frame.id}.txt`));
    copied += 1;
  }
  for (const file of ["report.md", "plan.json", "verdicts.json"]) {
    const src = join(dir, file);
    if (existsSync(src)) copyFileSync(src, join(to, file));
  }
  console.log(`exported ${copied} frame(s), their prompts, the plan and the verdicts to ${to}`);
  console.log("The images and the report are the deliverable; plan.json and verdicts.json are how someone else checks it.");
}

function cmdClean(args) {
  const dir = runDir(args);
  const state = loadState(dir);
  if (!["scored", "closed"].includes(state.phase) && !args.force) {
    die(`Run is at phase "${state.phase}", not scored. Pass --force to delete it anyway.`);
  }
  rmSync(dir, { recursive: true, force: true });
  console.log(`removed ${dir}`);
}

function cmdStatus(args) {
  const dir = runDir(args);
  const state = loadState(dir);
  console.log(`phase: ${state.phase}`);
  for (const id of IDS) {
    const f = state.frames[id] ?? {};
    console.log(`  ${id}  dispatch=${f.dispatch ?? "—"}  artifact=${f.artifact ?? "—"}  ${f.reason ?? ""}`);
  }
}

const USAGE = `still-cursor-living-day — twelve frames, one cursor, one day.

  init    [--run <dir>] [--id <name>] [--force]   write the run and a twelve-frame plan skeleton
  probe   --run <dir>                             which routes on this machine can generate an image
  route   --run <dir> [--approve]                 validate the plan against the axis; --approve locks its hash
  dispatch --run <dir> [--only 03,07] [--concurrency 4] [--budget 600] [--force]
  collect --run <dir>                             prove twelve real images landed, same geometry, no twins
  judge open   --phase blind|informed --run <dir>
  judge submit --phase blind|informed --run <dir> --file <verdicts.json>
  score   --run <dir>                             report, verdicts and the metrics line
  export  --run <dir> --to <dir> [--only 01,02]   deliverable out of the temp run
  status  --run <dir>
  clean   --run <dir> [--force]
`;

function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const cmd = args._[0];
  const sub = args._[1];
  switch (cmd) {
    case "init": return cmdInit(args);
    case "probe": return cmdProbe(args);
    case "route": return cmdRoute(args);
    case "dispatch": return cmdDispatch(args);
    case "collect": return cmdCollect(args);
    case "judge":
      if (sub === "open") return cmdJudgeOpen(args);
      if (sub === "submit") return cmdJudgeSubmit(args);
      return die(USAGE);
    case "score": return cmdScore(args);
    case "export": return cmdExport(args);
    case "status": return cmdStatus(args);
    case "clean": return cmdClean(args);
    default:
      console.log(USAGE);
      process.exit(cmd ? 1 : 0);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}

export { validate, transitions, breakage, kendallTau, inspectImage, lexicon, shuffled, planHash, clockMinutes, CURSOR_CLAUSE, SURFACE_CLAUSE, FRAME_COUNT, IDS };

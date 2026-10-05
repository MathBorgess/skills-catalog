#!/usr/bin/env node
// explain-me driver: everything about a video run that is procedure, not judgment.
//
//   node explain.mjs <command> [flags]        (run `node explain.mjs --help`)
//
// HyperFrames is only an engine here, reached through its CLI as a subprocess. Node ESM,
// standard library only, runs from any install path (assets are found next to this file).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { KIT_PRIMITIVES, describeOverride, findProjectSpec, loadSpec, resolveDesign, tokensCss, validateSpec, SpecError } from "./lib/design.mjs";
import { assetsDir, personalDesignPath, resolveRun, runsDir, skillHome, venvDir, venvPython } from "./lib/home.mjs";
import { commandLine, quoteArg } from "./lib/hints.mjs";
import { ffmpegFrame, runCheck, runRender, synthesizeBeat } from "./lib/hyperframes.mjs";
import { DEFAULT_ORIENTATION, frameSize, normalizeOrientation, orientationUsage, resolveLayout, runOrientation } from "./lib/orientation.mjs";
import {
  compareSemver,
  defaultDeps,
  espeakInstallHint,
  findOnPath,
  inspectEspeak,
  latestHyperframesVersion,
  resolveEspeak,
  resolveHyperframes,
  resolvePython,
} from "./lib/resolve.mjs";
import { DesignInvalid, STALE_SCRIPT_MESSAGE, appendMetrics, createRun, projectDir, projectHash, readExplainData, readRun, refreshDesign, scriptStaleness, updateRun, validateLayers } from "./lib/run.mjs";
import { ENTRANCE_FRAME_FRACTION, ENTRANCE_FRAME_MAX_SEC, FRAME_BEFORE_END_SEC, inspectionFrames, kokoroLang, lintLang, stageFrameMismatch } from "./lib/timeline.mjs";
import { runVoice } from "./lib/voice.mjs";

const ASSETS = assetsDir(import.meta.url);
const SHIPPED_DESIGN = path.join(ASSETS, "DESIGN.md");

// The script as it was started (so a hint is what the user would have typed), or its real path.
const SELF = (() => {
  const here = fileURLToPath(import.meta.url);
  try {
    if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(here)) return path.resolve(process.argv[1]);
  } catch {
    /* fall through */
  }
  return here;
})();
// Every command line the driver prints runs as printed from the current folder: hint(`voice ${q(runDir)}`).
const hint = (args = "") => commandLine(SELF, args);
const q = quoteArg;

// ---------------------------------------------------------------------------
// errors and output
// ---------------------------------------------------------------------------

class CliError extends Error {
  constructor(message, { fix, code = 1, data = {}, lines = [] } = {}) {
    super(message);
    this.fix = fix;
    this.code = code;
    this.data = data;
    this.lines = lines;
  }
}
const usage = (message) => new CliError(message, { code: 2, fix: `run: ${hint("--help")}` });

const fmtSec = (n) => (Math.round(n * 10) / 10).toFixed(1);
const tag = (level) => ({ ok: "ok    ", warn: "warn  ", error: "FAIL  ", info: "      " })[level];

function overrideLines(overrides) {
  if (!overrides?.length) return ["No overrides of the shipped default."];
  return [`Overrides of the shipped default (${overrides.length}):`, ...overrides.map((o) => `  ${describeOverride(o)}`)];
}

function designProblemLines(problems) {
  const lines = [];
  let file = null;
  for (const p of problems) {
    if (p.file && p.file !== file) {
      file = p.file;
      lines.push(`  ${file}`);
    }
    lines.push(`    ${p.path}: ${p.message}`);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// command table
// ---------------------------------------------------------------------------

const COMMANDS = {};
function command(name, spec) {
  COMMANDS[name] = spec;
}

const HELP_FOOTER = `Exit codes: 0 success, 1 failure (the reason and the fix are printed), 2 usage error.
Every command takes --json to print one JSON object instead of text.
<run> is a run folder path or a slug (the latest run with that slug).
Skill home: $EXPLAIN_ME_HOME, else $XDG_CACHE_HOME/explain-me, else ~/.cache/explain-me (Windows: %LOCALAPPDATA%\\explain-me).`;

function topHelp() {
  const rows = Object.values(COMMANDS).map((c) => `  ${c.usage}\n      ${c.summary}`);
  return `explain-me driver

Usage: ${hint("<command> [flags]")}

Commands:
${rows.join("\n\n")}

${HELP_FOOTER}
`;
}

function commandHelp(name) {
  const c = COMMANDS[name];
  return `Usage: ${hint(c.usage)}\n\n${c.summary}\n${c.details ? `\n${c.details}\n` : ""}\n${HELP_FOOTER}\n`;
}

const espeakFix = (deps) => `${espeakInstallHint(deps.platform)}, then run again`;

function espeakLine(espeak) {
  const untested = espeak.tested ? "" : " (not tried yet: no Python with kokoro_onnx)";
  if (espeak.status === "bundled") return `${tag("ok")}espeak-ng: bundled loader works (inside the Python packages)`;
  if (espeak.status === "system") return `${tag("ok")}espeak-ng: system library ${espeak.library}${untested}`;
  if (espeak.status === "user") return `${tag("ok")}espeak-ng: PHONEMIZER_ESPEAK_LIBRARY ${espeak.library}`;
  return `${tag("warn")}espeak-ng: missing (${espeak.error})`;
}

// ---------------------------------------------------------------------------
// doctor
// ---------------------------------------------------------------------------

command("doctor", {
  usage: "doctor [--offline]",
  summary: "Report the home, HyperFrames, Python/Kokoro, ffmpeg, model cache and personal DESIGN.md. Installs nothing.",
  options: { offline: { type: "boolean" } },
  positionals: 0,
  async run(ctx, { values }) {
    const { deps } = ctx;
    const home = skillHome({ env: deps.env, platform: deps.platform, homedir: deps.homedir });
    const problems = [];
    const addProblem = (level, message, fix) => problems.push({ level, message, fix });

    const hf = resolveHyperframes(deps, { probeNpx: false });
    let newer = null;
    if (hf.ok && hf.version && !values.offline) {
      const latest = await latestHyperframesVersion();
      if (latest) newer = { latest, available: compareSemver(latest, hf.version) > 0 };
    }
    if (!hf.ok) addProblem("error", hf.reason, hf.fix);
    else if (hf.tier === "npx-latest") addProblem("warn", "HyperFrames is not installed; the first check or render downloads hyperframes@latest through npx", "to install it once: npm install -g hyperframes");
    if (newer?.available) addProblem("info", `HyperFrames ${newer.latest} is available (installed ${hf.version}); explain-me never updates it for you`, "to update by hand: npm install -g hyperframes@latest");

    const python = resolvePython(deps, { home: home.dir });
    if (!python.ok) addProblem("warn", "no Python with kokoro_onnx and soundfile; narration would be silent", `run: ${hint("setup")}`);

    const espeak = inspectEspeak(deps, python);
    if (!espeak.ok) addProblem("warn", `espeak-ng is missing, so Kokoro cannot phonemize and narration would fail: ${espeak.error}`, espeakFix(deps));

    const ffmpeg = findOnPath("ffmpeg", deps);
    if (!ffmpeg) addProblem("error", "ffmpeg is not on PATH (rendering and frame extraction need it)", "install ffmpeg (macOS: brew install ffmpeg)");
    const uv = findOnPath("uv", deps);

    const nodeMajor = Number(process.versions.node.split(".")[0]);
    if (nodeMajor < 22) addProblem("error", `Node ${process.versions.node} is too old; HyperFrames needs Node 22 or newer`, "install a current Node.js");

    const ttsCache = path.join(deps.homedir, ".cache", "hyperframes", "tts");
    const model = path.join(ttsCache, "models", "kokoro-v1.0.onnx");
    const voices = path.join(ttsCache, "voices", "voices-v1.0.bin");
    const modelCached = deps.fs.existsSync(model) && deps.fs.existsSync(voices);
    if (!modelCached) addProblem("info", "the Kokoro model is not cached yet; the first narrated run downloads about 340 MB, once", `optional warm-up: ${hint("setup --warm")}`);

    const chromeCached = deps.fs.existsSync(path.join(deps.homedir, ".cache", "hyperframes", "chrome"));
    if (!chromeCached) addProblem("info", "HyperFrames has not cached its Chrome yet; the first check downloads it", "or run: hyperframes browser ensure");

    const personal = personalDesignPath(home.dir);
    const designPresent = deps.fs.existsSync(personal);
    if (!designPresent) addProblem("info", "no personal DESIGN.md yet; setup seeds one from the shipped default", `run: ${hint("setup")}`);

    const data = {
      ok: !problems.some((p) => p.level === "error"),
      home: { path: home.dir, source: home.source, exists: deps.fs.existsSync(home.dir) },
      hyperframes: hf.ok ? { tier: hf.tier, version: hf.version, command: [hf.command, ...(hf.prefixArgs ?? [])].join(" "), newer } : { tier: null, reason: hf.reason },
      python: { ok: python.ok, tier: python.tier, path: python.path, candidates: python.candidates },
      espeak: { ...espeak, install: espeak.ok ? null : espeakInstallHint(deps.platform) },
      ffmpeg: { path: ffmpeg },
      uv: { path: uv },
      node: process.versions.node,
      ttsModel: { cached: modelCached, path: ttsCache },
      chrome: { cached: chromeCached },
      personalDesign: { present: designPresent, path: personal },
      problems,
    };

    const lines = [];
    lines.push(`${tag("info")}home: ${home.dir} (${home.source})${data.home.exists ? "" : " - not created yet, setup creates it"}`);
    if (hf.ok) {
      lines.push(`${tag(hf.tier === "npx-latest" ? "warn" : "ok")}hyperframes: ${hf.tier}${hf.version ? ` ${hf.version}` : ""}${newer ? (newer.available ? ` (newer ${newer.latest} exists)` : " (up to date)") : ""}`);
    } else lines.push(`${tag("error")}hyperframes: ${hf.reason}`);
    lines.push(python.ok ? `${tag("ok")}python: ${python.tier} ${python.path} (kokoro_onnx and soundfile import)` : `${tag("warn")}python: no interpreter has kokoro_onnx and soundfile (tried ${python.candidates.map((c) => c.tier).join(", ") || "none"})`);
    lines.push(espeakLine(espeak));
    lines.push(ffmpeg ? `${tag("ok")}ffmpeg: ${ffmpeg}` : `${tag("error")}ffmpeg: not on PATH`);
    lines.push(`${tag(uv ? "ok" : "info")}uv: ${uv ?? "not found (setup falls back to python -m venv)"}`);
    lines.push(`${tag(modelCached ? "ok" : "info")}kokoro model: ${modelCached ? "cached" : "not cached yet"} (${ttsCache})`);
    lines.push(`${tag(chromeCached ? "ok" : "info")}chrome: ${chromeCached ? "cached by HyperFrames" : "not cached yet"}`);
    lines.push(`${tag(designPresent ? "ok" : "info")}personal DESIGN.md: ${designPresent ? personal : "none yet"}`);
    for (const p of problems) if (p.level !== "info" && p.fix) lines.push(`  ${p.level === "error" ? "fix" : "hint"}: ${p.fix}`);
    return { code: data.ok ? 0 : 1, data, lines };
  },
});

// ---------------------------------------------------------------------------
// setup
// ---------------------------------------------------------------------------

command("setup", {
  usage: "setup [--warm]",
  summary: "Create the home and runs/, seed the personal DESIGN.md, make sure a Python can run Kokoro (venv only if none can).",
  details: "--warm  also run one tiny narration so HyperFrames downloads the Kokoro model now (about 340 MB, once).",
  options: { warm: { type: "boolean" } },
  positionals: 0,
  async run(ctx, { values }) {
    const { deps } = ctx;
    const home = skillHome({ env: deps.env, platform: deps.platform, homedir: deps.homedir }).dir;
    const lines = [];
    const data = { home, actions: [] };
    const note = (text) => {
      data.actions.push(text);
      if (!ctx.json) console.log(text); // progress as it happens; installs print their own output between notes
    };
    const inherit = !ctx.json;

    fs.mkdirSync(runsDir(home), { recursive: true });
    note(`home ready: ${home}`);

    const personal = personalDesignPath(home);
    if (!fs.existsSync(SHIPPED_DESIGN)) throw new CliError(`the skill is missing assets/DESIGN.md (looked in ${ASSETS})`, { fix: "reinstall the skill" });
    if (!fs.existsSync(personal)) {
      fs.copyFileSync(SHIPPED_DESIGN, personal);
      note(`seeded ${personal} from the shipped default (edit it to make your own style the default; it is never overwritten)`);
    } else note(`kept your ${personal} (never overwritten)`);

    let python = resolvePython(deps, { home });
    if (python.ok) note(`python ready: ${python.tier} ${python.path}`);
    else {
      const venvPy = venvPython(home, deps.platform);
      const uv = findOnPath("uv", deps);
      const base = findOnPath("python3", deps) ?? findOnPath("python", deps);
      const run = (cmd, args) => deps.exec(cmd, args, { env: deps.env, inherit, timeoutMs: 15 * 60 * 1000 });
      const fail = (what, r) => {
        throw new CliError(`${what} failed${r?.stderr ? `: ${String(r.stderr).trim().slice(-400)}` : r?.status != null ? ` (exit ${r.status})` : ""}`, {
          fix: "install Python 3.10-3.13, then run setup again; or install the packages yourself: pip install kokoro-onnx soundfile and set HYPERFRAMES_PYTHON",
        });
      };
      if (!fs.existsSync(venvPy)) {
        if (!uv && !base) throw new CliError("no Python and no uv found to create a virtual environment", { fix: "install Python 3.10 or newer (or uv), then run setup again" });
        note(`creating the virtual environment ${venvDir(home)} with ${uv ? "uv" : "python -m venv"}`);
        const r = uv ? run(uv, ["venv", venvDir(home)]) : run(base, ["-m", "venv", venvDir(home)]);
        if (r.status !== 0 || r.error) fail("creating the virtual environment", r);
      }
      note("installing kokoro-onnx and soundfile into the virtual environment");
      const r = uv ? run(uv, ["pip", "install", "--python", venvPy, "kokoro-onnx", "soundfile"]) : run(venvPy, ["-m", "pip", "install", "kokoro-onnx", "soundfile"]);
      if (r.status !== 0 || r.error) fail("installing kokoro-onnx and soundfile", r);
      python = resolvePython(deps, { home });
      if (!python.ok) throw new CliError("the virtual environment exists but cannot import kokoro_onnx and soundfile", { fix: `delete ${venvDir(home)} and run setup again` });
      note(`python ready: ${python.tier} ${python.path}`);
    }
    data.python = { tier: python.tier, path: python.path };
    const espeak = resolveEspeak(deps, python.path);
    data.espeak = { ok: espeak.ok, via: espeak.via, library: espeak.library ?? null };
    if (espeak.ok) note(`espeak-ng ready: ${espeak.via}${espeak.library ? ` ${espeak.library}` : ""}`);
    else note(`warn: the phonemizer behind Kokoro (espeak-ng) cannot run (${espeak.error}); narration will fail until you ${espeakFix(deps)}`);

    const hf = resolveHyperframes(deps, { probeNpx: Boolean(values.warm) });
    data.hyperframes = hf.ok ? { tier: hf.tier, version: hf.version } : null;
    if (hf.ok) note(`hyperframes: ${hf.tier}${hf.version ? ` ${hf.version}` : ""}`);
    else note(`warn: ${hf.reason}; ${hf.fix}`);

    if (values.warm) {
      if (!hf.ok) throw new CliError(hf.reason, { fix: hf.fix });
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "explain-me-warm-"));
      const textFile = path.join(tmp, "warm.txt");
      fs.writeFileSync(textFile, "Ready.");
      note("warming up: one tiny narration (the first call downloads the Kokoro model, about 340 MB)");
      const r = synthesizeBeat(deps, hf, { textFile, out: path.join(tmp, "warm.wav"), voice: "af_heart", lang: "en-us", speed: 1, python: python.path, extraEnv: espeak.env });
      fs.rmSync(tmp, { recursive: true, force: true });
      if (!r.ok) throw new CliError(`the warm-up narration failed: ${r.error}`, { fix: "check your network (the model downloads from GitHub) and run setup --warm again" });
      note(`model ready (warm-up narration ${r.durationSeconds}s)`);
      data.warm = true;
    }
    return { code: 0, data: { ok: true, ...data }, lines };
  },
});

// ---------------------------------------------------------------------------
// design
// ---------------------------------------------------------------------------

function checkSpecFile(file) {
  const spec = loadSpec(file);
  const { errors, warnings } = validateSpec(spec);
  return { path: file, ok: errors.length === 0, errors, warnings };
}

command("design", {
  usage: "design <find|resolve|check> [...]",
  summary: "find: project brand spec. resolve: merged design. check: validate a spec.",
  details: `  design find [--project <dir>]       print the project spec found (frame.md, then design.md, then DESIGN.md) or none
  design resolve [--design <path>]    print the merged design, its layers and its overrides of the shipped default
  design check [<path>]               validate a spec file (or a folder holding one); with no path, the personal DESIGN.md and the shipped default
Kit primitives (the only valid ones in preferred motion and examples): ${KIT_PRIMITIVES.join(", ")}.`,
  options: { project: { type: "string" }, design: { type: "string" } },
  positionals: 2,
  async run(ctx, { values, positionals }) {
    const [sub, target] = positionals;
    const { deps } = ctx;
    const home = skillHome({ env: deps.env, platform: deps.platform, homedir: deps.homedir }).dir;
    if (sub === "find") {
      const dir = path.resolve(values.project ?? process.cwd());
      const found = findProjectSpec(dir);
      return {
        code: 0,
        data: { ok: true, project: dir, found },
        lines: [found ?? `none (looked for frame.md, design.md, DESIGN.md in ${dir})`],
      };
    }
    if (sub === "resolve") {
      const resolved = resolveDesign({ explicit: values.design ? path.resolve(values.design) : undefined, personal: personalDesignPath(home), shipped: SHIPPED_DESIGN });
      const { problems } = validateLayers(resolved.loaded);
      const data = { ok: problems.length === 0, layers: resolved.layers, overrides: resolved.overrides, design: resolved.data, prose: resolved.body, problems };
      const lines = [
        "Layers (highest priority first):",
        ...resolved.layers.map((l) => `  ${l.kind}: ${l.path}`),
        ...overrideLines(resolved.overrides),
        ...(problems.length ? ["Problems:", ...designProblemLines(problems)] : []),
        "",
        JSON.stringify(resolved.data, null, 2),
      ];
      return { code: problems.length ? 1 : 0, data, lines };
    }
    if (sub === "check") {
      let files;
      if (target) {
        const abs = path.resolve(target);
        let file = abs;
        if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
          file = findProjectSpec(abs);
          if (!file) throw new CliError(`no frame.md, design.md or DESIGN.md in ${abs}`, { fix: "pass the spec file itself" });
        }
        files = [file];
      } else {
        files = [personalDesignPath(home), SHIPPED_DESIGN].filter((f) => fs.existsSync(f));
      }
      const results = [];
      for (const f of files) {
        try {
          results.push(checkSpecFile(f));
        } catch (e) {
          if (!(e instanceof SpecError)) throw e;
          results.push({ path: f, ok: false, errors: [{ path: "frontmatter", message: e.message.replace(`${f}: `, "") }], warnings: [] });
        }
      }
      const ok = results.every((r) => r.ok);
      const lines = [];
      for (const r of results) {
        lines.push(`${tag(r.ok ? "ok" : "error")}${r.path}`);
        for (const e of r.errors) lines.push(`  error: ${e.path}: ${e.message}`);
        for (const w of r.warnings) lines.push(`  warn:  ${w.path}: ${w.message}`);
      }
      return { code: ok ? 0 : 1, data: { ok, results }, lines };
    }
    throw usage(sub ? `unknown design subcommand "${sub}" (find, resolve, check)` : "design needs a subcommand: find, resolve or check");
  },
});

// ---------------------------------------------------------------------------
// tokens
// ---------------------------------------------------------------------------

command("tokens", {
  usage: "tokens --css [--design <path>]",
  summary: "Print :root custom properties (--em-*) from the resolved design, for inline SVG and interactive HTML.",
  options: { css: { type: "boolean" }, design: { type: "string" } },
  positionals: 0,
  async run(ctx, { values }) {
    const { deps } = ctx;
    const home = skillHome({ env: deps.env, platform: deps.platform, homedir: deps.homedir }).dir;
    const resolved = resolveDesign({ explicit: values.design ? path.resolve(values.design) : undefined, personal: personalDesignPath(home), shipped: SHIPPED_DESIGN });
    const css = tokensCss(resolved.data);
    return { code: 0, data: { ok: true, css, layers: resolved.layers, overrides: resolved.overrides }, lines: [css.trimEnd()] };
  },
});

// ---------------------------------------------------------------------------
// new
// ---------------------------------------------------------------------------

command("new", {
  usage: "new --slug <slug> --lang <tag> [--format video|svg|html|text|mermaid|image] [--orientation landscape|portrait] [--design <path>] [--dest <dir>] [--title <t>]",
  summary: "Create the run folder. For video (the default): the HyperFrames project from assets/, frame.md, tokens.css, run.json and a starter script.json. For svg/html: run.json and tokens.css. For text/mermaid/image: run.json. Every format also gets a starter explanation.md.",
  details: "--lang is the language of the request (pt-BR, en, es, ...). Kokoro voices: pt-br, en-us, en-gb, es, fr-fr, it, ja, zh, hi; any other language gets a silent video and subtitles.\n--orientation is the frame shape of a video: landscape (16:9, 1920x1080, the default) or portrait (9:16, 1080x1920, for Reels, Shorts and TikTok). Aliases: horizontal, 16:9, vertical, 9:16, reels, shorts, tiktok. Video only; it is not --format.\n--design is the project's brand spec after the intake offered it; it overrides the personal DESIGN.md and the shipped default key by key.\nexplanation.md holds the load-bearing distinction, the glossary and the explain-back question, in the request's language (Portuguese for pt tags, English for every other language). It is never overwritten.",
  options: { slug: { type: "string" }, lang: { type: "string" }, format: { type: "string" }, orientation: { type: "string" }, design: { type: "string" }, dest: { type: "string" }, title: { type: "string" } },
  positionals: 0,
  async run(ctx, { values }) {
    const { deps } = ctx;
    const format = values.format ?? "video";
    if (!values.slug) throw usage("new needs --slug <slug>");
    if (!values.lang) throw usage("new needs --lang <tag> (the language of the request, for example pt-BR)");
    let orientation = DEFAULT_ORIENTATION;
    if (values.orientation !== undefined) {
      if (format !== "video") throw usage(`--orientation only applies to --format video (this run is ${format})`);
      orientation = normalizeOrientation(values.orientation);
      if (!orientation) throw usage(`${orientationUsage()}, got "${values.orientation}"`);
    }
    const home = skillHome({ env: deps.env, platform: deps.platform, homedir: deps.homedir }).dir;
    const hf = resolveHyperframes(deps, { probeNpx: false });
    let created;
    try {
      created = createRun({ home, slug: values.slug, lang: values.lang, title: values.title, designPath: values.design, dest: values.dest, assetsDir: ASSETS, hyperframes: hf.ok ? hf : null, format, orientation });
    } catch (e) {
      if (e instanceof DesignInvalid) {
        throw new CliError("the design spec is invalid", {
          fix: `fix the listed keys (run: ${hint("design check <path>")}) and run new again`,
          data: { problems: e.problems },
          lines: designProblemLines(e.problems),
        });
      }
      if (e instanceof SpecError) throw new CliError(e.message, { fix: `check the path passed to --design, or run: ${hint("design check <path>")}` });
      throw new CliError(e.message, { code: /invalid slug|missing --lang|invalid --format|invalid --orientation/.test(e.message) ? 2 : 1 });
    }
    const { runDir, projectDir: project, run, warnings, explanation } = created;
    const lintHint = commandLine(path.join(path.dirname(SELF), "ste-lint.mjs"), `--file ${q(explanation)} --lang ${lintLang(values.lang)}`);
    const explanationLines = [`  explain: ${explanation} (the distinction, the glossary and the explain-back question: fill it in)`, `  lint:    ${lintHint}`];
    if (format !== "video") {
      const tokens = format === "svg" || format === "html" ? path.join(runDir, "tokens.css") : null;
      const data = { ok: true, run: runDir, format, lang: values.lang, dest: run.dest, design: run.design, warnings, files: { tokens, explanation } };
      const lines = [
        runDir,
        `  format:  ${format} (write the artefact into this folder${run.dest ? `, then copy it to ${run.dest}` : ""})`,
        ...explanationLines,
        ...(tokens ? [`  tokens:  ${tokens} (inline these --em-* properties)`] : []),
        ...overrideLines(run.design.overrides).map((l) => `  ${l}`),
        ...warnings.map((w) => `  warn: ${path.basename(w.file)}: ${w.path}: ${w.message}`),
      ];
      return { code: 0, data, lines };
    }
    const kLang = kokoroLang(values.lang);
    const { width, height } = frameSize(run.orientation);
    const { layout, captions } = resolveLayout(created.designData, run.orientation);
    const data = {
      ok: true,
      run: runDir,
      project,
      lang: values.lang,
      kokoroLang: kLang,
      voice: run.voice,
      silent: !run.voice,
      orientation: run.orientation,
      width,
      height,
      layout,
      captions,
      dest: run.dest,
      design: run.design,
      warnings,
      files: { script: path.join(runDir, "script.json"), explanation, index: path.join(project, "index.html"), frame: path.join(project, "frame.md"), tokens: path.join(project, "tokens.css") },
    };
    const box = (b) => `[${b.join(", ")}]`;
    const lines = [
      runDir,
      `  project: ${project}`,
      `  script:  ${data.files.script} (write the beats here)`,
      ...explanationLines,
      `  voice:   ${run.voice ? `${run.voice} (${kLang})` : `none: no Kokoro voice for ${values.lang}, the video will be silent with subtitles`}`,
      `  frame:   ${run.orientation} ${width}x${height} (author the stage in viewBox 0 0 ${width} ${height})`,
      `  layout:  keep content inside the safe box ${box(layout.safe)}; captions ${captions.burn ? `are burned in at ${box(layout.captions)}, up to ${captions.maxWords} words at a time` : "are not burned in (the .srt ships beside the video)"}`,
      ...overrideLines(run.design.overrides).map((l) => `  ${l}`),
      ...warnings.map((w) => `  warn: ${path.basename(w.file)}: ${w.path}: ${w.message}`),
      `  next: edit script.json, then: ${hint(`voice ${q(runDir)}`)}`,
    ];
    return { code: 0, data, lines };
  },
});

// ---------------------------------------------------------------------------
// voice
// ---------------------------------------------------------------------------

const ttsCachePath = (deps) => path.join(deps.homedir, ".cache", "hyperframes", "tts", "models", "kokoro-v1.0.onnx");

// Loaded on first use, so a script error never needs the linter.
function lazyLint() {
  let lintText;
  return async (text, options) => {
    if (!lintText) {
      const file = new URL("./ste-lint.mjs", import.meta.url);
      let mod;
      try {
        mod = await import(file.href);
      } catch (e) {
        throw new CliError(`cannot load ste-lint.mjs: ${e.message}`, { fix: "the skill install is incomplete; reinstall it" });
      }
      if (typeof mod.lintText !== "function") throw new CliError("ste-lint.mjs does not export lintText(text, options)", { fix: "update the skill; voice needs the narration linter" });
      lintText = mod.lintText;
    }
    return lintText(text, options);
  };
}

command("voice", {
  usage: "voice <run> [--strict] [--silent] [--glossary <path>]",
  summary: "Refresh the design, lint each narration, synthesize one audio file per beat (Kokoro), build the timeline, write explain-data.js, audio tags, motion sidecar and subtitles.",
  details: "Every call first re-resolves the run's design layers (the explicit spec it was created with, your personal DESIGN.md as it is now, the shipped default) and rewrites project/frame.md and project/tokens.css, so a restyle is: edit the spec, voice, check, render.\n--strict    lexicon warnings become errors\n--silent    skip Kokoro and estimate beat lengths at 150 words per minute (also the fallback for languages without a voice)\n--glossary  markdown glossary for term locks (default: <run>/glossary.md when it exists)",
  options: { strict: { type: "boolean" }, silent: { type: "boolean" }, glossary: { type: "string" } },
  positionals: 1,
  async run(ctx, { values, positionals }) {
    const { deps } = ctx;
    const home = skillHome({ env: deps.env, platform: deps.platform, homedir: deps.homedir }).dir;
    const runDir = locateRun(home, positionals[0]);
    const existing = readRun(runDir);
    if (existing.format && existing.format !== "video") throw new CliError(`this run is a ${existing.format} run; voice only applies to video runs`, { fix: `start a video run with: ${hint("new --slug <slug> --lang <tag>")}` });

    // A restyle reaches an existing run here: the design is resolved again before anything is built from it.
    let design;
    try {
      design = refreshDesign({ runDir, home, assetsDir: ASSETS });
    } catch (e) {
      if (e instanceof DesignInvalid) {
        throw new CliError("the design spec is invalid", {
          fix: `fix the listed keys (run: ${hint("design check <path>")}) and run voice again`,
          data: { stage: "design", problems: e.problems },
          lines: designProblemLines(e.problems),
        });
      }
      if (e instanceof SpecError) throw new CliError(e.message, { fix: "restore the spec this run was created with (design.explicit in run.json), or start a new run" });
      throw e;
    }

    let glossary = values.glossary ? path.resolve(values.glossary) : undefined;
    if (!glossary && fs.existsSync(path.join(runDir, "glossary.md"))) glossary = path.join(runDir, "glossary.md");
    if (values.glossary && !fs.existsSync(glossary)) throw new CliError(`glossary not found: ${glossary}`, { fix: "check the --glossary path" });

    // Engine resolution is lazy: a silent run, or a lint failure, never touches Python or HyperFrames.
    let engine;
    const getEngine = () => {
      if (engine) return engine;
      const hf = resolveHyperframes(deps, { probeNpx: true });
      if (!hf.ok) return (engine = { error: `${hf.reason}. ${hf.fix}` });
      const python = resolvePython(deps, { home });
      if (!python.ok) return (engine = { error: `no Python can import kokoro_onnx and soundfile. Run: ${hint("setup")} (or pass --silent for a silent video with subtitles)` });
      const espeak = resolveEspeak(deps, python.path);
      if (!espeak.ok) return (engine = { error: `the phonemizer behind Kokoro (espeak-ng) cannot run: ${espeak.error}. ${espeakFix(deps)} (or pass --silent)` });
      if (!deps.fs.existsSync(ttsCachePath(deps)) && !ctx.json) process.stderr.write("The Kokoro model is not cached yet: the first narration downloads about 340 MB to ~/.cache/hyperframes/tts (once).\n");
      return (engine = { hf, python, espeak });
    };
    const ttsDir = path.join(runDir, "tts");
    const synth = (beat, out, { voice, lang, speed }) => {
      const eng = getEngine();
      if (eng.error) return { ok: false, error: eng.error };
      fs.mkdirSync(ttsDir, { recursive: true });
      const textFile = path.join(ttsDir, `${beat.id}.txt`);
      fs.writeFileSync(textFile, beat.narration);
      if (!ctx.json) process.stderr.write(`  ${beat.id}: ${voice} ...\n`);
      return synthesizeBeat(deps, eng.hf, { textFile, out, voice, lang, speed, python: eng.python.path, extraEnv: eng.espeak.env });
    };

    let result;
    try {
      result = await runVoice({ runDir, synth, lint: lazyLint(), strict: Boolean(values.strict), glossary, forceSilent: Boolean(values.silent) });
    } finally {
      fs.rmSync(ttsDir, { recursive: true, force: true }); // the per-beat text files only exist to feed tts
    }

    if (!result.ok) {
      if (result.stage === "script") {
        throw new CliError("script.json is not valid", { fix: `fix script.json in ${runDir}`, data: { stage: "script", errors: result.errors }, lines: result.errors.map((e) => `  ${e}`) });
      }
      if (result.stage === "lint") {
        const lines = [];
        for (const f of result.lintFailures) {
          lines.push(`  ${f.beat}: ${f.narration}`);
          for (const e of f.errors) lines.push(`    [${e.rule}] ${e.message}${e.sample ? ` ("${e.sample.length > 60 ? `${e.sample.slice(0, 60)}...` : e.sample}")` : ""}`);
        }
        throw new CliError(`narration breaks the writing rules in ${result.lintFailures.length} beat(s); no audio was made`, {
          fix: "rewrite those narrations (references/ste-lite.md), then run voice again",
          data: { stage: "lint", lintFailures: result.lintFailures, lintWarnings: result.lintWarnings },
          lines,
        });
      }
      throw new CliError(`narration failed on ${result.beat}: ${result.error}`, {
        fix: `run: ${hint("doctor")} (then setup); or run voice with --silent for a silent video with subtitles`,
        data: { stage: "tts", beat: result.beat, error: result.error },
      });
    }

    if (engine?.hf) updateRun(runDir, { hyperframes: { tier: engine.hf.tier, version: engine.hf.version }, python: { tier: engine.python.tier, path: engine.python.path, espeak: engine.espeak.via } });
    else if (result.silent) updateRun(runDir, { python: null });

    const designInfo = { changed: design.changed, overridesChanged: design.overridesChanged, layers: design.layers, overrides: design.overrides, warnings: design.warnings };
    const data = { ok: true, run: runDir, design: designInfo, ...result };
    const lines = [
      `design: ${design.changed ? "restyled, project/frame.md, project/tokens.css and the tokens region of index.html rewritten" : "unchanged"} (${design.layers.map((l) => l.kind).join(" > ")})`,
      ...(design.changed || design.overridesChanged ? overrideLines(design.overrides).map((l) => `  ${l}`) : []),
      ...design.warnings.map((w) => `warn: ${path.basename(w.file)}: ${w.path}: ${w.message}`),
      result.silent ? `voice: none (${result.silentReason}); silent video with subtitles, lengths estimated at 150 words per minute` : `voice: ${result.voice} (${result.kokoroLang}), ${result.synthesized} synthesized, ${result.reused} reused`,
      `frame: ${result.orientation} ${frameSize(result.orientation).width}x${frameSize(result.orientation).height}; captions ${result.captions.burn ? `burned in (${result.captions.maxWords} words at a time, motion test limited to #stage)` : "not burned in"}`,
      `timeline: ${result.beats.length} beat(s), ${fmtSec(result.total)} s; the Motion Gate judges motion up to ${fmtSec(result.motionUntil)} s, the end of the last beat (the closing tail is a deliberate hold)`,
      ...result.beats.map((b) => `  ${b.id}  ${fmtSec(b.start).padStart(5)} - ${fmtSec(b.end).padStart(5)}  (${b.dur.toFixed(2)} s)`),
      `subtitles: ${result.files.srt}`,
      `data:      ${result.files.explainData}`,
      ...result.warnings.map((w) => `warn: ${w.beat} [${w.rule}] ${w.message}`),
      `next: write the STAGE and SCENE regions of ${result.files.index}, then: ${hint(`check ${q(runDir)}`)}`,
    ];
    return { code: 0, data, lines };
  },
});

function locateRun(home, ref) {
  try {
    return resolveRun(home, ref);
  } catch (e) {
    throw new CliError(e.message, { fix: "pass the run folder printed by `new`, or its slug" });
  }
}

// `voice` records the hash of script.json it built from; a script edited after that has no audio, timeline or
// subtitles behind it, so check and render refuse it.
function guardStaleScript(runDir) {
  const s = scriptStaleness(runDir);
  if (!s.stale) return;
  throw new CliError(s.missing ? "script.json is missing: run voice again" : STALE_SCRIPT_MESSAGE, {
    fix: `run: ${hint(`voice ${q(runDir)}`)} (narration already made is reused, so only changed beats are synthesized again)`,
    data: { stage: "script", stale: true },
  });
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

command("check", {
  usage: "check <run>",
  summary: "Run hyperframes check in project/ (lint, runtime, layout, motion, contrast) and record the result and the file hash in run.json.",
  options: {},
  positionals: 1,
  async run(ctx, { positionals }) {
    const { deps } = ctx;
    const home = skillHome({ env: deps.env, platform: deps.platform, homedir: deps.homedir }).dir;
    const runDir = locateRun(home, positionals[0]);
    const project = projectDir(runDir);
    for (const f of ["index.html", "explain-data.js", "index.motion.json"]) {
      if (!fs.existsSync(path.join(project, f))) throw new CliError(`project/${f} is missing`, { fix: `run: ${hint(`voice ${q(runDir)}`)}` });
    }
    guardStaleScript(runDir);
    const preflight = [];
    const mismatch = stageFrameMismatch(fs.readFileSync(path.join(project, "index.html"), "utf8"), runOrientation(readRun(runDir)));
    if (mismatch) preflight.push(mismatch);
    const hf = resolveHyperframes(deps, { probeNpx: true });
    if (!hf.ok) throw new CliError(hf.reason, { fix: hf.fix });
    const result = runCheck(deps, hf, project);
    const hash = projectHash(project);
    const at = new Date().toISOString();
    const version = result.version ?? hf.version;
    updateRun(runDir, {
      hyperframes: { tier: hf.tier, version },
      check: { ok: result.ok, errors: result.errors, warnings: result.warnings, frozen: result.frozen, hash, at },
    });
    if (result.crashed) {
      throw new CliError("hyperframes check did not produce a result", { fix: `run: ${hint("doctor")}; or run hyperframes doctor`, lines: result.raw ? result.raw.split("\n").map((l) => `  ${l}`) : [] });
    }
    const lines = [`${tag(result.ok ? "ok" : "error")}hyperframes check: ${result.errors} error(s), ${result.warnings} warning(s)${version ? ` (hyperframes ${version})` : ""}`];
    for (const w of preflight) lines.push(`  warn    ${w}`);
    for (const f of result.findings) {
      lines.push(`  ${f.severity.padEnd(7)} ${f.code}${f.selector ? ` ${f.selector}` : ""}${f.time != null ? ` at ${fmtSec(f.time)}s` : ""}: ${f.message}`);
      if (f.fixHint && f.severity === "error") lines.push(`          fix: ${f.fixHint}`);
    }
    if (result.ok) lines.push(`gate open: render with: ${hint(`render ${q(runDir)}`)}`);
    else lines.push("gate closed: fix the errors above and run check again; render refuses until it passes");
    return { code: result.ok ? 0 : 1, data: { ok: result.ok, run: runDir, errors: result.errors, warnings: result.warnings, frozen: result.frozen, hash, findings: result.findings, preflight }, lines };
  },
});

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

command("render", {
  usage: "render <run> [--dest <dir>] [--quality draft|looks|delivery] [--fps <n>] [--verbose]",
  summary: "Render <run>/<slug>.mp4 (refuses unless the latest check passed for the current files), extract two frames per beat (entrance and settled), copy to --dest, log the metrics line.",
  details: "--verbose  stream HyperFrames' own render log (very long); by default it is captured and only shown when the render fails.",
  options: { dest: { type: "string" }, quality: { type: "string" }, fps: { type: "string" }, verbose: { type: "boolean" } },
  positionals: 1,
  async run(ctx, { values, positionals }) {
    const { deps } = ctx;
    const home = skillHome({ env: deps.env, platform: deps.platform, homedir: deps.homedir }).dir;
    const runDir = locateRun(home, positionals[0]);
    const run = readRun(runDir);
    const project = projectDir(runDir);
    const quality = values.quality ?? "looks";
    if (!["draft", "looks", "delivery", "standard", "high"].includes(quality)) throw usage(`--quality must be draft, looks or delivery (got "${quality}")`);
    if (values.fps !== undefined && !(Number(values.fps) > 0)) throw usage(`--fps must be a positive number (got "${values.fps}")`);

    guardStaleScript(runDir);

    // The Motion Gate.
    const check = run.check;
    if (!check) throw new CliError("Motion Gate closed: no check on record for this run", { fix: `run: ${hint(`check ${q(runDir)}`)}` });
    if (!check.ok || check.errors > 0) throw new CliError(`Motion Gate closed: the latest check found ${check.errors} error(s)`, { fix: `fix them, then run: ${hint(`check ${q(runDir)}`)}` });
    const hash = projectHash(project);
    if (check.hash !== hash) throw new CliError("Motion Gate closed: index.html, explain-data.js or index.motion.json changed since the last check", { fix: `run: ${hint(`check ${q(runDir)}`)}` });

    const hf = resolveHyperframes(deps, { probeNpx: true });
    if (!hf.ok) throw new CliError(hf.reason, { fix: hf.fix });
    const mp4 = path.join(runDir, `${run.slug}.mp4`);
    const started = Date.now();
    if (!ctx.json) process.stderr.write(`Rendering ${path.basename(mp4)} (${fmtSec(run.timeline?.total ?? 0)} s of video; this takes a while)...\n`);
    const r = runRender(deps, hf, project, { out: mp4, quality, fps: values.fps, inherit: Boolean(values.verbose) && !ctx.json });
    const renderSeconds = Math.round((Date.now() - started) / 100) / 10;
    if (!r.ok || !fs.existsSync(mp4)) throw new CliError(`hyperframes render failed${r.status != null ? ` (exit ${r.status})` : ""}`, { fix: `run: ${hint("doctor")}; the render output above says what broke`, lines: r.stderr ? r.stderr.split("\n").map((l) => `  ${l}`) : [] });

    const explain = readExplainData(project);
    const framesDir = path.join(runDir, "frames");
    fs.mkdirSync(framesDir, { recursive: true });
    const frames = [];
    const frameTimes = {};
    const frameWarnings = [];
    // two frames per beat: <id>-in.png for the entrance, <id>.png once its motion has settled
    for (const fr of inspectionFrames(explain.beats)) {
      const out = path.join(framesDir, `${fr.name}.png`);
      const f = ffmpegFrame(deps, { video: mp4, atSec: fr.at, out });
      if (f.ok && fs.existsSync(out)) {
        frames.push(out);
        frameTimes[fr.name] = fr.at;
      } else frameWarnings.push(`could not extract the ${fr.kind === "in" ? "entrance " : "settled "}frame for ${fr.id}: ${f.stderr}`);
    }

    const dest = values.dest ? path.resolve(values.dest) : run.dest;
    const delivered = [];
    if (dest) {
      fs.mkdirSync(dest, { recursive: true });
      const srt = path.join(runDir, `${run.slug}.srt`);
      for (const f of [mp4, srt]) {
        if (!fs.existsSync(f)) continue;
        const to = path.join(dest, path.basename(f));
        fs.copyFileSync(f, to);
        delivered.push(to);
      }
    }

    const version = check.version ?? run.hyperframes?.version ?? hf.version;
    const metricsFile = appendMetrics({
      skill: "explain-me",
      run: path.basename(runDir),
      lang: run.lang,
      silent: Boolean(run.silent),
      beats: explain.beats.length,
      duration_s: explain.total,
      check_errors: check.errors,
      motion_frozen: check.frozen ?? 0,
      render_s: renderSeconds,
      hyperframes_version: version ?? null,
      overrides: run.design?.overrides ?? [],
      format: "video",
      orientation: runOrientation(run),
      captions_burned: Boolean(explain.captions?.burn),
    });
    updateRun(runDir, { hyperframes: { tier: hf.tier, version: version ?? null }, render: { path: mp4, at: new Date().toISOString(), seconds: renderSeconds } });

    const data = { ok: true, run: runDir, mp4, srt: path.join(runDir, `${run.slug}.srt`), frames, frameTimes, orientation: runOrientation(run), captionsBurned: Boolean(explain.captions?.burn), delivered, duration: explain.total, renderSeconds, silent: Boolean(run.silent), overrides: run.design?.overrides ?? [], metrics: metricsFile, warnings: frameWarnings };
    const lines = [
      `video:     ${mp4}`,
      `subtitles: ${data.srt}`,
      `frames:    ${framesDir} (${frames.length} of ${explain.beats.length * 2}: <id>-in.png at ${Math.round(ENTRANCE_FRAME_FRACTION * 100)}% of each beat, at most ${ENTRANCE_FRAME_MAX_SEC.toFixed(1)} s after it starts, shows the entrance; <id>.png ${FRAME_BEFORE_END_SEC} s before it ends, shows it settled; look at both before you deliver)`,
      `duration:  ${fmtSec(explain.total)} s, rendered in ${fmtSec(renderSeconds)} s${run.silent ? " (silent)" : ""}`,
      ...(delivered.length ? [`delivered:  ${delivered.join(", ")}`] : []),
      ...overrideLines(run.design?.overrides),
      ...frameWarnings.map((w) => `warn: ${w}`),
    ];
    return { code: 0, data, lines };
  },
});

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const SHARED_OPTIONS = { json: { type: "boolean" }, help: { type: "boolean", short: "h" } };

export async function main(argv, { deps = defaultDeps() } = {}) {
  const [name, ...rest] = argv;
  if (!name) {
    process.stderr.write(topHelp());
    return 2;
  }
  if (name === "--help" || name === "-h" || name === "help") {
    process.stdout.write(topHelp());
    return 0;
  }
  const cmd = COMMANDS[name];
  const wantsJson = rest.includes("--json");
  const report = (err) => {
    if (wantsJson) {
      console.log(JSON.stringify({ ok: false, error: err.message, fix: err.fix ?? null, ...err.data }, null, 2));
    } else {
      process.stderr.write(`error: ${err.message}\n`);
      for (const l of err.lines ?? []) process.stderr.write(`${l}\n`);
      if (err.fix) process.stderr.write(`fix: ${err.fix}\n`);
    }
    return err.code ?? 1;
  };
  if (!cmd) return report(usage(`unknown command "${name}"`));

  let parsed;
  try {
    parsed = parseArgs({ args: rest, options: { ...SHARED_OPTIONS, ...cmd.options }, allowPositionals: true, strict: true });
  } catch (e) {
    return report(usage(e.message));
  }
  if (parsed.values.help) {
    process.stdout.write(commandHelp(name));
    return 0;
  }
  if (parsed.positionals.length > cmd.positionals) return report(usage(`unexpected argument "${parsed.positionals[cmd.positionals]}"`));
  if (cmd.positionals === 1 && parsed.positionals.length < 1) return report(usage(`${name} needs a <run> (a run folder path or a slug)`));

  const ctx = { json: Boolean(parsed.values.json), deps };
  try {
    const result = await cmd.run(ctx, parsed);
    if (ctx.json) console.log(JSON.stringify(result.data, null, 2));
    else if (result.lines.length) console.log(result.lines.join("\n"));
    return result.code ?? 0;
  } catch (e) {
    if (e instanceof CliError) return report(e);
    if (e instanceof SpecError) return report(new CliError(e.message, { fix: `run: ${hint("design check <path>")}` }));
    return report(new CliError(e?.stack ?? String(e)));
  }
}

const isMain = (() => {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

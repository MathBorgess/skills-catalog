// A run: its folder, run.json, the HyperFrames project inside it, the gate hash and metrics.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { frameMd, loadSpec, resolveDesign, tokensCss, validateSpec } from "./design.mjs";
import { SLUG_RE, createRunDir, personalDesignPath } from "./home.mjs";
import { DEFAULT_ORIENTATION, ORIENTATIONS, normalizeOrientation } from "./orientation.mjs";
import { applyOrientation, hasTokensRegion, kokoroLang, lintLang, rewriteHtmlLang, rewriteTokensRegion, voiceFor } from "./timeline.mjs";

export class DesignInvalid extends Error {
  constructor(problems) {
    super("the design spec is invalid");
    this.name = "DesignInvalid";
    this.problems = problems; // [{file, path, message}]
  }
}

export const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
export const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");

export const runFile = (runDir) => path.join(runDir, "run.json");
export const projectDir = (runDir) => path.join(runDir, "project");

export function readRun(runDir) {
  try {
    return readJson(runFile(runDir));
  } catch (e) {
    throw new Error(`cannot read ${runFile(runDir)}: ${e.message}`);
  }
}

export function updateRun(runDir, patch) {
  const run = { ...readRun(runDir), ...patch };
  writeJson(runFile(runDir), run);
  return run;
}

// sha256 over what the Motion Gate protects: the composition, its data, its motion sidecar, the
// style tokens and the kit.
export const GATED_FILES = ["index.html", "explain-data.js", "index.motion.json", "tokens.css", "kit.js"];
export function projectHash(project) {
  const h = crypto.createHash("sha256");
  for (const name of GATED_FILES) {
    let content = "<missing>";
    try {
      content = fs.readFileSync(path.join(project, name), "utf8");
    } catch {
      /* hash the marker */
    }
    h.update(`${name}\0${content.length}\0${content}\0`);
  }
  return h.digest("hex");
}

// ---------------------------------------------------------------------------
// the script guard: `voice` records the sha256 of script.json, `check` and `render` refuse a changed one
// ---------------------------------------------------------------------------

export const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

export const STALE_SCRIPT_MESSAGE = "script.json changed since voice: run voice again";

// {stale: false} for a run whose voice never recorded a hash (made before the guard existed), for a run
// whose script is unchanged; {stale: true, missing} otherwise.
export function scriptStaleness(runDir, run = readRun(runDir)) {
  if (typeof run.scriptHash !== "string" || !run.scriptHash) return { stale: false, recorded: false };
  let text;
  try {
    text = fs.readFileSync(path.join(runDir, "script.json"), "utf8");
  } catch {
    return { stale: true, missing: true, recorded: true };
  }
  return { stale: sha256(text) !== run.scriptHash, missing: false, recorded: true };
}

export function starterScript({ lang, title }) {
  return {
    lang,
    title: title ?? "",
    beats: [{ id: "b01", scene: "s1", narration: "", subject: "#subject" }],
  };
}

// ---------------------------------------------------------------------------
// explanation.md: the three things every explanation starts from
// ---------------------------------------------------------------------------

// The sections in the requester language: Portuguese for any pt tag, English for every other language. Each
// section carries a one-line HTML comment that says what goes there; ste-lint skips such a line, and the table.
const EXPLANATION_TEXT = {
  pt: {
    distinction: ["Distinção central", "Uma frase: o que o aluno precisa saber explicar de volta."],
    glossary: ["Glossário", "Uma linha por termo: o nome simples que o aluno já usa, o nome formal e um exemplo concreto."],
    header: ["termo simples", "nome formal", "exemplo"],
    question: ["Pergunta de explicação", "Uma pergunta que o aluno responde com as próprias palavras."],
  },
  en: {
    distinction: ["Load-bearing distinction", "One sentence: what the learner must be able to explain back."],
    glossary: ["Glossary", "One row per term: the plain name the learner already uses, the formal name, and one concrete example."],
    header: ["plain name", "formal name", "example"],
    question: ["Explain-back question", "One question the learner answers in their own words."],
  },
};

export const explanationLanguage = (lang) => (lintLang(lang) === "pt" ? "pt" : "en");

export function starterExplanation(lang) {
  const t = EXPLANATION_TEXT[explanationLanguage(lang)];
  const row = (cells) => `| ${cells.join(" | ")} |`;
  return [
    `## ${t.distinction[0]}`,
    "",
    `<!-- ${t.distinction[1]} -->`,
    "",
    `## ${t.glossary[0]}`,
    "",
    `<!-- ${t.glossary[1]} -->`,
    "",
    row(t.header),
    row(t.header.map(() => "---")),
    "",
    `## ${t.question[0]}`,
    "",
    `<!-- ${t.question[1]} -->`,
    "",
  ].join("\n");
}

// Writes <runDir>/explanation.md for a new run and returns its path. A file that is already there is never
// touched (the `wx` flag refuses it), so a second call, or a folder somebody filled first, keeps its text.
export function writeStarterExplanation(runDir, lang) {
  const file = path.join(runDir, "explanation.md");
  try {
    fs.writeFileSync(file, starterExplanation(lang), { flag: "wx" });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
  return file;
}

// Validate every layer on its own (each is checked against its own folder), return problems.
export function validateLayers(layers) {
  const problems = [];
  const warnings = [];
  for (const layer of layers) {
    const r = validateSpec(layer);
    for (const e of r.errors) problems.push({ file: layer.path, ...e });
    for (const w of r.warnings) warnings.push({ file: layer.path, ...w });
  }
  return { problems, warnings };
}

// assets/logo images are copied into the project so the render can load them; reference images
// stay where they are (they are for the agent to look at).
function adoptProjectImages(data, project) {
  if (!Array.isArray(data.images)) return [];
  const copied = [];
  const taken = new Set();
  for (const img of data.images) {
    if (!img || typeof img.path !== "string" || !["asset", "logo"].includes(img.role)) continue;
    if (!fs.existsSync(img.path)) continue;
    let name = path.basename(img.path);
    for (let n = 2; taken.has(name); n++) name = `${n}-${path.basename(img.path)}`;
    taken.add(name);
    fs.mkdirSync(path.join(project, "assets"), { recursive: true });
    fs.copyFileSync(img.path, path.join(project, "assets", name));
    copied.push({ from: img.path, to: `assets/${name}` });
    img.path = `assets/${name}`;
  }
  return copied;
}

// What run.json records about the design: the layers it resolved, what they override, and the
// explicit spec path (so a later `voice` can resolve the same layers again).
const designRecord = (resolved, explicit) => ({ sources: resolved.layers.map((l) => l.path), overrides: resolved.overrides, explicit: explicit ?? null });

// Resolve explicit -> personal -> shipped and validate every layer; throws DesignInvalid.
export function loadDesignLayers({ home, assetsDir, explicit }) {
  const resolved = resolveDesign({ explicit: explicit || undefined, personal: personalDesignPath(home), shipped: path.join(assetsDir, "DESIGN.md") });
  const { problems, warnings } = validateLayers(resolved.loaded);
  if (problems.length) throw new DesignInvalid(problems);
  return { resolved, warnings };
}

// Puts the text of tokens.css into the tokens region of index.html (fonts reach the render only from an
// inline <style>). Returns {present, changed}; present is false when index.html has no tokens markers.
export function inlineTokens(project) {
  const file = path.join(project, "index.html");
  let html;
  let css;
  try {
    html = fs.readFileSync(file, "utf8");
    css = fs.readFileSync(path.join(project, "tokens.css"), "utf8");
  } catch {
    return { present: false, changed: false };
  }
  if (!hasTokensRegion(html)) return { present: false, changed: false };
  const next = rewriteTokensRegion(html, css);
  if (next !== html) fs.writeFileSync(file, next);
  return { present: true, changed: next !== html };
}

export const noTokensRegionWarning = (project) => ({
  file: path.join(project, "index.html"),
  path: "explain:tokens",
  message: "index.html has no explain:tokens markers, so brand fonts will not reach the render; restore them from assets/composition.html",
});

// Writes project/frame.md and project/tokens.css (and copies asset/logo images) from a resolved design,
// then inlines the tokens into index.html. Returns whether any of them changed.
function writeProjectDesign(project, resolved) {
  const data = resolved.data; // adoptProjectImages rewrites image paths in place
  const copiedImages = adoptProjectImages(data, project);
  const write = (name, content) => {
    const file = path.join(project, name);
    let before = null;
    try {
      before = fs.readFileSync(file, "utf8");
    } catch {
      /* first write */
    }
    fs.writeFileSync(file, content);
    return before !== content;
  };
  const frameChanged = write("frame.md", frameMd(data, resolved.body));
  const tokensChanged = write("tokens.css", tokensCss(data));
  const inline = inlineTokens(project);
  return { copiedImages, changed: frameChanged || tokensChanged || inline.changed, frameChanged, tokensChanged, inlineChanged: inline.changed, inlinePresent: inline.present };
}

// The explicit spec this run was created with: recorded in run.json, or inferred for older runs
// (a source that is neither the personal DESIGN.md nor the shipped default).
function recordedExplicit(run, home) {
  if (run.design && run.design.explicit !== undefined) return run.design.explicit;
  const personal = path.resolve(personalDesignPath(home));
  const rest = (run.design?.sources ?? []).slice(0, -1).filter((p) => path.resolve(p) !== personal);
  return rest[0] ?? null;
}

// Re-resolves the design layers of a run (explicit, then the personal DESIGN.md as it is now, then the
// shipped default) and rewrites frame.md and tokens.css. This is how a restyle reaches an existing run:
// edit the spec, run `voice`, `check`, `render`. Throws DesignInvalid or SpecError.
export function refreshDesign({ runDir, home, assetsDir }) {
  const run = readRun(runDir);
  const explicit = recordedExplicit(run, home);
  const { resolved, warnings } = loadDesignLayers({ home, assetsDir, explicit });
  const written = writeProjectDesign(projectDir(runDir), resolved);
  if (!written.inlinePresent) warnings.push(noTokensRegionWarning(projectDir(runDir)));
  const design = designRecord(resolved, explicit);
  const previous = JSON.stringify(run.design?.overrides ?? []);
  updateRun(runDir, { design });
  return { ...written, layers: resolved.layers, overrides: resolved.overrides, overridesChanged: previous !== JSON.stringify(resolved.overrides), warnings };
}

export const FORMATS = ["video", "svg", "html", "text", "mermaid", "image"];

export function createRun({ home, slug, lang, title, designPath, dest, assetsDir, hyperframes, format = "video", orientation = DEFAULT_ORIENTATION, now = new Date() }) {
  const orient = normalizeOrientation(orientation);
  if (!orient) throw new Error(`invalid --orientation ${JSON.stringify(orientation)}: use ${ORIENTATIONS.join(" or ")}`);
  if (!FORMATS.includes(format)) throw new Error(`invalid --format ${JSON.stringify(format)}: use one of ${FORMATS.join(", ")}`);
  if (!SLUG_RE.test(slug ?? "")) throw new Error(`invalid slug ${JSON.stringify(slug)}: use lowercase letters, digits and hyphens (for example hash-table-lookup)`);
  if (!lang || typeof lang !== "string") throw new Error("missing --lang: pass the language of the request, for example pt-BR or en");

  const explicit = designPath ? path.resolve(designPath) : null;
  const { resolved, warnings } = loadDesignLayers({ home, assetsDir, explicit });

  if (format !== "video") return createStaticRun({ home, slug, lang, title, dest, format, resolved, explicit, warnings, now });

  for (const f of ["composition.html", "kit.js"]) {
    if (!fs.existsSync(path.join(assetsDir, f))) throw new Error(`the skill is missing assets/${f} (looked in ${assetsDir})`);
  }

  const runDir = createRunDir(home, slug, now);
  const project = projectDir(runDir);
  fs.mkdirSync(project, { recursive: true });
  // the frame size, the placeholder stage and <html lang> are set here; the agent then authors in that viewBox
  const composition = fs.readFileSync(path.join(assetsDir, "composition.html"), "utf8");
  fs.writeFileSync(path.join(project, "index.html"), rewriteHtmlLang(applyOrientation(composition, orient), lang));
  fs.copyFileSync(path.join(assetsDir, "kit.js"), path.join(project, "kit.js"));

  const data = resolved.data;
  const { copiedImages, inlinePresent } = writeProjectDesign(project, resolved);
  if (!inlinePresent) warnings.push(noTokensRegionWarning(project));

  const kLang = kokoroLang(lang);
  const voice = voiceFor(data, kLang);
  const run = {
    slug,
    format,
    lang,
    orientation: orient,
    kokoroLang: kLang,
    voice,
    title: title ?? "",
    created: now.toISOString(),
    dest: dest ? path.resolve(dest) : null,
    design: designRecord(resolved, explicit),
    hyperframes: hyperframes ? { tier: hyperframes.tier, version: hyperframes.version } : null,
    python: null,
    timeline: null,
    check: null,
    render: null,
  };
  writeJson(runFile(runDir), run);
  writeJson(path.join(runDir, "script.json"), starterScript({ lang, title }));
  const explanation = writeStarterExplanation(runDir, lang);

  return { runDir, projectDir: project, run, warnings, copiedImages, layers: resolved.layers, designData: data, explanation };
}

// A Run for a format without narration or motion: the folder, run.json, and the tokens the artefact inlines.
function createStaticRun({ home, slug, lang, title, dest, format, resolved, explicit, warnings, now }) {
  const runDir = createRunDir(home, slug, now);
  if (format === "svg" || format === "html") fs.writeFileSync(path.join(runDir, "tokens.css"), tokensCss(resolved.data));
  const run = {
    slug,
    format,
    lang,
    title: title ?? "",
    created: now.toISOString(),
    dest: dest ? path.resolve(dest) : null,
    design: designRecord(resolved, explicit),
  };
  writeJson(runFile(runDir), run);
  const explanation = writeStarterExplanation(runDir, lang);
  return { runDir, projectDir: null, run, warnings, copiedImages: [], layers: resolved.layers, explanation };
}

export function readExplainData(project) {
  const text = fs.readFileSync(path.join(project, "explain-data.js"), "utf8");
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

export function readProjectDesign(project) {
  const spec = loadSpec(path.join(project, "frame.md"));
  return spec.data;
}

// One JSON line per finished render, in the OS temp dir. Never rewritten.
export function appendMetrics(line, { tmpdir = os.tmpdir() } = {}) {
  const dir = path.join(tmpdir, "explain-me");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "metrics.jsonl");
  fs.appendFileSync(file, JSON.stringify(line) + "\n");
  return file;
}

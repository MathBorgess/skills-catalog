#!/usr/bin/env node
// Provenance and temporary work files; design and generation remain agent work.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { finalReadiness } from "./workflow.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const bundledRegistry = path.resolve(here, "../references/registry.json");
const spatialGuide = path.resolve(here, "../references/spatial-collections.md");
const movementGuide = path.resolve(here, "../references/mindful-movement.md");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const readJSON = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJSON = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
export const headings = ["Reference composition", "Work brief", "Author invariants", "Author overrides", "Base to authorship", "Expected result", "Object cast", "Motion score", "Animation plan", "Generation and inspection"];
const schema2Headings = [...headings];
headings.push("Exploration collection", "Spatial direction", "Authorship refinement");
const legacyHeadings = schema2Headings.filter((h) => !["Author overrides", "Object cast", "Motion score"].includes(h));

function inside(root, relative) {
  if (typeof relative !== "string" || !relative || path.isAbsolute(relative)) throw new Error("Expected a relative path");
  const target = path.resolve(root, relative);
  const rel = path.relative(root, target);
  if (!rel || rel === ".." || rel.startsWith(".." + path.sep)) throw new Error("Path must remain inside its directory");
  // Reject symlinks escaping the run/registry too.
  if (fs.existsSync(target)) {
    const real = path.relative(fs.realpathSync(root), fs.realpathSync(target));
    if (real === ".." || real.startsWith(".." + path.sep)) throw new Error("Symlink leaves its directory");
  }
  return target;
}

function selectReferences(registryPath, ids) {
  const registry = readJSON(registryPath);
  if (registry.schema_version !== 1 || !Array.isArray(registry.references)) throw new Error("Unsupported reference registry");
  const seen = new Set();
  for (const entry of registry.references) {
    if (!/^[a-z][a-z0-9-]*$/.test(entry.id) || seen.has(entry.id)) throw new Error("Invalid or duplicate reference id");
    seen.add(entry.id);
  }
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error("Select at least one distinct reference");
  return ids.map((id) => {
    const entry = registry.references.find((r) => r.id === id);
    if (!entry) throw new Error(`Unknown reference: ${id}`);
    if (!["documented-practice", "observed-example", "measured-result"].includes(entry.evidence_level)) throw new Error(`Invalid evidence level: ${id}`);
    if (!Array.isArray(entry.sources) || !entry.sources.length || entry.sources.some((s) => !s.url || !s.revision)) throw new Error(`Reference needs sources and revisions: ${id}`);
    const file = inside(path.dirname(registryPath), entry.profile);
    const bytes = fs.readFileSync(file);
    if (!bytes.length) throw new Error(`Empty profile: ${id}`);
    const resources = (entry.resources ?? []).map((relative) => {
      const bytes = fs.readFileSync(inside(path.dirname(registryPath), relative));
      if (!bytes.length) throw new Error(`Empty reference resource: ${relative}`);
      return { path: relative, bytes, sha256: hash(bytes) };
    });
    return { ...entry, resources, bytes, profile_sha256: hash(bytes) };
  });
}

export function newRun({ design, brief, references = ["apple-fluid", "disney-principles", "lottiefiles-motion-design"], stage = "exploration", videoReviewMode = "complete-video", registry = bundledRegistry, tempRoot = os.tmpdir() }) {
  if (!["exploration", "refinement"].includes(stage)) throw new Error("Stage must be exploration or refinement");
  if (!["complete-video", "per-attempt"].includes(videoReviewMode)) throw new Error("Video review mode must be complete-video or per-attempt");
  const source = fs.realpathSync(path.resolve(design));
  const bytes = fs.readFileSync(source);
  if (!bytes.length) throw new Error("Source design is empty");
  if (!brief) throw new Error("Save the human briefing and pass --brief");
  const sourceBrief = fs.realpathSync(path.resolve(brief));
  const briefBytes = fs.readFileSync(sourceBrief);
  if (!briefBytes.length) throw new Error("Human briefing is empty");
  const selected = selectReferences(path.resolve(registry), references);
  const guideline = fs.readFileSync(movementGuide);
  const spatial = fs.readFileSync(spatialGuide);
  const run = fs.mkdtempSync(path.join(tempRoot, "co-direct-animation-"));
  fs.mkdirSync(path.join(run, "references"));
  fs.mkdirSync(path.join(run, "guidelines"));
  fs.writeFileSync(path.join(run, "guidelines/mindful-movement.md"), guideline);
  const manifest = {
    schema_version: 4, stage, skill: "co-direct-animation", status: "draft", video_review_mode: videoReviewMode,
    source_brief: sourceBrief, brief_sha256: hash(briefBytes),
    created: new Date().toISOString(), source_design: source,
    source_asset_base: path.dirname(source), source_sha256: hash(bytes),
    movement_guideline: { id: "mindful-movement", origin: "creative-brief", revision: "2026-10-12", snapshot: "guidelines/mindful-movement.md", sha256: hash(guideline) },
    spatial_guideline: { snapshot: "guidelines/spatial-collections.md", sha256: hash(spatial) },
    references: selected.map(({ bytes: profile, resources, ...entry }) => {
      const snapshot = `references/${entry.id}/${entry.profile}`;
      fs.mkdirSync(path.dirname(path.join(run, snapshot)), { recursive: true });
      fs.writeFileSync(path.join(run, snapshot), profile);
      const snapshots = resources.map(({ path: resource, bytes, sha256 }) => {
        const snapshot = `references/${entry.id}/${resource}`;
        fs.mkdirSync(path.dirname(path.join(run, snapshot)), { recursive: true });
        fs.writeFileSync(path.join(run, snapshot), bytes);
        return { path: resource, snapshot, sha256 };
      });
      return { ...entry, snapshot, resources: snapshots };
    }),
  };
  fs.writeFileSync(path.join(run, "guidelines/spatial-collections.md"), spatial);
  fs.writeFileSync(path.join(run, "SOURCE-DESIGN.md"), bytes);
  fs.writeFileSync(path.join(run, "SOURCE-BRIEF.md"), briefBytes);
  fs.writeFileSync(path.join(run, "DESIGN.md"), bytes);
  writeJSON(path.join(run, "run.json"), manifest);
  return { run, design: path.join(run, "DESIGN.md"), source_sha256: manifest.source_sha256 };
}

export function provenance(run) {
  const manifest = readJSON(path.join(run, "run.json"));
  if (!([1, 2, 3].includes(manifest.schema_version) && manifest.skill === "reference-animation") && !(manifest.schema_version === 4 && manifest.skill === "co-direct-animation")) throw new Error("Unsupported run");
  if (manifest.schema_version === 4 && hash(fs.readFileSync(path.join(run, "SOURCE-BRIEF.md"))) !== manifest.brief_sha256) throw new Error("Brief snapshot changed");
  const snapshot = fs.readFileSync(path.join(run, "SOURCE-DESIGN.md"));
  if (hash(snapshot) !== manifest.source_sha256) throw new Error("Source snapshot changed");
  if (hash(fs.readFileSync(manifest.source_design)) !== manifest.source_sha256) throw new Error("Original design changed; create a new run from the current source");
  for (const ref of manifest.references) {
    for (const resource of ref.resources ?? []) {
      if (hash(fs.readFileSync(inside(run, resource.snapshot))) !== resource.sha256) throw new Error(`Reference resource changed: ${resource.path}`);
    }
    if (hash(fs.readFileSync(inside(run, ref.snapshot))) !== ref.profile_sha256) throw new Error(`Reference snapshot changed: ${ref.id}`);
  }
  if (manifest.schema_version >= 2) {
    const guide = manifest.movement_guideline;
    if (guide?.id !== "mindful-movement" || hash(fs.readFileSync(inside(run, guide.snapshot))) !== guide.sha256) throw new Error("Mindful Movement guideline missing or changed");
  }
  if (manifest.schema_version >= 3) {
    if (!["exploration", "refinement"].includes(manifest.stage)) throw new Error("Invalid run stage");
    const guide = manifest.spatial_guideline;
    if (!guide || hash(fs.readFileSync(inside(run, guide.snapshot))) !== guide.sha256) throw new Error("Spatial guideline missing or changed");
  }
  return { manifest, snapshot };
}

function checkProposal(text, schemaVersion) {
  for (const heading of schemaVersion === 1 ? legacyHeadings : schemaVersion === 2 ? schema2Headings : headings) {
    const parts = text.split(`## ${heading}\n`);
    if (parts.length !== 2 || !parts[1].split(/\n## /)[0].trim()) throw new Error(`Missing or empty composition section: ${heading}`);
  }
}

export function compose(run, proposal) {
  run = fs.realpathSync(run);
  const { manifest, snapshot } = provenance(run);
  const text = fs.readFileSync(proposal, "utf8").replace(/\r\n/g, "\n");
  checkProposal(text, manifest.schema_version);
  const working = Buffer.concat([snapshot, Buffer.from("\n\n<!-- Work-specific reference composition; source above preserves authorship; the composition records stage and explicit scoped author overrides. -->\n\n" + text)]);
  fs.writeFileSync(path.join(run, "DESIGN.md"), working);
  manifest.status = "composed";
  manifest.composition_sha256 = hash(text);
  manifest.design_sha256 = hash(working);
  fs.writeFileSync(path.join(run, "composition.md"), text);
  writeJSON(path.join(run, "run.json"), manifest);
  return { run, design: path.join(run, "DESIGN.md"), design_sha256: manifest.design_sha256 };
}

export function direction(run) {
  run = fs.realpathSync(run);
  const { manifest, snapshot } = provenance(run);
  const design = fs.readFileSync(path.join(run, "DESIGN.md"));
  if (!design.subarray(0, snapshot.length).equals(snapshot)) throw new Error("Working design no longer preserves the original prefix");
  if (!manifest.design_sha256 || hash(design) !== manifest.design_sha256) throw new Error("Working design changed; compose it again");
  const proposal = fs.readFileSync(path.join(run, "composition.md"), "utf8");
  if (hash(proposal) !== manifest.composition_sha256) throw new Error("Composition changed; compose it again");
  checkProposal(proposal, manifest.schema_version);
  return { manifest, snapshot };
}

export function check(run) {
  run = fs.realpathSync(run);
  const { manifest } = direction(run);
  const delivery = readJSON(path.join(run, "delivery.json"));
  if (manifest.schema_version < 4 && delivery.status !== "preview") throw new Error("Legacy workflow delivers a preview, not brand approval");
  if (manifest.schema_version === 4 && !["ready-for-review", "accepted"].includes(delivery.status)) throw new Error("Delivery status must be ready-for-review or accepted");
  if (!Array.isArray(delivery.artifacts) || !delivery.artifacts.length) throw new Error("No delivery artifacts");
  let animation = false;
  let evidence = false;
  for (const artifact of delivery.artifacts) {
    const file = inside(run, artifact.path);
    if (!fs.statSync(file).isFile() || !fs.statSync(file).size) throw new Error(`Missing or empty artifact: ${artifact.path}`);
    if (artifact.kind === "animation" && (manifest.schema_version < 4 ? /\.(html|mp4|webm|gif)$/i : /\.(mp4|webm)$/i).test(file)) animation = true;
    if (artifact.kind === "evidence") evidence = true;
  }
  if (!animation || !evidence) throw new Error("Delivery needs both animation and inspection evidence");
  const inspection = delivery.inspection;
  if (inspection?.status !== "inspected" || !inspection.method?.trim() || !Array.isArray(inspection.findings) || !inspection.findings.length) throw new Error("Record actual inspection and findings");
  if (!Array.isArray(delivery.limitations)) throw new Error("Record delivery limitations, even when empty");
  const reviews = manifest.schema_version === 4 ? finalReadiness(run) : { final: "legacy-preview" };
  if (manifest.schema_version === 4 && (!Array.isArray(delivery.source_attempts) || !delivery.source_attempts.length || delivery.source_attempts.some(id => !reviews.generated.some(a => a.id === id)))) throw new Error("Name reviewed gflow source_attempts for the assembled film");
  if (manifest.schema_version === 4 && delivery.source_attempts.some(id => !reviews.previewPacket.dependencies.some(d => d.id === id))) throw new Error("Source attempts were not included in the accepted complete motion preview");
  if (delivery.status === "accepted" && reviews.final !== "accepted-record") throw new Error("Final human review missing or stale");
  if (delivery.status === "accepted" && delivery.artifacts.some(a => !reviews.finalPacket.artifacts.some(p => p.path === a.path && p.sha256 === hash(fs.readFileSync(inside(run, a.path)))))) throw new Error("Delivery artifacts differ from the accepted final packet");
  return { ok: true, run, structural_checks: "passed", reviews: reviews.final, visual_assessment: "agent-recorded; not verified by this script", artifacts: delivery.artifacts };
}

const help = "compose.mjs new --design <source> --brief <human-brief.md> [--stage exploration|refinement] [--video-review-mode complete-video|per-attempt] [--references apple-fluid,disney-principles,lottiefiles-motion-design] [--registry <json>]\ncompose.mjs compose <run> --proposal <markdown>\ncompose.mjs check <run>";
function main(args) {
  if (!args.length || args.includes("--help")) return { usage: help };
  const command = args.shift();
  const options = {};
  let run;
  if (command !== "new") run = args.shift();
  while (args.length) {
    const key = args.shift();
    if (!["--design", "--brief", "--stage", "--video-review-mode", "--references", "--registry", "--proposal"].includes(key) || !args.length || args[0].startsWith("--")) throw new Error(`Invalid option: ${key}`);
    options[key.slice(2)] = args.shift();
  }
  if (command === "new" && options.design) return newRun({ ...options, videoReviewMode: options["video-review-mode"], references: options.references?.split(",") });
  if (command === "compose" && run && options.proposal) return compose(run, options.proposal);
  if (command === "check" && run) return check(run);
  throw new Error(help);
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  try { console.log(JSON.stringify(main(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; }
}

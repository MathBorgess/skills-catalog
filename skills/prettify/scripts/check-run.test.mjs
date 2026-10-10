import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("./check-run.mjs", import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "prettify-cli-"));
const callerCwd = path.join(temp, "caller-cwd");
fs.mkdirSync(callerCwd);
let n = 0;

function fixture(mutator = () => {}) {
  const dir = path.join(temp, `case-${++n}`);
  fs.mkdirSync(path.join(dir, "project"), { recursive: true });
  const project = path.join(dir, "project");
  const design = "# Visual direction\n\nUse warm colors.\n";
  fs.writeFileSync(path.join(project, "DESIGN.md"), design);
  fs.writeFileSync(path.join(project, "DESIGN.original.md"), design);
  fs.mkdirSync(path.join(project, "receipts"));
  fs.mkdirSync(path.join(project, "dist"));
  fs.writeFileSync(path.join(project, "dist/index.html"), "<!doctype html><title>Prototype</title>");
  const put = (name, value) => fs.writeFileSync(path.join(project, name), JSON.stringify(value));
  put("receipts/briefing.json", { decision: "accepted", reason: "Brief approved for the run.", evidence: ["brief.md"] });
  put("receipts/skip-low.json", { decision: "skip", reason: "The user asked to go straight to delivery.", evidence: ["user choice"] });
  put("receipts/high.json", { decision: "accepted", reason: "The high fidelity candidate was accepted.", evidence: ["high.html"] });
  put("receipts/dependency.json", { decision: "available", reason: "The required editor is available.", evidence: ["image-editor"] });
  put("receipts/question.json", { decision: "inconclusive", reason: "Only one of two variants was explored.", evidence: ["variant-a"] });
  put("receipts/inspection.json", { decision: "inspected", reason: "The final artifact was opened and reviewed.", evidence: ["dist/index.html"] });
  const hash = crypto.createHash("sha256").update(design).digest("hex");
  const manifest = {
    version: 1,
    projectRoot: "project",
    design: { path: "DESIGN.md", original: { path: "DESIGN.original.md", sha256: hash }, decision: "accepted", update: null },
    stages: {
      briefing: { status: "complete", receipt: "receipts/briefing.json" },
      lowFidelity: { status: "skipped", receipt: "receipts/skip-low.json" },
      highFidelity: { status: "complete", receipt: "receipts/high.json" },
    },
    dependencies: [{ name: "image editor", required: true, status: "available", receipt: "receipts/dependency.json" }],
    questionResult: { status: "inconclusive", receipt: "receipts/question.json" },
    delivery: {
      artifacts: [{ kind: "web", path: "dist/index.html" }],
      inspection: { status: "inspected", receipt: "receipts/inspection.json" },
    },
  };
  mutator({ dir, project, manifest, put, hash });
  const manifestPath = path.join(dir, "run.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  return { manifestPath, project, manifest, put, hash };
}

function run(manifestPath) {
  const result = spawnSync(process.execPath, [cli, manifestPath], { encoding: "utf8", cwd: callerCwd });
  let output;
  try { output = JSON.parse(result.stdout); } catch { assert.fail(`CLI did not emit JSON: ${result.stdout}\n${result.stderr}`); }
  return { ...result, output };
}

try {
  {
    const f = fixture();
    const r = run(f.manifestPath);
    assert.equal(r.status, 0);
    assert.deepEqual(r.output, { ok: true, complete: true, errors: [] });
  }
  {
    const f = fixture();
    f.manifest.stages.briefing.receipt = { unexpected: "path" };
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    const r = run(f.manifestPath);
    assert.equal(r.status, 1);
    assert(r.output.errors.some((e) => e.code === "RECEIPT_MISSING"));
    assert(r.output.errors.every((e) => e.path === null || typeof e.path === "string"), "malformed path values never escape the public JSON schema");
  }
  {
    const f = fixture();
    fs.writeFileSync(path.join(f.project, "DESIGN.md"), "# Changed without approval\n");
    const r = run(f.manifestPath);
    assert.equal(r.status, 1);
    assert(r.output.errors.some((e) => e.code === "DESIGN_HASH_MISMATCH"), "an existing DESIGN edit without an update receipt blocks completion");
  }
  {
    const f = fixture(({ manifest }) => {
      manifest.dependencies[0].status = "missing";
      manifest.dependencies[0].receipt = "receipts/missing-dependency.json";
    });
    f.put("receipts/missing-dependency.json", { decision: "missing", reason: "The required editor is unavailable.", evidence: ["No usable editor capability was found."] });
    const r = run(f.manifestPath);
    assert.equal(r.status, 1);
    assert(r.output.errors.some((e) => e.code === "DEPENDENCY_BLOCKED"), "a required missing dependency blocks completion even with its receipt");
  }
  {
    const f = fixture(({ manifest }) => { manifest.design.decision = "rejected"; });
    const r = run(f.manifestPath);
    assert.equal(r.status, 1);
    assert(r.output.errors.some((e) => e.code === "DESIGN_REJECTED"));
  }
  {
    const f = fixture();
    f.manifest.design.original = null;
    f.manifest.design.decision = "piece-only";
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    assert.equal(run(f.manifestPath).status, 0, "a new piece-only design does not claim a durable edit");
    f.manifest.design.decision = "accepted";
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    assert(run(f.manifestPath).output.errors.some((e) => e.code === "DESIGN_HASH_MISMATCH"));
    f.manifest.design.update = { receipt: "receipts/design-update.json" };
    f.put("receipts/design-update.json", {
      decision: "design-update-approved",
      reason: "The user approved the durable design change.",
      evidence: ["user choice"],
      beforeSha256: null,
      afterSha256: f.hash,
    });
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    assert.equal(run(f.manifestPath).status, 0);
  }
  {
    const f = fixture(({ manifest }) => { manifest.stages.lowFidelity.status = "skipped"; });
    const r = run(f.manifestPath);
    assert.equal(r.output.complete, true, "a valid explicit skip is not fabricated approval");
    f.manifest.stages.lowFidelity.receipt = "receipts/high.json";
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    const bad = run(f.manifestPath);
    assert.equal(bad.status, 1);
    assert(bad.output.errors.some((e) => e.code === "RECEIPT_INVALID"));
  }
  {
    const f = fixture();
    f.manifest.design.update = { receipt: "receipts/design-update.json" };
    const updated = "# Visual direction\n\nUse warm colors and rounded forms.\n";
    fs.writeFileSync(path.join(f.project, "DESIGN.md"), updated);
    f.put("receipts/design-update.json", {
      decision: "design-update-approved",
      reason: "The user approved the durable design change.",
      evidence: ["user choice"],
      beforeSha256: f.hash,
      afterSha256: crypto.createHash("sha256").update(updated).digest("hex"),
    });
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    assert.equal(run(f.manifestPath).status, 0);
    f.manifest.design.update.receipt = "receipts/missing.json";
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    assert(run(f.manifestPath).output.errors.some((e) => e.code === "RECEIPT_MISSING"));
  }
  {
    const f = fixture(({ manifest }) => {
      manifest.dependencies[0].status = "refused";
      manifest.dependencies[0].receipt = "receipts/refused.json";
      manifest.delivery.inspection.status = "unverified";
      manifest.delivery.inspection.receipt = null;
    });
    f.put("receipts/refused.json", { decision: "refused", reason: "The user declined installation.", evidence: ["user choice"] });
    const r = run(f.manifestPath);
    assert.equal(r.status, 1);
    assert(r.output.errors.some((e) => e.code === "DEPENDENCY_BLOCKED"));
    assert(r.output.errors.some((e) => e.code === "INSPECTION_UNVERIFIED"));
    assert.equal(r.output.complete, false);
  }
  {
    const f = fixture(({ manifest }) => { manifest.delivery.artifacts[0] = { kind: "static", path: "dist/index.html" }; });
    assert.equal(run(f.manifestPath).status, 0, "static files use the same final inspection contract");
  }
  {
    const f = fixture(({ manifest }) => { manifest.delivery.artifacts[0] = { kind: "web", path: "." }; });
    assert.equal(run(f.manifestPath).status, 0, "a web project is deliverable by project path plus inspection receipt");
  }
  {
    const f = fixture(({ manifest }) => {
      manifest.delivery.artifacts[0] = { kind: "static", path: "missing.png" };
    });
    const r = run(f.manifestPath);
    assert(r.output.errors.some((e) => e.code === "ARTIFACT_MISSING"));
    f.manifest.delivery.artifacts[0] = { kind: "web", path: "dist/index.html" };
    f.manifest.questionResult.status = "visual-approved";
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    assert(run(f.manifestPath).output.errors.some((e) => e.code === "QUESTION_RESULT_INVALID"));
  }
  {
    const f = fixture(({ manifest }) => { delete manifest.stages.lowFidelity; });
    assert(run(f.manifestPath).output.errors.some((e) => e.code === "MANIFEST_INVALID"));
  }
  {
    const f = fixture();
    f.put("receipts/briefing.json", { decision: "accepted" });
    assert(run(f.manifestPath).output.errors.some((e) => e.code === "RECEIPT_INVALID"));
  }
  {
    const f = fixture();
    f.manifest.design.decision = "piece-only";
    f.manifest.design.update = { receipt: "receipts/design-update.json" };
    f.put("receipts/design-update.json", {
      decision: "design-update-approved",
      reason: "Durable update claim.",
      evidence: ["user choice"],
      beforeSha256: f.hash,
      afterSha256: f.hash,
    });
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    assert(run(f.manifestPath).output.errors.some((e) => e.code === "MANIFEST_INVALID"));
  }
  {
    const f = fixture(({ manifest }) => { manifest.surprise = true; });
    assert(run(f.manifestPath).output.errors.some((e) => e.code === "MANIFEST_INVALID"));
  }
  process.stdout.write("ok - prettify public CLI contract\n");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

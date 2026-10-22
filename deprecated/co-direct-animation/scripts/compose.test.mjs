import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { newRun, compose, check, headings } from "./compose.mjs";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "reference-animation-test-"));
try {
  const source = path.join(temp, "author.md");
  const original = "---\nauthor: Test author\n---\n# Original\nKeep the logo rigid, use Inter and hard cuts.\n";
  fs.writeFileSync(source, original);
  const { run } = newRun({ design: source, brief: source, tempRoot: temp });
  const manifest = JSON.parse(fs.readFileSync(path.join(run, "run.json")));
  assert.equal(manifest.source_asset_base, fs.realpathSync(temp));
  assert.equal(fs.readFileSync(path.join(run, "SOURCE-DESIGN.md"), "utf8"), original);
  assert.equal(manifest.references.length, 3);
  assert.equal(manifest.schema_version, 4);
  assert.equal(manifest.skill, "co-direct-animation");
  assert.equal(fs.readFileSync(path.join(run, "SOURCE-BRIEF.md"), "utf8"), original);
  assert.equal(manifest.movement_guideline.id, "mindful-movement");
  assert.ok(fs.readFileSync(path.join(run, manifest.movement_guideline.snapshot), "utf8").includes("objects as people"));

  assert.equal(manifest.stage, "exploration");
  assert.equal(manifest.references[2].resources.length, 3);
  const bundled = manifest.references[2].resources;
  const compilation = fs.readFileSync(path.join(run, bundled[0].snapshot), "utf8");
  const coverage = JSON.parse(fs.readFileSync(path.join(run, bundled[1].snapshot)));
  const bodies = [...compilation.matchAll(/~~~~markdown\n([\s\S]*?)\n~~~~\n/g)].map(m => m[1]);
  assert.equal(bodies.length, 17, "the full upstream skill has 17 source documents");
  assert.equal(coverage.files.length, bodies.length);
  bodies.forEach((body, i) => {
    assert.equal(Buffer.byteLength(body), coverage.files[i].bytes);
    assert.equal(createHash("sha256").update(body).digest("hex"), coverage.files[i].sha256);
  });
  assert.ok(fs.readFileSync(path.join(run, bundled[2].snapshot), "utf8").includes("Copyright (c) 2025 LottieFiles"));
  assert.throws(() => newRun({ design: source, brief: source, stage: "approved", tempRoot: temp }), /Stage/);
  const refined = newRun({ design: source, brief: source, stage: "refinement", tempRoot: temp });
  assert.equal(JSON.parse(fs.readFileSync(path.join(refined.run, "run.json"))).stage, "refinement");
  const extra = JSON.parse(fs.readFileSync(path.join(refined.run, "run.json"))).references[2].resources[0];
  fs.appendFileSync(path.join(refined.run, extra.snapshot), "tampered");
  assert.throws(() => check(refined.run), /Reference resource changed/);

  const proposal = path.join(temp, "proposal.md");
  fs.writeFileSync(proposal, headings.map((h) => `## ${h}\nRetain the author's choices; reject logo deformation.\n`).join("\n"));
  compose(run, proposal);
  assert.equal(fs.readFileSync(source, "utf8"), original);
  assert.ok(fs.readFileSync(path.join(run, "DESIGN.md"), "utf8").startsWith(original));
  const before = fs.readFileSync(path.join(run, "DESIGN.md"));
  for (const missing of ["Object cast", "Motion score", "Author overrides", "Exploration collection", "Spatial direction", "Authorship refinement"]) {
    fs.writeFileSync(proposal, headings.filter((h) => h !== missing).map((h) => `## ${h}\nSynthetic content\n`).join("\n"));
    assert.throws(() => compose(run, proposal), new RegExp(missing));
  }
  fs.writeFileSync(proposal, "## Work brief\nIncomplete\n");
  assert.throws(() => compose(run, proposal), /section/);
  assert.deepEqual(fs.readFileSync(path.join(run, "DESIGN.md")), before);
  // Historical schema 3 fixtures retain their original preview contract.
  manifest.schema_version = 3; manifest.skill = "reference-animation";
  const composedManifest = JSON.parse(fs.readFileSync(path.join(run, "run.json")));
  fs.writeFileSync(path.join(run, "run.json"), JSON.stringify({ ...composedManifest, schema_version: 3, skill: "reference-animation" }));
  assert.throws(() => check(run), /delivery.json/);

  const project = path.join(run, "project");
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, "index.html"), "<!doctype html><title>Synthetic animation record fixture</title>");
  fs.writeFileSync(path.join(run, "inspection.md"), "Synthetic record fixture; not a visual approval.");
  const delivery = { status: "preview", artifacts: [{ path: "project/index.html", kind: "animation" }, { path: "inspection.md", kind: "evidence" }], inspection: { status: "inspected", method: "Synthetic fixture only", findings: ["Record validation"] }, limitations: [] };
  fs.writeFileSync(path.join(run, "delivery.json"), JSON.stringify(delivery));
  assert.equal(check(run).ok, true);
  delivery.status = "approved";
  fs.writeFileSync(path.join(run, "delivery.json"), JSON.stringify(delivery));
  assert.throws(() => check(run), /preview/);
  delivery.status = "preview";
  delivery.artifacts[0].path = "../author.md";
  fs.writeFileSync(path.join(run, "delivery.json"), JSON.stringify(delivery));
  assert.throws(() => check(run), /inside/);
  delivery.artifacts[0].path = "project/index.html";
  fs.writeFileSync(path.join(run, "delivery.json"), JSON.stringify(delivery));
  fs.appendFileSync(path.join(run, manifest.references[0].snapshot), "tampered");
  assert.throws(() => check(run), /Reference snapshot changed/);

  const second = newRun({ design: source, brief: source, tempRoot: temp });
  fs.appendFileSync(source, "Changed after run\n");
  assert.throws(() => check(second.run), /Original design changed/);
  const count = fs.readdirSync(temp).length;
  assert.throws(() => newRun({ design: source, brief: source, references: ["unknown"], tempRoot: temp }), /Unknown reference/);
  assert.equal(fs.readdirSync(temp).length, count, "invalid intake creates no run");

  fs.writeFileSync(path.join(temp, "new-profile.md"), "# Observed design practice\nUse a legible focal point.\n");
  const registry = path.join(temp, "registry.json");
  fs.writeFileSync(registry, JSON.stringify({ schema_version: 1, references: [{ id: "new-base", profile: "new-profile.md", evidence_level: "observed-example", sources: [{ url: "https://example.com/design", revision: "synthetic-fixture" }] }] }));
  const custom = newRun({ design: source, brief: source, references: ["new-base"], registry, tempRoot: temp });
  const customManifest = JSON.parse(fs.readFileSync(path.join(custom.run, "run.json")));
  assert.equal(customManifest.references[0].id, "new-base");
  assert.equal(customManifest.movement_guideline.id, "mindful-movement", "a custom registry cannot omit the movement method");
  fs.appendFileSync(path.join(custom.run, customManifest.movement_guideline.snapshot), "changed");
  assert.throws(() => compose(custom.run, proposal), /Mindful Movement guideline/);
  const spatialRun = newRun({ design: source, brief: source, tempRoot: temp });
  const spatialManifest = JSON.parse(fs.readFileSync(path.join(spatialRun.run, "run.json")));
  fs.appendFileSync(path.join(spatialRun.run, spatialManifest.spatial_guideline.snapshot), "changed");
  assert.throws(() => compose(spatialRun.run, proposal), /Spatial guideline/);
  // Existing schema 2 runs keep their prior contract, without new stage headings.
  const legacy = newRun({ design: source, brief: source, tempRoot: temp });
  const legacyFile = path.join(legacy.run, "run.json");
  const legacyManifest = JSON.parse(fs.readFileSync(legacyFile));
  legacyManifest.schema_version = 2;
  legacyManifest.skill = "reference-animation";
  fs.writeFileSync(legacyFile, JSON.stringify(legacyManifest));
  fs.writeFileSync(proposal, headings.slice(0, 10).map(h => `## ${h}\nLegacy content\n`).join("\n"));
  compose(legacy.run, proposal);
  console.log("ok: co-direct-animation provenance, mandatory movement guideline/cast/score, delivery and extensible references");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

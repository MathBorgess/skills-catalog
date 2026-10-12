import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { newRun, compose, check, headings } from "./compose.mjs";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "reference-animation-test-"));
try {
  const source = path.join(temp, "author.md");
  const original = "---\nauthor: Test author\n---\n# Original\nKeep the logo rigid, use Inter and hard cuts.\n";
  fs.writeFileSync(source, original);
  const { run } = newRun({ design: source, tempRoot: temp });
  const manifest = JSON.parse(fs.readFileSync(path.join(run, "run.json")));
  assert.equal(manifest.source_asset_base, temp);
  assert.equal(fs.readFileSync(path.join(run, "SOURCE-DESIGN.md"), "utf8"), original);
  assert.equal(manifest.references.length, 2);
  assert.equal(manifest.schema_version, 2);
  assert.equal(manifest.movement_guideline.id, "mindful-movement");
  assert.ok(fs.readFileSync(path.join(run, manifest.movement_guideline.snapshot), "utf8").includes("objects as people"));

  const proposal = path.join(temp, "proposal.md");
  fs.writeFileSync(proposal, headings.map((h) => `## ${h}\nRetain the author's choices; reject logo deformation.\n`).join("\n"));
  compose(run, proposal);
  assert.equal(fs.readFileSync(source, "utf8"), original);
  assert.ok(fs.readFileSync(path.join(run, "DESIGN.md"), "utf8").startsWith(original));
  const before = fs.readFileSync(path.join(run, "DESIGN.md"));
  for (const missing of ["Object cast", "Motion score", "Author overrides"]) {
    fs.writeFileSync(proposal, headings.filter((h) => h !== missing).map((h) => `## ${h}\nSynthetic content\n`).join("\n"));
    assert.throws(() => compose(run, proposal), new RegExp(missing));
  }
  fs.writeFileSync(proposal, "## Work brief\nIncomplete\n");
  assert.throws(() => compose(run, proposal), /section/);
  assert.deepEqual(fs.readFileSync(path.join(run, "DESIGN.md")), before);
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

  const second = newRun({ design: source, tempRoot: temp });
  fs.appendFileSync(source, "Changed after run\n");
  assert.throws(() => check(second.run), /Original design changed/);
  const count = fs.readdirSync(temp).length;
  assert.throws(() => newRun({ design: source, references: ["unknown"], tempRoot: temp }), /Unknown reference/);
  assert.equal(fs.readdirSync(temp).length, count, "invalid intake creates no run");

  fs.writeFileSync(path.join(temp, "new-profile.md"), "# Observed design practice\nUse a legible focal point.\n");
  const registry = path.join(temp, "registry.json");
  fs.writeFileSync(registry, JSON.stringify({ schema_version: 1, references: [{ id: "new-base", profile: "new-profile.md", evidence_level: "observed-example", sources: [{ url: "https://example.com/design", revision: "synthetic-fixture" }] }] }));
  const custom = newRun({ design: source, references: ["new-base"], registry, tempRoot: temp });
  const customManifest = JSON.parse(fs.readFileSync(path.join(custom.run, "run.json")));
  assert.equal(customManifest.references[0].id, "new-base");
  assert.equal(customManifest.movement_guideline.id, "mindful-movement", "a custom registry cannot omit the movement method");
  fs.appendFileSync(path.join(custom.run, customManifest.movement_guideline.snapshot), "changed");
  assert.throws(() => compose(custom.run, proposal), /Mindful Movement guideline/);
  console.log("ok: reference-animation provenance, mandatory movement guideline/cast/score, delivery and extensible references");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

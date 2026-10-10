#!/usr/bin/env node
// Structural validation of a prettify run manifest and its local evidence files.
// A pass validates declarations and file presence; it cannot authenticate people or tool actions.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const errors = [];
const err = (code, message, file = null) => errors.push({ code, path: typeof file === "string" ? file : null, message });
const obj = (o) => o && typeof o === "object" && !Array.isArray(o);
const has = (o, required, optional = []) => obj(o) && required.every((k) => Object.hasOwn(o, k)) && Object.keys(o).every((k) => [...required, ...optional].includes(k));
const nonempty = (v) => typeof v === "string" && v.trim().length > 0;
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

function check(manifestFile) {
  let m;
  try { m = JSON.parse(fs.readFileSync(manifestFile, "utf8")); }
  catch (e) { err("MANIFEST_INVALID", `cannot read JSON manifest: ${e.message}`, manifestFile); return result(); }
  const base = path.dirname(path.resolve(manifestFile));
  if (!has(m, ["version", "projectRoot", "design", "stages", "dependencies", "questionResult", "delivery"]) || m.version !== 1 || !nonempty(m.projectRoot)) {
    err("MANIFEST_INVALID", "expected schema version 1 with only the documented top-level keys and a projectRoot", manifestFile); return result();
  }
  const project = path.resolve(base, m.projectRoot);
  const resolve = (p, root = project) => typeof p === "string" && p.length ? path.resolve(root, p) : null;
  const fileCheck = (p, code, what) => {
    const f = resolve(p);
    if (!f || !fs.existsSync(f) || !fs.statSync(f).isFile()) { err(code, `${what} file is missing`, p ?? null); return null; }
    return f;
  };
  const readReceipt = (p, expectedDecision, label, extraKeys = []) => {
    const f = fileCheck(p, "RECEIPT_MISSING", `${label} receipt`);
    if (!f) return null;
    let r;
    try { r = JSON.parse(fs.readFileSync(f, "utf8")); }
    catch { err("RECEIPT_INVALID", `${label} receipt is not valid JSON`, p); return null; }
    if (!has(r, ["decision", "reason", "evidence", ...extraKeys]) || r.decision !== expectedDecision) {
      err("RECEIPT_INVALID", `${label} receipt must declare decision ${JSON.stringify(expectedDecision)} and only documented fields`, p); return null;
    }
    if (!nonempty(r.reason)) err("RECEIPT_INVALID", `${label} receipt reason must be non-empty`, p);
    if (!Array.isArray(r.evidence) || r.evidence.length === 0 || !r.evidence.every(nonempty)) err("RECEIPT_INVALID", `${label} receipt evidence must be a non-empty array of non-empty strings`, p);
    return r;
  };

  // DESIGN authority and optional separately approved durable edit.
  if (!has(m.design, ["path", "original", "decision", "update"]) || !["accepted", "piece-only", "rejected"].includes(m.design.decision) || !(m.design.original === null || (has(m.design.original, ["path", "sha256"]) && /^[a-f0-9]{64}$/.test(m.design.original.sha256)))) {
    err("MANIFEST_INVALID", "design requires path, original null or {path, sha256}, decision accepted|piece-only|rejected, and update", "design");
  } else {
    const current = fileCheck(m.design.path, "DESIGN_HASH_MISMATCH", "current design");
    let original = null;
    if (m.design.original) {
      original = fileCheck(m.design.original.path, "DESIGN_HASH_MISMATCH", "original design snapshot");
      if (original && sha(original) !== m.design.original.sha256) err("DESIGN_HASH_MISMATCH", "original design snapshot does not match declared SHA-256", m.design.original.path);
    }
    if (m.design.decision === "rejected") err("DESIGN_REJECTED", "rejected design direction cannot proceed", "design.decision");
    if (m.design.update === null) {
      if (m.design.original && current && sha(current) !== m.design.original.sha256) err("DESIGN_HASH_MISMATCH", "current design changed without a separate design-update receipt", m.design.path);
      if (!m.design.original && m.design.decision === "accepted") err("DESIGN_HASH_MISMATCH", "a newly created durable design needs a separate design-update receipt", m.design.path);
    } else if (has(m.design.update, ["receipt"])) {
      if (m.design.decision === "piece-only") err("MANIFEST_INVALID", "piece-only design acceptance cannot include a durable design update", "design.update");
      const receipt = readReceipt(m.design.update.receipt, "design-update-approved", "design update", ["beforeSha256", "afterSha256"]);
      if (receipt) {
        const beforeMatches = m.design.original ? receipt.beforeSha256 === m.design.original.sha256 : receipt.beforeSha256 === null;
        if (!beforeMatches || !current || !/^[a-f0-9]{64}$/.test(receipt.afterSha256 ?? "") || receipt.afterSha256 !== sha(current)) err("DESIGN_HASH_MISMATCH", "design update receipt hashes do not match original snapshot and current design", m.design.update.receipt);
      }
    } else err("MANIFEST_INVALID", "design.update must be null or {receipt}", "design.update");
  }

  // Stage receipts preserve the distinction between an explicit skip and acceptance.
  if (!has(m.stages, ["briefing", "lowFidelity", "highFidelity"])) err("MANIFEST_INVALID", "stages must contain briefing, lowFidelity, highFidelity only", "stages");
  else for (const [name, stage] of Object.entries(m.stages)) {
    if (!has(stage, ["status", "receipt"]) || !["complete", "skipped"].includes(stage.status)) { err("MANIFEST_INVALID", `${name} stage status must be complete or skipped`, `stages.${name}`); continue; }
    if (stage.status === "complete") readReceipt(stage.receipt, "accepted", `${name} stage`);
    else {
      const r = readReceipt(stage.receipt, "skip", `${name} skip`);
      if (r && !nonempty(r.reason)) err("RECEIPT_INVALID", `${name} skip needs a non-empty reason`, stage.receipt);
    }
  }

  if (!Array.isArray(m.dependencies)) err("MANIFEST_INVALID", "dependencies must be an array", "dependencies");
  else m.dependencies.forEach((d, i) => {
    if (!has(d, ["name", "required", "status", "receipt"]) || !nonempty(d.name) || typeof d.required !== "boolean" || !["available", "missing", "refused"].includes(d.status)) { err("MANIFEST_INVALID", "dependency requires name, required, status available|missing|refused, receipt", `dependencies.${i}`); return; }
    if (d.required && d.status !== "available") err("DEPENDENCY_BLOCKED", `required dependency ${d.name} is ${d.status}; run cannot proceed`, `dependencies.${i}`);
    readReceipt(d.receipt, d.status, `dependency ${d.name}`);
  });

  if (!has(m.questionResult, ["status", "receipt"]) || !["answered", "inconclusive"].includes(m.questionResult.status)) err("QUESTION_RESULT_INVALID", "questionResult status must be answered or inconclusive", "questionResult");
  else readReceipt(m.questionResult.receipt, m.questionResult.status, "question result");

  if (!has(m.delivery, ["artifacts", "inspection"]) || !Array.isArray(m.delivery.artifacts) || !m.delivery.artifacts.length) err("MANIFEST_INVALID", "delivery requires at least one artifact and an inspection", "delivery");
  else {
    m.delivery.artifacts.forEach((a, i) => {
      if (!has(a, ["kind", "path"]) || !["web", "static"].includes(a.kind) || !nonempty(a.path)) { err("MANIFEST_INVALID", "artifact requires kind web|static and path", `delivery.artifacts.${i}`); return; }
      const f = resolve(a.path);
      if (!f || !fs.existsSync(f)) { err("ARTIFACT_MISSING", `${a.kind} artifact path is missing`, a.path); return; }
      const stat = fs.statSync(f);
      if (a.kind === "static" && !stat.isFile()) err("ARTIFACT_INVALID", "static artifact path must be a file", a.path);
      if (a.kind === "web") {
        const standaloneHtml = stat.isFile() && path.extname(f).toLowerCase() === ".html";
        if (!standaloneHtml && !stat.isDirectory()) err("ARTIFACT_INVALID", "web artifact must be an HTML file or a project directory", a.path);
      }
    });
    const inspect = m.delivery.inspection;
    if (!has(inspect, ["status", "receipt"]) || !["inspected", "unverified"].includes(inspect.status)) err("MANIFEST_INVALID", "inspection status must be inspected or unverified", "delivery.inspection");
    else if (inspect.status === "inspected") readReceipt(inspect.receipt, "inspected", "final inspection");
    else {
      if (inspect.receipt !== null) err("MANIFEST_INVALID", "unverified inspection must not claim an inspection receipt", "delivery.inspection.receipt");
      err("INSPECTION_UNVERIFIED", "final artifact inspection is unverified; run is incomplete", "delivery.inspection");
    }
  }
  return result();
}

function result() {
  const ok = errors.length === 0;
  return { ok, complete: ok, errors };
}

const manifest = process.argv[2];
if (!manifest || process.argv.length !== 3) {
  errors.push({ code: "MANIFEST_INVALID", path: null, message: "usage: node check-run.mjs <run.json>" });
} else {
  try { check(manifest); }
  catch (e) { err("MANIFEST_INVALID", `could not inspect manifest evidence: ${e.message}`, manifest); }
}
const output = result();
process.stdout.write(`${JSON.stringify(output)}\n`);
process.exitCode = output.complete ? 0 : 1;

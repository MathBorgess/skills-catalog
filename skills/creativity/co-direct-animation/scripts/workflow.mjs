#!/usr/bin/env node
// Record consistency and generation boundaries, never proof of human authorship or taste.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const gates = ["moodboard", "frames", "storyboard", "motion-preview", "final"];
export const sha = bytes => createHash("sha256").update(bytes).digest("hex");
export const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
export function write(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  fs.renameSync(temp, file);
}
export function inside(run, relative) {
  if (typeof relative !== "string" || !relative || path.isAbsolute(relative)) throw new Error("Expected a run-relative path");
  const target = path.resolve(run, relative);
  const rel = path.relative(run, target);
  if (!rel || rel === ".." || rel.startsWith(`..${path.sep}`)) throw new Error("Path must remain inside run");
  // Check existing ancestors too, so a new output cannot escape through a directory symlink.
  let ancestor = target;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const actual = path.relative(fs.realpathSync(run), fs.realpathSync(ancestor));
  if (actual === ".." || actual.startsWith(`..${path.sep}`)) throw new Error("Symlink leaves run");
  return target;
}
const text = value => typeof value === "string" && value.trim().length > 0;
function load(run) {
  const manifest = read(path.join(run, "run.json"));
  if (manifest.schema_version !== 4 || manifest.skill !== "co-direct-animation") throw new Error("Workflow requires a new schema 4 run; legacy runs are read-only under their earlier contract");
  const file = path.join(run, "workflow.json");
  return fs.existsSync(file) ? read(file) : { schema_version: 1, current: {}, packets: {}, attempts: [] };
}
function change(run, action) {
  run = fs.realpathSync(run);
  const lock = path.join(run, "workflow.lock");
  const fd = fs.openSync(lock, "wx");
  try {
    fs.writeFileSync(fd, `${process.pid}\n`);
    const state = load(run);
    const result = action(state);
    write(path.join(run, "workflow.json"), state);
    return result;
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
function gateIndex(gate) {
  const index = gates.indexOf(gate);
  if (index < 0) throw new Error(`Unknown gate: ${gate}`);
  return index;
}
function intact(run, p, key) {
  if (!p) return false;
  for (const a of p.artifacts) {
    const file = inside(run, a.path);
    if (!fs.existsSync(file) || sha(fs.readFileSync(file)) !== a.sha256) return false;
    const copy = inside(run, a.snapshot);
    if (!fs.existsSync(copy) || sha(fs.readFileSync(copy)) !== a.sha256) return false;
  }
  const spec = inside(run, `reviews/${p.id}/${key}/TO-SPEC.md`);
  if (!fs.existsSync(spec) || sha(fs.readFileSync(spec)) !== p.spec_sha256) return false;
  return true;
}
function effective(run, state, key, seen = new Set()) {
  const p = state.packets[key];
  if (!p || state.current[p.id] !== key || seen.has(key) || !intact(run, p, key)) return false;
  seen.add(key);
  for (const d of p.dependencies) {
    if (state.current[d.id] !== d.key || !effective(run, state, d.key, new Set(seen))) return false;
    const decision = state.packets[d.key].review?.decision;
    if (!["accept", "override"].includes(decision)) return false;
  }
  return true;
}
function accepted(run, state, id) {
  const key = state.current[id];
  return effective(run, state, key) && ["accept", "override"].includes(state.packets[key].review?.decision);
}
function dependencies(run, state, gate, extra = []) {
  const index = gateIndex(gate);
  const ids = [...new Set([...(index ? [`gate-${gates[index - 1]}`] : []), ...extra])];
  return ids.map(id => {
    if (!accepted(run, state, id)) throw new Error(`Pending or stale prerequisite: ${id}`);
    return { id, key: state.current[id] };
  });
}
function packet(run, state, input) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(input.id) || !text(input.revision)) throw new Error("Packet needs stable id and revision");
  gateIndex(input.gate);
  if (!Array.isArray(input.artifacts) || !input.artifacts.length) throw new Error("Packet needs concrete artifacts");
  const spec = inside(run, "TO-SPEC.md");
  if (!fs.existsSync(spec) || !fs.readFileSync(spec, "utf8").trim()) throw new Error("Write external TO-SPEC.md first");
  const sources = input.artifacts.map(relative => {
    const file = inside(run, relative);
    if (!fs.statSync(file).isFile() || (!fs.statSync(file).size && input.kind !== "attempt")) throw new Error(`Missing/empty artifact: ${relative}`);
    return { path: relative, sha256: sha(fs.readFileSync(file)) };
  });
  const base = { id: input.id, revision: input.revision, gate: input.gate, kind: input.kind ?? "gate", artifacts: sources,
    dependencies: input.dependencyRecords ?? dependencies(run, state, input.gate, input.dependencies), spec_sha256: sha(fs.readFileSync(spec)) };
  const key = sha(JSON.stringify(base));
  if (state.packets[key]) { state.current[base.id] = key; return { key, ...state.packets[key] }; }
  const dir = inside(run, `reviews/${input.id}/${key}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(spec, path.join(dir, "TO-SPEC.md"));
  const artifacts = sources.map((a, i) => {
    const snapshot = `reviews/${input.id}/${key}/${i}-${path.basename(a.path)}`;
    fs.copyFileSync(inside(run, a.path), inside(run, snapshot));
    return { ...a, snapshot };
  });
  const p = { ...base, artifacts };
  write(path.join(dir, "packet.json"), { key, ...p });
  state.packets[key] = p;
  state.current[input.id] = key;
  return { key, ...p };
}
export function submit(run, input) {
  if (!gates.includes(input.gate)) throw new Error("Unknown gate");
  return change(run, state => packet(run, state, { ...input, id: `gate-${input.gate}`, kind: "gate" }));
}
export function review(run, input) {
  return change(run, state => {
    const p = state.packets[input.key];
    // A human may dispose of an intact attempt made obsolete upstream; it stays stale for reuse.
    const reviewable = p?.kind === "attempt" ? state.current[p.id] === input.key && intact(run, p, input.key) : effective(run, state, input.key);
    if (!p || !reviewable) throw new Error("Review revision is missing, changed or stale");
    if (input.actor !== "human" || !text(input.evidence?.source) || !text(input.evidence?.quote)) throw new Error("Human response source and exact quote required");
    if (!["accept", "revise", "reject", "override"].includes(input.decision)) throw new Error("Explicit accept/revise/reject decision required; generic continue is not approval");
    if (input.decision === "override") {
      if (!text(input.scope) || !Array.isArray(input.waive) || !input.waive.length || input.waive.some(x => !["criticism", "uncertain-submission"].includes(x))) throw new Error("Override needs precise scope and named requirement");
    }
    if (!text(input.criticism) && !(input.decision === "override" && input.waive.includes("criticism"))) throw new Error("Explicit human criticism required, including 'nothing to change'");
    if (p.kind === "attempt") {
      const next = input.next_attempt;
      const scoped = text(next?.shot) && gates.includes(next?.gate);
      if (next !== "stop" && !scoped && !(next === "continue-plan" && input.decision === "accept")) throw new Error("Attempt response needs next_attempt: stop, scoped {gate, shot}, or continue-plan after acceptance");
    }
    const dir = inside(run, `reviews/${p.id}/${input.key}/responses`);
    fs.mkdirSync(dir, { recursive: true });
    const record = { ...input, recorded_at: new Date().toISOString() };
    const file = path.join(dir, `${fs.readdirSync(dir).length + 1}.json`);
    write(file, record);
    p.review = record;
    return { key: input.key, decision: input.decision, record: path.relative(run, file), human_authorship: "caller-recorded; not certified" };
  });
}
export function startAttempt(run, request) {
  return change(run, state => {
    gateIndex(request.gate);
    if (!text(request.shot) || !text(request.provider) || !text(request.prompt)) throw new Error("Attempt needs shot, provider and prompt");
    if (request.type === "video") {
      if (request.provider !== "gflow" || request.gate !== "motion-preview") throw new Error("Video generation requires gflow after storyboard review");
    } else if (request.type !== "image" || !["moodboard", "frames", "storyboard"].includes(request.gate)) throw new Error("Unsupported visual attempt type/gate");
    const deps = dependencies(run, state, request.gate, request.dependencies);
    const last = state.attempts.at(-1);
    if (last) {
      const key = state.current[last.id], p = state.packets[key];
      if (!intact(run, p, key) || !p?.review) throw new Error(`Review the previous visual attempt first: ${last.id}`);
      if (last.status === "uncertain" && !(p.review.decision === "override" && p.review.waive.includes("uncertain-submission"))) throw new Error("Recover uncertain submission before replacement; explicit scoped human override required to abandon it");
      const next = p.review.next_attempt;
      if (next === "stop" || (next !== "continue-plan" && (next?.gate !== request.gate || next?.shot !== request.shot))) throw new Error("Next visual attempt is outside the recorded human scope");
    }
    const id = `attempt-${String(state.attempts.length + 1).padStart(4, "0")}`;
    const dir = inside(run, `attempts/${id}`);
    const spec = inside(run, "TO-SPEC.md");
    if (!fs.existsSync(spec) || !fs.readFileSync(spec, "utf8").trim()) throw new Error("Write external TO-SPEC.md first");
    const inputs = (request.inputs ?? []).map((relative, i) => {
      const file = inside(run, relative);
      if (!fs.statSync(file).isFile() || !fs.statSync(file).size) throw new Error("Input asset missing/empty");
      return { path: relative, snapshot: `attempts/${id}/inputs/${i}-${path.basename(relative)}`, sha256: sha(fs.readFileSync(file)) };
    });
    fs.mkdirSync(path.join(dir, "inputs"), { recursive: true });
    for (const input of inputs) fs.copyFileSync(inside(run, input.path), inside(run, input.snapshot));
    const record = { id, status: "started", request: { ...request, inputs }, dependencies: deps, created_at: new Date().toISOString() };
    fs.copyFileSync(inside(run, "TO-SPEC.md"), path.join(dir, "TO-SPEC.md"));
    write(path.join(dir, "request.json"), record);
    record.request_sha256 = sha(fs.readFileSync(path.join(dir, "request.json")));
    record.spec_sha256 = sha(fs.readFileSync(path.join(dir, "TO-SPEC.md")));
    state.attempts.push(record);
    return record;
  });
}
export function verifyAttempt(run, id, { prerequisites = false } = {}) {
  const state = load(run), a = state.attempts.find(x => x.id === id);
  if (!a) throw new Error("Unknown attempt");
  if (a.outcomes?.length && !intact(run, state.packets[state.current[id]], state.current[id])) throw new Error("Attempt evidence changed after recording");
  for (const [file, expected] of [[`attempts/${id}/request.json`, a.request_sha256], [`attempts/${id}/TO-SPEC.md`, a.spec_sha256], ...a.request.inputs.map(i => [i.snapshot, i.sha256])]) {
    const target = inside(run, file);
    if (!fs.existsSync(target) || sha(fs.readFileSync(target)) !== expected) throw new Error(`Attempt receipt/input changed: ${file}`);
  }
  if (prerequisites && a.dependencies.some(d => state.current[d.id] !== d.key || !accepted(run, state, d.id))) throw new Error("Attempt prerequisites changed before submission");
  return a;
}
export function finishAttempt(run, id, outcome) {
  return change(run, state => {
    const a = state.attempts.find(x => x.id === id);
    if (!a || !["started", "uncertain"].includes(a.status)) throw new Error("Attempt cannot be completed/recovered in this state");
    if (!["generated", "blocked", "failed", "uncertain"].includes(outcome.status) || !text(outcome.note)) throw new Error("Outcome needs explicit status and report");
    if (outcome.status === "generated" && (!Array.isArray(outcome.artifacts) || !outcome.artifacts.length)) throw new Error("Generated attempt needs output artifacts");
    if (outcome.status === "generated") {
      verifyAttempt(run, id);
      if (outcome.artifacts.some(f => !fs.statSync(inside(run, f)).isFile() || !fs.statSync(inside(run, f)).size)) throw new Error("Generated outputs must be nonempty files");
    }
    const sequence = (a.outcomes?.length ?? 0) + 1;
    const result = `attempts/${id}/outcome-${sequence}.json`;
    write(inside(run, result), outcome);
    const receipts = ["request.json", "TO-SPEC.md", "command.json", "stdout.txt", "stderr.txt"].map(f => `attempts/${id}/${f}`).filter(f => fs.existsSync(inside(run, f)));
    a.evidence = [...new Set([...(a.evidence ?? []), ...(outcome.evidence ?? [])])];
    const p = packet(run, state, { id, gate: a.request.gate, kind: "attempt", revision: String(sequence),
      artifacts: [...new Set([result, ...(a.outcomes ?? []).map(o => o.path), ...receipts, ...a.evidence, ...a.request.inputs.map(i => i.snapshot), ...(outcome.artifacts ?? [])])], dependencyRecords: a.dependencies });
    a.status = outcome.status;
    a.outcomes = [...(a.outcomes ?? []), { path: result, key: p.key }];
    return { id, status: a.status, review_key: p.key };
  });
}
export function status(run) {
  const state = load(run);
  return { gates: Object.fromEntries(gates.map(g => {
    const id = `gate-${g}`, key = state.current[id], p = state.packets[key];
    return [g, !p ? "planned" : !effective(run, state, key) ? "stale" : p.review?.decision ?? "pending"];
  })), attempts: state.attempts.map(a => ({ id: a.id, status: a.status, key: state.current[a.id], validity: !state.current[a.id] ? "unfinished" : effective(run, state, state.current[a.id]) ? "current" : "stale", review: state.packets[state.current[a.id]]?.review?.decision ?? "pending" })) };
}
export function finalReadiness(run) {
  const state = load(run);
  for (const g of gates.slice(0, 4)) if (!accepted(run, state, `gate-${g}`)) throw new Error(`Pending or stale gate: ${g}`);
  if (state.attempts.some(a => !state.packets[state.current[a.id]]?.review || a.status === "started" || (a.status === "uncertain" && !state.packets[state.current[a.id]].review?.waive?.includes("uncertain-submission")))) throw new Error("Review/resolve visual attempts before final delivery");
  const generated = state.attempts.filter(a => a.request.type === "video" && a.request.provider === "gflow" && a.status === "generated" && accepted(run, state, a.id));
  if (!generated.length) throw new Error("Delivery needs reviewed gflow video provenance");
  return { generated, previewPacket: state.packets[state.current["gate-motion-preview"]], finalPacket: state.packets[state.current["gate-final"]], final: accepted(run, state, "gate-final") ? "accepted-record" : "pending-human-review" };
}
function main(args) {
  const [command, run, file] = args;
  if (!run || !["submit", "review", "start", "finish", "status"].includes(command)) throw new Error("workflow.mjs submit|review|start|finish|status <run> [input.json]; finish input: {id, outcome}");
  if (command === "status") return status(run);
  const input = read(file);
  if (command === "submit") return submit(run, input);
  if (command === "review") return review(run, input);
  if (command === "start") return startAttempt(run, input);
  return finishAttempt(run, input.id, input.outcome);
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  try { console.log(JSON.stringify(main(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; }
}

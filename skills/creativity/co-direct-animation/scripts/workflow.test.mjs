import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { newRun, compose, headings, check } from "./compose.mjs";
import { submit, review, startAttempt, finishAttempt, status, read, gates, finalReadiness } from "./workflow.mjs";
import { generate, recover, argumentsFor, execute } from "./gflow.mjs";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "co-direct-contract-"));
const design = path.join(temp, "DESIGN.md"), brief = path.join(temp, "brief.md");
fs.writeFileSync(design, "# Synthetic author\nKeep the circle recognizable.\n");
fs.writeFileSync(brief, "# Synthetic brief\nAn illustrated circle offers a square a place to rest.\n");
function fixture() {
  const { run } = newRun({ design, brief, tempRoot: temp });
  fs.writeFileSync(path.join(run, "TO-SPEC.md"), "# Synthetic context\nPlan, decisions and next step are recorded here.\n");
  const proposal = path.join(run, "composition.md");
  fs.writeFileSync(proposal, headings.map(h => `## ${h}\nSynthetic direction; no real film or approval.\n`).join("\n"));
  compose(run, proposal);
  return run;
}
function response(key, decision = "accept", criticism = "Nothing to change in this synthetic fixture.") {
  return { key, actor: "human", decision, criticism, next_attempt: decision === "accept" ? "continue-plan" : { gate: "motion-preview", shot: "shot-01" }, evidence: { source: "synthetic-user-message", quote: "Synthetic fixture only; no real human approval is asserted." } };
}
function gate(run, name, dependencies = []) {
  const artifact = `${name}.md`;
  fs.writeFileSync(path.join(run, artifact), `Synthetic ${name} packet`);
  const p = submit(run, { gate: name, revision: "v1", artifacts: [artifact], dependencies });
  review(run, response(p.key));
  return p;
}
function planning(run) { return gates.slice(0, 3).map(g => gate(run, g)); }
const request = { shot: "shot-01", mode: "i2v", model: "veo-lite", aspect: "16:9", duration: 8, profile: "fixture-profile", project: "fixture-project", inputs: ["frame.png"], prompt: 'An "illustrated" circle; $(touch SHOULD_NOT_EXIST)' };
const mp4 = Buffer.from([0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0]);
function fake({ mutate = x => x, noFile = false } = {}) {
  const calls = [];
  const executor = async (_binary, args) => {
    calls.push(args);
    if (args[0] === "--version") return { code: 0, stdout: "gflow fixture 0.83.2", stderr: "" };
    if (args[0] === "models") return { code: 0, stdout: JSON.stringify({ video: { models: [{ name: "veo_3_1_lite", aliases: ["veo-lite"] }] } }), stderr: "" };
    if (args.includes("--help")) return { code: 0, stdout: "--output --json --count --duration", stderr: "" };
    const output = args[args.indexOf("--output") + 1];
    if (!noFile) fs.writeFileSync(output, mp4);
    const result = mutate({ status: "ok", command: "video i2v", media_id: "synthetic-media", succeeded: true, generation_status: "MEDIA_GENERATION_STATUS_SUCCESSFUL", local_path: noFile ? null : output, request: { model: "veo_3_1_lite", mode: "i2v", aspect: "landscape", duration: 8, count: 1, seed: null } });
    return { code: 0, signal: null, stdout: JSON.stringify(result), stderr: "Synthetic fixture; not real Flow evidence." };
  };
  return { calls, executor };
}
try {
  assert.throws(() => newRun({ design, tempRoot: temp }), /brief/i);
  const run = fixture();
  assert.throws(() => submit(run, { gate: "frames", revision: "v1", artifacts: ["TO-SPEC.md"] }), /prerequisite/);
  fs.writeFileSync(path.join(run, "board.md"), "Synthetic visual board");
  const board = submit(run, { gate: "moodboard", revision: "v1", artifacts: ["board.md"] });
  assert.throws(() => review(run, response(board.key, "accept", "")), /criticism/);
  assert.throws(() => review(run, { ...response(board.key), decision: undefined }), /decision/);
  assert.throws(() => review(run, response(board.key, "continue")), /continue/);
  assert.throws(() => review(run, { ...response(board.key), actor: "agent" }), /Human/);
  assert.throws(() => review(run, response("wrong-revision")), /revision/);
  assert.equal(status(run).gates.moodboard, "pending");
  review(run, response(board.key, "reject", "The reference hierarchy is unclear; refine it."));
  assert.throws(() => gate(run, "frames"), /prerequisite/);
  fs.writeFileSync(path.join(run, "board.md"), "Refined synthetic visual board");
  const refined = submit(run, { gate: "moodboard", revision: "v2", artifacts: ["board.md"] });
  assert.throws(() => review(run, response(board.key)), /stale/);
  review(run, response(refined.key));
  const frames = gate(run, "frames"), storyboard = gate(run, "storyboard");
  assert.equal(status(run).gates.storyboard, "accept");
  fs.writeFileSync(path.join(run, "storyboard.md"), "Retimed synthetic storyboard");
  assert.equal(status(run).gates.storyboard, "stale");
  assert.equal(status(run).gates.frames, "accept", "timing change preserves unrelated accepted appearance");
  const updated = submit(run, { gate: "storyboard", revision: "v2", artifacts: ["storyboard.md"] });
  review(run, response(updated.key));
  fs.writeFileSync(path.join(run, "frame.png"), "synthetic image bytes");
  const f = fake();
  const result = await generate(run, request, { executor: f.executor });
  assert.equal(result.status, "generated");
  assert.equal(f.calls.length, 4, "one submit after three interface probes");
  const args = f.calls.at(-1);
  assert.equal(args.at(-1), request.prompt);
  assert.equal(args[args.indexOf("--count") + 1], "1");
  assert.ok(!args.includes("--seed"));
  assert.ok(args[args.indexOf("--initial-frame") + 1].includes("attempts/attempt-0001/inputs/"));
  assert.throws(() => startAttempt(run, { type: "image", provider: "gpt-image", gate: "frames", shot: "next", prompt: "next" }), /previous visual attempt/);
  review(run, response(result.review_key));
  gate(run, "motion-preview", [result.id]);
  fs.mkdirSync(path.join(run, "delivery"));
  fs.writeFileSync(path.join(run, "delivery/master.mp4"), mp4);
  fs.writeFileSync(path.join(run, "delivery/inspection.md"), "Synthetic record test; no decoded film or creative success.");
  const delivery = { status: "ready-for-review", source_attempts: [result.id], artifacts: [{ path: "delivery/master.mp4", kind: "animation" }, { path: "delivery/inspection.md", kind: "evidence" }], inspection: { status: "inspected", method: "Synthetic fixture contract only", findings: ["No real production validation claimed"] }, limitations: ["Synthetic bytes"] };
  fs.writeFileSync(path.join(run, "delivery.json"), JSON.stringify(delivery));
  assert.equal(check(run).reviews, "pending-human-review");
  delivery.status = "accepted"; fs.writeFileSync(path.join(run, "delivery.json"), JSON.stringify(delivery));
  assert.throws(() => check(run), /Final human review/);
  const final = submit(run, { gate: "final", revision: "v1", artifacts: delivery.artifacts.map(a => a.path) });
  review(run, response(final.key));
  assert.equal(check(run).reviews, "accepted-record");
  const inputSnapshot = path.join(run, "attempts/attempt-0001/inputs/0-frame.png");
  const inputBytes = fs.readFileSync(inputSnapshot);
  fs.writeFileSync(inputSnapshot, "Changed submitted frame");
  assert.throws(() => finalReadiness(run), /stale/);
  fs.writeFileSync(inputSnapshot, inputBytes);
  const commandPath = path.join(run, "attempts/attempt-0001/command.json"), commandBytes = fs.readFileSync(commandPath);
  fs.writeFileSync(commandPath, "Changed receipt");
  assert.throws(() => finalReadiness(run), /stale/);
  fs.writeFileSync(commandPath, commandBytes);
  fs.writeFileSync(path.join(run, "delivery/other.mp4"), mp4);
  delivery.artifacts[0].path = "delivery/other.mp4"; fs.writeFileSync(path.join(run, "delivery.json"), JSON.stringify(delivery));
  assert.throws(() => check(run), /differ/);
  delivery.status = "ready-for-review"; delivery.artifacts[0].path = "board.md"; fs.writeFileSync(path.join(run, "delivery.json"), JSON.stringify(delivery));
  assert.throws(() => check(run), /animation/);
  fs.writeFileSync(path.join(run, "board.md"), "Changed upstream visual direction");
  assert.equal(status(run).gates.frames, "stale");
  assert.equal(status(run).gates.final, "stale");
  assert.equal(status(run).attempts[0].validity, "stale");
  assert.equal(status(run).attempts[0].review, "accept", "historical human response is distinct from current validity");

  for (const mutation of ["input", "prerequisite"]) {
    const changedRun = fixture(); planning(changedRun); fs.writeFileSync(path.join(changedRun, "frame.png"), "fixture");
    const backend = fake();
    const result = await generate(changedRun, request, { executor: async (binary, args) => {
      const output = await backend.executor(binary, args);
      if (args.includes("--help")) fs.writeFileSync(path.join(changedRun, mutation === "input" ? "attempts/attempt-0001/inputs/0-frame.png" : "storyboard.md"), "Changed during probes");
      return output;
    } });
    assert.equal(result.status, "blocked");
    assert.equal(backend.calls.length, 3, "changed input or approval blocks submission after probes");
    review(changedRun, { ...response(result.review_key, "reject", "Discard the blocked attempt; retain evidence."), next_attempt: "stop" });
    if (mutation === "prerequisite") assert.equal(status(changedRun).attempts[0].validity, "stale", "review disposes of stale attempt without approving reuse");
  }

  const blockedRun = fixture(); planning(blockedRun); fs.writeFileSync(path.join(blockedRun, "frame.png"), "fixture");
  let submitted = 0;
  const blocked = await generate(blockedRun, request, { executor: async () => { submitted++; return { code: null, error: "executable absent", stdout: "", stderr: "" }; } });
  assert.equal(blocked.status, "blocked"); assert.equal(submitted, 1);
  assert.ok(!fs.existsSync(path.join(blockedRun, "attempts/attempt-0001/output.mp4")));

  const uncertainRun = fixture(); planning(uncertainRun); fs.writeFileSync(path.join(uncertainRun, "frame.png"), "fixture");
  const noDownload = fake({ noFile: true });
  const uncertain = await generate(uncertainRun, request, { executor: noDownload.executor });
  assert.equal(uncertain.status, "uncertain", "exit zero without local download is insufficient");
  review(uncertainRun, response(uncertain.review_key, "revise", "Recover the existing media."));
  await assert.rejects(() => generate(uncertainRun, request, { executor: noDownload.executor }), /uncertain submission/);
  for (let i = 0; i < 2; i++) {
    const result = await recover(uncertainRun, uncertain.id, { executor: async () => ({ code: 1, stdout: "", stderr: `Synthetic failed recovery ${i}` }) });
    assert.equal(result.status, "uncertain");
  }
  const receipts = read(path.join(uncertainRun, "workflow.json")).attempts[0].evidence;
  assert.equal(receipts.length, 4, "failed recovery logs are retained separately");
  assert.notEqual(fs.readFileSync(path.join(uncertainRun, receipts[1]), "utf8"), fs.readFileSync(path.join(uncertainRun, receipts[3]), "utf8"));
  const recovered = await recover(uncertainRun, uncertain.id, { executor: async (_bin, args) => {
    assert.equal(args[0], "data"); assert.equal(args[1], "download");
    const file = path.join(args[args.indexOf("--out") + 1], "synthetic-media.mp4"); fs.writeFileSync(file, mp4);
    return { code: 0, stdout: JSON.stringify({ media_id: "synthetic-media", profile: request.profile, project_id: request.project, path: file, bytes: mp4.length }), stderr: "" };
  } });
  assert.equal(recovered.id, uncertain.id); assert.equal(recovered.status, "generated");
  assert.notEqual(recovered.review_key, uncertain.review_key);
  assert.throws(() => review(uncertainRun, response(uncertain.review_key)), /stale/);

  for (const field of ["model", "mode", "duration", "aspect", "count"]) {
    const mismatchRun = fixture(); planning(mismatchRun); fs.writeFileSync(path.join(mismatchRun, "frame.png"), "fixture");
    const mismatch = fake({ mutate: r => ({ ...r, request: { ...r.request, [field]: "wrong" } }) });
    const bad = await generate(mismatchRun, request, { executor: mismatch.executor });
    assert.equal(bad.status, "uncertain");
    let downloads = 0;
    const stillBad = await recover(mismatchRun, bad.id, { executor: async () => { downloads++; throw new Error("Must not download contradictory report"); } });
    assert.equal(stillBad.status, "uncertain"); assert.equal(downloads, 0);
  }

  const overrideRun = fixture(); fs.writeFileSync(path.join(overrideRun, "board.md"), "fixture");
  const overridden = submit(overrideRun, { gate: "moodboard", revision: "v1", artifacts: ["board.md"] });
  assert.throws(() => review(overrideRun, { ...response(overridden.key, "override", ""), waive: ["criticism"] }), /scope/);
  review(overrideRun, { ...response(overridden.key, "override", ""), scope: "Human explicitly waives criticism for this moodboard revision only", waive: ["criticism"] });
  gate(overrideRun, "frames");
  const image = startAttempt(overrideRun, { type: "image", provider: "gpt-image", gate: "frames", shot: "style", prompt: "A readable illustrated shape" });
  const failed = finishAttempt(overrideRun, image.id, { status: "failed", note: "Synthetic tool failure; no visual candidate" });
  assert.throws(() => review(overrideRun, { ...response(failed.review_key, "reject"), next_attempt: undefined }), /next_attempt/);
  review(overrideRun, { ...response(failed.review_key, "reject", "Stop spending."), next_attempt: "stop" });
  assert.throws(() => startAttempt(overrideRun, { type: "image", provider: "gpt-image", gate: "frames", shot: "style", prompt: "Another input" }), /human scope/);
  review(overrideRun, { ...response(failed.review_key, "revise", "Correct the stated tool input and try once."), next_attempt: { gate: "frames", shot: "style" } });
  assert.throws(() => startAttempt(overrideRun, { type: "image", provider: "gpt-image", gate: "frames", shot: "another", prompt: "Another input" }), /human scope/);
  assert.ok(startAttempt(overrideRun, { type: "image", provider: "gpt-image", gate: "frames", shot: "style", prompt: "Corrected input" }));

  assert.throws(() => argumentsFor({ ...request, duration: 10 }, "out", ["a"]), /duration/);
  assert.throws(() => argumentsFor({ ...request, mode: "r2v", model: "veo-quality" }, "out", ["a"]), /Reference/);
  const actualSpawn = await execute(process.execPath, ["-e", "process.stdout.write(JSON.stringify(process.argv.slice(1)))", "--", request.prompt]);
  assert.deepEqual(JSON.parse(actualSpawn.stdout), [request.prompt], "literal prompt survives real spawn without shell evaluation");
  console.log("ok: five revision-bound gates, critique/rejection/recovery, one-attempt reviews and gflow adapter fixtures (not live Flow)");
} finally { fs.rmSync(temp, { recursive: true, force: true }); }

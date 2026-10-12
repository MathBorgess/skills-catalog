#!/usr/bin/env node
// One gflow video submission, durable receipt, no automatic retry and no shell.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { direction } from "./compose.mjs";
import { inside, read, write, startAttempt, finishAttempt, verifyAttempt } from "./workflow.mjs";

export function execute(binary, args) {
  return new Promise(resolve => {
    const child = spawn(binary, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", bytes => { stdout += bytes; });
    child.stderr.on("data", bytes => { stderr += bytes; });
    child.on("error", error => resolve({ code: null, signal: null, stdout, stderr, error: error.message }));
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}
const parse = value => { try { return JSON.parse(value); } catch { return null; } };
export async function probe({ executable = "gflow", executor = execute } = {}) {
  const version = await executor(executable, ["--version"]);
  if (version.code !== 0) return { available: false, reason: version.error ?? version.stderr, version: null };
  const models = await executor(executable, ["models", "--json"]);
  const catalog = parse(models.stdout);
  return { available: models.code === 0 && Array.isArray(catalog?.video?.models), version: version.stdout.trim(), catalog,
    evidence: "CLI interface only; saved session, account controls and successful generation remain unverified" };
}
export function argumentsFor(request, output, inputs) {
  if (!["t2v", "i2v", "r2v"].includes(request.mode) || !["16:9", "9:16"].includes(request.aspect)) throw new Error("Unsupported input mode/aspect");
  if (!["omni-flash", "veo-lite", "veo-fast", "veo-quality", "veo-lite-lp"].includes(request.model)) throw new Error("Name an accepted video model explicitly");
  if (![4, 6, 8, ...(request.model === "omni-flash" ? [10] : [])].includes(request.duration)) throw new Error("Unsupported model duration");
  if (![request.prompt, request.profile, request.project].every(v => typeof v === "string" && v.trim())) throw new Error("Prompt, profile and project required");
  if ((request.mode === "t2v" && inputs.length) || (request.mode === "i2v" && ![1, 2].includes(inputs.length)) || (request.mode === "r2v" && (!inputs.length || request.model === "veo-quality" || inputs.length > (request.model === "omni-flash" ? 7 : 3)))) throw new Error("Reference inputs do not match the selected mode/model");
  const args = ["video", request.mode];
  if (request.mode === "i2v") {
    args.push("--initial-frame", inputs[0]);
    if (inputs[1]) args.push("--end-frame", inputs[1]);
  }
  if (request.mode === "r2v") for (const file of inputs) args.push("--ref", file);
  // Prompt is one literal argument. No tool rewriting, seed, extra args or silent fallback.
  args.push("--profile", request.profile, "--project", request.project, "--model", request.model,
    "--aspect", request.aspect, "--duration", String(request.duration), "--count", "1", "--output", output, "--json", "--", request.prompt);
  return args;
}
function mp4(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size < 12) return false;
  const fd = fs.openSync(file, "r"), bytes = Buffer.alloc(32);
  try { fs.readSync(fd, bytes, 0, 32, 0); } finally { fs.closeSync(fd); }
  return bytes.includes(Buffer.from("ftyp"));
}
function matchingReport(report, request, modelName) {
  return report?.status === "ok" && report.succeeded === true &&
    report.generation_status === "MEDIA_GENERATION_STATUS_SUCCESSFUL" && report.command === `video ${request.mode}` &&
    typeof report.media_id === "string" && !!report.media_id.trim() &&
    report.request?.mode === request.mode && report.request?.count === 1 && report.request?.model === modelName &&
    report.request?.duration === request.duration && report.request?.aspect === (request.aspect === "9:16" ? "portrait" : "landscape");
}
export function validResult(process, report, request, output, modelName) {
  return process.code === 0 && !process.signal && matchingReport(report, request, modelName) && report.local_path === output && mp4(output);
}
export async function generate(run, request, options = {}) {
  run = fs.realpathSync(run);
  direction(run);
  const executable = options.executable ?? "gflow", executor = options.executor ?? execute;
  // Validate before reserving or running any operation.
  argumentsFor(request, "output.mp4", request.inputs ?? []);
  const a = startAttempt(run, { ...request, type: "video", provider: "gflow", gate: "motion-preview" });
  let submitted = false, process = null, report = null;
  try {
    const capability = await probe({ executable, executor });
    const modelName = capability.catalog?.video?.models.find(m => m.aliases?.includes(request.model))?.name;
    if (!capability.available || !modelName) return finishAttempt(run, a.id, { status: "blocked", note: "Required gflow CLI/model interface unavailable; no generation submitted", capability });
    const help = await executor(executable, ["video", request.mode, "--help"]);
    if (help.code !== 0 || !["--output", "--json", "--count", "--duration"].every(flag => help.stdout.includes(flag))) return finishAttempt(run, a.id, { status: "blocked", note: "Installed command contract differs; inspect --help before generation", capability });
    const output = inside(run, `attempts/${a.id}/output.mp4`);
    const args = argumentsFor(request, output, a.request.inputs.map(i => inside(run, i.snapshot)));
    write(inside(run, `attempts/${a.id}/command.json`), { executable, args, capability, note: "Named profile/project are private; catalog is not a live capability test" });
    direction(run);
    verifyAttempt(run, a.id, { prerequisites: true });
    submitted = true;
    process = await executor(executable, args);
    report = parse(process.stdout);
    fs.writeFileSync(inside(run, `attempts/${a.id}/stdout.txt`), process.stdout);
    fs.writeFileSync(inside(run, `attempts/${a.id}/stderr.txt`), process.stderr);
    const good = validResult(process, report, request, output, modelName);
    const definitiveFailure = report?.generation_status === "MEDIA_GENERATION_STATUS_FAILED" && report.succeeded === false;
    return finishAttempt(run, a.id, { status: good ? "generated" : definitiveFailure ? "failed" : "uncertain", process: { code: process.code, signal: process.signal, error: process.error ?? null },
      reported: report, note: good ? "MP4 download checked; full decoding, actual timing and visual assessment still required" : "Generation/download not confirmed; preserve known IDs and recover before replacement", artifacts: good ? [`attempts/${a.id}/output.mp4`] : [] });
  } catch (error) {
    return finishAttempt(run, a.id, { status: submitted ? "uncertain" : "blocked", process: process && { code: process.code, signal: process.signal, error: process.error ?? null }, reported: report, note: error.message });
  }
}
export async function recover(run, id, options = {}) {
  run = fs.realpathSync(run);
  const a = verifyAttempt(run, id);
  if (!a || a.status !== "uncertain") throw new Error("Recovery requires an uncertain existing attempt");
  const previous = read(inside(run, a.outcomes.at(-1).path));
  const media = previous.reported?.media_id;
  if (!media) throw new Error("No known media ID; inspect the private Flow/catalog operation before replacement");
  const command = read(inside(run, `attempts/${id}/command.json`));
  const modelName = command.capability?.catalog?.video?.models.find(m => m.aliases?.includes(a.request.model))?.name;
  if (!modelName || !matchingReport(previous.reported, a.request, modelName)) return finishAttempt(run, id, { status: "uncertain", reported: previous.reported,
    note: "Existing generation report contradicts or omits required request/success fields; downloading cannot resolve it. Inspect private operation evidence." });
  const dir = fs.mkdtempSync(inside(run, `attempts/${id}/recovered-${a.outcomes.length + 1}-`));
  const relative = path.relative(run, dir);
  const executor = options.executor ?? execute;
  let process = null, report = null;
  const evidence = [];
  try {
    process = await executor(options.executable ?? "gflow", ["data", "download", media, "--profile", a.request.profile, "--out", dir, "--json"]);
    report = parse(process.stdout);
    for (const stream of ["stdout", "stderr"]) {
      fs.writeFileSync(path.join(dir, `${stream}.txt`), process[stream]);
      evidence.push(`${relative}/${stream}.txt`);
    }
    const target = typeof report?.path === "string" ? path.resolve(report.path) : "";
    const contained = target && path.relative(dir, target) && !path.relative(dir, target).startsWith("..") && !path.isAbsolute(path.relative(dir, target));
    if (process.code !== 0 || process.signal || report?.media_id !== media || report.profile !== a.request.profile || report.project_id !== a.request.project || !contained || !mp4(inside(run, path.relative(run, target))) || fs.statSync(target).size !== report.bytes) throw new Error("Recovered download not verified; no new generation submitted");
    return finishAttempt(run, id, { status: "generated", note: "Recovered known media without another generation; inspection still required", reported: previous.reported, recovery: report, evidence, artifacts: [path.relative(run, target)] });
  } catch (error) {
    return finishAttempt(run, id, { status: "uncertain", note: error.message, reported: previous.reported, recovery: report, process: process && { code: process.code, signal: process.signal, error: process.error ?? null }, evidence });
  }
}
async function main(args) {
  const [command, run, file] = args;
  if (command === "probe") return probe();
  if (command === "generate" && run && file) return generate(run, read(file));
  if (command === "recover" && run && file) return recover(run, file);
  throw new Error("gflow.mjs probe | generate <run> <shot-request.json> | recover <run> <attempt-id>");
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  try { console.log(JSON.stringify(await main(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; }
}

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkPackage } from "./check-package.mjs";

const temp = mkdtempSync(join(tmpdir(), "domain-skill-contract-"));
const script = join(dirname(fileURLToPath(import.meta.url)), "check-package.mjs");
const kinds = ["normal", "missing-input", "conflicting-guidance", "out-of-scope"];
function fixture() {
  const directory = join(mkdtempSync(join(temp, "case-")), "review-proposals");
  for (const subdir of ["agents", "references", "evals"]) mkdirSync(join(directory, subdir), { recursive: true });
  const refs = ["personality", "methods", "review-rubric", "sources"];
  writeFileSync(join(directory, "SKILL.md"), `---\nname: review-proposals\ndescription: "Use when reviewing a proposal for a concrete decision."\nmetadata:\n  author: Synthetic fixture\n  version: 0.0.0\n---\n\n# Review proposals\n\n## Steps\n\n1. Read ${refs.map((name) => `[${name}](references/${name}.md)`).join(", ")} and review the proposal.\n\n## Done-check\n\n- [ ] A decision cites proposal evidence.\n`);
  writeFileSync(join(directory, "agents/openai.yaml"), 'interface:\n  display_name: "Review Proposals"\n  short_description: "Review proposals against explicit decision criteria"\n');
  for (const name of refs) writeFileSync(join(directory, `references/${name}.md`), `# Synthetic ${name}\n\nContract fixture; no claim of domain validation.\n`);
  const evaluations = {
    skill_name: "review-proposals",
    evals: kinds.map((kind, index) => ({ id: index + 1, kind, prompt: `Synthetic ${kind} proposal case`, expected_output: "A decision grounded in supplied evidence", assertions: ["The decision points to supplied evidence"] })),
    triggers: [
      { prompt: "Review my proposal", should_trigger: true },
      { prompt: "Find problems in this proposal", should_trigger: true },
      { prompt: "Write a biography", should_trigger: false },
      { prompt: "Create a new workflow", should_trigger: false },
    ],
  };
  writeFileSync(join(directory, "evals/evals.json"), JSON.stringify(evaluations));
  return directory;
}
function edit(directory, path, fn) {
  writeFileSync(join(directory, path), fn(readFileSync(join(directory, path), "utf8")));
}
function editEvals(directory, fn) {
  edit(directory, "evals/evals.json", (text) => JSON.stringify(fn(JSON.parse(text))));
}
function refuses(mutate, expected) {
  const directory = fixture();
  mutate(directory);
  const result = checkPackage(directory);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((message) => message.includes(expected)), result.errors.join("\n"));
}
try {
  const good = fixture();
  assert.deepEqual(checkPackage(good), { ok: true, name: "review-proposals", errors: [] });
  const installed = join(temp, "installed", "review-proposals");
  mkdirSync(dirname(installed));
  symlinkSync(good, installed);
  assert.equal(checkPackage(installed).ok, true, "flat symlink installs remain usable");
  const cli = spawnSync(process.execPath, [script, good], { cwd: temp, encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).ok, true);
  const linkedScripts = join(temp, "installed-factory-scripts");
  symlinkSync(dirname(script), linkedScripts);
  const linkedCli = spawnSync(process.execPath, [join(linkedScripts, "check-package.mjs"), good], { cwd: temp, encoding: "utf8" });
  assert.equal(linkedCli.status, 0, linkedCli.stderr);
  assert.equal(JSON.parse(linkedCli.stdout).ok, true, "the checker itself runs through an installed symlink");
  assert.equal(spawnSync(process.execPath, [join(linkedScripts, "check-package.mjs"), join(temp, "absent")], { encoding: "utf8" }).status, 1);
  assert.equal(spawnSync(process.execPath, [script], { encoding: "utf8" }).status, 1);
  assert.equal(checkPackage(join(temp, "absent")).ok, false);

  refuses((dir) => edit(dir, "SKILL.md", (s) => s.replace("name: review-proposals", "name: expert-persona")), "name must match directory");
  refuses((dir) => edit(dir, "SKILL.md", (s) => s.replace("metadata:", "disable-model-invocation: true\nmetadata:")), "omit disable-model-invocation");
  refuses((dir) => edit(dir, "SKILL.md", (s) => s.replace("metadata:", '"disable-model-invocation": true\nmetadata:')), "omit disable-model-invocation");
  refuses((dir) => edit(dir, "agents/openai.yaml", (s) => `${s}policy:\n  allow_implicit_invocation: false\n`), "omit policy");
  refuses((dir) => edit(dir, "agents/openai.yaml", (s) => `${s}'policy': {allow_implicit_invocation: false}\n`), "omit policy");
  refuses((dir) => edit(dir, "SKILL.md", (s) => s.replace(/description: [^\n]+/, "description:")), "one-line description");
  refuses((dir) => edit(dir, "SKILL.md", (s) => s.replace("[methods](references/methods.md)", "methods")), "must link references/methods.md");
  refuses((dir) => rmSync(join(dir, "references/personality.md")), "required nonempty file");
  refuses((dir) => edit(dir, "evals/evals.json", () => "{"), "invalid JSON");
  refuses((dir) => editEvals(dir, (e) => ({ ...e, evals: e.evals.slice(1) })), "missing normal case");
  refuses((dir) => editEvals(dir, (e) => ({ ...e, evals: [...e.evals, e.evals[0]] })), "unique id");
  refuses((dir) => editEvals(dir, (e) => ({ ...e, evals: [null] })), "unique id");
  refuses((dir) => editEvals(dir, (e) => ({ ...e, triggers: e.triggers.filter((t) => t.should_trigger) })), "two distinct negative");
  refuses((dir) => editEvals(dir, (e) => ({ ...e, triggers: e.triggers.map((t) => ({ ...t, should_trigger: "false" })) })), "boolean should_trigger");
  refuses((dir) => editEvals(dir, (e) => ({ ...e, triggers: [e.triggers[0], e.triggers[0], ...e.triggers.slice(2)] })), "two distinct positive");
  refuses((dir) => editEvals(dir, (e) => ({ ...e, evals: e.evals.map((c) => ({ ...c, files: ["../outside.md"] })) })), "fixture must be a file inside package");
  const outside = join(temp, "outside.md");
  writeFileSync(outside, "Outside fixture must never be read\n");
  refuses((dir) => {
    rmSync(join(dir, "references/sources.md"));
    symlinkSync(outside, join(dir, "references/sources.md"));
  }, "required nonempty file");
  refuses((dir) => {
    symlinkSync(outside, join(dir, "evals/outside.md"));
    editEvals(dir, (e) => ({ ...e, evals: e.evals.map((c) => ({ ...c, files: ["evals/outside.md"] })) }));
  }, "fixture must be a file inside package");
  console.log("ok: generated package structure, model invocation, evaluation cases, CLI and contained fixture paths (not domain performance)");
} finally {
  rmSync(temp, { recursive: true, force: true });
}

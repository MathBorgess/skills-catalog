import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { getSiblingSkills } from "../skills/engineering/skills-evaluate/scripts/evaluate.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "catalog-layout-")));
try {
  const fixture = path.join(temp, "repo");
  const dest = path.join(temp, "installed");
  fs.mkdirSync(path.join(fixture, "scripts"), { recursive: true });
  fs.mkdirSync(dest);
  const skills = { engineering: "technical", creativity: "visual", experiments: "measured" };
  for (const [category, name] of Object.entries(skills)) {
    const dir = path.join(fixture, "skills", category, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: Synthetic category fixture\n---\n`);
  }
  fs.symlinkSync(path.join(fixture, "skills", "technical"), path.join(dest, "technical"));
  fs.symlinkSync(path.join(fixture, "skills", "removed"), path.join(dest, "removed"));
  const unrelated = path.join(temp, "external");
  fs.mkdirSync(unrelated);
  fs.symlinkSync(unrelated, path.join(dest, "unrelated"));
  // Redirect only this fixture's destination block; never install into the user's home.
  const script = fs.readFileSync(path.join(repo, "scripts/link-skills.sh"), "utf8")
    .replace(/DESTS=\([\s\S]*?\n\)/, `DESTS=( '${dest.replaceAll("'", "'\\''")}' )`);
  fs.writeFileSync(path.join(fixture, "scripts/link-skills.sh"), script);
  const linked = spawnSync("bash", [path.join(fixture, "scripts/link-skills.sh")], { encoding: "utf8" });
  assert.equal(linked.status, 0, linked.stderr);
  for (const [category, name] of Object.entries(skills)) {
    assert.equal(fs.realpathSync(path.join(dest, name)), path.join(fixture, "skills", category, name));
  }
  assert.equal(fs.existsSync(path.join(dest, "removed")), false);
  assert.equal(fs.realpathSync(path.join(dest, "unrelated")), unrelated);
  assert.deepEqual(getSiblingSkills(path.join(fixture, "skills"), "").map((s) => s.name).sort(), ["measured", "technical", "visual"]);
  assert.deepEqual(getSiblingSkills(dest, "").map((s) => s.name).sort(), ["measured", "technical", "visual"], "flat symlink installs remain discoverable");
  const flat = path.join(temp, "flat");
  fs.mkdirSync(path.join(flat, "standalone"), { recursive: true });
  fs.writeFileSync(path.join(flat, "standalone/SKILL.md"), "---\nname: standalone\ndescription: Flat install fixture\n---\n");
  assert.deepEqual(getSiblingSkills(flat, "").map((s) => s.name), ["standalone"]);
  // A real rename removes this checkout's former installed name, without a duplicate.
  const old = path.join(fixture, "skills/creativity/reference-animation");
  fs.mkdirSync(old);
  fs.writeFileSync(path.join(old, "SKILL.md"), "---\nname: reference-animation\ndescription: Synthetic old name\n---\n");
  const relink = () => spawnSync("bash", [path.join(fixture, "scripts/link-skills.sh")], { encoding: "utf8" });
  assert.equal(relink().status, 0);
  assert.ok(fs.existsSync(path.join(dest, "reference-animation")));
  const renamed = path.join(fixture, "skills/creativity/co-direct-animation");
  fs.renameSync(old, renamed);
  fs.writeFileSync(path.join(renamed, "SKILL.md"), "---\nname: co-direct-animation\ndescription: Synthetic new name\n---\n");
  assert.equal(relink().status, 0);
  assert.equal(fs.existsSync(path.join(dest, "reference-animation")), false);
  assert.equal(fs.realpathSync(path.join(dest, "co-direct-animation")), renamed);
  assert.equal(fs.realpathSync(path.join(dest, "unrelated")), unrelated);
  // Installed symlinks must still resolve bundled profiles through import.meta.url.
  const installed = path.join(temp, "actual-skill");
  fs.symlinkSync(path.join(repo, "skills/creativity/co-direct-animation"), installed);
  const source = path.join(temp, "source.md"), brief = path.join(temp, "brief.md");
  fs.writeFileSync(source, "# Synthetic design\n"); fs.writeFileSync(brief, "# Synthetic brief\n");
  const invoked = spawnSync(process.execPath, [path.join(installed, "scripts/compose.mjs"), "new", "--design", source, "--brief", brief], { cwd: temp, encoding: "utf8" });
  assert.equal(invoked.status, 0, invoked.stderr);
  const run = JSON.parse(invoked.stdout).run;
  try {
    assert.equal(JSON.parse(fs.readFileSync(path.join(run, "run.json"))).skill, "co-direct-animation");
    assert.ok(fs.existsSync(path.join(run, "references/apple-fluid/apple-fluid.md")));
    const state = spawnSync(process.execPath, [path.join(installed, "scripts/workflow.mjs"), "status", run], { encoding: "utf8" });
    assert.equal(state.status, 0, state.stderr);
    assert.equal(JSON.parse(state.stdout).gates.moodboard, "planned");
    const probe = spawnSync(process.execPath, [path.join(installed, "scripts/gflow.mjs"), "probe"], { env: { ...process.env, PATH: path.join(temp, "absent-bin") }, encoding: "utf8" });
    assert.equal(probe.status, 0, probe.stderr);
    assert.equal(JSON.parse(probe.stdout).available, false);
  } finally { fs.rmSync(run, { recursive: true, force: true }); }
  console.log("ok: categorized discovery, unchanged install names, stale link refresh and unrelated link preservation");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

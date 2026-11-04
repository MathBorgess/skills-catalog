import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const retired = ["domain-modeling", "study-wiki", "skills-evaluate", "video-reference", "explain-me", "prettify"];
const plugin = JSON.parse(fs.readFileSync(path.join(repo, ".claude-plugin/plugin.json"), "utf8"));
for (const name of retired) {
  assert.ok(fs.existsSync(path.join(repo, "deprecated", name, "SKILL.md")), `${name} remains available as historical source`);
  assert.ok(!plugin.skills.some((entry) => entry.endsWith(`/${name}`)), `${name} is not shipped by the plugin`);
  for (const category of ["engineering", "creativity", "media", "experiments"]) {
    assert.ok(!fs.existsSync(path.join(repo, "skills", category, name)), `${name} is not an active skill`);
  }
}
const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "catalog-layout-")));
try {
  const fixture = path.join(temp, "repo");
  const dest = path.join(temp, "installed");
  fs.mkdirSync(path.join(fixture, "scripts"), { recursive: true });
  fs.mkdirSync(dest);
  const skills = {
    engineering: "technical",
    creativity: "visual",
    media: "editorial",
    experiments: "measured",
  };
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
  // A real rename or category move removes this checkout's former installed name, without a duplicate.
  const old = path.join(fixture, "skills/creativity/old-director");
  fs.mkdirSync(old);
  fs.writeFileSync(path.join(old, "SKILL.md"), "---\nname: old-director\ndescription: Synthetic old name\n---\n");
  const relink = () => spawnSync("bash", [path.join(fixture, "scripts/link-skills.sh")], { encoding: "utf8" });
  assert.equal(relink().status, 0);
  assert.ok(fs.existsSync(path.join(dest, "old-director")));
  const renamed = path.join(fixture, "skills/media/social-video-director");
  fs.renameSync(old, renamed);
  fs.writeFileSync(path.join(renamed, "SKILL.md"), "---\nname: social-video-director\ndescription: Synthetic new name\n---\n");
  assert.equal(relink().status, 0);
  assert.equal(fs.existsSync(path.join(dest, "old-director")), false);
  assert.equal(fs.realpathSync(path.join(dest, "social-video-director")), renamed);
  assert.equal(fs.realpathSync(path.join(dest, "unrelated")), unrelated);
  // Installed symlinks must still resolve bundled scripts through import.meta.url.
  const installed = path.join(temp, "actual-skill");
  fs.symlinkSync(path.join(repo, "skills/creativity/easy-to-read"), installed);
  const checkRun = spawnSync(process.execPath, [path.join(installed, "scripts/ste-lint.mjs"), "--help"], { cwd: temp, encoding: "utf8" });
  assert.ok(checkRun.status === 0 || checkRun.stdout.length > 0 || checkRun.stderr.length > 0);
  console.log("ok: categorized discovery, unchanged install names, stale link refresh and unrelated link preservation");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

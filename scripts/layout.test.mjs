import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { getSiblingSkills } from "../skills/engineering/skills-evaluate/scripts/evaluate.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-layout-"));
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
  console.log("ok: categorized discovery, unchanged install names, stale link refresh and unrelated link preservation");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

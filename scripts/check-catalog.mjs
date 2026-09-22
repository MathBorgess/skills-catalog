#!/usr/bin/env node
// Fail if README, plugin.json, package.json, and skills/ disagree.
// Optional: `claude plugin validate . --strict` when the Claude CLI is on PATH.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = join(repo, "skills");
const names = readdirSync(skillsDir).filter((name) =>
  existsSync(join(skillsDir, name, "SKILL.md")),
);

const errors = [];

const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf8"));
const plugin = JSON.parse(
  readFileSync(join(repo, ".claude-plugin", "plugin.json"), "utf8"),
);
const marketplace = JSON.parse(
  readFileSync(join(repo, ".claude-plugin", "marketplace.json"), "utf8"),
);
const readme = readFileSync(join(repo, "README.md"), "utf8");

if (plugin.version !== pkg.version) {
  errors.push(
    `plugin.json version ${plugin.version} != package.json ${pkg.version}. Run \`npm run sync-plugin-version\`.`,
  );
}

if (plugin.name !== "skills-catalog") {
  errors.push(`plugin.json name must be skills-catalog, got ${plugin.name}`);
}

const listed = new Set(plugin.skills ?? []);
for (const name of names) {
  const rel = `./skills/${name}`;
  if (!listed.has(rel)) errors.push(`plugin.json missing ${rel}`);

  const skill = readFileSync(join(skillsDir, name, "SKILL.md"), "utf8");
  const fmName = skill.match(/^name:\s*(\S+)/m)?.[1];
  if (fmName !== name) {
    errors.push(`${name}/SKILL.md frontmatter name "${fmName}" != directory`);
  }

  const version = skill.match(/^\s+version:\s*['"]?([0-9]+\.[0-9]+\.[0-9]+)/m)?.[1];
  const catalogLink = "[`" + name + "`](skills/" + name + "/)";
  if (!readme.includes(catalogLink)) {
    errors.push("README.md catalog missing " + catalogLink);
  } else if (version) {
    const escaped = version.replace(/\./g, "\\.");
    const row = new RegExp(
      "\\[`" + name + "`\\]\\(skills/" + name + "/\\)\\s*\\|\\s*" + escaped + "\\s*\\|",
    );
    if (!row.test(readme)) {
      errors.push("README.md version for " + name + " is not " + version);
    }
  }

  if (!existsSync(join(skillsDir, name, "agents", "openai.yaml"))) {
    errors.push(`${name} missing agents/openai.yaml`);
  }
}

for (const rel of listed) {
  const name = rel.replace(/^\.\/skills\//, "");
  if (!names.includes(name)) errors.push(`plugin.json lists missing ${rel}`);
}

const marketplacePlugin = marketplace.plugins?.[0];
if (marketplacePlugin?.name !== plugin.name) {
  errors.push(
    `marketplace.json plugin name ${marketplacePlugin?.name} != plugin.json ${plugin.name}`,
  );
}

function claudeValidate(target, strict) {
  const args = ["plugin", "validate", target];
  if (strict) args.push("--strict");
  return spawnSync("claude", args, { encoding: "utf8" });
}

const claudeCheck = claudeValidate(
  join(repo, ".claude-plugin", "marketplace.json"),
  true,
);
if (claudeCheck.error && claudeCheck.error.code === "ENOENT") {
  console.log("skip: claude CLI not installed (plugin validate)");
} else {
  if (claudeCheck.status !== 0) {
    errors.push(
      "claude plugin validate marketplace --strict failed:\n" +
        (claudeCheck.stdout || "") +
        (claudeCheck.stderr || ""),
    );
  }
  const skillsCheck = claudeValidate(join(repo, "skills"), true);
  if (skillsCheck.status !== 0) {
    errors.push(
      "claude plugin validate skills --strict failed:\n" +
        (skillsCheck.stdout || "") +
        (skillsCheck.stderr || ""),
    );
  }
  // plugin.json --strict also loads the repo root and warns that CLAUDE.md and
  // AGENTS.md are not plugin context. That warning is correct; do not fail the
  // catalog on it.
  const pluginCheck = claudeValidate(
    join(repo, ".claude-plugin", "plugin.json"),
    false,
  );
  if (pluginCheck.status !== 0) {
    errors.push(
      "claude plugin validate plugin.json failed:\n" +
        (pluginCheck.stdout || "") +
        (pluginCheck.stderr || ""),
    );
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`ok: ${names.length} skills, plugin ${plugin.version}`);

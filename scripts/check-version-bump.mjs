#!/usr/bin/env node
// Fail a pull request that touches skills/ without bumping package.json's
// version. The publish job in validate.yml runs on every push to main but
// only actually `npm publish`s when that version is not already on GitHub
// Packages (`npm view <name>@<version>` — see that workflow) — so a skill
// change that lands with the version unchanged merges cleanly and then
// silently never ships. This is the check that makes that impossible.
//
// Meaningful only where a base ref exists to diff against (a pull_request
// run — GITHUB_BASE_REF, or an explicit ref for local testing). Push events
// have already been through this gate as a PR, so there is nothing to
// enforce and the script is a no-op.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const baseRef = process.env.GITHUB_BASE_REF || process.argv[2];

if (!baseRef) {
  console.log("check-version-bump: no base ref (not a pull_request run) — skipping.");
  process.exit(0);
}

function git(args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

// A PR checkout does not otherwise have the base branch locally.
try {
  git(["fetch", "--depth=1", "origin", baseRef]);
} catch (e) {
  console.error(`check-version-bump: could not fetch origin/${baseRef}: ${e.message}`);
  process.exit(1);
}

const base = `origin/${baseRef}`;

// Two-dot diff: a direct tree comparison between the two commits, so it
// needs no shared history — which a shallow, just-fetched base ref may not
// have with a shallow PR checkout.
const changed = git(["diff", "--name-only", base, "HEAD"])
  .split("\n")
  .filter(Boolean);

if (!changed.some((f) => f.startsWith("skills/"))) {
  console.log("check-version-bump: no file under skills/ changed — nothing to enforce.");
  process.exit(0);
}

const versionAt = (ref, file) => JSON.parse(git(["show", `${ref}:${file}`])).version;

const baseVersion = versionAt(base, "package.json");
const headVersion = JSON.parse(readFileSync(join(repo, "package.json"), "utf8")).version;

if (baseVersion === headVersion) {
  console.error(
    `check-version-bump: skills/ changed but package.json is still ${headVersion}, same as ` +
      `${baseRef}. Bump it — \`npm version patch|minor|major\` (syncs plugin.json) — or this ` +
      `merges but never publishes. See AGENTS.md § Release.`,
  );
  process.exit(1);
}

console.log(
  `check-version-bump: skills/ changed and package.json moved ${baseVersion} -> ${headVersion}. ok.`,
);

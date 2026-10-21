#!/usr/bin/env node
// Read-only checks for the generated package contract. No domain verdicts.
import { readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const required = [
  "SKILL.md", "agents/openai.yaml", "references/personality.md",
  "references/methods.md", "references/review-rubric.md",
  "references/sources.md", "evals/evals.json",
];
const kinds = ["normal", "missing-input", "conflicting-guidance", "out-of-scope"];
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const inside = (root, target) => {
  const rel = relative(root, target);
  return rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(rel);
};

// Supported strings: one-line plain scalars, JSON double quotes or YAML single quotes.
function scalar(source, key, indent = "") {
  const matches = [...source.matchAll(new RegExp(`^${indent}${key}:[ \\t]*([^\\r\\n]*)$`, "gm"))];
  if (matches.length !== 1) return "";
  const value = matches[0][1].trim();
  if (value.startsWith('"')) {
    try { const parsed = JSON.parse(value); return typeof parsed === "string" ? parsed : ""; }
    catch { return ""; }
  }
  if (value.startsWith("'")) return /^'(?:[^']|'')*'$/.test(value) ? value.slice(1, -1).replaceAll("''", "'") : "";
  const reservedStart = /^[!&*\[\]{},#|>@`%]/.test(value) || /^[-?:](?:[ \t]|$)/.test(value);
  const unsafePlain = /:(?:[ \t]|$)|(?:^|[ \t])#|[\u0000-\u001f\u007f-\u009f]/.test(value);
  const typedPlain = /^(?:~|null|true|false|[-+]?(?:0x[0-9a-f]+|0o[0-7]+|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:e[-+]?[0-9]+)?|\.inf|\.nan))$/i.test(value);
  return !value || reservedStart || unsafePlain || typedPlain ? "" : value;
}

function mapping(source, key) {
  const lines = source.split(/\r?\n/);
  const starts = lines.flatMap((line, index) => line.startsWith(`${key}:`) ? [index] : []);
  if (starts.length !== 1 || lines[starts[0]].trimEnd() !== `${key}:`) return "";
  const start = starts[0] + 1;
  let end = start;
  while (end < lines.length && (!lines[end].trim() || /^[ \t#]/.test(lines[end]))) end++;
  return lines.slice(start, end).join("\n");
}

export function checkPackage(directory) {
  const errors = [];
  let root;
  try {
    root = realpathSync(directory);
    if (!statSync(root).isDirectory()) throw new Error("not a directory");
  } catch {
    return { ok: false, errors: ["Package directory is missing or invalid"] };
  }
  function localFile(path) {
    if (!nonempty(path) || isAbsolute(path) || !inside(root, resolve(root, path))) throw new Error("path leaves package");
    const target = realpathSync(resolve(root, path));
    if (!inside(root, target) || !statSync(target).isFile()) throw new Error("not a package file");
    return target;
  }
  const contents = new Map();
  for (const path of required) {
    try {
      const content = readFileSync(localFile(path), "utf8");
      if (!content.trim()) throw new Error("empty");
      contents.set(path, content);
    } catch { errors.push(`${path}: required nonempty file inside package`); }
  }
  const skill = contents.get("SKILL.md") ?? "";
  const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? "";
  const name = scalar(frontmatter, "name");
  const description = scalar(frontmatter, "description");
  const directoryName = resolve(directory).split(/[\\/]/).at(-1);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64 || name !== directoryName) {
    errors.push("SKILL.md: activity name must match directory, use lowercase hyphens and be at most 64 characters");
  }
  if (!description || description.length > 1024) errors.push("SKILL.md: one-line description must contain 1-1024 characters");
  const metadata = mapping(frontmatter, "metadata");
  if (!scalar(metadata, "author", "  ") || !/^\d+\.\d+\.\d+$/.test(scalar(metadata, "version", "  "))) {
    errors.push("SKILL.md: metadata.author and semantic metadata.version are required");
  }
  if (/^["']?disable-model-invocation["']?[ \t]*:/m.test(frontmatter)) errors.push("SKILL.md: omit disable-model-invocation to preserve default model invocation");
  if (!/^## (?:Steps|Workflow)\s*$/m.test(skill) || !/^\d+\. /m.test(skill)) errors.push("SKILL.md: ordered activity steps are required");
  if (!/^## Done-check\s*$/m.test(skill) || !/^- \[ \] /m.test(skill)) errors.push("SKILL.md: a done-check is required");
  for (const path of required.filter((p) => p.startsWith("references/"))) {
    if (!skill.includes(`](${path})`)) errors.push(`SKILL.md: must link ${path}`);
  }
  const ui = contents.get("agents/openai.yaml") ?? "";
  const uiInterface = mapping(ui, "interface");
  if (!scalar(uiInterface, "display_name", "  ") || !scalar(uiInterface, "short_description", "  ")) {
    errors.push("agents/openai.yaml: interface display_name and short_description are required");
  }
  if (/^["']?policy["']?[ \t]*:/m.test(ui)) errors.push("agents/openai.yaml: omit policy to preserve default model invocation");

  let evaluations;
  try { evaluations = JSON.parse(contents.get("evals/evals.json") ?? ""); }
  catch { errors.push("evals/evals.json: invalid JSON"); }
  if (!evaluations || typeof evaluations !== "object" || Array.isArray(evaluations)) {
    errors.push("evals/evals.json: expected an evaluation object");
  } else {
    if (evaluations.skill_name !== name) errors.push("evals/evals.json: skill_name must match activity name");
    const cases = Array.isArray(evaluations.evals) ? evaluations.evals : [];
    const ids = new Set();
    for (const [index, entry] of cases.entries()) {
      const validId = (nonempty(entry?.id) || Number.isInteger(entry?.id)) && !ids.has(entry?.id);
      ids.add(entry?.id);
      if (!validId || !kinds.includes(entry?.kind) || !nonempty(entry?.prompt) || !nonempty(entry?.expected_output) ||
          !Array.isArray(entry?.assertions) || !entry.assertions.length || !entry.assertions.every(nonempty)) {
        errors.push(`evals/evals.json: case ${index + 1} needs a unique id, valid kind, prompt, expected_output and assertions`);
      }
      if (entry?.files !== undefined) {
        if (!Array.isArray(entry.files)) errors.push(`evals/evals.json: case ${index + 1} files must be an array`);
        else for (const path of entry.files) {
          try { localFile(path); } catch { errors.push(`evals/evals.json: case ${index + 1} fixture must be a file inside package`); }
        }
      }
    }
    for (const kind of kinds) {
      if (!cases.some((entry) => entry?.kind === kind)) errors.push(`evals/evals.json: missing ${kind} case`);
    }
    const triggers = Array.isArray(evaluations.triggers) ? evaluations.triggers : [];
    if (triggers.some((entry) => !nonempty(entry?.prompt) || typeof entry?.should_trigger !== "boolean")) errors.push("evals/evals.json: triggers need prompt and boolean should_trigger");
    const allPrompts = triggers.filter((entry) => nonempty(entry?.prompt)).map((entry) => entry.prompt.trim());
    if (new Set(allPrompts).size !== allPrompts.length) errors.push("evals/evals.json: unique trigger prompts are required across all labels");
    for (const expected of [true, false]) {
      const prompts = new Set(triggers.filter((entry) => nonempty(entry?.prompt) && entry?.should_trigger === expected).map((entry) => entry.prompt.trim()));
      if (prompts.size < 2) errors.push(`evals/evals.json: need two distinct ${expected ? "positive" : "negative"} trigger prompts`);
    }
  }
  return { ok: errors.length === 0, name, errors };
}

let invokedDirectly = false;
try { invokedDirectly = realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); }
catch { /* Imported from an eval or stdin session. */ }
if (invokedDirectly) {
  const result = process.argv.length === 3 ? checkPackage(process.argv[2]) : { ok: false, errors: ["Usage: node check-package.mjs <skill-directory>"] };
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}

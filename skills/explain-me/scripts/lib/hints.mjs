// Command lines the driver prints as hints ("next: ...", "fix: ..."). Each one must run as printed from the
// folder the user is in, so the script is named by its real path, relative to the current folder.

import path from "node:path";

// The script path relative to `cwd`; absolute when the relative path would climb out more than twice
// (a long ../../../.. chain is harder to read and to trust than the absolute path).
export function scriptRef(script, cwd = process.cwd(), pathMod = path) {
  const rel = pathMod.relative(cwd, script);
  if (!rel || pathMod.isAbsolute(rel)) return script; // another drive on Windows, or the same place
  const climbs = rel.split(/[\\/]+/).filter((part) => part === "..").length;
  return climbs > 2 ? script : rel;
}

// A path or value that has spaces or shell characters gets double quotes.
export function quoteArg(value) {
  const s = String(value);
  return /^[\w@%+=:,./\\~-]+$/.test(s) ? s : `"${s.replace(/(["$`\\])/g, "\\$1")}"`;
}

// `node <script> <args>`, with the script written as scriptRef says.
export function commandLine(script, args, cwd = process.cwd(), pathMod = path) {
  return `node ${quoteArg(scriptRef(script, cwd, pathMod))}${args ? ` ${args}` : ""}`;
}

// Skill home: the one per-machine directory where explain-me keeps its venv, the user's
// personal DESIGN.md and every run. Nothing here touches the user's project.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Returns { dir, source } so `doctor` can say where the path came from.
export function skillHome({ env = process.env, platform = process.platform, homedir = os.homedir() } = {}) {
  const override = env.EXPLAIN_ME_HOME;
  if (override && override.trim()) return { dir: path.resolve(override), source: "EXPLAIN_ME_HOME" };
  if (platform === "win32") {
    const local = env.LOCALAPPDATA && env.LOCALAPPDATA.trim() ? env.LOCALAPPDATA : path.win32.join(homedir, "AppData", "Local");
    return { dir: path.win32.join(local, "explain-me"), source: env.LOCALAPPDATA ? "LOCALAPPDATA" : "default" };
  }
  const xdg = env.XDG_CACHE_HOME;
  if (xdg && xdg.trim()) return { dir: path.join(xdg, "explain-me"), source: "XDG_CACHE_HOME" };
  return { dir: path.join(homedir, ".cache", "explain-me"), source: "default" };
}

export const runsDir = (home) => path.join(home, "runs");
export const personalDesignPath = (home) => path.join(home, "DESIGN.md");
export const venvDir = (home) => path.join(home, "venv");

export function venvPython(home, platform = process.platform) {
  return platform === "win32" ? path.join(venvDir(home), "Scripts", "python.exe") : path.join(venvDir(home), "bin", "python");
}

// The shipped assets live next to the scripts, whatever the install path is.
export function assetsDir(metaUrl) {
  return path.resolve(path.dirname(fileURLToPath(metaUrl)), "..", "assets");
}

export function pad2(n) {
  return String(n).padStart(2, "0");
}

// YYYYMMDD-HHMMSS in local time.
export function runStamp(date = new Date()) {
  return (
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}` +
    `-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`
  );
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function slugify(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

// Creates <home>/runs/<stamp>-<slug>/ (never reuses a folder: a clash gets -2, -3, ...).
export function createRunDir(home, slug, date = new Date()) {
  const base = `${runStamp(date)}-${slug}`;
  fs.mkdirSync(runsDir(home), { recursive: true });
  for (let n = 1; ; n++) {
    const name = n === 1 ? base : `${base}-${n}`;
    const dir = path.join(runsDir(home), name);
    try {
      fs.mkdirSync(dir);
      return dir;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
}

// <run> is a run folder path, or a slug (the latest run with that slug).
export function resolveRun(home, ref) {
  if (!ref) throw new Error("missing <run>: pass a run folder path or a slug");
  const asPath = path.resolve(ref);
  if (fs.existsSync(path.join(asPath, "run.json"))) return asPath;
  const inRuns = path.join(runsDir(home), ref);
  if (fs.existsSync(path.join(inRuns, "run.json"))) return inRuns;
  let names = [];
  try {
    names = fs.readdirSync(runsDir(home));
  } catch {
    /* no runs yet */
  }
  const matches = names
    .filter((n) => /^\d{8}-\d{6}-/.test(n))
    .filter((n) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(runsDir(home), n, "run.json"), "utf8")).slug === ref;
      } catch {
        return false;
      }
    })
    .sort();
  if (!matches.length) throw new Error(`no run found for "${ref}" (looked for a folder with run.json, then a slug under ${runsDir(home)})`);
  return path.join(runsDir(home), matches[matches.length - 1]);
}

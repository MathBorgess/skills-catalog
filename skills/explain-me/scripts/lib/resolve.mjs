// Resolution of the two external pieces explain-me drives: the HyperFrames CLI and a Python
// that can run Kokoro. Both are "installed first": nothing is downloaded or updated when a
// usable copy exists. Everything that touches the machine goes through `deps` so the order
// can be tested with fakes.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hfEnv } from "./hyperframes.mjs";
import { venvPython } from "./home.mjs";

export function defaultDeps() {
  return {
    env: process.env,
    platform: process.platform,
    homedir: os.homedir(),
    nodePath: process.execPath,
    fs,
    exec: execCommand,
  };
}

// spawnSync wrapper returning {status, stdout, stderr, error}. `inherit` streams the child's
// output to ours (progress bars) and returns no captured text.
export function execCommand(cmd, args = [], { cwd, env, timeoutMs = 0, inherit = false, input } = {}) {
  const needsShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(cmd);
  const r = spawnSync(cmd, args, {
    cwd,
    env,
    input,
    encoding: "utf8",
    timeout: timeoutMs || undefined,
    maxBuffer: 64 * 1024 * 1024,
    stdio: inherit ? ["ignore", "inherit", "inherit"] : ["pipe", "pipe", "pipe"],
    shell: needsShell,
    windowsHide: true,
  });
  return { status: r.status, signal: r.signal, stdout: r.stdout ?? "", stderr: r.stderr ?? "", error: r.error ?? null };
}

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

export function parseSemver(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(String(v ?? "").trim());
  return m ? { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? null } : null;
}

// -1, 0, 1; unparsable versions sort lowest.
export function compareSemver(a, b) {
  const x = parseSemver(a);
  const y = parseSemver(b);
  if (!x && !y) return 0;
  if (!x) return -1;
  if (!y) return 1;
  for (const k of ["major", "minor", "patch"]) if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1;
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1; // a release outranks its pre-release
  if (y.pre === null) return -1;
  return x.pre < y.pre ? -1 : 1;
}

const isWin = (deps) => deps.platform === "win32";
const pathMod = (deps) => (isWin(deps) ? path.win32 : path.posix);

export function findOnPath(name, deps) {
  const p = pathMod(deps);
  const raw = deps.env.PATH ?? deps.env.Path ?? "";
  const dirs = raw.split(isWin(deps) ? ";" : ":").filter(Boolean);
  const exts = isWin(deps) ? ["", ...(deps.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean)] : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = p.join(dir, name + ext);
      if (!deps.fs.existsSync(candidate)) continue;
      try {
        if (deps.fs.statSync && !deps.fs.statSync(candidate).isFile()) continue;
      } catch {
        continue;
      }
      return candidate;
    }
  }
  return null;
}

function readVersionFromOutput(text) {
  const m = /(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/.exec(text ?? "");
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// HyperFrames
// ---------------------------------------------------------------------------

export function npxCacheRoots(deps) {
  const p = pathMod(deps);
  const roots = [];
  const configured = deps.env.npm_config_cache ?? deps.env.NPM_CONFIG_CACHE;
  if (configured) roots.push(p.join(configured, "_npx"));
  roots.push(p.join(deps.homedir, ".npm", "_npx"));
  if (isWin(deps) && deps.env.LOCALAPPDATA) roots.push(p.join(deps.env.LOCALAPPDATA, "npm-cache", "_npx"));
  return [...new Set(roots)];
}

// Every cached copy: [{bin, version, root}]
export function findNpxCacheCopies(deps) {
  const p = pathMod(deps);
  const found = [];
  for (const root of npxCacheRoots(deps)) {
    let entries = [];
    try {
      entries = deps.fs.readdirSync(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const pkgDir = p.join(root, entry, "node_modules", "hyperframes");
      const bin = p.join(pkgDir, "bin", "hyperframes.mjs");
      const pkg = p.join(pkgDir, "package.json");
      if (!deps.fs.existsSync(bin) || !deps.fs.existsSync(pkg)) continue;
      try {
        const version = JSON.parse(deps.fs.readFileSync(pkg, "utf8")).version;
        if (parseSemver(version)) found.push({ bin, version, root: p.join(root, entry) });
      } catch {
        /* a half-written cache entry is not a copy */
      }
    }
  }
  return found.sort((a, b) => compareSemver(b.version, a.version));
}

// Returns {ok, tier, command, prefixArgs, version, bin?, note?} or {ok:false, reason}.
//   tier "path"      : `hyperframes` on PATH
//   tier "npx-cache" : highest copy already in the npx cache, run with node
//   tier "npx-latest": `npx --yes hyperframes@latest` (only when nothing is installed)
// `probeNpx` runs `--version` through npx for the last tier (that downloads it); `doctor`
// leaves it off so it never installs.
export function resolveHyperframes(deps = defaultDeps(), { probeNpx = false } = {}) {
  const onPath = findOnPath("hyperframes", deps);
  if (onPath) {
    const p = pathMod(deps);
    // Windows shims (.cmd) sit next to node_modules/hyperframes; prefer running the script with node.
    let command = onPath;
    let prefixArgs = [];
    let bin;
    if (isWin(deps) && /\.(cmd|bat)$/i.test(onPath)) {
      const sibling = p.join(p.dirname(onPath), "node_modules", "hyperframes", "bin", "hyperframes.mjs");
      if (deps.fs.existsSync(sibling)) {
        command = deps.nodePath;
        prefixArgs = [sibling];
        bin = sibling;
      }
    }
    const r = deps.exec(command, [...prefixArgs, "--version"], { env: hfEnv(deps.env), timeoutMs: 20000 });
    return { ok: true, tier: "path", command, prefixArgs, bin, path: onPath, version: readVersionFromOutput(r.stdout) };
  }
  const copies = findNpxCacheCopies(deps);
  if (copies.length) {
    const best = copies[0];
    return { ok: true, tier: "npx-cache", command: deps.nodePath, prefixArgs: [best.bin], bin: best.bin, version: best.version, copies: copies.length };
  }
  const npx = findOnPath("npx", deps);
  if (!npx) {
    return {
      ok: false,
      reason: "HyperFrames is not installed and npx is not on PATH",
      fix: "install Node.js 22 or newer (it ships npx), or run: npm install -g hyperframes",
    };
  }
  const base = { ok: true, tier: "npx-latest", command: npx, prefixArgs: ["--yes", "hyperframes@latest"], version: null, note: "not installed; the first call downloads hyperframes@latest through npx" };
  if (probeNpx) {
    const r = deps.exec(npx, [...base.prefixArgs, "--version"], { env: hfEnv(deps.env), timeoutMs: 300000 });
    base.version = readVersionFromOutput(r.stdout);
    base.note = "downloaded through npx on this call";
  }
  return base;
}

// Best effort, never throws, null when offline or slow.
export async function latestHyperframesVersion({ fetchFn = globalThis.fetch, timeoutMs = 2500 } = {}) {
  try {
    if (typeof fetchFn !== "function") return null;
    const res = await fetchFn("https://registry.npmjs.org/hyperframes/latest", { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json.version === "string" && parseSemver(json.version) ? json.version : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Python with Kokoro
// ---------------------------------------------------------------------------

export const PYTHON_PROBE = "import importlib.util,sys; sys.exit(0 if all(importlib.util.find_spec(m) for m in ['kokoro_onnx','soundfile']) else 1)";

export function pythonHasKokoro(python, deps) {
  const r = deps.exec(python, ["-c", PYTHON_PROBE], { env: deps.env, timeoutMs: 20000 });
  return r.status === 0 && !r.error;
}

// Order: $HYPERFRAMES_PYTHON -> python3 on PATH -> <home>/venv. The first one that can import
// kokoro_onnx and soundfile wins. Returns {ok, tier, path, candidates}.
export function resolvePython(deps = defaultDeps(), { home } = {}) {
  const candidates = [];
  const tried = new Set();
  const consider = (tier, pythonPath) => {
    if (!pythonPath || tried.has(pythonPath)) return null;
    tried.add(pythonPath);
    const present = deps.fs.existsSync(pythonPath) || !path.isAbsolute(pythonPath);
    const kokoro = present ? pythonHasKokoro(pythonPath, deps) : false;
    candidates.push({ tier, path: pythonPath, present, kokoro });
    return kokoro ? { ok: true, tier, path: pythonPath } : null;
  };

  const hit = (deps.env.HYPERFRAMES_PYTHON && consider("env", deps.env.HYPERFRAMES_PYTHON)) || consider("python3", findOnPath("python3", deps) ?? findOnPath("python", deps)) || (home && consider("venv", venvPython(home, deps.platform)));
  if (hit) return { ...hit, candidates };
  return { ok: false, tier: null, path: null, candidates };
}

// ---------------------------------------------------------------------------
// espeak-ng (the phonemizer behind Kokoro)
// ---------------------------------------------------------------------------

// The espeak-ng library that ships inside the espeakng-loader wheel can carry a data path that
// does not exist on the user's machine ("Error processing file .../phontab"). A system
// espeak-ng library works, and phonemizer reads PHONEMIZER_ESPEAK_LIBRARY to find it.
export const ESPEAK_PROBE = "from kokoro_onnx.tokenizer import Tokenizer\nassert Tokenizer().phonemize('oi', lang='pt-br')";

export function systemEspeakCandidates(deps) {
  switch (deps.platform) {
    case "darwin":
      return ["/opt/homebrew/lib/libespeak-ng.dylib", "/usr/local/lib/libespeak-ng.dylib", "/opt/local/lib/libespeak-ng.dylib"];
    case "win32":
      return ["C:\\Program Files\\eSpeak NG\\libespeak-ng.dll", "C:\\Program Files (x86)\\eSpeak NG\\libespeak-ng.dll"];
    default:
      return [
        "/usr/lib/x86_64-linux-gnu/libespeak-ng.so.1",
        "/usr/lib/aarch64-linux-gnu/libespeak-ng.so.1",
        "/usr/lib64/libespeak-ng.so.1",
        "/usr/lib/libespeak-ng.so.1",
        "/usr/local/lib/libespeak-ng.so.1",
      ];
  }
}

// The first system espeak-ng library that exists on this machine, or null.
export function systemEspeakLibrary(deps) {
  return systemEspeakCandidates(deps).find((library) => deps.fs.existsSync(library)) ?? null;
}

// What to tell a user who has no espeak-ng. explain-me never installs it.
export function espeakInstallHint(platform) {
  switch (platform) {
    case "darwin":
      return "install espeak-ng with: brew install espeak-ng";
    case "win32":
      return "install espeak-ng from the Windows installer at https://github.com/espeak-ng/espeak-ng/releases";
    default:
      return "install espeak-ng with: sudo apt install espeak-ng (Debian or Ubuntu) or sudo dnf install espeak-ng (Fedora)";
  }
}

function espeakWorks(python, deps, extraEnv = {}) {
  const r = deps.exec(python, ["-c", ESPEAK_PROBE], { env: { ...deps.env, ...extraEnv }, timeoutMs: 60000 });
  return { ok: r.status === 0 && !r.error, error: (r.stderr || String(r.error ?? "")).trim().split("\n").slice(-2).join(" ") };
}

// Returns {ok, via: "user"|"bundled"|"system", env, library?, error?}. `env` holds what to add to
// the tts subprocess. A PHONEMIZER_ESPEAK_LIBRARY the user already set is respected, not replaced.
export function resolveEspeak(deps, python) {
  if (deps.env.PHONEMIZER_ESPEAK_LIBRARY) {
    const r = espeakWorks(python, deps);
    return r.ok ? { ok: true, via: "user", env: {}, library: deps.env.PHONEMIZER_ESPEAK_LIBRARY } : { ok: false, via: "user", env: {}, error: r.error };
  }
  const bundled = espeakWorks(python, deps);
  if (bundled.ok) return { ok: true, via: "bundled", env: {} };
  for (const library of systemEspeakCandidates(deps)) {
    if (!deps.fs.existsSync(library)) continue;
    const r = espeakWorks(python, deps, { PHONEMIZER_ESPEAK_LIBRARY: library });
    if (r.ok) return { ok: true, via: "system", env: { PHONEMIZER_ESPEAK_LIBRARY: library }, library };
  }
  return { ok: false, via: null, env: {}, error: bundled.error };
}

// espeak-ng for `doctor`, always: {status: bundled | system | user | missing, ok, via, library, tested, error}.
// With no Python that has kokoro_onnx, only the system library can be found and the bundled loader cannot be tried.
export function inspectEspeak(deps, python) {
  if (python.ok) {
    const r = resolveEspeak(deps, python.path);
    return r.ok
      ? { status: r.via, ok: true, via: r.via, library: r.library ?? null, tested: true, error: null }
      : { status: "missing", ok: false, via: null, library: null, tested: true, error: r.error || "the phonemizer cannot load an espeak-ng library" };
  }
  const library = systemEspeakLibrary(deps);
  return library
    ? { status: "system", ok: true, via: "system", library, tested: false, error: null }
    : { status: "missing", ok: false, via: null, library: null, tested: false, error: "no system library found, and the bundled loader cannot be tried until a Python has kokoro_onnx" };
}

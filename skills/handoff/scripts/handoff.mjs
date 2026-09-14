#!/usr/bin/env node
// handoff — deterministic orchestration for the `handoff` skill.
//
// Everything in here is procedure, not judgment: reading plan quota, checking
// that sessions are really independent, assigning slots, spawning children,
// waiting for them, and scoring the run. A model that does this by hand pays
// tokens per wave and gets it wrong under pressure; a script does it once for
// free. The skill's markdown keeps only the parts that need a model.
//
// Zero dependencies, Node 18+. Reads local credential files; never writes them.
//
// Commands
//   probe    [--run DIR] [--json]      supply snapshot per slot
//   route    --run DIR                 admission control + slot assignment
//   dispatch --run DIR [--budget S]    launch ready sessions, wait, reroute, repeat
//   status   --run DIR                 one line per session
//   score    --run DIR                 cost + defect scorecard, appends metrics.jsonl
//
// Run directory layout
//   $TMPDIR/handoff/<run-id>/
//     plan.json      written by the model: the cut
//     quota.json     written by probe
//     routing.json   written by route
//     state.json     written by dispatch
//     sessions/NN.md NN.prompt.md NN.result.md NN.progress.md
//     logs/NN.log    child stdout+stderr. The parent model never reads this.
//     wt/NN/         git worktree for a file-writing session

import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  readSync,
  statSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  claudeConfigDirs,
  localSearchPaths,
  localSnapshot,
} from "./local-usage.mjs";

const LOW_PCT = Number(process.env.HANDOFF_LOW_PCT ?? 20);
const PROBE_TTL_S = 300;
const POLL_MS = 3000;

// Cost prior, in percentage points of a provider's tightest window, per
// session. Replaced by the median of this machine's own history as soon as
// metrics.jsonl has three runs that used the same provider and size.
const COST_PRIOR = { s: 3, m: 8, l: 18 };

// ---------------------------------------------------------------- utilities

const readJSON = (p, fallback = null) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
};
const writeJSON = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
const nowISO = () => new Date().toISOString();
const secsSince = (iso) => (Date.now() - Date.parse(iso)) / 1000;
const which = (bin) =>
  spawnSync(process.platform === "win32" ? "where" : "command",
    process.platform === "win32" ? [bin] : ["-v", bin],
    { encoding: "utf8", shell: process.platform !== "win32" }).status === 0;

function die(msg, code = 1) {
  console.error(`handoff: ${msg}`);
  process.exit(code);
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

function runDir() {
  const d = arg("run") || process.env.HANDOFF_RUN;
  if (!d) die("no --run DIR (or $HANDOFF_RUN)");
  return resolve(d);
}

// Bounded read: the whole point is that bulk child output never reaches the
// model. The script may look at it; it only ever emits a classification.
function tailOf(path, bytes = 8192) {
  try {
    const size = statSync(path).size;
    const fd = openSync(path, "r");
    const start = Math.max(0, size - bytes);
    const buf = Buffer.alloc(Math.min(bytes, size));
    readSync(fd, buf, 0, buf.length, start);
    closeSync(fd);
    return buf.toString("utf8");
  } catch {
    return "";
  }
}

// ------------------------------------------------------------------- probe
//
// Source order per provider, first that yields a number:
//   1. ai-usagebar usage --json   (if installed — it already tracks 20+ vendors,
//      multiple accounts, a 60s atomic cache and a 429 backoff; free to prefer)
//   2. this file's own read of the CLI's own OAuth credential + usage endpoint
//   3. binary present but unreadable → installed, remaining unknown
//
// Reads are strictly read-only. An expired token is reported as `unknown` with
// a fix; refreshing another process's credential is not this script's business.

// A credential is wherever the CLI actually put it, which differs by OS and
// moves between versions. Each provider lists every place worth looking, and
// the first source that yields an unexpired token wins; `probe --explain`
// prints the whole list so a miss is diagnosable instead of mysterious.
function readKeychainRaw(service) {
  if (process.platform !== "darwin") return null;
  const r = spawnSync("/usr/bin/security", ["find-generic-password", "-s", service, "-w"], {
    encoding: "utf8",
    timeout: 10000,
  });
  return r.status === 0 && r.stdout ? r.stdout.trim() : null;
}

function readKeychain(service) {
  const raw = readKeychainRaw(service);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Three outcomes, not two. "The file is not there" and "the file is there and
// holds no token" call for different fixes, and collapsing them into `missing`
// throws away the more useful half.
function firstUsable(sources, isExpired) {
  const tried = [];
  let expiredSeen = false;
  for (const src of sources) {
    const creds = src.read();
    const present = creds ? true : (src.exists?.() ?? false);
    tried.push({
      label: src.label,
      state: creds ? "usable" : present ? "no token" : "missing",
    });
    if (!creds) continue;
    if (isExpired(creds)) {
      tried[tried.length - 1].state = "expired";
      expiredSeen = true;
      continue;
    }
    return { creds, source: src.label, tried, expiredSeen };
  }
  return { creds: null, source: null, tried, expiredSeen };
}

const PROVIDERS = {
  claude: {
    bin: ["claude"],
    // macOS Claude Code keeps the live token in the login Keychain; the
    // .credentials.json left in the home directory is often a stale copy, so a
    // file that parses is not evidence the file is current.
    credSources: () => [
      ...claudeConfigDirs().map((dir) => ({
        label: join(dir, ".credentials.json"),
        exists: () => existsSync(join(dir, ".credentials.json")),
        read: () => readJSON(join(dir, ".credentials.json")),
      })),
      {
        label: "macOS Keychain: Claude Code-credentials",
        read: () => readKeychain("Claude Code-credentials"),
      },
    ],
    isExpired: (c) => {
      const e = c?.claudeAiOauth?.expiresAt;
      return typeof e === "number" && e < Date.now();
    },
    local: "claude",
    usagebarIds: ["anthropic"],
    async fetchUsage(creds) {
      const token = creds?.claudeAiOauth?.accessToken;
      if (!token) return null;
      const exp = creds.claudeAiOauth.expiresAt;
      if (typeof exp === "number" && exp < Date.now()) {
        return { error: "credential expired" };
      }
      const r = await fetch("https://api.anthropic.com/api/oauth/usage", {
        headers: {
          Authorization: `Bearer ${token}`,
          "anthropic-beta": "oauth-2025-04-20",
          "User-Agent": "claude-code/2.1.183",
          "Content-Type": "application/json",
        },
      });
      if (!r.ok) return { error: `HTTP ${r.status}` };
      const j = await r.json();
      // `utilization` is percent USED. Tightest window wins.
      const windows = [
        ["five_hour", j.five_hour, 18000],
        ["seven_day", j.seven_day, 604800],
      ].filter(([, w]) => w && typeof w.utilization === "number");
      if (!windows.length) return { error: "no usage windows in response" };
      return {
        windows: windows.map(([name, w, secs]) => ({
          name,
          remaining_pct: 100 - w.utilization,
          resets_at: w.resets_at ?? null,
          window_secs: secs,
        })),
      };
    },
  },
  codex: {
    bin: ["codex"],
    credSources: () =>
      (process.env.CODEX_HOME ? process.env.CODEX_HOME.split(",") : [join(homedir(), ".codex")])
        .map((d) => d.trim())
        .filter(Boolean)
        .map((dir) => ({
          label: join(dir, "auth.json"),
          exists: () => existsSync(join(dir, "auth.json")),
          read: () => readJSON(join(dir, "auth.json")),
        })),
    isExpired: (c) => {
      const e = Date.parse(c?.tokens?.expires_at ?? "");
      return Number.isFinite(e) && e < Date.now();
    },
    local: "codex",
    usagebarIds: ["openai"],
    async fetchUsage(creds) {
      const token = creds?.tokens?.access_token ?? creds?.access_token;
      if (!token) return null;
      const exp = Date.parse(creds?.tokens?.expires_at ?? "");
      if (Number.isFinite(exp) && exp < Date.now()) {
        return { error: "credential expired" };
      }
      const headers = { Authorization: `Bearer ${token}`, "User-Agent": "codex-cli" };
      const accountId = creds?.tokens?.account_id ?? creds?.account_id;
      if (accountId) headers["ChatGPT-Account-Id"] = accountId;
      const r = await fetch("https://chatgpt.com/backend-api/wham/usage", { headers });
      if (!r.ok) return { error: `HTTP ${r.status}` };
      const j = await r.json();
      const rl = j.rate_limit ?? {};
      const windows = [rl.primary_window, rl.secondary_window]
        .filter((w) => w && typeof w.used_percent === "number")
        .map((w) => ({
          name: w.limit_window_seconds === 604800 ? "weekly" : "session",
          remaining_pct: 100 - w.used_percent,
          resets_at: w.reset_at ? new Date(w.reset_at * 1000).toISOString() : null,
          window_secs: w.limit_window_seconds ?? null,
        }));
      if (!windows.length) return { error: "no rate_limit windows in response" };
      return { windows };
    },
  },
  cursor: {
    bin: ["cursor-agent", "agent"],
    // cursor-agent's login has lived at several paths across versions and
    // platforms, and the IDE keeps its own token in a SQLite state file.
    credSources: () => {
      const h = homedir();
      const files = [
        join(h, ".config", "cursor", "auth.json"),
        join(h, ".config", "cursor-agent", "auth.json"),
        join(h, "Library", "Application Support", "cursor", "auth.json"),
        join(h, "Library", "Application Support", "Cursor", "auth.json"),
        join(h, ".cursor", "auth.json"),
        join(h, ".cursor", "cli-config.json"),
        join(h, ".cursor", "credentials.json"),
        join(h, ".cursor-agent", "auth.json"),
      ];
      return [
        // A config file only counts as a credential when a token is actually
        // inside it. cli-config.json, for instance, carries identity and
        // settings and no token at all.
        ...files.map((f) => ({
          label: f,
          exists: () => existsSync(f),
          read: () => {
            const j = readJSON(f);
            if (!j) return null;
            const token = findJwt(j);
            return token ? { token, identity: j.authInfo ?? null, from: f } : null;
          },
        })),
        {
          label: `Cursor IDE state.vscdb — ${cursorDbState()}`,
          exists: () => CURSOR_DB_PATHS().some((p) => existsSync(p)),
          read: () => {
            const t = readCursorIdeToken();
            return t ? { token: t, from: "state.vscdb" } : null;
          },
        },
      ];
    },
    isExpired: () => false,
    local: null,
    // Learned the hard way, and worth stating rather than re-deriving: the
    // usage token is the Cursor IDE's, kept in its state.vscdb. cursor-agent's
    // cli-config.json carries identity and settings and no token at all, so a
    // machine with the CLI and no IDE simply has nothing to read.
    noCredentialHint:
      "cursor-agent does not store a usage token — the one this endpoint needs belongs to the " +
      "Cursor IDE, in its state.vscdb. Without the IDE signed in on this machine the slot stays " +
      "unprobed, and routing gives it a neutral weight rather than dropping it.",
    usagebarIds: ["cursor"],
    async fetchUsage(creds) {
      const token = creds?.token;
      if (!token) return null;

      // Primary: the dashboard service the Cursor IDE itself calls. It takes a
      // bearer token and nothing else — no user id, no composite cookie — and
      // answers with the billing period alongside the usage, which is exactly
      // what the window model needs.
      const r = await fetch(
        "https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Connect-Protocol-Version": "1",
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
      if (r.ok) {
        const j = await r.json();
        const plan = j.planUsage ?? {};
        let usedPct = plan.totalPercentUsed;
        if (typeof usedPct !== "number" && typeof plan.limit === "number" && plan.limit > 0) {
          const used =
            typeof plan.used === "number" ? plan.used : plan.limit - (plan.remaining ?? 0);
          usedPct = (used / plan.limit) * 100;
        }
        if (typeof usedPct === "number") {
          // billingCycleStart/End arrive as epoch-millisecond strings.
          const startMs = Number(j.billingCycleStart);
          const endMs = Number(j.billingCycleEnd);
          return {
            windows: [
              {
                name: "billing_cycle",
                remaining_pct: Math.max(0, Math.round(100 - usedPct)),
                resets_at:
                  Number.isFinite(endMs) && endMs > 0 ? new Date(endMs).toISOString() : null,
                window_secs:
                  Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
                    ? Math.round((endMs - startMs) / 1000)
                    : null,
              },
            ],
            lanes: cursorLanes(plan, j),
          };
        }
      }
      const dashStatus = r.status;

      // Fallback: the older summary endpoint, which authenticates with a
      // composite session cookie `<user id>::<token>` instead of a bearer.
      const userId = cursorUserId(creds?.identity?.authId ?? jwtClaim(token, "sub"));
      if (!userId) {
        return { error: `dashboard HTTP ${dashStatus}; no user id for the fallback` };
      }
      const r2 = await fetch("https://cursor.com/api/usage-summary", {
        headers: {
          Cookie: `WorkosCursorSessionToken=${userId}%3A%3A${token}`,
          Origin: "https://cursor.com",
          Referer: "https://cursor.com/dashboard",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        },
      });
      if (!r2.ok) {
        return { error: `dashboard HTTP ${dashStatus}, usage-summary HTTP ${r2.status}` };
      }
      const j2 = await r2.json();
      if (j2.isUnlimited) {
        return {
          windows: [{ name: "unlimited", remaining_pct: 100, resets_at: null, window_secs: null }],
        };
      }
      const plan2 = j2.individualUsage?.plan ?? j2.teamUsage?.plan ?? null;
      const pct2 = plan2?.totalPercentUsed ?? plan2?.autoPercentUsed ?? null;
      if (typeof pct2 !== "number") return { error: "no plan usage in usage-summary response" };
      const end2 = Date.parse(j2.billingCycleEnd ?? "");
      const start2 = Date.parse(j2.billingCycleStart ?? "");
      return {
        windows: [
          {
            name: "billing_cycle",
            remaining_pct: Math.round(100 - pct2),
            resets_at: Number.isFinite(end2) ? new Date(end2).toISOString() : null,
            window_secs:
              Number.isFinite(end2) && Number.isFinite(start2)
                ? Math.round((end2 - start2) / 1000)
                : null,
          },
        ],
        lanes: cursorLanes(plan2, j2),
      };
    },
  },
};

// The headline number: a provider is as free as its most binding limit right
// now. Every window is still carried on the slot — collapsing to this one is
// what hid the five-hour window behind the weekly one and made short-horizon
// scheduling blind.
function pickTightest(windows) {
  return windows.reduce((a, b) => (b.remaining_pct < a.remaining_pct ? b : a));
}

// An oauth id looks like "github|user_abc123" or "auth0|user_abc123"; the half
// that matters is whichever part starts with `user_`, not blindly the second.
function cursorUserId(rawId) {
  if (typeof rawId !== "string" || !rawId) return null;
  const part = rawId.split("|").find((p) => p.startsWith("user_"));
  return part ?? (rawId.startsWith("user_") ? rawId : null);
}

// ------------------------------------------------------------------- lanes
//
// Cursor bills two independent pools inside one billing cycle, and its own
// dashboard names them: **Cursor Models** (Auto, Composer, the Grok tiers —
// `autoPercentUsed`) and **Other Models** (named third-party models, charged at
// that model's API price — `apiPercentUsed`). `totalPercentUsed` is the blended
// headline, and it hides the case that decides a run: a slot reading 55% overall
// can have Other Models at 100% spent, so a session routed there on Claude dies
// on its first call while Composer would have worked all day.
//
// Lanes are not windows. Windows are simultaneous gates — a plan checks all of
// them at once, so a slot is worth the LEAST of them. Lanes are alternatives — a
// session draws from exactly one, so a slot is worth the BEST of them, and which
// one it draws from is decided by the model id.
const LANE_LABEL = {
  "cursor-models": "Cursor Models — Auto, Composer, Grok",
  "other-models": "Other Models — named third-party, at API price",
};

// Which lane a model id draws from. A pattern, not a list of ids: Cursor adds
// and renames its own models faster than any hardcoded list survives, and an
// unrecognised name falls to the metered lane rather than quietly spending the
// pool it does not belong to.
const CURSOR_OWN_MODEL_RE = new RegExp(
  process.env.HANDOFF_CURSOR_OWN_MODELS ?? "composer|grok|^auto$",
  "i",
);
const cursorLaneOf = (model) =>
  !model ? null : CURSOR_OWN_MODEL_RE.test(model) ? "cursor-models" : "other-models";
const laneOfModel = (provider, model) => (provider === "cursor" ? cursorLaneOf(model) : null);

// "You've used 42% of your included total usage" — on team and enterprise
// accounts, which report no `plan` object, the prose is the only place the split
// appears.
function percentFromMessage(msg) {
  const m = typeof msg === "string" ? msg.match(/(\d+(?:\.\d+)?)\s*%/) : null;
  return m ? Number(m[1]) : null;
}

// Both pools or neither. A half-known split would send routing off a guess,
// while the blended total it falls back to is at least a real number.
function cursorLanes(plan, payload) {
  const read = (v, msg) =>
    typeof v === "number" && Number.isFinite(v) ? v : percentFromMessage(msg);
  const auto = read(plan?.autoPercentUsed, payload?.autoModelSelectedDisplayMessage);
  const api = read(plan?.apiPercentUsed, payload?.namedModelSelectedDisplayMessage);
  if (typeof auto !== "number" || typeof api !== "number") return undefined;
  const left = (used) => Math.max(0, Math.min(100, Math.round(100 - used)));
  return [
    { name: "cursor-models", remaining_pct: left(auto) },
    { name: "other-models", remaining_pct: left(api) },
  ];
}

// The CLI's own model list, so a lane can be pinned to a real id instead of an
// invented one. `--list-models` is the documented flag; a CLI without it exits
// non-zero and the lane stays a preference the default model may ignore, which
// the routing table then marks rather than pretending otherwise.
const modelListCache = new Map();
function cliModels(bin) {
  if (modelListCache.has(bin)) return modelListCache.get(bin);
  let out = [];
  try {
    const r = spawnSync(bin, ["--list-models"], { encoding: "utf8", timeout: 20000 });
    if (r.status === 0 && r.stdout) {
      out = r.stdout
        .split("\n")
        .map((l) => l.replace(/^[\s*\-\u2022]+/, "").trim())
        .filter((l) => /^[a-z0-9][a-z0-9._-]{1,48}$/i.test(l));
    }
  } catch {}
  modelListCache.set(bin, out);
  return out;
}

const pickModelForLane = (bin, provider, laneName) => {
  const inLane = cliModels(bin).filter((m) => laneOfModel(provider, m) === laneName);
  // `auto` hands the choice to Cursor's router, and on team plans that choice can
  // land in the other pool — so a named own-model wins over it when one is listed.
  return inLane.find((m) => m.toLowerCase() !== "auto") ?? inLane[0] ?? null;
};

// Walk a parsed config and return the first string that decodes as a JWT
// carrying a `sub` claim. Key names move between CLI versions — the shape of a
// session token does not — so this finds the token without a list of guesses.
function findJwt(value, depth = 0) {
  if (depth > 6 || value === null) return null;
  if (typeof value === "string") {
    return value.split(".").length === 3 && jwtClaim(value, "sub") ? value : null;
  }
  if (typeof value !== "object") return null;
  for (const v of Array.isArray(value) ? value : Object.values(value)) {
    const hit = findJwt(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

// Try several Keychain service names and return the first that answers.
function readKeychainAny(services) {
  for (const svc of services) {
    const raw = readKeychainRaw(svc);
    if (raw) return { service: svc, raw };
  }
  return null;
}

// Decode a JWT payload claim. No signature check — this only reads a claim out
// of a token the user's own CLI already holds.
function jwtClaim(token, claim) {
  try {
    const part = String(token).split(".")[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json)?.[claim] ?? null;
  } catch {
    return null;
  }
}

// The Cursor IDE's session token lives in its SQLite state file under the key
// `cursorAuth/accessToken`. cursor-agent's own config does not carry a token at
// all, so this file is the only source — which also means a machine with the
// CLI but no IDE has nothing to read, and saying so is the honest answer.
//
// Two readers, because neither is guaranteed: the sqlite3 binary, then a
// python3 one-liner. state.vscdb can exceed 2GB, which rules out slurping it.
const CURSOR_DB_PATHS = () => {
  const h = homedir();
  return [
    join(h, "Library", "Application Support", "Cursor", "User", "globalStorage", "state.vscdb"),
    join(h, ".config", "Cursor", "User", "globalStorage", "state.vscdb"),
    join(h, "AppData", "Roaming", "Cursor", "User", "globalStorage", "state.vscdb"),
  ];
};

const CURSOR_TOKEN_SQL =
  "SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken' LIMIT 1";

function readCursorIdeToken() {
  const db = CURSOR_DB_PATHS().find((p) => existsSync(p));
  if (!db) return null;

  if (which("sqlite3")) {
    const r = spawnSync("sqlite3", [db, CURSOR_TOKEN_SQL], { encoding: "utf8", timeout: 15000 });
    const v = (r.stdout || "").trim();
    if (v) return v;
  }
  for (const py of ["python3", "python"]) {
    if (!which(py)) continue;
    const script =
      "import sqlite3,sys\n" +
      "c=sqlite3.connect(sys.argv[1]);r=c.execute(sys.argv[2]).fetchone()\n" +
      "print(r[0] if r and r[0] else '');c.close()";
    const r = spawnSync(py, ["-c", script, db, CURSOR_TOKEN_SQL], {
      encoding: "utf8",
      timeout: 15000,
    });
    const v = (r.stdout || "").trim();
    if (v) return v;
  }
  return null;
}

function cursorDbState() {
  const db = CURSOR_DB_PATHS().find((p) => existsSync(p));
  if (!db) return "no Cursor IDE state.vscdb on this machine";
  if (!which("sqlite3") && !which("python3") && !which("python")) {
    return `${db} found but neither sqlite3 nor python3 is available to read it`;
  }
  return `${db} has no cursorAuth/accessToken — sign in to the Cursor IDE`;
}

function usagebarSnapshot() {
  if (!which("ai-usagebar")) return null;
  const r = spawnSync("ai-usagebar", ["usage", "--json"], {
    encoding: "utf8",
    timeout: 15000,
  });
  if (r.status !== 0 || !r.stdout) return null;
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

function fromUsagebar(report, ids) {
  if (!report?.entries) return null;
  const out = [];
  for (const e of report.entries) {
    const id = String(e.id ?? "");
    if (!ids.some((want) => id === want || id.startsWith(`${want}:`))) continue;
    if (e.error) continue;
    const metrics = (e.sections ?? []).filter(
      (s) => s.type === "metric" && typeof s.percent === "number",
    );
    if (!metrics.length) continue;
    const windows = metrics.map((m) => ({
      name: m.label,
      remaining_pct: 100 - m.percent,
      resets_at: m.reset_at ?? null,
      window_secs: m.window_secs ?? null,
    }));
    // `id` is "vendor" or "vendor:account" — the account half is the slot key.
    out.push({ account: id.includes(":") ? id.split(":")[1] : "default", windows });
  }
  return out.length ? out : null;
}

// A slot carries EVERY window the provider reports. `remaining_pct` and
// `window` are only the headline — the binding one right now. Supply is
// computed per window and then taken at the minimum, because a plan gates on
// all of its windows at once and each refills on its own schedule.
function makeSlot({ key, provider, account, bin, windows, lanes, source, estimated, note, tried }) {
  const usable = (windows ?? []).filter((w) => typeof w.remaining_pct === "number");
  const head = usable.length ? pickTightest(usable) : null;
  return {
    key, provider, account, installed: true, bin,
    windows: windows?.length ? windows : undefined,
    // Alternatives, not gates — see the lanes block above.
    lanes: lanes?.length
      ? lanes.map((l) => ({ ...l, bucket: bucketOf(l.remaining_pct) }))
      : undefined,
    remaining_pct: head?.remaining_pct ?? null,
    window: head?.name ?? windows?.[0]?.name ?? null,
    resets_at: head?.resets_at ?? windows?.[0]?.resets_at ?? null,
    window_secs: head?.window_secs ?? windows?.[0]?.window_secs ?? null,
    bucket: bucketOf(head?.remaining_pct),
    estimated: estimated || undefined,
    source,
    note: note || undefined,
    tried,
  };
}

function bucketOf(remaining) {
  if (remaining === null || remaining === undefined) return "unknown";
  if (remaining <= 0) return "empty";
  if (remaining < LOW_PCT) return "low";
  return "ok";
}

async function probe() {
  const report = usagebarSnapshot();
  const slots = [];

  for (const [name, p] of Object.entries(PROVIDERS)) {
    const bin = p.bin.find((b) => which(b));
    if (!bin) {
      slots.push({
        key: name, provider: name, account: "default", installed: false,
        remaining_pct: null, bucket: "absent", source: "not installed",
      });
      continue;
    }

    const viaBar = fromUsagebar(report, p.usagebarIds);
    if (viaBar) {
      for (const v of viaBar) {
        slots.push(
          makeSlot({
            key: v.account === "default" ? name : `${name}:${v.account}`,
            provider: name, account: v.account, bin,
            windows: v.windows, source: "ai-usagebar",
          }),
        );
      }
      continue;
    }

    let result = null, note = "", source = null;

    // Source 2: the CLI's own credential, wherever it really lives.
    const { creds, source: credLabel, tried, expiredSeen } = firstUsable(
      p.credSources(),
      p.isExpired,
    );
    if (!creds) {
      const tokenless = tried.filter((t) => t.state === "no token").map((t) => t.label);
      if (expiredSeen) {
        note = `every credential found is expired — run \`${bin}\` once to refresh`;
      } else if (tokenless.length) {
        // Logged in, but the session token is not in the file this probe can
        // read. Telling someone to log in again when they already are is the
        // least useful thing to say.
        note =
          p.noCredentialHint ??
          `${tokenless[0]} holds settings or identity but no session token ` +
            `(probe --explain lists every path tried)`;
      } else {
        // Where the CLI is not the thing that holds the token, saying "log in
        // again" sends someone to do the one thing that cannot help.
        note =
          p.noCredentialHint ??
          `no credential found — run \`${bin}\` once to log in (probe --explain lists the paths tried)`;
      }
    } else {
      try {
        result = await p.fetchUsage(creds);
        if (result?.error) {
          note = `${result.error} (via ${credLabel})`;
          result = null;
        } else if (!result?.windows?.length) {
          // A file that exists and parses can still hold no usable token. That
          // is a failed source, not a source reporting "unknown" — saying
          // otherwise hides the one fact that would let someone fix it.
          note = `${credLabel} has no usable token — ${
            result === null ? "no credential field this probe recognises" : "no windows in the response"
          }`;
          result = null;
        } else source = `${name}-oauth`;
      } catch (e) {
        note = `probe failed: ${e.message}`;
      }
    }

    // Source 3: the transcripts this machine already wrote. No credential, no
    // network — so it still answers when every OAuth path above has failed.
    let estimated = false;
    if (!result && p.local) {
      const local = localSnapshot(p.local);
      const asWindow = (l) => ({
        windows: [
          {
            name: l.window,
            remaining_pct: l.remaining_pct,
            resets_at: l.resets_at,
            window_secs: l.window_secs,
          },
        ],
      });
      if (local && !local.error && local.remaining_pct !== null) {
        result = asWindow(local);
        estimated = true;
        source = "local-transcript";
        note = note ? `${note}; estimated from transcripts: ${local.detail}` : local.detail;
      } else if (local?.resets_at) {
        // No usable percent, but a real reset time is still worth having.
        result = asWindow({ ...local, remaining_pct: null });
        estimated = true;
        source = "local-transcript";
        note = local.detail;
      } else if (local?.error) {
        note = note ? `${note}; local: ${local.error}` : `local: ${local.error}`;
      }
    }

    slots.push(
      makeSlot({
        key: name, provider: name, account: "default", bin,
        windows: result?.windows ?? [],
        lanes: result?.lanes,
        source: source ?? "probe failed",
        estimated, note,
        tried: arg("explain") ? tried : undefined,
      }),
    );
  }

  return { ts: nowISO(), low_pct: LOW_PCT, slots };
}

// `probe --explain`: every path consulted, so a miss names its own cause.
function renderExplain(quota) {
  const out = ["", "## Where the probe looked", ""];
  for (const s of quota.slots) {
    out.push(`**${s.key}** — ${s.installed ? `binary \`${s.bin}\`` : "not installed"}`);
    for (const t of s.tried ?? []) {
      out.push(`  ${String(t.state).padEnd(8)}  ${t.label}`);
    }
    for (const lp of localSearchPaths(s.provider)) {
      out.push(`  ${(existsSync(lp) ? "found" : "missing").padEnd(8)}  ${lp}  (transcripts)`);
    }
    out.push("");
  }
  return out.join("\n");
}

// A slot that is poor now but whose window reopens inside the run horizon is
// rich over the horizon. It is eligible — just not yet. That distinction is the
// difference between waiting ten minutes and burning a session on a wall.
function refillsInHorizon(slot, horizonS) {
  const windows = slot.windows?.length ? slot.windows : [slot];
  return windows.some((w) => {
    const r = resetsInS(w);
    return r !== null && w.window_secs && r <= horizonS;
  });
}

function resetsInS(slot) {
  if (!slot.resets_at) return null;
  const s = (Date.parse(slot.resets_at) - Date.now()) / 1000;
  return Number.isFinite(s) ? Math.max(0, Math.round(s)) : null;
}

// Weight by rate, not stock. A 5h window that refills inside the run horizon is
// cheap to spend now; a weekly window at 30% is not. `unknown` gets a neutral
// 50 so an unprobed provider still takes a share instead of being starved.
function windowSupply(w, horizonS) {
  if (typeof w.remaining_pct !== "number") return 50;
  let supply = w.remaining_pct;
  const r = resetsInS(w);
  if (r !== null && w.window_secs && r <= horizonS) {
    const after = horizonS - r;
    supply += 100 * (1 + Math.floor(after / w.window_secs));
  }
  return Math.max(0, supply);
}

// A plan gates on all of its windows at once, so a slot is worth the LEAST of
// them over the horizon. Each window refills on its own clock, which is why
// they cannot be collapsed before this point: a five-hour window at 8% that
// reopens in twenty minutes stops binding a two-hour run, while a weekly
// window at 8% binds it the whole way.
function effectiveSupply(slot, horizonS) {
  return Math.max(...laneOptions(slot).map((l) => supplyFor(slot, l, horizonS)));
}

// The lanes a slot can be routed on: its real ones, or one null lane for a
// provider that bills a single undivided pool.
const laneOptions = (slot) => (slot.lanes?.length ? slot.lanes : [null]);

const slotWindows = (slot) =>
  slot.windows?.length
    ? slot.windows
    : [{ remaining_pct: slot.remaining_pct, resets_at: slot.resets_at, window_secs: slot.window_secs }];

// Supply for ONE lane of a slot. The lane is a smaller pool inside the same
// cycle, so its cap goes in before the per-window rate math, not after — a lane
// at 0% is out even while the cycle it sits in reads 55%.
function supplyFor(slot, lane, horizonS) {
  if (slot.bucket === "absent" || slot.bucket === "empty") return 0;
  return Math.min(...laneCapped(slot, lane).map((w) => windowSupply(w, horizonS)));
}

function laneCapped(slot, lane) {
  const windows = slotWindows(slot);
  if (!lane) return windows;
  return windows.map((w) => ({
    ...w,
    remaining_pct:
      typeof w.remaining_pct === "number"
        ? Math.min(w.remaining_pct, lane.remaining_pct)
        : lane.remaining_pct,
  }));
}

// The latest reset among windows that are under the floor right now and reopen
// within the horizon. Null when nothing is currently blocking a start.
function holdUntil(slot, horizonS, lane = null) {
  const windows = laneCapped(slot, lane);
  let latest = null;
  for (const w of windows) {
    if (typeof w.remaining_pct !== "number" || w.remaining_pct >= LOW_PCT) continue;
    const r = resetsInS(w);
    if (r === null || !w.resets_at || r > horizonS) continue;
    const at = Date.parse(w.resets_at);
    if (latest === null || at > latest) latest = at;
  }
  return latest === null ? null : new Date(latest).toISOString();
}

// The window that actually binds this slot over the horizon — the one whose
// reset a held session is waiting for.
function bindingWindow(slot, horizonS) {
  const windows = slot.windows ?? [];
  if (!windows.length) return null;
  let best = null, bestSupply = Infinity;
  for (const w of windows) {
    const sup = windowSupply(w, horizonS);
    if (sup < bestSupply) { bestSupply = sup; best = w; }
  }
  return best;
}

// -------------------------------------------------------- independence gate
//
// Two sessions that can run at the same time must not write the same path.
// This is the check the skill used to ask a model to perform by eye, and the
// one the scorecard called `independence_miss` after the damage was done.
// Refusing here makes that flag unreachable.

const ALWAYS_SHARED = [
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock",
  "go.sum", "poetry.lock", "Gemfile.lock", "composer.lock",
];

const literalPrefix = (glob) => {
  const i = glob.search(/[*?[]/);
  return i === -1 ? glob : glob.slice(0, i);
};

function pathsCollide(a, b) {
  if (ALWAYS_SHARED.some((f) => a.endsWith(f) && b.endsWith(f))) return true;
  const [pa, pb] = [literalPrefix(a), literalPrefix(b)];
  const norm = (s) => s.replace(/\/+$/, "");
  const [na, nb] = [norm(pa), norm(pb)];
  if (!na || !nb) return true; // one of them writes everywhere
  return na === nb || na.startsWith(nb + "/") || nb.startsWith(na + "/");
}

// Sessions are concurrent unless one transitively depends on the other.
function transitiveDeps(sessions) {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const memo = new Map();
  const walk = (id, seen = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    const out = new Set();
    for (const d of byId.get(id)?.deps ?? []) {
      if (seen.has(d)) continue;
      out.add(d);
      for (const t of walk(d, new Set([...seen, d]))) out.add(t);
    }
    memo.set(id, out);
    return out;
  };
  return new Map(sessions.map((s) => [s.id, walk(s.id)]));
}

function independenceConflicts(sessions) {
  const deps = transitiveDeps(sessions);
  const conflicts = [];
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const [a, b] = [sessions[i], sessions[j]];
      if (deps.get(a.id)?.has(b.id) || deps.get(b.id)?.has(a.id)) continue;
      for (const pa of a.writes ?? []) {
        for (const pb of b.writes ?? []) {
          if (pathsCollide(pa, pb)) {
            conflicts.push({ a: a.id, b: b.id, a_path: pa, b_path: pb });
          }
        }
      }
    }
  }
  return conflicts;
}

// ------------------------------------------------------------------- route

function costHistory() {
  const f = join(tmpdir(), "handoff", "metrics.jsonl");
  if (!existsSync(f)) return {};
  const rows = readFileSync(f, "utf8").trim().split("\n").slice(-50)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
  const buckets = {};
  for (const r of rows) {
    for (const [prov, samples] of Object.entries(r.session_cost_pct ?? {})) {
      for (const { size, pct } of samples) {
        (buckets[`${prov}:${size}`] ??= []).push(pct);
      }
    }
  }
  const median = (xs) => xs.sort((x, y) => x - y)[Math.floor(xs.length / 2)];
  return Object.fromEntries(
    Object.entries(buckets)
      .filter(([, xs]) => xs.length >= 3)
      .map(([k, xs]) => [k, median(xs)]),
  );
}

function estimateCost(provider, size, history) {
  return history[`${provider}:${size}`] ?? COST_PRIOR[size] ?? COST_PRIOR.m;
}

// A mechanical job on a frontier model spends the metered pool for nothing; a
// design job on a small own-model is a real downgrade. So tier picks a lane — as
// a preference, not a wall: a penalty on the score, so the other lane still wins
// when the preferred one is genuinely scarce, and the table marks it when it
// does. The penalty is deliberately steep: the preference is about capability,
// not load-balancing, and it should take a wide utilisation gap to trade a
// design session down to a small model while the frontier pool is still full.
const LANE_PENALTY = 3;
const preferredLane = (tier) => (tier === "mechanical" ? "cursor-models" : "other-models");

function route(dir) {
  const plan = readJSON(join(dir, "plan.json"));
  if (!plan?.sessions?.length) die("plan.json missing or has no sessions");
  const quota = readJSON(join(dir, "quota.json"));
  if (!quota) die("quota.json missing — run `handoff probe --run DIR` first");
  if (secsSince(quota.ts) > PROBE_TTL_S) {
    die(`quota.json is ${Math.round(secsSince(quota.ts))}s old — re-probe`);
  }

  const conflicts = independenceConflicts(plan.sessions);
  if (conflicts.length) {
    console.error("handoff: sessions are not independent — fix the cut:\n");
    for (const c of conflicts) {
      console.error(`  ${c.a} writes ${c.a_path}  ×  ${c.b} writes ${c.b_path}`);
    }
    console.error("\nMerge them into one session, or make one depend on the other.");
    process.exit(2);
  }

  const horizonS = Number(plan.horizon_s ?? 7200);
  const history = costHistory();
  const eligible = quota.slots
    .filter((s) => s.installed && s.bucket !== "empty")
    .map((s) => ({ ...s, supply: effectiveSupply(s, horizonS) }))
    .filter((s) => s.supply > 0);

  if (!eligible.length) {
    console.error("handoff: every provider is empty or absent. Nothing launched.");
    console.error(renderQuota(quota));
    const soonest = quota.slots
      .map((s) => ({ s, r: resetsInS(s) }))
      .filter((x) => x.r !== null)
      .sort((a, b) => a.r - b.r)[0];
    if (soonest) {
      console.error(`\nSoonest reset: ${soonest.s.key} in ${fmtDur(soonest.r)}.`);
    }
    process.exit(3);
  }

  const ok = eligible.filter(
    (s) =>
      s.bucket === "ok" ||
      s.bucket === "unknown" ||
      refillsInHorizon(s, horizonS),
  );
  const pool = ok.length ? ok : eligible;

  // Lanes expand the pool: a slot with one spent lane is not a spent slot, and
  // the two lanes of one slot compete for work independently.
  const candidates = [];
  for (const p of pool) {
    for (const lane of laneOptions(p)) {
      const supply = supplyFor(p, lane, horizonS);
      if (supply > 0) {
        candidates.push({ slot: p, lane, key: lane ? `${p.key}/${lane.name}` : p.key, supply });
      }
    }
  }

  // Admission control before assignment: does the pool hold this cut?
  const demand = plan.sessions.reduce((acc, s) => {
    const size = s.size ?? "m";
    const avg = pool.reduce((t, p) => t + estimateCost(p.provider, size, history), 0) / pool.length;
    return acc + avg;
  }, 0);
  const supply = pool.reduce((t, p) => t + p.supply, 0);
  const admission = {
    demand_pct: Math.round(demand),
    supply_pct: Math.round(supply),
    ok: demand <= supply,
    headroom_pct: Math.round(supply - demand),
  };

  // Weighted assignment: minimise projected utilisation of each lane.
  const load = Object.fromEntries(candidates.map((c) => [c.key, 0]));
  const assigned = [];
  const pickBest = (field, size, wanted, pinned) => {
    const lanePinned = pinned ? field.filter((c) => c.lane?.name === pinned) : [];
    return (lanePinned.length ? lanePinned : field)
      .map((c) => ({
        c,
        score:
          ((load[c.key] + estimateCost(c.slot.provider, size, history)) / c.supply) *
          (c.lane && c.lane.name !== wanted ? LANE_PENALTY : 1),
      }))
      .sort((a, b) => a.score - b.score)[0].c;
  };
  for (const s of [...plan.sessions].sort((a, b) => a.id.localeCompare(b.id))) {
    const size = s.size ?? "m";
    const wanted = preferredLane(s.tier);
    let cand;
    if (s.provider) {
      const named = candidates.filter(
        (c) => c.slot.key === s.provider || c.slot.provider === s.provider,
      );
      if (named.length) {
        cand = pickBest(named, size, wanted, laneOfModel(named[0].slot.provider, s.model));
      } else {
        // The user named a provider whose every lane is spent. Their call wins;
        // the zero supply is what the admission warning is for.
        const slot =
          eligible.find((p) => p.key === s.provider || p.provider === s.provider) ??
          quota.slots.find((p) => p.key === s.provider || p.provider === s.provider);
        if (!slot?.installed) die(`session ${s.id} names provider ${s.provider}, which is absent`);
        cand = { slot, lane: null, key: slot.key, supply: 0 };
      }
    } else {
      cand = pickBest(candidates, size, wanted, null);
    }
    const slot = cand.slot;
    const laneName = cand.lane?.name ?? null;
    load[cand.key] = (load[cand.key] ?? 0) + estimateCost(slot.provider, size, history);
    // Pin the lane to a model id the CLI actually lists. Without a pin the lane
    // is only a preference and the CLI's default model decides the pool, so the
    // table says so rather than claiming a routing decision it did not make.
    const model = s.model ?? (laneName ? pickModelForLane(slot.bin, slot.provider, laneName) : null);
    assigned.push({
      ...s,
      size,
      slot: slot.key,
      provider: slot.provider,
      account: slot.account,
      bin: slot.bin,
      model,
      lane: laneName ?? undefined,
      lane_remaining_pct: cand.lane?.remaining_pct,
      lane_pinned: laneName ? Boolean(model) : undefined,
      lane_fallback: laneName && laneName !== wanted ? true : undefined,
      remaining_pct: slot.remaining_pct,
      windows: slot.windows,
      lanes: slot.lanes,
      isolation: (s.writes ?? []).length ? `wt/${s.id}` : "cwd",
      brief: join(dir, "sessions", `${s.id}.md`),
      est_cost_pct: estimateCost(slot.provider, size, history),
      // "Worth assigning" and "safe to start now" are different questions.
      // Assignment weighs supply across the horizon, so a window that reopens
      // mid-run stops counting against the slot. Starting is about this
      // instant: a session launched while any window is still under the floor
      // walks straight into that wall. So hold until the LAST such window has
      // reset — and only when it resets inside the horizon, otherwise waiting
      // buys nothing.
      not_before: holdUntil(slot, horizonS, cand.lane),
      user_override: Boolean(s.provider),
    });
  }

  const routing = { ts: nowISO(), mode: plan.mode ?? "fan-out", horizon_s: horizonS, admission, sessions: assigned };
  writeJSON(join(dir, "routing.json"), routing);
  console.log(renderQuota(quota));
  console.log(renderRouting(routing));
  if (!admission.ok) {
    console.log(
      `\n⚠ admission: this cut needs ~${admission.demand_pct}% of plan quota and the pool holds ~${admission.supply_pct}%.` +
        `\n  Cut fewer and bigger sessions, or wait for a reset before dispatching.`,
    );
  }
  return routing;
}

// ---------------------------------------------------------------- rendering

const fmtDur = (s) => {
  if (s === null || s === undefined) return "—";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
};

const pct = (v) => (v === null || v === undefined ? "unknown" : `${v}%`);

const SHORT_WINDOW = { five_hour: "5h", session: "5h", seven_day: "7d", weekly: "7d", billing_cycle: "cycle", "five_hour~": "5h~" };

// Every window, not just the binding one. A reader who cannot see that the
// five-hour window is nearly spent cannot decide whether to start now or in
// forty minutes, which is the decision this whole table exists to support.
function renderWindows(s) {
  if (!s.windows?.length) return "—";
  return s.windows
    .map((w) => {
      const label = SHORT_WINDOW[w.name] ?? w.name;
      const left = typeof w.remaining_pct === "number" ? `${w.remaining_pct}%` : "?";
      const r = resetsInS(w);
      return `${label} ${left}${r === null ? "" : ` (${fmtDur(r)})`}`;
    })
    .join(" · ");
}

// Every pool the slot bills against, not just the blended headline. A reader who
// cannot see that Other Models is spent cannot tell why a 55% slot is about to
// refuse a Claude session.
function renderLanes(s) {
  if (!s.lanes?.length) return "—";
  return s.lanes
    .map((l) => `${l.name} ${typeof l.remaining_pct === "number" ? `${l.remaining_pct}%` : "?"}`)
    .join(" · ");
}

function renderQuota(quota) {
  const rows = quota.slots.map(
    (s) =>
      `| ${s.key} | ${pct(s.remaining_pct)}${s.estimated ? "~" : ""} | ${s.bucket} | ${renderWindows(s)} | ${renderLanes(s)} | ${s.source} |`,
  );
  return [
    "",
    "| Slot | Binding | Bucket | Windows | Lanes | Source |",
    "|---|---|---|---|---|---|",
    ...rows,
    ...quota.slots.filter((s) => s.note).map((s) => `> ${s.key}: ${s.note}`),
    ...quota.slots.flatMap((s) =>
      (s.lanes ?? [])
        .filter((l) => l.bucket === "empty" || l.bucket === "low")
        .map(
          (l) =>
            `> ${s.key}: ${LANE_LABEL[l.name] ?? l.name} is ${l.bucket} at ${l.remaining_pct}% — ` +
            `the other lane is still open, so route by model, not by dropping the slot`,
        ),
    ),
  ].join("\n");
}

// The model and the lane are one decision, so they share a cell: the model id is
// what actually decides which pool the session spends.
function renderModel(s) {
  const model = s.model ?? "default";
  if (!s.lane) return model;
  const tag = s.lane.replace("-models", "");
  return `${model} [${tag}${s.lane_fallback ? "\u2193" : ""}${s.lane_pinned === false ? "*" : ""}]`;
}

function renderRouting(r) {
  const rows = r.sessions.map(
    (s) =>
      `| ${s.id} | ${s.goal?.slice(0, 40) ?? ""} | ${s.provider} | ${renderModel(s)} | ${pct(s.lane_remaining_pct ?? s.remaining_pct)} | ~${s.est_cost_pct}% | ${s.isolation} | ${(s.deps ?? []).join(",") || "—"} | ${s.not_before ? `holds ${fmtDur(Math.round((Date.parse(s.not_before) - Date.now()) / 1000))}` : "now"} |`,
  );
  const legend = [];
  if (r.sessions.some((s) => s.lane_fallback)) {
    legend.push(
      "\u2193 the lane this tier prefers was spent or loaded — this session fell back to the other pool",
    );
  }
  if (r.sessions.some((s) => s.lane_pinned === false)) {
    legend.push(
      "* lane not pinned — this CLI did not list its models, so its default model picks the pool",
    );
  }
  return [
    "",
    "| Session | Goal | Provider | Model [lane] | Remaining | Est. cost | Isolation | Deps | Starts |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows,
    ...legend,
  ].join("\n");
}

// ---------------------------------------------------------------- dispatch

function launchArgs(s, promptPath) {
  const prompt = readFileSync(promptPath, "utf8").trim();
  switch (s.provider) {
    case "claude": {
      const a = ["-p", "--dangerously-skip-permissions", "--output-format", "text"];
      if (s.model) a.push("--model", s.model);
      return [s.bin, [...a, prompt]];
    }
    case "codex": {
      // --sandbox and --approve-for-me are mutually exclusive on this CLI.
      // Running with cwd set to the worktree means workspace-write is enough.
      const a = ["exec", "--sandbox", "workspace-write"];
      if (s.model) a.push("-m", s.model);
      return [s.bin, [...a, prompt]];
    }
    case "cursor": {
      const a = ["-p", "--force"];
      if (s.model) a.push("--model", s.model);
      return [s.bin, [...a, prompt]];
    }
    default:
      throw new Error(`unknown provider ${s.provider}`);
  }
}

function ensureWorktree(dir, s) {
  if (s.isolation === "cwd") return process.cwd();
  const wt = join(dir, "wt", s.id);
  if (existsSync(wt)) return wt;
  mkdirSync(join(dir, "wt"), { recursive: true });
  const branch = `handoff/${dir.split("/").pop()}-${s.id}`;
  const r = spawnSync("git", ["worktree", "add", "-b", branch, wt, "HEAD"], {
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`git worktree add failed: ${r.stderr?.trim()}`);
  return wt;
}

const QUOTA_DEATH =
  /rate.?limit|usage limit|quota|out of extra usage|session limit|too many requests|429|insufficient credits/i;

function classifyExit(dir, s, code) {
  const resultPath = join(dir, "sessions", `${s.id}.result.md`);
  if (existsSync(resultPath)) {
    const body = readFileSync(resultPath, "utf8");
    const m = body.match(/^\s*-?\s*status:\s*(done|blocked|failed)/mi);
    if (m) return { status: m[1].toLowerCase(), reason: null };
  }
  const tail = tailOf(join(dir, "logs", `${s.id}.log`));
  if (QUOTA_DEATH.test(tail)) return { status: "quota", reason: "provider quota exhausted" };
  if (code === 0) return { status: "failed", reason: "exited 0 without writing a result file" };
  return { status: "failed", reason: `exit ${code}` };
}

function loadState(dir) {
  return (
    readJSON(join(dir, "state.json")) ?? {
      started_at: nowISO(),
      parent_turns: 0,
      sessions: {},
      empty_slots: [],
      events: [],
    }
  );
}

async function dispatch(dir) {
  const routing = readJSON(join(dir, "routing.json"));
  if (!routing) die("routing.json missing — run `handoff route --run DIR` first");
  const quota = readJSON(join(dir, "quota.json"));
  if (!quota || secsSince(quota.ts) > PROBE_TTL_S) {
    die("quota.json missing or stale — run `handoff probe --run DIR` first");
  }

  const budgetS = Number(arg("budget", 540));
  const deadline = Date.now() + budgetS * 1000;
  const state = loadState(dir);
  state.parent_turns += 1;
  mkdirSync(join(dir, "logs"), { recursive: true });

  const byId = new Map(routing.sessions.map((s) => [s.id, s]));
  for (const s of routing.sessions) {
    state.sessions[s.id] ??= { status: "pending", attempts: 0, slot: s.slot, lane: s.lane };
  }

  const live = new Map(); // id -> child process

  const terminal = (st) => ["done", "blocked", "failed", "abandoned"].includes(st);
  const depsDone = (s) =>
    (s.deps ?? []).every((d) => state.sessions[d]?.status === "done");

  const reassign = (s) => {
    // The lane died — which is not the same as the slot dying. A Cursor session
    // that ran Other Models out still has the Cursor Models pool sitting next to
    // it, so the sibling lane is a candidate like any other slot.
    const dead = new Set(state.empty_slots);
    const horizon = routing.horizon_s ?? 7200;
    const options = [];
    for (const q of quota.slots) {
      if (!q.installed || q.bucket === "empty" || dead.has(q.key)) continue;
      for (const lane of laneOptions(q)) {
        const key = lane ? `${q.key}/${lane.name}` : q.key;
        if (dead.has(key)) continue;
        const supply = supplyFor(q, lane, horizon);
        if (supply > 0) options.push({ q, lane, supply });
      }
    }
    const best = options.sort((a, b) => b.supply - a.supply)[0];
    if (!best) return null;
    s.slot = best.q.key;
    s.provider = best.q.provider;
    s.bin = best.q.bin;
    s.lane = best.lane?.name ?? undefined;
    // Model ids do not travel across providers, and inside a lane the id is what
    // holds the session to that pool — so it is re-pinned, never carried over.
    s.model = best.lane ? pickModelForLane(best.q.bin, best.q.provider, best.lane.name) : null;
    s.lane_pinned = best.lane ? Boolean(s.model) : undefined;
    return s;
  };

  while (Date.now() < deadline) {
    // 1. launch everything whose dependencies are satisfied
    for (const s of routing.sessions) {
      const st = state.sessions[s.id];
      if (st.status !== "pending" || live.has(s.id) || !depsDone(s)) continue;
      if (s.not_before && Date.parse(s.not_before) > Date.now()) {
        st.held_until = s.not_before; // slot refills before this is worth starting
        continue;
      }
      try {
        const cwd = ensureWorktree(dir, s);
        const promptPath = join(dir, "sessions", `${s.id}.prompt.md`);
        if (!existsSync(promptPath)) {
          st.status = "failed";
          st.reason = "no prompt file — the brief was never written";
          continue;
        }
        const [bin, args] = launchArgs(s, promptPath);
        const logFd = openSync(join(dir, "logs", `${s.id}.log`), "a");
        const child = spawn(bin, args, {
          cwd,
          detached: true,
          stdio: ["ignore", logFd, logFd],
        });
        child.unref();
        closeSync(logFd);
        st.status = "running";
        st.pid = child.pid;
        st.slot = s.slot;
        st.lane = s.lane;
        st.started_at = nowISO();
        st.attempts += 1;
        live.set(s.id, child);
        state.events.push(
          `${nowISO()} ${s.id} launched on ${s.lane ? `${s.slot}/${s.lane}` : s.slot} pid ${child.pid}`,
        );
        child.on("exit", (code) => {
          const verdict = classifyExit(dir, s, code ?? -1);
          live.delete(s.id);
          st.ended_at = nowISO();
          if (verdict.status === "quota") {
            // Mark the lane that died, not the whole slot: blacklisting `cursor`
            // because Other Models ran out throws away a pool that is still full.
            const deadKey = st.lane ? `${st.slot}/${st.lane}` : st.slot;
            if (!state.empty_slots.includes(deadKey)) state.empty_slots.push(deadKey);
            state.events.push(`${nowISO()} ${s.id} died: ${deadKey} quota exhausted`);
            if (st.attempts < 3 && reassign(s)) {
              st.status = "pending"; // relaunch on another slot next tick
              state.events.push(
                `${nowISO()} ${s.id} rerouted to ${s.lane ? `${s.slot}/${s.lane}` : s.slot}`,
              );
            } else {
              st.status = "blocked";
              st.reason = "no slot with quota left";
            }
          } else {
            st.status = verdict.status;
            st.reason = verdict.reason ?? undefined;
            state.events.push(`${nowISO()} ${s.id} ${verdict.status}`);
          }
          writeJSON(join(dir, "state.json"), state);
        });
      } catch (e) {
        st.status = "failed";
        st.reason = e.message;
        state.events.push(`${nowISO()} ${s.id} launch_fail: ${e.message}`);
      }
    }

    writeJSON(join(dir, "state.json"), state);

    const all = routing.sessions.map((s) => state.sessions[s.id]);
    if (all.every((st) => terminal(st.status))) break;
    // Nothing running and nothing launchable: the DAG is stuck on a blocked dep.
    if (!live.size && !routing.sessions.some((s) => state.sessions[s.id].status === "pending" && depsDone(s))) {
      const stuck = routing.sessions.filter((s) => state.sessions[s.id].status === "pending");
      if (stuck.length) {
        for (const s of stuck) {
          state.sessions[s.id].status = "abandoned";
          state.sessions[s.id].reason = `dependency ${(s.deps ?? []).join(",")} never completed`;
        }
      }
      break;
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  writeJSON(join(dir, "state.json"), state);
  console.log(renderStatus(dir, routing, state));
  const pending = routing.sessions.filter((s) => !terminal(state.sessions[s.id].status));
  if (pending.length) {
    console.log(
      `\nstill running: ${pending.map((s) => s.id).join(", ")} — call \`handoff dispatch --run ${dir}\` again.`,
    );
  } else {
    console.log(`\nall sessions terminal — run \`handoff score --run ${dir}\`.`);
  }
}

function renderStatus(dir, routing, state) {
  const rows = routing.sessions.map((s) => {
    const st = state.sessions[s.id] ?? {};
    const res = join(dir, "sessions", `${s.id}.result.md`);
    let summary = st.reason ?? "";
    if (!summary && existsSync(res)) {
      // One line only. The result file's own body stays out of the model's
      // context unless the model decides to open it.
      summary = (readFileSync(res, "utf8").match(/^\s*-?\s*summary:\s*(.+)$/mi)?.[1] ?? "").slice(0, 70);
    }
    const lane = st.lane ?? s.lane;
    return `| ${s.id} | ${st.status ?? "pending"} | ${st.slot ?? s.slot}${lane ? `/${lane}` : ""} | ${st.attempts ?? 0} | ${summary} |`;
  });
  return ["", "| Session | Status | Slot | Tries | Note |", "|---|---|---|---|---|", ...rows].join("\n");
}

// ------------------------------------------------------------------- score

async function score(dir) {
  const routing = readJSON(join(dir, "routing.json"));
  const before = readJSON(join(dir, "quota.json"));
  const state = loadState(dir);
  if (!routing || !before) die("routing.json or quota.json missing");

  const after = await probe();
  writeJSON(join(dir, "quota-after.json"), after);

  // The number the old scorecard never had: what the run actually cost, in the
  // only currency that runs out.
  const cost = {};
  const sessionCost = {};
  for (const b of before.slots) {
    const a = after.slots.find((x) => x.key === b.key);
    if (b.remaining_pct === null || a?.remaining_pct === null || !a) continue;
    const delta = b.remaining_pct - a.remaining_pct;
    cost[b.key] = Math.round(delta * 10) / 10;
    const ran = routing.sessions.filter(
      (s) => state.sessions[s.id]?.slot === b.key && state.sessions[s.id]?.attempts > 0,
    );
    if (ran.length && delta > 0) {
      sessionCost[b.provider] = ran.map((s) => ({
        size: s.size,
        pct: Math.round((delta / ran.length) * 10) / 10,
      }));
    }
  }

  const st = (id) => state.sessions[id] ?? {};
  const done = routing.sessions.filter((s) => st(s.id).status === "done");
  const providersUsed = [...new Set(routing.sessions.map((s) => st(s.id).slot).filter(Boolean))];
  const providersAvail = before.slots.filter((s) => s.installed).map((s) => s.key);
  const wall = Math.round(secsSince(state.started_at));

  const metrics = {
    ts: nowISO(),
    skill_version: skillVersion(),
    mode: routing.mode,
    n_sessions: routing.sessions.length,
    n_done: done.length,
    wall_clock_s: wall,
    parent_turns: state.parent_turns,
    providers_available: providersAvail,
    providers_used: providersUsed,
    quota_delta_pct: cost,
    session_cost_pct: sessionCost,
    // Counts, not booleans: six relaunches must not score the same as one.
    relaunches: routing.sessions.reduce((n, s) => n + Math.max(0, (st(s.id).attempts ?? 0) - 1), 0),
    quota_deaths: state.empty_slots.length,
    launch_fails: state.events.filter((e) => e.includes("launch_fail")).length,
    blocked: routing.sessions.filter((s) => st(s.id).status === "blocked").length,
    failed: routing.sessions.filter((s) => st(s.id).status === "failed").length,
    abandoned: routing.sessions.filter((s) => st(s.id).status === "abandoned").length,
    // Structural: the router refuses overlapping writers, so this is 0 unless
    // someone bypassed `route`.
    independence_miss: 0,
    spread_miss: providersAvail.length >= 2 && providersUsed.length === 1 ? 1 : 0,
    admission_ignored: routing.admission?.ok === false ? 1 : 0,
  };

  const jsonl = join(tmpdir(), "handoff", "metrics.jsonl");
  mkdirSync(join(tmpdir(), "handoff"), { recursive: true });
  appendFileSync(jsonl, JSON.stringify(metrics) + "\n");

  const lines = [
    "",
    "## Scorecard",
    "",
    "```json",
    JSON.stringify(metrics, null, 2),
    "```",
    "",
    `Cost of this run: ${
      Object.entries(cost)
        .map(([k, v]) => {
          const est = before.slots.find((x) => x.key === k)?.estimated;
          return `${k} −${v}pt${est ? " (estimated from transcripts)" : " of plan quota"}`;
        })
        .join(", ") || "not measurable (every probe was unknown)"
    }`,
    `Wall clock ${fmtDur(wall)} across ${state.parent_turns} parent turn(s).`,
  ];
  appendFileSync(join(dir, "manifest.md"), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  console.log(`\nappended: ${jsonl}`);
}

function skillVersion() {
  try {
    const here = new URL("../SKILL.md", import.meta.url).pathname;
    return readFileSync(here, "utf8").match(/^\s+version:\s*['"]?([0-9.]+)/m)?.[1] ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// -------------------------------------------------------------------- main

const cmd = process.argv[2];

if (cmd === "probe") {
  const snapshot = await probe();
  const dir = arg("run") || process.env.HANDOFF_RUN;
  if (dir) {
    mkdirSync(join(resolve(dir), "sessions"), { recursive: true });
    writeJSON(join(resolve(dir), "quota.json"), snapshot);
  }
  console.log(arg("json") ? JSON.stringify(snapshot, null, 2) : renderQuota(snapshot));
  if (arg("explain") && !arg("json")) console.log(renderExplain(snapshot));
} else if (cmd === "route") {
  route(runDir());
} else if (cmd === "dispatch") {
  await dispatch(runDir());
} else if (cmd === "status") {
  const dir = runDir();
  console.log(renderStatus(dir, readJSON(join(dir, "routing.json")), loadState(dir)));
} else if (cmd === "score") {
  await score(runDir());
} else {
  console.log(
    `handoff — orchestration for the handoff skill

  probe    [--run DIR] [--json] [--explain]
                                    supply snapshot per slot; --explain lists
                                    every credential and transcript path tried
  route    --run DIR                admission control + assignment (refuses overlapping writers)
  dispatch --run DIR [--budget S]   launch ready sessions, wait, reroute on quota death
  status   --run DIR                one line per session
  score    --run DIR                cost + defect scorecard, appends metrics.jsonl
`,
  );
}

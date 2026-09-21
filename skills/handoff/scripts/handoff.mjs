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
//   route    --run DIR [--approve]     admission control + slot assignment
//   dispatch --run DIR [--budget S] [--settle S]
//                                      launch ready sessions, wait, reroute, repeat
//   status   --run DIR                 status table + result digest blocks
//   score    --run DIR                 cost + defect scorecard, appends metrics.jsonl
//   clean    --run DIR [--branches]    remove clean worktrees and run dir; --branches also deletes session branches merged into HEAD
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
import { createHash } from "node:crypto";
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
  readdirSync,
  rmSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RTK_ENV, RTK_PROMPT, historyStats, normalizeMode, rtkVersion } from "./rtk.mjs";
import {
  claudeConfigDirs,
  codexHomes,
  localSearchPaths,
  localSnapshot,
} from "./local-usage.mjs";
import {
  choice,
  score as s1Score,
  noul,
  rules,
  setBackend,
  getBackend,
  EFFORTS,
  EFFORT_BY_TIER,
  DEFAULT_EFFORT,
  decisionsPath,
  resolveDecisions,
  readDecisions,
} from "./s1.mjs";
import { runSessionGates } from "./gate.mjs";

const LOW_PCT = Number(process.env.HANDOFF_LOW_PCT ?? 20);
const PROBE_TTL_S = 300;
const POLL_MS = 3000;
export const DEFAULT_SETTLE_S = 30;

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
function readKeychainRaw(service, account) {
  if (process.platform !== "darwin") return null;
  const args = ["find-generic-password", "-s", service];
  // Some items are only unique per (service, account) — go-keyring writes every
  // Antigravity product's session under one service.
  if (account) args.push("-a", account);
  const r = spawnSync("/usr/bin/security", [...args, "-w"], {
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
  antigravity: {
    bin: ["agy", "antigravity"],
    // Not a credential file anywhere: quota comes from a running product's
    // loopback RPC, and from the saved Google session when none is running. Both
    // are modelled as sources so `--explain` names whichever one was missing.
    credSources: () => {
      const bases = agyBases();
      return [
        {
          label: bases.length
            ? `Antigravity language server on ${bases.join(", ")}`
            : "Antigravity language server — no product listening on this machine",
          exists: () => bases.length > 0,
          read: () => (bases.length ? { bases } : null),
        },
        {
          label: `OS keyring: service gemini, account antigravity${
            process.platform === "darwin"
              ? " (login Keychain)"
              : process.platform === "linux"
                ? " (Secret Service)"
                : " — unreadable on this platform"
          }`,
          read: () => antigravitySession(),
        },
      ];
    },
    // The live-server source carries no expiry; the saved session does.
    isExpired: (c) => Boolean(c?.expires_at && c.expires_at < Date.now()),
    // agy keeps its conversations in a SQLite store whose schema this script has
    // not verified. A guessed reading is worse than an honest `unknown`.
    local: null,
    usagebarIds: ["antigravity"],
    noCredentialHint:
      "Antigravity serves quota from a running product — the app, the IDE, or an interactive " +
      "`agy` session — on a loopback port, or from the Google session it saved in the OS keyring. " +
      "With no product running and nothing saved, the slot stays unprobed and routing gives it a " +
      "neutral weight. Point ANTIGRAVITY_LS_ADDRESS at host:port if the server is somewhere this " +
      "cannot discover.",
    async fetchUsage(creds) {
      if (creds?.bases?.length) {
        const local = await agyLocal(creds.bases);
        if (local && !local.error) return local;
        // A server that is up but signed out, or `agy`'s CSRF token that it does
        // not publish, both leave the saved session as the way through.
        const cloud = await agyCloud(antigravitySession());
        if (cloud && !cloud.error) return cloud;
        return local ?? cloud;
      }
      return agyCloud(creds);
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
//
// Every lane declares a `kind`: `own` for the provider's own models, `frontier`
// for named third-party ones. The names are each provider's own vocabulary and
// belong in the table; `kind` is what routing reasons about, so a provider with
// a third pair of names needs no new branch in the router.
//
// A lane holds EITHER a single percentage capping windows it shares with the
// slot (Cursor: two pools inside one billing cycle) OR its own windows
// (Antigravity: a five-hour and a weekly bucket per pool). Both shapes reduce to
// the same question — how much can this lane supply over the horizon — which is
// why `laneCapped` is the only place that has to know which shape it is.
const LANE_LABEL = {
  "cursor-models": "Auto, Composer, Grok",
  "other-models": "named third-party models, at their API price",
  gemini: "Antigravity's own Gemini models",
  "third-party": "Claude and GPT on Antigravity",
};

// Which lane kind a model id draws from. A pattern, not a list of ids: these
// vendors add and rename their own models faster than any hardcoded list
// survives, and an unrecognised name falls to the frontier lane rather than
// quietly spending the pool it does not belong to.
const OWN_MODEL_RE = {
  cursor: new RegExp(process.env.HANDOFF_CURSOR_OWN_MODELS ?? "composer|grok|^auto$", "i"),
  antigravity: new RegExp(process.env.HANDOFF_ANTIGRAVITY_OWN_MODELS ?? "^gemini", "i"),
};
const laneKindOfModel = (provider, model) => {
  const re = OWN_MODEL_RE[provider];
  return !re || !model ? null : re.test(model) ? "own" : "frontier";
};

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
    { name: "cursor-models", kind: "own", remaining_pct: left(auto) },
    { name: "other-models", kind: "frontier", remaining_pct: left(api) },
  ];
}

export function resolveCodexModel(bin = "codex", account = null) {
  if (process.env.CODEX_MODEL) return process.env.CODEX_MODEL;
  for (const dir of codexHomes()) {
    if (account && account !== "default") {
      const profCfg = join(dir, `${account}.config.toml`);
      if (existsSync(profCfg)) {
        try {
          const text = readFileSync(profCfg, "utf8");
          const m = text.match(/^\s*model\s*=\s*["']?([^"'\s#]+)["']?/m);
          if (m && m[1] && m[1].toLowerCase() !== "default") return m[1];
        } catch {}
      }
    }
    const cfg = join(dir, "config.toml");
    if (existsSync(cfg)) {
      try {
        const text = readFileSync(cfg, "utf8");
        const m = text.match(/^\s*model\s*=\s*["']?([^"'\s#]+)["']?/m);
        if (m && m[1] && m[1].toLowerCase() !== "default") return m[1];
      } catch {}
    }
    const cache = join(dir, "models_cache.json");
    if (existsSync(cache)) {
      try {
        const j = JSON.parse(readFileSync(cache, "utf8"));
        if (j.default_model && j.default_model.toLowerCase() !== "default") return j.default_model;
        if (Array.isArray(j.models) && j.models.length > 0) {
          const slug = j.models[0]?.slug || j.models[0]?.id;
          if (slug && slug.toLowerCase() !== "default") return slug;
        }
      } catch {}
    }
  }
  return "gpt-5.6-sol";
}

// The CLI's own model list, so a lane can be pinned to a real id instead of an
// invented one. Each CLI publishes it differently — `cursor-agent
// --list-models`, `agy models` — and a CLI with no such command exits non-zero,
// which leaves the lane a preference its default model may ignore; the routing
// table marks that rather than pretending otherwise.
const MODEL_LIST_ARGS = { cursor: ["--list-models"], antigravity: ["models"] };
const modelListCache = new Map();
export function cliModels(bin, provider) {
  if (provider === "codex") {
    for (const dir of codexHomes()) {
      const cachePath = join(dir, "models_cache.json");
      if (existsSync(cachePath)) {
        try {
          const j = JSON.parse(readFileSync(cachePath, "utf8"));
          if (Array.isArray(j.models)) {
            const list = j.models.map((m) => m.slug || m.id).filter(Boolean);
            if (list.length) return list;
          }
        } catch {}
      }
    }
    return [resolveCodexModel(bin)];
  }
  const listArgs = MODEL_LIST_ARGS[provider];
  if (!listArgs) return [];
  if (modelListCache.has(bin)) return modelListCache.get(bin);
  let out = [];
  try {
    const r = spawnSync(bin, listArgs, { encoding: "utf8", timeout: 20000 });
    if (r.status === 0 && r.stdout) {
      out = r.stdout
        .split("\n")
        .map((l) => l.replace(/^[\s*\-\u2022\u2800-\u28ff]+/, "").trim())
        .filter((l) => !l.startsWith("Available") && !l.includes("Fetching") && !l.startsWith("Tip:"))
        .map((l) => l.split(/\s+-\s+|\s+/)[0].trim())
        .filter((l) => /^[a-z0-9][a-z0-9._-]{1,64}$/i.test(l));
    }
  } catch {}
  modelListCache.set(bin, out);
  return out;
}

const pickModelForLane = (bin, provider, lane) => {
  if (!lane?.kind) return null;
  const inLane = cliModels(bin, provider).filter(
    (m) => laneKindOfModel(provider, m) === lane.kind,
  );
  // `auto` hands the choice to the provider's own router, and that choice can
  // land in the other pool — so a named own-model wins over it when one is
  // listed.
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

// ------------------------------------------------------- antigravity reading
//
// Antigravity has no credential file and no public usage endpoint. Google ships
// three products that share one account-wide quota — the Antigravity app, the
// IDE, and the `agy` CLI — and each runs the same CSRF-guarded JSON-RPC surface
// on a loopback port it binds with `--https_server_port 0`. The port is drawn
// from the ephemeral range, so it cannot be hardcoded: it has to be discovered
// from the listening sockets of a matching process. Method reverse-engineered
// from ai-usagebar's `src/antigravity`.
//
// When no product is running, the same summary is served by Google's Cloud Code
// API to the session Antigravity saved in the OS keyring. That is the fallback,
// and it is read-only: no token refresh, because renewing it needs Antigravity's
// own OAuth client and rewriting another program's session is not this script's
// business.
const AGY_QUOTA_RPC =
  "exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary";
const AGY_CLOUD_QUOTA = [
  // The daily channel first, which is the order the product itself uses.
  "https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary",
  "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary",
];
const AGY_HTTP_MS = 5000;
const GO_KEYRING_PREFIX = "go-keyring-base64:";

// Antigravity 2.0 and the IDE spawn a separate `language_server` child; the CLI
// embeds the same surface in its own process. Matching only the server binary
// would miss a CLI-only install.
const AGY_PROCESS = /(^|\/)agy$|language_server|antigravity/i;

function readSecretTool(attrs) {
  if (process.platform !== "linux" || !which("secret-tool")) return null;
  const r = spawnSync("secret-tool", ["lookup", ...attrs], {
    encoding: "utf8",
    timeout: 10000,
  });
  return r.status === 0 && r.stdout ? r.stdout.trim() : null;
}

const epochToMs = (n) =>
  // 1e11 seconds is the year 5138; 1e11 milliseconds is 1973. Anything at or
  // above it is already milliseconds.
  n >= 1e11 ? n : n * 1000;

function agyExpiry(value) {
  if (typeof value === "number" && Number.isFinite(value)) return epochToMs(value);
  if (typeof value !== "string" || !value.trim()) return null;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && value.trim() !== "") return epochToMs(asNumber);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Every Antigravity product saves its Google session through Go's go-keyring,
// under service `gemini` and account `antigravity`: a login Keychain item on
// macOS, a Secret Service item on Linux. Backends that cannot hold raw text get
// the JSON base64-wrapped behind a fixed prefix.
function antigravitySession() {
  const raw =
    readKeychainRaw("gemini", "antigravity") ??
    readSecretTool(["service", "gemini", "username", "antigravity"]);
  if (!raw) return null;
  let json = raw.trim();
  if (json.startsWith(GO_KEYRING_PREFIX)) {
    try {
      json = Buffer.from(json.slice(GO_KEYRING_PREFIX.length).trim(), "base64").toString("utf8");
    } catch {
      return null;
    }
  }
  let root;
  try {
    root = JSON.parse(json);
  } catch {
    return null;
  }
  const t = root?.token && typeof root.token === "object" ? root.token : root;
  const token = [
    "access_token", "accessToken", "token", "id_token",
    "idToken", "bearerToken", "auth_token", "authToken",
  ]
    .map((k) => t?.[k])
    .find((v) => typeof v === "string" && v.trim());
  if (!token) return null;
  const expiry = ["expiry", "expires_at", "expiresAt"].map((k) => t?.[k]).find((v) => v != null);
  return { token, expires_at: agyExpiry(expiry) };
}

// Each product binds two listeners — JSON-RPC in the clear and HTTPS — in that
// order, so within one process the RPC port tends to draw the higher ephemeral
// number. Group ports per pid, sort high-to-low inside each group, then take
// them rank by rank, so every product's likely-RPC port is probed before any
// product's TLS one. A mis-ranked guess costs one round trip, nothing more.
function agyProbeOrder(perPid) {
  const groups = [...perPid.values()].map((ports) => [...new Set(ports)].sort((a, b) => b - a));
  const out = [];
  for (let rank = 0; ; rank += 1) {
    const row = groups.map((g) => g[rank]).filter((p) => p !== undefined);
    if (!row.length) return out;
    out.push(...row);
  }
}

function discoverLsPorts() {
  const perPid = new Map();
  const add = (pid, port) => {
    if (!Number.isInteger(port) || port <= 0) return;
    if (!perPid.has(pid)) perPid.set(pid, []);
    perPid.get(pid).push(port);
  };

  // `-F pcn` is the machine-parsable form: a `p<pid>` line, then a `c<command>`
  // line, then one `n<address>` line per listening socket.
  if (which("lsof")) {
    const r = spawnSync("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-F", "pcn"], {
      encoding: "utf8",
      timeout: 15000,
    });
    // A non-zero exit still prints the descriptors it could read.
    let pid = null;
    let owned = null;
    for (const line of (r.stdout ?? "").split("\n")) {
      const rest = line.slice(1);
      if (line.startsWith("p")) {
        pid = Number(rest) || null;
        owned = null;
      } else if (line.startsWith("c")) {
        owned = pid && AGY_PROCESS.test(rest.trim()) ? pid : null;
      } else if (line.startsWith("n") && owned) {
        add(owned, Number(rest.split(":").pop()));
      }
    }
  }

  // Linux without lsof: iproute2 prints the owning process inline.
  if (!perPid.size && which("ss")) {
    const r = spawnSync("ss", ["-ltnpH"], { encoding: "utf8", timeout: 15000 });
    for (const line of (r.stdout ?? "").split("\n")) {
      const proc = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
      if (!proc || !AGY_PROCESS.test(proc[1])) continue;
      const local = line.trim().split(/\s+/)[3] ?? "";
      add(Number(proc[2]), Number(local.split(":").pop()));
    }
  }

  return agyProbeOrder(perPid);
}

function agyBases() {
  const bases = [];
  const override = (process.env.ANTIGRAVITY_LS_ADDRESS ?? "").trim();
  if (override) {
    const [scheme, rest] = override.includes("://")
      ? [override.split("://")[0], override.split("://").slice(1).join("://")]
      : ["http", override];
    const authority = rest.replace(/\/+$/, "");
    if (authority) bases.push(`${scheme}://${authority}`);
  }
  for (const port of discoverLsPorts()) {
    const base = `http://127.0.0.1:${port}`;
    if (!bases.includes(base)) bases.push(base);
  }
  return bases;
}

// The desktop products embed a CSRF token in the HTML they serve at `/`. The
// `agy` CLI serves no such page, which is why a missing token is not fatal here:
// the RPC's own rejection is what decides whether to fall back to the cloud.
async function agyCsrf(base) {
  try {
    const r = await fetch(base, { signal: AbortSignal.timeout(AGY_HTTP_MS) });
    if (!r.ok) return null;
    const html = await r.text();
    return html.split('csrfToken":"')[1]?.split('"')[0] || null;
  } catch {
    return null;
  }
}

// Four buckets, two lanes: `gemini-5h`, `gemini-weekly`, `3p-5h`, `3p-weekly`.
// The group display name is the fallback key, so a renamed bucket id still lands
// in the right lane, and an unrecognised cadence or group is skipped rather than
// defaulted into a slot it might not belong to.
function agyQuota(payload) {
  const groups = payload?.response?.groups ?? payload?.groups;
  if (!Array.isArray(groups)) return { error: "quota summary has no groups" };
  const byLane = { gemini: [], "third-party": [] };
  const seen = [];
  for (const group of groups) {
    const groupName = typeof group?.displayName === "string" ? group.displayName : "";
    for (const bucket of group?.buckets ?? []) {
      const id = typeof bucket?.bucketId === "string" ? bucket.bucketId : "";
      const win = typeof bucket?.window === "string" ? bucket.window : "";
      seen.push(id || "<unnamed>");
      const weekly =
        id.endsWith("weekly") || win === "weekly"
          ? true
          : id.endsWith("5h") || win === "5h"
            ? false
            : null;
      if (weekly === null) continue;
      const lane = id.startsWith("gemini")
        ? "gemini"
        : id.startsWith("3p")
          ? "third-party"
          : groupName.includes("Gemini")
            ? "gemini"
            : /Claude|GPT/.test(groupName)
              ? "third-party"
              : null;
      if (!lane) continue;
      // `remainingFraction` is what is LEFT, 0..1 — the inverse of every other
      // provider here, which reports what is spent. No inversion, and a value
      // outside the range is dropped rather than clamped into a reassuring one.
      const frac = bucket?.remainingFraction;
      if (typeof frac !== "number" || !Number.isFinite(frac) || frac < 0 || frac > 1) continue;
      const reset = Date.parse(bucket?.resetTime ?? "");
      byLane[lane].push({
        name: weekly ? "weekly" : "five_hour",
        remaining_pct: Math.round(frac * 100),
        resets_at: Number.isFinite(reset) ? new Date(reset).toISOString() : null,
        window_secs: weekly ? 604800 : 18000,
      });
    }
  }
  const lanes = Object.entries(byLane)
    .filter(([, windows]) => windows.length)
    .map(([name, windows]) => ({
      name,
      kind: name === "gemini" ? "own" : "frontier",
      windows,
    }));
  if (!lanes.length) {
    return {
      error: `no 5h or weekly bucket in the quota summary (it offered: ${seen.join(", ") || "nothing"})`,
    };
  }
  return { windows: [], lanes };
}

async function agyLocal(bases) {
  const errors = [];
  for (const base of bases) {
    const csrf = await agyCsrf(base);
    try {
      const r = await fetch(`${base}/${AGY_QUOTA_RPC}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "x-codeium-csrf-token": csrf } : {}),
        },
        body: "{}",
        signal: AbortSignal.timeout(AGY_HTTP_MS),
      });
      if (!r.ok) {
        errors.push(`${base} HTTP ${r.status}`);
        continue;
      }
      const parsed = agyQuota(await r.json());
      if (parsed.error) {
        errors.push(`${base}: ${parsed.error}`);
        continue;
      }
      return { ...parsed, source: "agy-language-server" };
    } catch (e) {
      errors.push(`${base}: ${e.message}`);
    }
  }
  return errors.length ? { error: errors[0] } : null;
}

async function agyCloud(session) {
  if (!session?.token) return null;
  if (session.expires_at && session.expires_at < Date.now()) {
    return { error: "the saved Google session expired — open Antigravity to sign in again" };
  }
  let last = null;
  for (const url of AGY_CLOUD_QUOTA) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
          "User-Agent": "antigravity",
        },
        body: "{}",
        signal: AbortSignal.timeout(10000),
      });
      if (r.status === 401 || r.status === 403) {
        // Google's verdict on the session, not a transport hiccup: trying the
        // next base would only repeat it.
        return {
          error: "the saved Google session was rejected — open Antigravity to sign in again",
        };
      }
      if (!r.ok) {
        last = `HTTP ${r.status}`;
        continue;
      }
      const parsed = agyQuota(await r.json());
      if (parsed.error) return parsed;
      return { ...parsed, source: "google-cloud-code" };
    } catch (e) {
      last = e.message;
    }
  }
  return { error: `no Cloud Code endpoint answered${last ? ` (${last})` : ""}` };
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
function makeSlot({ key, provider, account, bin, windows, lanes, source, estimated, note, tried, auth_expired }) {
  const usableOf = (ws) => (ws ?? []).filter((w) => typeof w.remaining_pct === "number");
  // A lane with its own windows is worth its tightest one — the same rule that
  // makes a slot worth the least of its windows, applied one level down.
  const lanesOut = lanes?.length
    ? lanes.map((l) => {
        const own = usableOf(l.windows);
        const remaining_pct = own.length ? pickTightest(own).remaining_pct : l.remaining_pct;
        return { ...l, remaining_pct, bucket: auth_expired ? "unknown" : bucketOf(remaining_pct) };
      })
    : undefined;
  const usable = usableOf(windows);
  let head = usable.length ? pickTightest(usable) : null;
  if (!head && lanesOut?.length) {
    // No window is shared across the lanes, so the slot's headline is its BEST
    // lane's tightest window: a slot with one spent lane beside a full one is
    // not an empty slot, and `bucket` decides whether it is offered at all.
    const best = lanesOut
      .filter((l) => typeof l.remaining_pct === "number")
      .sort((a, b) => b.remaining_pct - a.remaining_pct)[0];
    const bw = usableOf(best?.windows);
    head = bw.length
      ? pickTightest(bw)
      : best
        ? { name: best.name, remaining_pct: best.remaining_pct, resets_at: null, window_secs: null }
        : null;
  }
  return {
    key, provider, account, installed: true, bin,
    windows: windows?.length ? windows : undefined,
    // Alternatives, not gates — see the lanes block above.
    lanes: lanesOut,
    remaining_pct: auth_expired ? null : (head?.remaining_pct ?? null),
    window: head?.name ?? windows?.[0]?.name ?? null,
    resets_at: head?.resets_at ?? windows?.[0]?.resets_at ?? null,
    window_secs: head?.window_secs ?? windows?.[0]?.window_secs ?? null,
    bucket: auth_expired ? "unknown" : bucketOf(head?.remaining_pct),
    estimated: estimated || undefined,
    auth_expired: auth_expired || undefined,
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
        source = "expired-credential";
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
        } else if (!result?.windows?.length && !result?.lanes?.length) {
          // A file that exists and parses can still hold no usable token. That
          // is a failed source, not a source reporting "unknown" — saying
          // otherwise hides the one fact that would let someone fix it.
          note = `${credLabel} has no usable token — ${
            result === null ? "no credential field this probe recognises" : "no windows in the response"
          }`;
          result = null;
        } else source = result.source ?? `${name}-oauth`;
      } catch (e) {
        note = `probe failed: ${e.message}`;
      }
    }

    // Source 3: the transcripts this machine already wrote. No credential, no
    // network — so it still answers when every OAuth path above has failed.
    // P1: A slot that fell back to transcripts *because* credentials expired is
    // unusable, so do not estimate quota from transcripts if auth expired.
    let estimated = false;
    if (!result && p.local && !expiredSeen) {
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
        auth_expired: Boolean(expiredSeen),
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
  // A lane that carries its own windows IS its own set of gates — same reset
  // clocks, same rate math, just not shared with the other lane.
  if (lane?.windows?.length) return lane.windows;
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

export function nonCausalDeps(sessions) {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const nonCausal = [];
  for (const b of sessions) {
    for (const aId of b.deps ?? []) {
      const a = byId.get(aId);
      if (!a) continue;
      const aWrites = a.writes ?? [];
      const bTargets = [...(b.reads ?? []), ...(b.writes ?? [])];
      let overlaps = false;
      for (const pa of aWrites) {
        for (const pb of bTargets) {
          if (pathsCollide(pa, pb)) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) break;
      }
      if (!overlaps) {
        nonCausal.push({ from: a.id, to: b.id, edge: `${a.id}→${b.id}` });
      }
    }
  }
  return nonCausal;
}

export function hashSessions(sessions) {
  return createHash("sha256").update(JSON.stringify(sessions ?? [])).digest("hex");
}

// What the owner approves: the sessions plus plan-level choices that change
// how they run. A plan without those hashes exactly as before.
export function hashPlan(plan) {
  if (plan?.rtk === undefined) return hashSessions(plan?.sessions);
  return createHash("sha256").update(JSON.stringify({ rtk: plan.rtk, sessions: plan.sessions ?? [] })).digest("hex");
}

// Per-session rtk: the session's own value wins over the plan's. Claude
// children get a scoped hook; hookless CLIs get the instruction in the prompt.
export function rtkFor(plan, s, provider) {
  const mode = normalizeMode(s.rtk ?? plan?.rtk);
  if (mode === "off") return { mode, via: "off" };
  return { mode, via: provider === "claude" ? "hook" : "prompt" };
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
// A kind, not a name: every provider that splits its plan has an own-model pool
// and a frontier one, whatever it calls them.
const preferredLane = (tier) => (tier === "mechanical" ? "own" : "frontier");

// P4: Provider sandbox capabilities. A session that declares `needs` cannot be
// routed to a sandbox that blocks any of those requirements.
const PROVIDER_CAPABILITIES = {
  claude: new Set(["network", "unix-socket", "git-write", "pty", "disk-write", "high-memory"]),
  cursor: new Set(["network", "unix-socket", "git-write", "pty", "disk-write", "high-memory"]),
  antigravity: new Set(["network", "unix-socket", "git-write", "pty", "disk-write", "high-memory"]),
  codex: new Set(["pty", "disk-write", "high-memory"]), // workspace-write sandbox blocks network, unix-socket, git-write
};

function slotSatisfiesNeeds(provider, needs) {
  if (!needs || !needs.length) return true;
  const caps = PROVIDER_CAPABILITIES[provider];
  if (!caps) return false;
  return needs.every((need) => caps.has(need));
}

export function route(dir) {
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

  const nonCausal = nonCausalDeps(plan.sessions);
  for (const nc of nonCausal) {
    console.warn(
      `⚠ warning: non-causal dependency edge ${nc.edge} (${nc.from} writes do not overlap ${nc.to} reads ∪ ${nc.to} writes)`,
    );
  }

  let wantsRtk = false;
  try {
    for (const s of plan.sessions) wantsRtk ||= normalizeMode(s.rtk ?? plan.rtk) !== "off";
  } catch (e) {
    die(`plan.json: ${e.message}`);
  }
  const rtkVer = wantsRtk ? rtkVersion() : null;
  if (wantsRtk && !rtkVer) die("plan.json asks for rtk but the rtk binary is not on PATH (brew install rtk)");

  // P8: Respect plan-level avoid list and slots found dead in state.json
  const deadSlots = new Set([...(plan.avoid ?? [])]);
  const statePath = join(dir, "state.json");
  if (existsSync(statePath)) {
    const priorState = readJSON(statePath);
    if (priorState?.empty_slots) {
      for (const k of priorState.empty_slots) deadSlots.add(k);
    }
  }

  const horizonS = Number(plan.horizon_s ?? 7200);
  const history = costHistory();
  const eligible = quota.slots
    .filter(
      (s) =>
        s.installed &&
        s.bucket !== "empty" &&
        !s.auth_expired &&
        !deadSlots.has(s.key) &&
        !deadSlots.has(s.provider),
    )
    .map((s) => ({ ...s, supply: effectiveSupply(s, horizonS) }))
    .filter((s) => s.supply > 0);

  if (!eligible.length) {
    console.error("handoff: every provider is empty, dead, or absent. Nothing launched.");
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
      const laneKey = lane ? `${p.key}/${lane.name}` : p.key;
      if (deadSlots.has(laneKey)) continue;
      const supply = supplyFor(p, lane, horizonS);
      if (supply > 0) {
        candidates.push({ slot: p, lane, key: laneKey, supply });
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
    const lanePinned = pinned ? field.filter((c) => c.lane?.kind === pinned) : [];
    return (lanePinned.length ? lanePinned : field)
      .map((c) => ({
        c,
        score:
          ((load[c.key] + estimateCost(c.slot.provider, size, history)) / c.supply) *
          (c.lane && c.lane.kind !== wanted ? LANE_PENALTY : 1),
      }))
      .sort((a, b) => a.score - b.score)[0].c;
  };
  for (const s of [...plan.sessions].sort((a, b) => a.id.localeCompare(b.id))) {
    const size = s.size ?? "m";
    const decision = choice(
      { session: s.id, tier: s.tier, effort: s.effort },
      EFFORTS,
      { site: "effort", run: dir, session: s.id }
    );
    const effort = decision.label;
    const hasModelOverride = Boolean(s.model);
    const hasEffortOverride = Boolean(s.effort);
    const isOverride = hasModelOverride || hasEffortOverride;
    const wanted = preferredLane(s.tier);
    // P4: Filter candidate slots by declared session capabilities
    const validCandidates = candidates.filter((c) => slotSatisfiesNeeds(c.slot.provider, s.needs));
    let cand;
    if (s.provider) {
      if (!slotSatisfiesNeeds(s.provider, s.needs)) {
        die(
          `session ${s.id} names provider ${s.provider}, which does not satisfy required needs: [${(s.needs ?? []).join(", ")}]`,
        );
      }
      const named = validCandidates.filter(
        (c) => c.slot.key === s.provider || c.slot.provider === s.provider,
      );
      if (named.length) {
        const pinnedLane = hasModelOverride ? laneKindOfModel(named[0].slot.provider, s.model) : null;
        cand = pickBest(named, size, wanted, pinnedLane);
      } else {
        // The user named a provider whose every lane is spent. Their call wins;
        // the zero supply is what the admission warning is for.
        const slot =
          eligible.find(
            (p) =>
              (p.key === s.provider || p.provider === s.provider) &&
              slotSatisfiesNeeds(p.provider, s.needs),
          ) ??
          quota.slots.find(
            (p) =>
              (p.key === s.provider || p.provider === s.provider) &&
              slotSatisfiesNeeds(p.provider, s.needs),
          );
        if (!slot?.installed) {
          die(`session ${s.id} names provider ${s.provider}, which is absent or does not satisfy needs`);
        }
        cand = { slot, lane: null, key: slot.key, supply: 0 };
      }
    } else {
      if (!validCandidates.length) {
        die(
          `session ${s.id} requires [${(s.needs ?? []).join(", ")}], but no eligible provider supports all required capabilities`,
        );
      }
      const pinnedLane = hasModelOverride ? laneKindOfModel(validCandidates[0].slot.provider, s.model) : null;
      cand = pickBest(validCandidates, size, wanted, pinnedLane);
    }
    const slot = cand.slot;
    const laneName = cand.lane?.name ?? null;

    if (hasModelOverride) {
      const available = cliModels(slot.bin, slot.provider);
      if (available.length > 0) {
        const baseModel = s.model.includes("[") ? s.model.split("[")[0].trim() : s.model;
        if (!available.includes(s.model) && !available.includes(baseModel)) {
          die(
            `session ${s.id} names model "${s.model}" for ${slot.provider}, which is not in the CLI's model list. Valid models: ${available.join(", ")}`,
          );
        }
      }
      // Warns, never reroutes, when an overridden model's lane has no quota
      if (cand.lane && (cand.lane.remaining_pct === 0 || cand.supply <= 0)) {
        console.warn(
          `⚠ warning: session ${s.id} model override "${s.model}" lane "${cand.lane.name}" has no quota remaining`,
        );
      }
    }

    load[cand.key] = (load[cand.key] ?? 0) + estimateCost(slot.provider, size, history);
    // Pin the lane to a model id the CLI actually lists. Without a pin the lane
    // is only a preference and the CLI's default model decides the pool, so the
    // table says so rather than claiming a routing decision it did not make.
    let model = s.model;
    if (!model && cand.lane) {
      model = pickModelForLane(slot.bin, slot.provider, cand.lane);
    }
    if (!model && slot.provider === "codex") {
      model = resolveCodexModel(slot.bin, slot.account);
    }
    assigned.push({
      ...s,
      size,
      effort,
      override: isOverride,
      slot: slot.key,
      provider: slot.provider,
      account: slot.account,
      bin: slot.bin,
      model,
      lane: laneName ?? undefined,
      lane_remaining_pct: cand.lane?.remaining_pct,
      lane_pinned: laneName ? Boolean(model) : undefined,
      lane_fallback: laneName && cand.lane.kind !== wanted ? true : undefined,
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
      user_override: Boolean(s.provider || isOverride),
      rtk: rtkFor(plan, s, slot.provider),
      rtk_events: join(dir, "sessions", `${s.id}.rtk.jsonl`),
    });
  }

  const routing = {
    ts: nowISO(),
    mode: plan.mode ?? "fan-out",
    horizon_s: horizonS,
    admission,
    rtk_version: rtkVer ?? undefined,
    sessions: assigned,
  };
  writeJSON(join(dir, "routing.json"), routing);
  console.log(renderQuota(quota));
  console.log(renderRouting(routing));
  if (!admission.ok) {
    console.log(
      `\n⚠ admission: this cut needs ~${admission.demand_pct}% of plan quota and the pool holds ~${admission.supply_pct}%.` +
        `\n  Cut fewer and bigger sessions, or wait for a reset before dispatching.`,
    );
  }
  if (!wantsRtk) {
    const found = rtkVersion();
    if (found) {
      console.log(
        `\ntip: rtk ${found} is installed but this plan has no "rtk" — add "rtk": "guarded" to plan.json to filter the children's build/test/git noise (recommended; A/B in skills-catalog#27). Raise it in the graph gate.`,
      );
    }
  }
  if (arg("approve")) {
    const hash = hashPlan(plan);
    writeJSON(join(dir, "approved.json"), { hash, ts: nowISO() });
    console.log(`\nlocked: approved.json written (hash: ${hash.slice(0, 12)}...)`);
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
    .map((l) =>
      // Brackets, not a separator: these cells are printed inside a markdown
      // table, where a `|` between lanes would split the row into new columns.
      l.windows?.length
        ? `${l.name}[${renderWindows(l)}]`
        : `${l.name} ${typeof l.remaining_pct === "number" ? `${l.remaining_pct}%` : "?"}`,
    )
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
            `> ${s.key}: the ${l.name} lane (${LANE_LABEL[l.name] ?? "—"}) is ${l.bucket} at ` +
            `${l.remaining_pct}% — the other lane is still open, so route by model, not by ` +
            `dropping the slot`,
        ),
    ),
  ].join("\n");
}

// The model and the lane are one decision, so they share a cell: the model id is
// what actually decides which pool the session spends.
export function renderModel(s) {
  const model = s.model ?? (s.provider === "codex" ? resolveCodexModel(s.bin, s.account) : "default");
  const effort = s.effort ? ` ${s.effort}` : "";
  const mark = s.override ? " \u270e" : "";
  if (!s.lane) return `${model}${effort}${mark}`;
  // Antigravity's own bucket ids call the frontier pool `3p`; the tag stays in
  // each provider's vocabulary so the cell matches what its dashboard says.
  const tag = s.lane.replace("-models", "").replace("third-party", "3p");
  return `${model}${effort}${mark} [${tag}${s.lane_fallback ? "\u2193" : ""}${s.lane_pinned === false ? "*" : ""}]`;
}

function renderRouting(r) {
  const rows = r.sessions.map(
    (s) =>
      `| ${s.id} | ${s.goal?.slice(0, 40) ?? ""} | ${s.provider} | ${renderModel(s)} | ${pct(s.lane_remaining_pct ?? s.remaining_pct)} | ~${s.est_cost_pct}% | ${s.isolation} | ${(s.deps ?? []).join(",") || "—"} | ${s.not_before ? `holds ${fmtDur(Math.round((Date.parse(s.not_before) - Date.now()) / 1000))}` : "now"} | ${s.rtk && s.rtk.mode !== "off" ? `${s.rtk.mode}/${s.rtk.via}` : "—"} |`,
  );
  const legend = [];
  if (r.sessions.some((s) => s.override)) {
    legend.push("\u270e owner override (model or effort set in plan)");
  }
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
  const rootSessions = r.sessions.filter((s) => !s.deps || s.deps.length === 0);
  const parallelNote = `> **Execution Graph:** ${r.sessions.length} sessions total · **${rootSessions.length} session(s) runnable immediately in parallel**.`;
  return [
    "",
    "| Session | Goal | Provider | Model [lane] | Remaining | Est. cost | Isolation | Deps | Starts | RTK |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...rows,
    parallelNote,
    ...legend,
  ].join("\n");
}

// ---------------------------------------------------------------- dispatch

export { EFFORT_BY_TIER, DEFAULT_EFFORT };
export const AGY_EFFORT = EFFORT_BY_TIER;

export function cursorModelWithEffort(model, effort) {
  if (!model || !effort) return model;
  if (
    /-(none|minimal|low|medium|high|xhigh|max)(?:-fast)?$/i.test(model) ||
    /-(none|minimal|low|medium|high|xhigh|max)-thinking(?:-fast)?$/i.test(model) ||
    /-thinking-(none|minimal|low|medium|high|xhigh|max)(?:-fast)?$/i.test(model)
  ) {
    return model;
  }
  if (model.includes("[") && model.endsWith("]")) {
    const inside = model.slice(model.indexOf("[") + 1, -1);
    if (/effort\s*=/i.test(inside)) return model;
    return `${model.slice(0, -1)},effort=${effort}]`;
  }
  return `${model}[effort=${effort}]`;
}

// The --settings JSON that gives one Claude child the rtk hook, and only it.
export function rtkClaudeSettings(mode, eventsPath) {
  const hook = fileURLToPath(new URL("./rtk-hook.mjs", import.meta.url));
  const command = `node ${JSON.stringify(hook)} ${mode} ${JSON.stringify(eventsPath ?? "")}`;
  return JSON.stringify({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command }] }] } });
}

export function launchArgs(s, promptPath, cwd) {
  let prompt = readFileSync(promptPath, "utf8").trim();
  const effort = s.effort ?? EFFORT_BY_TIER[s.tier] ?? DEFAULT_EFFORT;
  const rtk = s.rtk ?? { mode: "off", via: "off" };
  if (rtk.via === "prompt") prompt = `${prompt}\n\n${RTK_PROMPT[rtk.mode]}`;
  switch (s.provider) {
    case "claude": {
      const a = ["-p", "--dangerously-skip-permissions", "--output-format", "text"];
      if (rtk.via === "hook") a.push("--settings", rtkClaudeSettings(rtk.mode, s.rtk_events));
      if (effort) a.push("--effort", effort);
      if (s.model) a.push("--model", s.model);
      return [s.bin, [...a, prompt]];
    }
    case "codex": {
      // --sandbox and --approve-for-me are mutually exclusive on this CLI.
      // Running with cwd set to the worktree means workspace-write is enough.
      const a = ["exec", "--sandbox", "workspace-write"];
      if (effort) a.push("-c", `model_reasoning_effort=${effort}`);
      if (s.model) a.push("-m", s.model);
      return [s.bin, [...a, prompt]];
    }
    case "cursor": {
      const a = ["-p", "--force"];
      const model = cursorModelWithEffort(s.model, effort);
      if (model) a.push("--model", model);
      return [s.bin, [...a, prompt]];
    }
    case "antigravity": {
      // `-p` is the documented headless flag and takes the prompt, so it goes
      // last. The CLI is known to hang in a non-TTY while stdin stays open,
      // which is why the dispatcher spawns every child with stdin ignored.
      // Without --add-dir agy works in its own scratch project, not the cwd;
      // --print-timeout defaults to 5m, which kills any real session.
      const a = ["--dangerously-skip-permissions", "--add-dir", cwd, "--print-timeout", "4h", "--output-format", "text"];
      if (s.model) a.push("--model", s.model);
      if (effort) a.push("--effort", effort);
      return [s.bin, [...a, "-p", prompt]];
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

const AUTH_DEATH =
  /failed to authenticate|oauth session expired|not logged in|login required|unauthorized|authentication failed|credentials? expired/i;

const QUOTA_DEATH =
  /rate.?limit|usage limit|quota|out of extra usage|session limit|too many requests|429|insufficient credits|resource.?exhausted/i;

const TERMINAL_STATUS = new Set(["done", "blocked", "failed", "abandoned"]);
const isTerminal = (st) => TERMINAL_STATUS.has(st);

// Result files are written last. A parseable terminal status is authoritative
// for reconciliation; an ambiguous file is not. "completed" is the prose form
// children actually write (`## Status\n**Completed**`).
function parseResultStatus(body) {
  const token = (raw) => {
    const k = raw.toLowerCase();
    if (k === "done" || k === "completed") return "done";
    if (k === "blocked" || k === "failed") return k;
    return null;
  };
  const inline = body.match(
    /^\s*(?:#+\s*)?-?\s*status\s*:\s*\**\s*(done|completed|blocked|failed)\b/im,
  );
  if (inline) return token(inline[1]);
  const heading = body.match(/^\s*#+\s*status\s*$/im);
  if (!heading) return null;
  const after = body.slice(heading.index + heading[0].length);
  const value = after.match(/^\s*\**\s*(done|completed|blocked|failed)\b/im);
  return value ? token(value[1]) : null;
}

export function parseResultDigest(content, exists = true) {
  if (!exists || content === null || content === undefined) {
    return { ok: false, missing: true };
  }

  // 1. status
  const status = parseResultStatus(content);
  if (!status) {
    return { ok: false, malformed: true };
  }

  // 2. remaining
  const remainingInline = content.match(/^[^\S\r\n]*(?:#+[^\S\r\n]*)?-?[^\S\r\n]*(?:remaining|remaining\s+work)[^\S\r\n]*:[^\S\r\n]*(.+)$/im);
  let remaining = remainingInline ? remainingInline[1].trim() : null;
  if (!remaining) {
    const remainingHeading = content.match(/^[^\S\r\n]*#+[^\S\r\n]*remaining(?:\s+work)?[^\S\r\n]*$/im);
    if (remainingHeading) {
      const after = content.slice(remainingHeading.index + remainingHeading[0].length);
      const firstLine = after.match(/^[^\S\r\n]*([^\n#]+)/m);
      if (firstLine) remaining = firstLine[1].trim();
    }
  }
  if (!remaining) {
    return { ok: false, malformed: true };
  }

  // 3. files changed
  const filesHeading = content.match(/^[^\S\r\n]*(?:#+[^\S\r\n]*)?-?[^\S\r\n]*(?:files\s+changed|changed\s+files)[^\S\r\n]*:[^\S\r\n]*(.*)$/im);
  let paths = [];
  if (!filesHeading) {
    const heading = content.match(/^[^\S\r\n]*#+[^\S\r\n]*(?:files\s+changed|changed\s+files)[^\S\r\n]*$/im);
    if (!heading) {
      return { ok: false, malformed: true };
    }
    const after = content.slice(heading.index + heading[0].length);
    const lines = after.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      if (/^[^\S\r\n]*#/.test(line) || /^[^\S\r\n]*-?[^\S\r\n]*(?:remaining|summary|status)[^\S\r\n]*:/i.test(line)) break;
      const bullet = line.match(/^[^\S\r\n]*-[^\S\r\n]+([^\n]+)/);
      if (bullet) {
        const raw = bullet[1].trim();
        const p = raw.split(/\s+[—–-]\s+|\s*:\s+/)[0].trim();
        if (p && p.toLowerCase() !== "none") paths.push(p);
      }
    }
  } else {
    const inlineVal = filesHeading[1]?.trim();
    if (inlineVal && inlineVal.toLowerCase() !== "none" && !inlineVal.startsWith("-")) {
      const p = inlineVal.split(/\s+[—–-]\s+|\s*:\s+/)[0].trim();
      if (p) paths.push(p);
    }
    const after = content.slice(filesHeading.index + filesHeading[0].length);
    const lines = after.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      if (/^[^\S\r\n]*#/.test(line) || /^[^\S\r\n]*-?[^\S\r\n]*(?:remaining|summary|status)[^\S\r\n]*:/i.test(line)) break;
      const bullet = line.match(/^[^\S\r\n]*-[^\S\r\n]+([^\n]+)/);
      if (bullet) {
        const raw = bullet[1].trim();
        const p = raw.split(/\s+[—–-]\s+|\s*:\s+/)[0].trim();
        if (p && p.toLowerCase() !== "none") paths.push(p);
      }
    }
  }

  // 4. summary
  const summaryInline = content.match(/^[^\S\r\n]*(?:#+[^\S\r\n]*)?-?[^\S\r\n]*summary[^\S\r\n]*:[^\S\r\n]*(.+)$/im);
  let summary = summaryInline ? summaryInline[1].trim() : null;
  if (!summary) {
    const summaryHeading = content.match(/^[^\S\r\n]*#+[^\S\r\n]*summary[^\S\r\n]*$/im);
    if (summaryHeading) {
      const after = content.slice(summaryHeading.index + summaryHeading[0].length);
      const firstLine = after.match(/^[^\S\r\n]*([^\n#]+)/m);
      if (firstLine) summary = firstLine[1].trim();
    }
  }
  if (!summary) {
    return { ok: false, malformed: true };
  }

  summary = summary.replace(/\s+/g, " ").trim().slice(0, 300);
  remaining = remaining.replace(/\s+/g, " ").trim();

  return { ok: true, status, remaining, paths, summary };
}

export function formatResultDigestBlock(session, st, parsed) {
  const wallSec = st?.started_at && st?.ended_at
    ? Math.max(0, Math.round((Date.parse(st.ended_at) - Date.parse(st.started_at)) / 1000))
    : (st?.started_at ? Math.max(0, Math.round((Date.now() - Date.parse(st.started_at)) / 1000)) : 0);
  const wall = fmtDur(wallSec);
  const lane = st?.lane ?? session?.lane;
  const slot = st?.slot ?? session?.slot ?? "unknown";
  const slotLane = lane ? `${slot}/${lane}` : slot;
  const model =
    st?.model ??
    session?.model ??
    (session?.provider === "codex" || slot.startsWith("codex")
      ? resolveCodexModel(session?.bin, session?.account)
      : "default");
  const effort = session?.effort ?? "medium";
  const status = st?.status ?? "unknown";

  const header = `${session.id} ${status} · ${slotLane} · ${model} ${effort} · ${wall}`;
  if (!parsed || parsed.missing) {
    return `${header}\n  result.md missing`;
  }
  if (parsed.malformed) {
    return `${header}\n  result.md malformed`;
  }

  const paths = parsed.paths ?? [];
  const changedStr = paths.length === 0
    ? "0 files"
    : `${paths.length} file${paths.length === 1 ? "" : "s"} (${paths.slice(0, 3).join(", ")}${paths.length > 3 ? `, +${paths.length - 3}` : ""})`;

  return [
    header,
    `  remaining: ${parsed.remaining}`,
    `  changed: ${changedStr}`,
    `  summary: ${parsed.summary}`,
  ].join("\n");
}

export function evaluateSettle({ state, settleDeadline, settleS = DEFAULT_SETTLE_S, now = Date.now() }) {
  const hasFailure = Object.values(state?.sessions ?? {}).some(
    (s) => s.status === "failed" || s.status === "blocked",
  );
  if (!hasFailure) {
    return { shouldExit: false, settleDeadline: null, active: false };
  }
  const deadline = settleDeadline ?? now + settleS * 1000;
  const shouldExit = now >= deadline;
  return {
    shouldExit,
    settleDeadline: deadline,
    active: true,
    remainingMs: Math.max(0, deadline - now),
  };
}

export function classifyExit(dir, s, code, elapsedSec = 0, cwd = null) {
  const resultPath = join(dir, "sessions", `${s.id}.result.md`);
  if (existsSync(resultPath)) {
    const parsed = parseResultStatus(readFileSync(resultPath, "utf8"));
    if (parsed) {
      if (parsed === "done" && s?.verify && (Array.isArray(s.verify) ? s.verify.length : true)) {
        const gateCwd = cwd || (existsSync(join(dir, "wt", s.id)) ? join(dir, "wt", s.id) : dir);
        const gateRes = runSessionGates(s.verify, { cwd: gateCwd, env: RTK_ENV });
        if (!gateRes.ok) {
          return {
            status: "failed",
            reason: `gate verification failed: ${gateRes.summary}`,
            gate_results: gateRes.results,
          };
        }
        return { status: "done", reason: null, gate_results: gateRes.results };
      }
      return { status: parsed, reason: null };
    }
  }
  const tail = tailOf(join(dir, "logs", `${s.id}.log`));
  // P2: Auth failure or immediate launch crash (< 15s)
  if (AUTH_DEATH.test(tail)) {
    return { status: "auth_death", reason: "provider authentication failed or expired" };
  }
  if (elapsedSec <= 15 && code !== 0) {
    return { status: "launch_fail", reason: `exited immediately (${elapsedSec}s) with code ${code}` };
  }
  if (QUOTA_DEATH.test(tail)) return { status: "quota", reason: "provider quota exhausted" };
  if (code === 0) return { status: "failed", reason: "exited 0 without writing a result file" };
  return { status: "failed", reason: `exit ${code}` };
}

// A later `status`/`dispatch` has no child `exit` listener — the previous
// dispatch process is gone, and the provider may still be alive. If a running
// session already wrote a terminal result, that file wins. Already-terminal
// failed/blocked/done/abandoned is left alone, including when the file is
// ambiguous or even clearly done.
export function reconcileFromResults(dir, routing, state) {
  let changed = false;
  for (const s of routing?.sessions ?? []) {
    const st = state.sessions[s.id];
    if (!st || st.status !== "running" || st.parent_correction) continue;
    const resultPath = join(dir, "sessions", `${s.id}.result.md`);
    if (!existsSync(resultPath)) continue;
    const parsed = parseResultStatus(readFileSync(resultPath, "utf8"));
    if (!parsed) continue;
    let finalStatus = parsed;
    let reason = null;
    let gateResults = null;
    if (parsed === "done" && s?.verify && (Array.isArray(s.verify) ? s.verify.length : true)) {
      const gateCwd = st.cwd || (existsSync(join(dir, "wt", s.id)) ? join(dir, "wt", s.id) : dir);
      const gateRes = runSessionGates(s.verify, { cwd: gateCwd, env: RTK_ENV });
      if (!gateRes.ok) {
        finalStatus = "failed";
        reason = `gate verification failed: ${gateRes.summary}`;
      }
      gateResults = gateRes.results;
      st.gate_results = gateResults;
    }
    st.status = finalStatus;
    if (reason) st.reason = reason;
    st.ended_at ??= nowISO();
    state.events.push(
      `${nowISO()} ${s.id} ${finalStatus}${reason ? `: ${reason}` : ""} (result file)`,
    );
    changed = true;
  }
  return changed;
}

export function loadState(dir) {
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

// P19: Supported parent correction mechanism that survives subsequent dispatcher writes
export function markSession(dir, id, status, { note = null } = {}) {
  const validStatuses = ["done", "failed", "blocked", "pending"];
  if (!validStatuses.includes(status)) {
    die(`invalid status '${status}'. Must be one of: ${validStatuses.join(", ")}`);
  }
  const statePath = join(dir, "state.json");
  const state = loadState(dir);
  state.sessions[id] ??= {};
  const prevStatus = state.sessions[id].status ?? "unknown";

  state.sessions[id].status = status;
  state.sessions[id].parent_correction = {
    previous_status: prevStatus,
    status,
    note: note || null,
    ts: nowISO(),
  };
  if (note) state.sessions[id].note = note;
  if (status === "done" && !state.sessions[id].ended_at) {
    state.sessions[id].ended_at = nowISO();
  }

  const notePart = note ? `: ${note}` : "";
  const eventMsg = `${nowISO()} ${id} marked ${status} by parent (was ${prevStatus})${notePart}`;
  state.events.push(eventMsg);

  writeJSON(statePath, state);
  console.log(`marked session ${id} as ${status}${note ? ` (${note})` : ""}`);
  return state;
}

// Merge state from disk before dispatcher writes so parent corrections persist
export function mergeStateFromDisk(dir, state) {
  const onDisk = readJSON(join(dir, "state.json"));
  if (!onDisk) return state;

  // Merge events: append any disk events not yet in memory
  if (Array.isArray(onDisk.events)) {
    const existing = new Set(state.events);
    for (const ev of onDisk.events) {
      if (!existing.has(ev)) {
        state.events.push(ev);
        existing.add(ev);
      }
    }
  }

  // Merge empty_slots
  if (Array.isArray(onDisk.empty_slots)) {
    for (const slot of onDisk.empty_slots) {
      if (!state.empty_slots.includes(slot)) state.empty_slots.push(slot);
    }
  }

  // Merge sessions
  if (onDisk.sessions && typeof onDisk.sessions === "object") {
    for (const [id, diskSess] of Object.entries(onDisk.sessions)) {
      const memSess = state.sessions[id];
      if (!memSess) {
        state.sessions[id] = diskSess;
        continue;
      }

      // If disk has an explicit parent correction, disk wins unconditionally!
      if (diskSess.parent_correction) {
        memSess.status = diskSess.status;
        memSess.parent_correction = diskSess.parent_correction;
        if (diskSess.note) memSess.note = diskSess.note;
        if (diskSess.ended_at) memSess.ended_at = diskSess.ended_at;
        continue;
      }

      // If status changed on disk (e.g. manual edit or parent intervention)
      if (diskSess.status !== memSess.status) {
        const wasTerminal = isTerminal(diskSess.status);
        if (wasTerminal || memSess.status === "running" || memSess.status === "pending") {
          memSess.status = diskSess.status;
          if (diskSess.note) memSess.note = diskSess.note;
          if (diskSess.ended_at) memSess.ended_at = diskSess.ended_at;
          const correctionEv = `${nowISO()} ${id} corrected to ${diskSess.status} from disk${diskSess.note ? `: ${diskSess.note}` : ""}`;
          if (!state.events.some((e) => e.includes(`${id} corrected to ${diskSess.status}`))) {
            state.events.push(correctionEv);
          }
        }
      }
    }
  }

  return state;
}

export function saveState(dir, state) {
  mergeStateFromDisk(dir, state);
  writeJSON(join(dir, "state.json"), state);
}

async function dispatch(dir) {
  const routing = readJSON(join(dir, "routing.json"));
  if (!routing) die("routing.json missing — run `handoff route --run DIR` first");
  const quota = readJSON(join(dir, "quota.json"));
  if (!quota || secsSince(quota.ts) > PROBE_TTL_S) {
    die("quota.json missing or stale — run `handoff probe --run DIR` first");
  }
  const isCompact = routing.mode === "compact" || routing.sessions.length === 1;
  if (!isCompact) {
    const approvedPath = join(dir, "approved.json");
    if (!existsSync(approvedPath)) {
      die("dispatch refused: approved.json is missing. Run `handoff route --run DIR --approve` first.");
    }
    const approved = readJSON(approvedPath);
    const plan = readJSON(join(dir, "plan.json"));
    const currentHash = hashPlan(plan);
    if (!approved?.hash || approved.hash !== currentHash) {
      die(
        "dispatch refused: plan.json sessions content has changed since approval (hash mismatch). Re-run `handoff route --run DIR --approve`.",
      );
    }
  }

  const budgetS = Number(arg("budget", 540));
  const settleS = Number(arg("settle", DEFAULT_SETTLE_S));
  const deadline = Date.now() + budgetS * 1000;
  let settleDeadline = null;
  const state = loadState(dir);
  state.settle_s = settleS;
  state.parent_turns += 1;
  mkdirSync(join(dir, "logs"), { recursive: true });

  const byId = new Map(routing.sessions.map((s) => [s.id, s]));
  for (const s of routing.sessions) {
    state.sessions[s.id] ??= { status: "pending", attempts: 0, slot: s.slot, lane: s.lane };
  }

  const live = new Map(); // id -> child process

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
      if (
        !q.installed ||
        q.bucket === "empty" ||
        q.auth_expired ||
        dead.has(q.key) ||
        dead.has(q.provider)
      ) {
        continue;
      }
      if (!slotSatisfiesNeeds(q.provider, s.needs)) continue;
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
    s.model = best.lane ? pickModelForLane(best.q.bin, best.q.provider, best.lane) : null;
    s.lane_pinned = best.lane ? Boolean(s.model) : undefined;
    return s;
  };

  while (Date.now() < deadline) {
    mergeStateFromDisk(dir, state);
    reconcileFromResults(dir, routing, state);

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
        const [bin, args] = launchArgs(s, promptPath, cwd);
        const logFd = openSync(join(dir, "logs", `${s.id}.log`), "a");
        const child = spawn(bin, args, {
          cwd,
          env: RTK_ENV,
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
        st.cwd = cwd;
        st.rtk = s.rtk;
        st.attempts += 1;
        live.set(s.id, child);
        state.events.push(
          `${nowISO()} ${s.id} launched on ${s.lane ? `${s.slot}/${s.lane}` : s.slot} pid ${child.pid}`,
        );
        // `spawn` reports a missing or unexecutable binary asynchronously, as an
        // `error` event — never as a throw the try/catch below could see. With no
        // listener Node rethrows it as an unhandled `error`, which kills the
        // dispatcher and abandons every other session in the run. A slot whose CLI
        // is simply not installed is an ordinary launch failure, so it takes the
        // same dead-lane-and-reroute path as any other.
        let settled = false;
        const settle = (verdict) => {
          live.delete(s.id);
          if (settled) return;
          settled = true;
          if (st.parent_correction) {
            saveState(dir, state);
            return;
          }
          if (isTerminal(st.status)) {
            saveState(dir, state);
            return;
          }
          st.ended_at = nowISO();
          if (verdict.gate_results) {
            st.gate_results = verdict.gate_results;
          }
          if (
            verdict.status === "quota" ||
            verdict.status === "auth_death" ||
            verdict.status === "launch_fail"
          ) {
            // Mark the lane that died, not the whole slot: blacklisting `cursor`
            // because Other Models ran out throws away a pool that is still full.
            const deadKey = st.lane ? `${st.slot}/${st.lane}` : st.slot;
            if (!state.empty_slots.includes(deadKey)) state.empty_slots.push(deadKey);
            const isLaunchFail = verdict.status === "auth_death" || verdict.status === "launch_fail";
            state.events.push(
              `${nowISO()} ${s.id} died: ${deadKey} ${verdict.reason}${isLaunchFail ? " (launch_fail)" : ""}`,
            );
            if (st.attempts < 3 && reassign(s)) {
              st.status = "pending"; // relaunch on another slot next tick
              state.events.push(
                `${nowISO()} ${s.id} rerouted to ${s.lane ? `${s.slot}/${s.lane}` : s.slot}`,
              );
            } else {
              st.status = "blocked";
              st.reason =
                verdict.status === "quota"
                  ? "no slot with quota left"
                  : `launch failure on all candidates: ${verdict.reason}`;
            }
          } else {
            st.status = verdict.status;
            st.reason = verdict.reason ?? undefined;
            state.events.push(
              `${nowISO()} ${s.id} ${verdict.status}${verdict.reason ? `: ${verdict.reason}` : ""}`,
            );
          }
          saveState(dir, state);
        };
        // Both can fire for one failed spawn, in either order; `settle` is
        // idempotent so whichever arrives first decides.
        child.on("error", (err) => {
          // Name the binary and the errno: a reason of "exited immediately with
          // code -1" would hide that the CLI is simply not on PATH.
          settle({
            status: "launch_fail",
            reason: `could not launch ${bin}: ${err?.code ?? err?.message ?? "spawn failed"}`,
          });
        });
        child.on("exit", (code) => {
          const elapsedSec = st.started_at
            ? Math.max(0, Math.round((Date.now() - Date.parse(st.started_at)) / 1000))
            : 0;
          settle(classifyExit(dir, s, code ?? -1, elapsedSec, cwd));
        });
      } catch (e) {
        st.status = "failed";
        st.reason = e.message;
        state.events.push(`${nowISO()} ${s.id} launch_fail: ${e.message}`);
      }
    }

    saveState(dir, state);

    const all = routing.sessions.map((s) => state.sessions[s.id]);
    if (all.every((st) => isTerminal(st.status))) break;
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

    const settle = evaluateSettle({ state, settleDeadline, settleS, now: Date.now() });
    settleDeadline = settle.settleDeadline;
    if (settle.shouldExit) {
      state.events.push(
        `${nowISO()} settle window (${settleS}s) elapsed after failure; returning early`,
      );
      break;
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  saveState(dir, state);
  console.log(renderStatus(dir, routing, state));
  const pending = routing.sessions.filter((s) => !isTerminal(state.sessions[s.id].status));
  if (pending.length) {
    console.log(
      `\nstill running: ${pending.map((s) => s.id).join(", ")} — call \`handoff dispatch --run ${dir}\` again.`,
    );
  } else {
    console.log(`\nall sessions terminal — run \`handoff score --run ${dir}\`.`);
  }
}

export function renderStatus(dir, routing, state) {
  const rows = routing.sessions.map((s) => {
    const st = state.sessions[s.id] ?? {};
    const res = join(dir, "sessions", `${s.id}.result.md`);
    let summary = st.note ?? st.reason ?? "";
    if (!summary && existsSync(res)) {
      // One line only. The result file's own body stays out of the model's
      // context unless the model decides to open it.
      summary = (readFileSync(res, "utf8").match(/^\s*-?\s*summary:\s*(.+)$/mi)?.[1] ?? "").slice(0, 70);
    }
    const lane = st.lane ?? s.lane;
    return `| ${s.id} | ${st.status ?? "pending"} | ${st.slot ?? s.slot}${lane ? `/${lane}` : ""} | ${st.attempts ?? 0} | ${summary} |`;
  });
  const table = ["", "| Session | Status | Slot | Tries | Note |", "|---|---|---|---|---|", ...rows].join("\n");

  const digestBlocks = [];
  for (const s of routing.sessions) {
    const st = state.sessions[s.id];
    if (!st || !isTerminal(st.status)) continue;
    const res = join(dir, "sessions", `${s.id}.result.md`);
    const exists = existsSync(res);
    const parsed = exists
      ? parseResultDigest(readFileSync(res, "utf8"), true)
      : parseResultDigest(null, false);
    digestBlocks.push(formatResultDigestBlock(s, st, parsed));
  }

  if (digestBlocks.length) {
    return `${table}\n\n${digestBlocks.join("\n\n")}`;
  }
  return table;
}

// ------------------------------------------------------------------- score

// Per-session rtk evidence: rewrites and recalls come from the hook log (a
// Claude child), filtered bytes from RTK's history under the session's cwd.
// A prompt-mode child has no hook, so its recalls are unknown (null).
export function sessionRtk(s, st, historyOpts = {}) {
  const r = st?.rtk ?? s.rtk ?? { mode: "off", via: "off" };
  if (r.mode === "off") return { mode: "off", via: "off" };
  let rewrites = null;
  let recalls = null;
  if (r.via === "hook") {
    const lines = existsSync(s.rtk_events ?? "")
      ? readFileSync(s.rtk_events, "utf8").split("\n").filter(Boolean)
      : [];
    const events = lines.map((l) => { try { return JSON.parse(l); } catch { return {}; } });
    rewrites = events.filter((e) => e.event === "rewrite").length;
    recalls = events.filter((e) => e.event === "recall").length;
  }
  const history = st?.cwd && st?.started_at
    ? historyStats({ project: st.cwd, since: st.started_at, until: st.ended_at ?? nowISO(), ...historyOpts })
    : null;
  return { mode: r.mode, via: r.via, rewrites, recalls, history, shared_cwd: s.isolation === "cwd" || undefined };
}

export function buildParentTurnsByCause(state) {
  const base = {
    env_precondition: 0,
    dead_slot: 0,
    scope_conflict: 0,
    verify_by_hand: 0,
    disk: 0,
    other: 0,
  };
  if (state?.empty_slots?.length) {
    base.dead_slot = state.empty_slots.length;
  }
  if (state?.parent_turns_by_cause && typeof state.parent_turns_by_cause === "object") {
    for (const [k, v] of Object.entries(state.parent_turns_by_cause)) {
      if (typeof v === "number") base[k] = v;
    }
  } else {
    const known = base.dead_slot;
    base.other = Math.max(0, (state?.parent_turns ?? 0) - known);
  }
  return base;
}

export async function score(dir) {
  const routing = readJSON(join(dir, "routing.json"));
  const before = readJSON(join(dir, "quota.json"));
  const state = loadState(dir);
  if (!routing || !before) die("routing.json or quota.json missing");

  const run = basename(resolve(dir));
  const st = (id) => state.sessions[id] ?? {};
  const decisionSummary = resolveDecisions(run, (row) => {
    let sid = row.session;
    if (!sid && row.context) {
      try {
        const parsed = JSON.parse(row.context);
        sid = parsed.session ?? parsed.id;
      } catch {
        const m = row.context.match(/\b(?:session|id)\s*[:=]\s*["']?([a-zA-Z0-9_-]+)["']?/);
        if (m) sid = m[1];
      }
    }
    if (!sid && routing.sessions.length === 1) {
      sid = routing.sessions[0].id;
    }
    if (sid) {
      const sState = st(sid);
      if (sState?.status && ["done", "failed", "blocked", "abandoned"].includes(sState.status)) {
        return {
          observed: sState.status,
          status: sState.status,
          attempts: sState.attempts ?? 1,
        };
      }
    }
    return { unresolved: true };
  });

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

  const done = routing.sessions.filter((s) => st(s.id).status === "done");
  const providersUsed = [...new Set(routing.sessions.map((s) => st(s.id).slot).filter(Boolean))];
  const providersAvail = before.slots.filter((s) => s.installed).map((s) => s.key);
  const wall = Math.round(secsSince(state.started_at));

  const metrics = {
    skill: "handoff",
    ts: nowISO(),
    skill_version: skillVersion(),
    mode: routing.mode,
    settle_s: state.settle_s ?? DEFAULT_SETTLE_S,
    n_sessions: routing.sessions.length,
    n_done: done.length,
    wall_clock_s: wall,
    parent_turns: state.parent_turns,
    parent_turns_by_cause: buildParentTurnsByCause(state),
    providers_available: providersAvail,
    providers_used: providersUsed,
    quota_delta_pct: cost,
    session_cost_pct: sessionCost,
    rtk_version: routing.rtk_version ?? null,
    sessions: routing.sessions.map((s) => ({
      id: s.id,
      effort: s.effort ?? EFFORT_BY_TIER[s.tier] ?? DEFAULT_EFFORT,
      override: Boolean(s.override),
      rtk: sessionRtk(s, st(s.id)),
    })),
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
    decisions: decisionSummary,
    decision_summary: decisionSummary,
    unresolved_decisions: decisionSummary.unresolved,
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
    `Wall clock ${fmtDur(wall)} across ${state.parent_turns} parent turn(s) (${Object.entries(metrics.parent_turns_by_cause).map(([k, v]) => `${k}:${v}`).join(", ")}).`,
    `Decisions: ${decisionSummary.total} (${decisionSummary.resolved} resolved, ${decisionSummary.unresolved} unresolved).`,
    ...metrics.sessions
      .filter((x) => x.rtk.mode !== "off")
      .map((x) => {
        const h = x.rtk.history;
        return `rtk ${x.id} ${x.rtk.mode}/${x.rtk.via}: ${x.rtk.rewrites ?? "?"} rewrites, ${x.rtk.recalls ?? "?"} recalls` +
          (h ? `, ${h.commands} filtered, ${h.input_tokens} → ${h.output_tokens} tokens (RTK estimate)` : ", no RTK history") +
          (x.rtk.shared_cwd ? " — shares the parent cwd, history not attributable" : "");
      }),
  ];
  appendFileSync(join(dir, "manifest.md"), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  console.log(`\nappended: ${jsonl}`);
}

// ------------------------------------------------------------------- clean

export function clean(dir, { branches = false } = {}) {
  if (!dir || !existsSync(dir)) die(`clean: directory not found: ${dir}`);
  const wtDir = join(dir, "wt");
  const worktrees = [];
  if (existsSync(wtDir)) {
    const entries = readdirSync(wtDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const wtPath = join(wtDir, entry.name);
        worktrees.push(wtPath);
        const st = spawnSync("git", ["status", "--porcelain"], {
          cwd: wtPath,
          encoding: "utf8",
        });
        if (st.status !== 0) {
          die(`clean refused: git status failed in worktree ${wtPath}: ${st.stderr?.trim()}`);
        }
        if (st.stdout && st.stdout.trim().length > 0) {
          die(`clean refused: worktree ${wtPath} has uncommitted changes:\n${st.stdout.trim()}`);
        }
      }
    }
  }

  for (const wtPath of worktrees) {
    const rm = spawnSync("git", ["worktree", "remove", wtPath], { encoding: "utf8" });
    if (rm.status !== 0) {
      const rmForce = spawnSync("git", ["worktree", "remove", "--force", wtPath], {
        encoding: "utf8",
      });
      if (rmForce.status !== 0) {
        die(`clean failed: git worktree remove ${wtPath}: ${rm.stderr || rmForce.stderr}`);
      }
    }
  }

  rmSync(dir, { recursive: true, force: true });
  console.log(`cleaned: ${dir}`);
  if (branches) cleanBranches(basename(resolve(dir)));
}

// Session branches are intermediate once the run is merged into one branch.
// `git branch -d` only deletes a branch already merged into HEAD, so run this
// from the integration branch; anything unmerged is kept and named.
export function cleanBranches(runId) {
  const ls = spawnSync(
    "git",
    ["for-each-ref", "--format=%(refname:short)", `refs/heads/handoff/${runId}-*`],
    { encoding: "utf8" },
  );
  const found = ls.stdout.split("\n").filter(Boolean);
  const kept = [];
  for (const b of found) {
    const r = spawnSync("git", ["branch", "-d", b], { encoding: "utf8" });
    if (r.status === 0) console.log(`deleted branch: ${b}`);
    else kept.push(b);
  }
  if (kept.length) console.log(`kept (not merged into HEAD): ${kept.join(", ")}`);
  return { deleted: found.length - kept.length, kept };
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

const isCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCLI) {
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
    const routing = readJSON(join(dir, "routing.json"));
    const state = loadState(dir);
    if (reconcileFromResults(dir, routing, state)) saveState(dir, state);
    console.log(renderStatus(dir, routing, state));
  } else if (cmd === "mark") {
    const dir = runDir();
    const positionals = [];
    for (let i = 3; i < process.argv.length; i++) {
      const a = process.argv[i];
      if (a.startsWith("--")) {
        if ((a === "--run" || a === "--note") && i + 1 < process.argv.length && !process.argv[i + 1].startsWith("--")) {
          i++;
        }
      } else {
        positionals.push(a);
      }
    }
    const id = positionals[0];
    const status = positionals[1];
    const note = arg("note");
    if (!id || !status) {
      die("usage: handoff mark [--run DIR] <session-id> <status> [--note NOTE]");
    }
    markSession(dir, id, status, { note });
  } else if (cmd === "score") {
    await score(runDir());
  } else if (cmd === "clean") {
    clean(runDir(), { branches: process.argv.includes("--branches") });
  } else {
    console.log(
      `handoff — orchestration for the handoff skill

  probe    [--run DIR] [--json] [--explain]
                                    supply snapshot per slot; --explain lists
                                    every credential and transcript path tried
  route    --run DIR [--approve]    admission control + assignment (refuses overlapping writers)
  dispatch --run DIR [--budget S] [--settle S]
                                    launch ready sessions, wait, reroute on quota death
  status   --run DIR                one line per session + result digest blocks
  mark     [--run DIR] <id> <status> [--note NOTE]
                                    durable parent correction; records event and unblocks dependents
  score    --run DIR                cost + defect scorecard, appends metrics.jsonl
  clean    --run DIR [--branches]   remove clean worktrees and run dir; --branches also
                                   deletes this run's session branches merged into HEAD
`,
    );
  }
}

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

const PROVIDERS = {
  claude: {
    bin: ["claude"],
    creds: () => join(homedir(), ".claude", ".credentials.json"),
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
      return pickTightest(
        windows.map(([name, w, secs]) => ({
          window: name,
          remaining_pct: 100 - w.utilization,
          resets_at: w.resets_at ?? null,
          window_secs: secs,
        })),
      );
    },
  },
  codex: {
    bin: ["codex"],
    creds: () => join(homedir(), ".codex", "auth.json"),
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
          window: w.limit_window_seconds === 604800 ? "weekly" : "session",
          remaining_pct: 100 - w.used_percent,
          resets_at: w.reset_at ? new Date(w.reset_at * 1000).toISOString() : null,
          window_secs: w.limit_window_seconds ?? null,
        }));
      if (!windows.length) return { error: "no rate_limit windows in response" };
      return pickTightest(windows);
    },
  },
  cursor: {
    bin: ["cursor-agent", "agent"],
    // The headless CLI's own credential. The IDE's sqlite state.vscdb is read
    // only when `sqlite3` happens to be present — handoff launches the headless
    // agent, so its auth.json is the credential that matters.
    creds: () => join(homedir(), ".config", "cursor", "auth.json"),
    usagebarIds: ["cursor"],
    async fetchUsage(creds) {
      const token =
        creds?.accessToken ?? creds?.access_token ?? readCursorIdeToken();
      if (!token) return null;
      const r = await fetch("https://cursor.com/api/usage-summary", {
        headers: {
          Cookie: `WorkosCursorSessionToken=${token}`,
          Origin: "https://cursor.com",
          Referer: "https://cursor.com/dashboard",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        },
      });
      if (!r.ok) return { error: `HTTP ${r.status}` };
      const j = await r.json();
      if (j.isUnlimited) {
        return { window: "unlimited", remaining_pct: 100, resets_at: null, window_secs: null };
      }
      // Shape: individualUsage.plan.{auto,api,total}PercentUsed, and the same
      // under teamUsage for a seat on a team plan. The billing cycle is the
      // window, so its end is the reset.
      const plan = j.individualUsage?.plan ?? j.teamUsage?.plan ?? null;
      const pct = plan?.totalPercentUsed ?? plan?.autoPercentUsed ?? null;
      if (typeof pct !== "number") return { error: "no plan usage in response" };
      const end = j.billingCycleEnd ? Date.parse(j.billingCycleEnd) : NaN;
      const start = j.billingCycleStart ? Date.parse(j.billingCycleStart) : NaN;
      return {
        window: "billing_cycle",
        remaining_pct: Math.round(100 - pct),
        resets_at: Number.isFinite(end) ? new Date(end).toISOString() : null,
        window_secs:
          Number.isFinite(end) && Number.isFinite(start)
            ? Math.round((end - start) / 1000)
            : null,
      };
    },
  },
};

function pickTightest(windows) {
  // Tightest = least remaining. A provider is as free as its most binding limit.
  return windows.reduce((a, b) => (b.remaining_pct < a.remaining_pct ? b : a));
}

function readCursorIdeToken() {
  if (!which("sqlite3")) return null;
  const candidates = [
    join(homedir(), "Library", "Application Support", "Cursor", "User", "globalStorage", "state.vscdb"),
    join(homedir(), ".config", "Cursor", "User", "globalStorage", "state.vscdb"),
  ];
  for (const db of candidates) {
    if (!existsSync(db)) continue;
    const r = spawnSync(
      "sqlite3",
      [db, "SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'"],
      { encoding: "utf8" },
    );
    const v = (r.stdout || "").trim();
    if (v) return v;
  }
  return null;
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
    const w = pickTightest(
      metrics.map((m) => ({
        window: m.label,
        remaining_pct: 100 - m.percent,
        resets_at: m.reset_at ?? null,
        window_secs: m.window_secs ?? null,
      })),
    );
    // `id` is "vendor" or "vendor:account" — the account half is the slot key.
    out.push({ account: id.includes(":") ? id.split(":")[1] : "default", ...w });
  }
  return out.length ? out : null;
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
      for (const w of viaBar) {
        slots.push({
          key: w.account === "default" ? name : `${name}:${w.account}`,
          provider: name, account: w.account, installed: true, bin,
          remaining_pct: w.remaining_pct, window: w.window,
          resets_at: w.resets_at, window_secs: w.window_secs,
          bucket: bucketOf(w.remaining_pct), source: "ai-usagebar",
        });
      }
      continue;
    }

    let result = null, note = "";
    const credPath = p.creds();
    const creds = readJSON(credPath);
    if (!creds) {
      note = `no credential at ${credPath} — run \`${bin}\` once to log in`;
    } else {
      try {
        result = await p.fetchUsage(creds);
        if (result?.error) {
          note = `${result.error} — token may be expired; run \`${bin}\` once`;
          result = null;
        }
      } catch (e) {
        note = `probe failed: ${e.message}`;
      }
    }

    slots.push({
      key: name, provider: name, account: "default", installed: true, bin,
      remaining_pct: result?.remaining_pct ?? null,
      window: result?.window ?? null,
      resets_at: result?.resets_at ?? null,
      window_secs: result?.window_secs ?? null,
      bucket: bucketOf(result?.remaining_pct),
      source: result ? `${name}-oauth` : "probe failed",
      note: note || undefined,
    });
  }

  return { ts: nowISO(), low_pct: LOW_PCT, slots };
}

// A slot that is poor now but whose window reopens inside the run horizon is
// rich over the horizon. It is eligible — just not yet. That distinction is the
// difference between waiting ten minutes and burning a session on a wall.
function refillsInHorizon(slot, horizonS) {
  const r = resetsInS(slot);
  return r !== null && slot.window_secs !== null && r <= horizonS;
}

function resetsInS(slot) {
  if (!slot.resets_at) return null;
  const s = (Date.parse(slot.resets_at) - Date.now()) / 1000;
  return Number.isFinite(s) ? Math.max(0, Math.round(s)) : null;
}

// Weight by rate, not stock. A 5h window that refills inside the run horizon is
// cheap to spend now; a weekly window at 30% is not. `unknown` gets a neutral
// 50 so an unprobed provider still takes a share instead of being starved.
function effectiveSupply(slot, horizonS) {
  if (slot.bucket === "absent" || slot.bucket === "empty") return 0;
  if (slot.remaining_pct === null) return 50;
  let supply = slot.remaining_pct;
  const r = resetsInS(slot);
  if (r !== null && slot.window_secs && r <= horizonS) {
    const after = horizonS - r;
    supply += 100 * (1 + Math.floor(after / slot.window_secs));
  }
  return Math.max(0, supply);
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

  // Weighted assignment: minimise projected utilisation of each slot.
  const load = Object.fromEntries(pool.map((p) => [p.key, 0]));
  const assigned = [];
  for (const s of [...plan.sessions].sort((a, b) => a.id.localeCompare(b.id))) {
    const size = s.size ?? "m";
    let slot;
    if (s.provider) {
      slot = pool.find((p) => p.key === s.provider || p.provider === s.provider)
        ?? eligible.find((p) => p.provider === s.provider);
      if (!slot) die(`session ${s.id} names provider ${s.provider}, which is absent`);
    } else {
      slot = pool
        .map((p) => ({ p, score: (load[p.key] + estimateCost(p.provider, size, history)) / p.supply }))
        .sort((a, b) => a.score - b.score)[0].p;
    }
    load[slot.key] += estimateCost(slot.provider, size, history);
    assigned.push({
      ...s,
      size,
      slot: slot.key,
      provider: slot.provider,
      account: slot.account,
      bin: slot.bin,
      model: s.model ?? null,
      remaining_pct: slot.remaining_pct,
      isolation: (s.writes ?? []).length ? `wt/${s.id}` : "cwd",
      brief: join(dir, "sessions", `${s.id}.md`),
      est_cost_pct: estimateCost(slot.provider, size, history),
      // Assigned on its post-reset supply: do not launch it before then.
      not_before:
        slot.remaining_pct !== null && slot.remaining_pct < LOW_PCT && slot.resets_at
          ? slot.resets_at
          : null,
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

function renderQuota(quota) {
  const rows = quota.slots.map(
    (s) =>
      `| ${s.key} | ${pct(s.remaining_pct)} | ${s.bucket} | ${s.window ?? "—"} | ${fmtDur(resetsInS(s))} | ${s.source} |`,
  );
  return [
    "",
    "| Slot | Remaining | Bucket | Window | Resets in | Source |",
    "|---|---|---|---|---|---|",
    ...rows,
    ...quota.slots.filter((s) => s.note).map((s) => `> ${s.key}: ${s.note}`),
  ].join("\n");
}

function renderRouting(r) {
  const rows = r.sessions.map(
    (s) =>
      `| ${s.id} | ${s.goal?.slice(0, 40) ?? ""} | ${s.provider} | ${s.model ?? "default"} | ${pct(s.remaining_pct)} | ~${s.est_cost_pct}% | ${s.isolation} | ${(s.deps ?? []).join(",") || "—"} | ${s.not_before ? `holds ${fmtDur(Math.round((Date.parse(s.not_before) - Date.now()) / 1000))}` : "now"} |`,
  );
  return [
    "",
    "| Session | Goal | Provider | Model | Remaining | Est. cost | Isolation | Deps | Starts |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows,
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
    state.sessions[s.id] ??= { status: "pending", attempts: 0, slot: s.slot };
  }

  const live = new Map(); // id -> child process

  const terminal = (st) => ["done", "blocked", "failed", "abandoned"].includes(st);
  const depsDone = (s) =>
    (s.deps ?? []).every((d) => state.sessions[d]?.status === "done");

  const reassign = (s) => {
    // The slot died. Pick the next eligible one rather than waiting for it.
    const dead = new Set(state.empty_slots);
    const pool = quota.slots.filter(
      (q) => q.installed && q.bucket !== "empty" && !dead.has(q.key),
    );
    if (!pool.length) return null;
    const horizon = routing.horizon_s ?? 7200;
    const best = pool
      .map((q) => ({ q, supply: effectiveSupply(q, horizon) }))
      .filter((x) => x.supply > 0)
      .sort((a, b) => b.supply - a.supply)[0];
    if (!best) return null;
    s.slot = best.q.key;
    s.provider = best.q.provider;
    s.bin = best.q.bin;
    s.model = null; // model ids do not travel across providers
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
        st.started_at = nowISO();
        st.attempts += 1;
        live.set(s.id, child);
        state.events.push(`${nowISO()} ${s.id} launched on ${s.slot} pid ${child.pid}`);
        child.on("exit", (code) => {
          const verdict = classifyExit(dir, s, code ?? -1);
          live.delete(s.id);
          st.ended_at = nowISO();
          if (verdict.status === "quota") {
            if (!state.empty_slots.includes(st.slot)) state.empty_slots.push(st.slot);
            state.events.push(`${nowISO()} ${s.id} died: ${st.slot} quota exhausted`);
            if (st.attempts < 3 && reassign(s)) {
              st.status = "pending"; // relaunch on another slot next tick
              state.events.push(`${nowISO()} ${s.id} rerouted to ${s.slot}`);
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
    return `| ${s.id} | ${st.status ?? "pending"} | ${st.slot ?? s.slot} | ${st.attempts ?? 0} | ${summary} |`;
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
    `Cost of this run, in plan quota: ${
      Object.entries(cost).map(([k, v]) => `${k} −${v}pt`).join(", ") || "not measurable (probes were unknown)"
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

  probe    [--run DIR] [--json]     supply snapshot per slot
  route    --run DIR                admission control + assignment (refuses overlapping writers)
  dispatch --run DIR [--budget S]   launch ready sessions, wait, reroute on quota death
  status   --run DIR                one line per session
  score    --run DIR                cost + defect scorecard, appends metrics.jsonl
`,
  );
}

#!/usr/bin/env node
// Local usage accounting — quota estimated from the transcripts the CLIs write
// on this machine, with no credential and no network call.
//
// The method is ccusage's (github.com/ccusage/ccusage): every coding CLI writes
// a JSONL transcript per session that records token usage per turn, and those
// turns group into the same rolling five-hour windows the plans bill against.
// Read the transcripts, rebuild the windows, and you know how much of the
// current window you have spent without asking anyone.
//
// Why this exists here: an OAuth probe fails for reasons the user cannot act on
// — a token that moved to the system keychain, a login that wrote to a path this
// script does not know, an endpoint that changed shape. Every one of those ends
// in `unknown`, and a run routed on `unknown` learns each provider's real limit
// by killing a session on it. The transcripts are still on disk in all of those
// cases.
//
// What it is not: the account's real limit. There is no plan quota in a
// transcript. The denominator here is the largest completed window this machine
// has actually produced, so the number answers "how heavy is this window
// against my own heaviest" — a proxy, always reported as estimated.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HOUR_MS = 3600_000;
const BLOCK_MS = 5 * HOUR_MS;

// Bounds, so a probe stays a probe. Transcripts grow without limit and nothing
// here needs the whole history: newest files first, stop at either bound.
const DEFAULT_DAYS = 7;
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

const csvEnv = (name) =>
  (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// CLAUDE_CONFIG_DIR takes one path or a comma-separated list; without it both
// well-known roots are read and combined.
export function claudeConfigDirs() {
  const fromEnv = csvEnv("CLAUDE_CONFIG_DIR");
  if (fromEnv.length) return fromEnv;
  return [join(homedir(), ".config", "claude"), join(homedir(), ".claude")];
}

export function codexHomes() {
  const fromEnv = csvEnv("CODEX_HOME");
  if (fromEnv.length) return fromEnv;
  return [join(homedir(), ".codex")];
}

function walkJsonl(root, out = [], depth = 0) {
  if (depth > 8 || !existsSync(root)) return out;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(root, e.name);
    // Never follow a symlink out of the tree being scanned.
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) walkJsonl(p, out, depth + 1);
    else if (e.isFile() && e.name.endsWith(".jsonl")) {
      try {
        const st = statSync(p);
        out.push({ path: p, mtime: st.mtimeMs, size: st.size });
      } catch {
        /* vanished mid-walk */
      }
    }
  }
  return out;
}

function selectFiles(roots, { days, maxBytes }) {
  const cutoff = Date.now() - days * 24 * HOUR_MS;
  const all = roots.flatMap((r) => walkJsonl(r));
  all.sort((a, b) => b.mtime - a.mtime);
  const picked = [];
  let bytes = 0;
  let truncated = false;
  for (const f of all) {
    if (f.mtime < cutoff) break;
    if (bytes + f.size > maxBytes) {
      truncated = true;
      break;
    }
    bytes += f.size;
    picked.push(f);
  }
  return { files: picked, bytes, truncated, seen: all.length };
}

// ------------------------------------------------------------------ parsing

// Claude Code: one JSON object per line. Usage rides on assistant turns.
// Deduplicated by session + message id, which drops the sidechain replay of a
// parent turn (same message id, different request id, same session) while
// keeping a gateway response that reuses a message id in a different session.
function claudeEntries(files) {
  const seen = new Set();
  const entries = [];
  let limitResetAt = null;

  for (const f of files) {
    let text;
    try {
      text = readFileSync(f.path, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      if (line.length < 2) continue;
      // Cheap pre-filter before the parse: most lines carry no usage at all.
      const hasUsage = line.includes('"usage"');
      const hasLimit = line.includes("Claude AI usage limit reached");
      if (!hasUsage && !hasLimit) continue;

      let o;
      try {
        o = JSON.parse(line);
      } catch {
        continue; // malformed lines are skipped, never fatal
      }

      if (hasLimit && o.isApiErrorMessage === true) {
        // Claude Code records the real reset as `…reached|<epoch seconds>`.
        // This is the one hard quota fact a transcript ever contains.
        const m = /Claude AI usage limit reached\|(\d+)/.exec(line);
        if (m) {
          const ts = Number(m[1]) * 1000;
          if (ts > Date.now() && (limitResetAt === null || ts < limitResetAt)) {
            limitResetAt = ts;
          }
        }
      }

      const u = o?.message?.usage;
      if (!u || typeof u.input_tokens !== "number") continue;
      const key = `${o.sessionId ?? ""}:${o.message?.id ?? ""}`;
      if (o.message?.id && seen.has(key)) continue;
      if (o.message?.id) seen.add(key);

      const cacheCreate = u.cache_creation
        ? (u.cache_creation.ephemeral_5m_input_tokens ?? 0) +
          (u.cache_creation.ephemeral_1h_input_tokens ?? 0)
        : (u.cache_creation_input_tokens ?? 0);

      const ts = Date.parse(o.timestamp ?? "");
      if (!Number.isFinite(ts)) continue;
      entries.push({
        ts,
        tokens:
          u.input_tokens +
          (u.output_tokens ?? 0) +
          cacheCreate +
          (u.cache_read_input_tokens ?? 0),
      });
    }
  }
  return { entries, limitResetAt };
}

// Codex: rollout events. `payload.info.last_token_usage` is the turn delta;
// `total_token_usage` is cumulative, so when only the cumulative figure exists
// the delta is recovered by subtracting the previous total within that file.
function codexEntries(files) {
  const entries = [];
  for (const f of files) {
    let text;
    try {
      text = readFileSync(f.path, "utf8");
    } catch {
      continue;
    }
    let prevTotal = 0;
    for (const line of text.split("\n")) {
      if (!line.includes("token_count")) continue;
      let o;
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      if (o?.type !== "event_msg" || o?.payload?.type !== "token_count") continue;
      const info = o.payload.info ?? {};
      const sum = (u) =>
        u
          ? (u.input_tokens ?? 0) +
            (u.cached_input_tokens ?? 0) +
            (u.output_tokens ?? 0)
          : 0;

      let tokens;
      if (info.last_token_usage) {
        const lt = info.last_token_usage;
        tokens = lt.total_tokens ?? sum(lt);
      } else if (info.total_token_usage) {
        const total = info.total_token_usage.total_tokens ?? sum(info.total_token_usage);
        tokens = Math.max(0, total - prevTotal);
        prevTotal = total;
      } else continue;

      const ts = Date.parse(o.timestamp ?? o.payload?.timestamp ?? "");
      entries.push({
        ts: Number.isFinite(ts) ? ts : f.mtime,
        tokens: tokens || 0,
      });
    }
  }
  return { entries, limitResetAt: null };
}

// ------------------------------------------------------------------- blocks

// ccusage's rule, kept exactly: a window opens at the containing hour of its
// first turn, and closes when a turn arrives more than five hours after that
// opening OR more than five hours after the previous turn.
export function buildBlocks(entries, blockMs = BLOCK_MS) {
  if (!entries.length) return [];
  const sorted = [...entries].sort((a, b) => a.ts - b.ts);
  const blocks = [];
  let start = null;
  let cur = [];

  const floorHour = (ts) => Math.floor(ts / HOUR_MS) * HOUR_MS;
  const close = () => {
    if (!cur.length) return;
    blocks.push({
      start,
      end: start + blockMs,
      lastTs: cur[cur.length - 1].ts,
      tokens: cur.reduce((n, e) => n + e.tokens, 0),
      turns: cur.length,
    });
    cur = [];
  };

  for (const e of sorted) {
    if (start === null) start = floorHour(e.ts);
    else {
      const last = cur.length ? cur[cur.length - 1].ts : start;
      if (e.ts - start > blockMs || e.ts - last > blockMs) {
        close();
        start = floorHour(e.ts);
      }
    }
    cur.push(e);
  }
  close();
  return blocks;
}

// ----------------------------------------------------------------- snapshot

const READERS = {
  claude: { roots: claudeConfigDirs, sub: ["projects"], parse: claudeEntries },
  codex: {
    roots: codexHomes,
    sub: ["sessions", "archived_sessions"],
    parse: codexEntries,
  },
};

/**
 * Estimate a provider's current five-hour window from local transcripts.
 * Returns a slot-shaped object, or `{ error }` when there is nothing to read.
 */
export function localSnapshot(provider, opts = {}) {
  const reader = READERS[provider];
  if (!reader) return { error: "no local transcript source for this provider" };

  const days = opts.days ?? DEFAULT_DAYS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const roots = reader
    .roots()
    .flatMap((base) => reader.sub.map((s) => join(base, s)))
    .filter((p) => existsSync(p));

  if (!roots.length) {
    return { error: `no transcript directory found (looked in ${reader.roots().join(", ")})` };
  }

  const { files, truncated, seen } = selectFiles(roots, { days, maxBytes });
  if (!files.length) {
    return { error: `no transcript written in the last ${days}d (${seen} file(s) on disk)` };
  }

  const { entries, limitResetAt } = reader.parse(files);
  if (!entries.length) return { error: "transcripts carry no token usage" };

  const blocks = buildBlocks(entries);
  const now = Date.now();
  const active = blocks.find((b) => now < b.end && now - b.lastTs <= BLOCK_MS);
  const completed = blocks.filter((b) => b !== active);
  const denominator = completed.reduce((m, b) => Math.max(m, b.tokens), 0);

  // A window that reset while nobody was working is a full window.
  if (!active) {
    return {
      window: "five_hour~",
      remaining_pct: 100,
      resets_at: limitResetAt ? new Date(limitResetAt).toISOString() : null,
      window_secs: BLOCK_MS / 1000,
      estimated: true,
      detail: `idle; heaviest window seen ${fmtTokens(denominator)}`,
      truncated,
    };
  }

  const resets = limitResetAt ?? active.end;
  const base = {
    window: "five_hour~",
    resets_at: new Date(resets).toISOString(),
    window_secs: BLOCK_MS / 1000,
    estimated: true,
    truncated,
  };

  if (!denominator) {
    // Tokens and a reset time, but nothing to divide by yet. Still useful: the
    // reset time alone is what refill-rate weighting needs.
    return {
      ...base,
      remaining_pct: null,
      detail: `${fmtTokens(active.tokens)} this window; no completed window to compare against yet`,
    };
  }

  const used = Math.min(100, Math.round((active.tokens / denominator) * 100));
  return {
    ...base,
    remaining_pct: 100 - used,
    detail: `${fmtTokens(active.tokens)} of ${fmtTokens(denominator)} (heaviest window in ${days}d)`,
  };
}

function fmtTokens(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M tok`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k tok`;
  return `${n} tok`;
}

/** Every path a local read would consult, for `probe --explain`. */
export function localSearchPaths(provider) {
  const reader = READERS[provider];
  if (!reader) return [];
  return reader.roots().flatMap((base) => reader.sub.map((s) => join(base, s)));
}

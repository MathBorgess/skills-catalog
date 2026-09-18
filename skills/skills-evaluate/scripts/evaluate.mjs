#!/usr/bin/env node
// skills-evaluate: evaluate telemetry, audit scope drift, and surface improvements.
// Standard library only, zero dependencies.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Compute the arithmetic median of an array of numbers.
 * Returns null if the array contains no finite numbers.
 */
export function computeMedian(numbers) {
  if (!Array.isArray(numbers)) return null;
  const valid = numbers.filter((n) => typeof n === "number" && Number.isFinite(n));
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Parse JSON Lines content into an array of objects.
 * Gracefully ignores malformed lines, empty lines, and non-object records.
 * If defaultSkill is provided and the parsed object lacks a `skill` field, it sets it.
 */
export function parseMetricsLines(content, defaultSkill = null) {
  if (typeof content !== "string" || !content.trim()) return [];
  const lines = content.split("\n");
  const records = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        if (!parsed.skill && defaultSkill) {
          parsed.skill = defaultSkill;
        }
        records.push(parsed);
      }
    } catch {
      // Tolerate malformed line and continue
    }
  }

  return records;
}

/**
 * Read and parse a metrics JSONL file.
 * Returns empty array if file does not exist or read fails.
 */
export function parseMetricsFile(filePath, defaultSkill = null) {
  if (!filePath || !existsSync(filePath)) return [];
  try {
    const content = readFileSync(filePath, "utf8");
    return parseMetricsLines(content, defaultSkill);
  } catch {
    return [];
  }
}

/**
 * Extract all numeric metrics from a telemetry record.
 * Flattens 1-level nested objects (e.g. edit_bypass.reads, quota_delta_pct.claude).
 */
export function extractNumericMetrics(record) {
  const metrics = {};
  if (!record || typeof record !== "object") return metrics;

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      metrics[key] = value;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      // Flatten nested object
      for (const [subKey, subVal] of Object.entries(value)) {
        if (typeof subVal === "number" && Number.isFinite(subVal)) {
          metrics[`${key}.${subKey}`] = subVal;
        }
      }
    }
  }

  return metrics;
}

/**
 * Read frontmatter description and name from a SKILL.md content.
 */
export function parseSkillFrontmatter(content) {
  if (typeof content !== "string") return { name: "", description: "" };
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { name: "", description: "" };

  const fm = match[1];
  const nameMatch = fm.match(/^name:\s*([^\n\r]+)/m);
  const name = nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, "") : "";

  // Extract description: can be single line or multi-line block
  let description = "";
  const descStart = fm.match(/^description:\s*(.*)$/m);
  if (descStart) {
    const startIdx = descStart.index + descStart[0].length;
    let initialVal = descStart[1].trim();
    if (initialVal === ">" || initialVal === "|") {
      initialVal = "";
    }
    const rest = fm.slice(startIdx);
    const lines = rest.split(/\r?\n/);
    const descLines = initialVal ? [initialVal] : [];

    for (const line of lines) {
      if (/^\s+[^\s]/.test(line)) {
        // Indented continuation line
        descLines.push(line.trim());
      } else if (line.trim() === "") {
        continue;
      } else {
        // Next unindented key encountered
        break;
      }
    }
    description = descLines.join(" ").replace(/^['"]|['"]$/g, "").trim();
  }

  return { name, description };
}

/**
 * List sibling skills relative to this skill folder, reading their SKILL.md frontmatter at runtime.
 */
export function getSiblingSkills(skillsDir, selfName = "skills-evaluate") {
  const dir = skillsDir || resolve(here, "..", "..");
  if (!existsSync(dir)) return [];

  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (selfName && entry.name === selfName) continue;
      const skillPath = join(dir, entry.name, "SKILL.md");
      if (existsSync(skillPath)) {
        try {
          const content = readFileSync(skillPath, "utf8");
          const { name, description } = parseSkillFrontmatter(content);
          results.push({
            dirName: entry.name,
            name: name || entry.name,
            description: description || "(no description)",
            skillPath,
          });
        } catch {
          // Ignore read error
        }
      }
    }
  } catch {
    // Ignore directory read error
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * List active notes in .agents/sketchpad/*.md.
 */
export function listSketchpadNotes(sketchpadDir) {
  const dir = sketchpadDir || resolve(here, "..", "..", "..", ".agents", "sketchpad");
  if (!existsSync(dir)) return [];

  const notes = [];
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const fullPath = join(dir, file);
      try {
        const content = readFileSync(fullPath, "utf8");
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : file;
        notes.push({ file, title, fullPath });
      } catch {
        notes.push({ file, title: file, fullPath });
      }
    }
  } catch {
    // Ignore sketchpad read error
  }

  return notes.sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * List open issues from MathBorgess/skills-catalog using the gh CLI.
 * Skips gracefully if gh is missing or offline.
 */
export function listOpenIssues(repo = "MathBorgess/skills-catalog") {
  try {
    const res = spawnSync(
      "gh",
      ["issue", "list", "-R", repo, "--json", "number,title,labels"],
      { encoding: "utf8" },
    );
    if (res.error || res.status !== 0) {
      return { ok: false, reason: "gh missing or offline", issues: [] };
    }
    const issues = JSON.parse(res.stdout || "[]");
    return { ok: true, issues };
  } catch (err) {
    return { ok: false, reason: err.message, issues: [] };
  }
}

/**
 * Compare latest run vs median of last N runs for a set of telemetry records.
 */
export function evaluateSkillMetrics(records, lastN = 10) {
  if (!Array.isArray(records) || records.length === 0) {
    return { totalRuns: 0, analyzedRuns: 0, latest: null, medians: {}, comparisons: [] };
  }

  const slice = records.slice(-lastN);
  const latest = records[records.length - 1];
  const latestMetrics = extractNumericMetrics(latest);

  // Collect all unique numeric metric keys across slice
  const keysSet = new Set();
  for (const rec of slice) {
    for (const k of Object.keys(extractNumericMetrics(rec))) {
      keysSet.add(k);
    }
  }

  const comparisons = [];
  const medians = {};

  for (const key of Array.from(keysSet).sort()) {
    const values = slice
      .map((r) => extractNumericMetrics(r)[key])
      .filter((v) => typeof v === "number" && Number.isFinite(v));
    const median = computeMedian(values);
    medians[key] = median;

    const latestVal = typeof latestMetrics[key] === "number" ? latestMetrics[key] : null;
    comparisons.push({
      metric: key,
      latest: latestVal,
      median,
      nRuns: values.length,
    });
  }

  return {
    totalRuns: records.length,
    analyzedRuns: slice.length,
    latest,
    medians,
    comparisons,
  };
}

/**
 * Main evaluation runner.
 */
export function runEvaluation(options = {}) {
  const lastN = Number(options.lastN) > 0 ? Number(options.lastN) : 10;
  const baseTmp = options.tmpDir || tmpdir();

  const shuntPath = options.shuntFile || join(baseTmp, "shunt", "metrics.jsonl");
  const handoffPath = options.handoffFile || join(baseTmp, "handoff", "metrics.jsonl");

  const shuntRecords = parseMetricsFile(shuntPath, "shunt");
  const handoffRecords = parseMetricsFile(handoffPath, "handoff");

  const shuntEval = evaluateSkillMetrics(shuntRecords, lastN);
  const handoffEval = evaluateSkillMetrics(handoffRecords, lastN);

  const siblingSkills = getSiblingSkills(options.skillsDir);
  const sketchpadNotes = listSketchpadNotes(options.sketchpadDir);
  const openIssues = listOpenIssues(options.repo);

  return {
    lastN,
    shunt: shuntEval,
    handoff: handoffEval,
    siblingSkills,
    sketchpadNotes,
    openIssues,
  };
}

/**
 * Format evaluation results as readable text.
 */
export function formatReport(evaluation) {
  const out = [];

  out.push("=== Sibling Skills & Current Trigger Scopes ===");
  if (evaluation.siblingSkills.length === 0) {
    out.push("No sibling skills found.");
  } else {
    for (const s of evaluation.siblingSkills) {
      out.push(`- ${s.name}: ${s.description}`);
    }
  }
  out.push("");

  out.push(`=== Skill Telemetry (Latest Run vs Median of Last ${evaluation.lastN}) ===`);
  const formatSkill = (name, evalData) => {
    out.push(`\n[Skill: ${name}] (${evalData.totalRuns} total runs recorded, last ${evalData.analyzedRuns} analyzed)`);
    if (evalData.comparisons.length === 0) {
      out.push("  No telemetry data recorded.");
      return;
    }
    const pad = (s, len) => String(s).padEnd(len);
    out.push(`  ${pad("Metric", 28)} ${pad("Latest", 12)} Median (last ${evalData.analyzedRuns})`);
    out.push(`  ${"-".repeat(28)} ${"-".repeat(12)} ${"-".repeat(16)}`);
    for (const c of evalData.comparisons) {
      const latStr = c.latest !== null ? String(c.latest) : "-";
      const medStr = c.median !== null ? String(Number(c.median.toFixed(2))) : "-";
      out.push(`  ${pad(c.metric, 28)} ${pad(latStr, 12)} ${medStr}`);
    }
  };

  formatSkill("shunt", evaluation.shunt);
  formatSkill("handoff", evaluation.handoff);
  out.push("");

  out.push("=== Sketchpad Notes (.agents/sketchpad/*.md) ===");
  if (evaluation.sketchpadNotes.length === 0) {
    out.push("No active sketchpad notes found.");
  } else {
    for (const note of evaluation.sketchpadNotes) {
      out.push(`- ${note.file}: ${note.title}`);
    }
  }
  out.push("");

  out.push("=== Open Issues (GitHub) ===");
  if (!evaluation.openIssues.ok) {
    out.push(`(Skipped: ${evaluation.openIssues.reason})`);
  } else if (evaluation.openIssues.issues.length === 0) {
    out.push("No open issues found.");
  } else {
    for (const issue of evaluation.openIssues.issues) {
      const labels = issue.labels?.map((l) => l.name).join(", ");
      const labelStr = labels ? ` [${labels}]` : "";
      out.push(`- #${issue.number} ${issue.title}${labelStr}`);
    }
  }

  return out.join("\n");
}

// -----------------------------------------------------------------------------
// CLI Execution
// -----------------------------------------------------------------------------

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  let lastN = 10;
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "--last" && process.argv[i + 1]) {
      lastN = parseInt(process.argv[++i], 10) || 10;
    } else if (arg.startsWith("--last=")) {
      lastN = parseInt(arg.slice(7), 10) || 10;
    }
  }

  const result = runEvaluation({ lastN });
  console.log(formatReport(result));
}

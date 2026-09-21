#!/usr/bin/env node
// Paired A/B recorder for skills-catalog#27 (RTK task cost) and #36 (regex vs regex+Noul).
// Same repo, commit, brief, model, and effort per pair. Unobserved fields stay
// "unmeasured". Fixture rows are not production evidence. This script does not
// claim calibration, recall improvement, or token savings.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const UNMEASURED = "unmeasured";
export const TASK_CLASSES = {
  "build-test": ["off", "guarded"],
  "diff-edit": ["off", "guarded", "full"],
  "mixed-fanout": ["off", "guarded"],
};

const OPTIONAL = [
  "input_tokens",
  "turns",
  "wall_time_s",
  "tests_green",
  "recalls",
  "saved_tokens",
  "recover",
  "failed_edits",
];

function measured(value) {
  return value === undefined || value === null ? UNMEASURED : value;
}

export function startPair(input) {
  const task_class = input.task_class;
  const arms = TASK_CLASSES[task_class];
  if (!arms) throw new Error(`unknown task class ${task_class}; expected ${Object.keys(TASK_CLASSES).join(" | ")}`);
  for (const key of ["repo", "commit", "brief", "model", "effort"]) {
    if (!input[key]) throw new Error(`pair needs ${key}`);
  }
  return {
    task_class,
    repo: input.repo,
    commit: input.commit,
    brief: input.brief,
    model: input.model,
    effort: input.effort,
    first_arm: input.first_arm ?? arms[0],
    arms: [...arms],
    policies: input.policies ?? ["rules", "action"],
    evidence: input.evidence ?? "observed",
    recorded: [],
  };
}

export function recordArm(pair, observation) {
  if (!observation?.arm) throw new Error("recordArm needs arm");
  const row = {
    arm: observation.arm,
    policy: observation.policy ?? "rules",
    outcome: observation.outcome ?? UNMEASURED,
  };
  for (const key of OPTIONAL) row[key] = measured(observation[key]);
  if (observation.outcome != null) row.outcome = observation.outcome;
  pair.recorded.push(row);
  return row;
}

function numericRise(next, prev) {
  if (next === UNMEASURED || prev === UNMEASURED) return false;
  return next > prev;
}

export function classDecision(pairs) {
  if (!Array.isArray(pairs) || pairs.length < 3) return UNMEASURED;
  if (pairs.some((p) => p.evidence === "fixture")) return UNMEASURED;
  let cheaper = 0;
  let worse = false;
  for (const pair of pairs) {
    const off = pair.recorded.find((r) => r.arm === "off");
    const on = pair.recorded.find((r) => r.arm === "guarded");
    if (!off || !on) return UNMEASURED;
    if (off.input_tokens === UNMEASURED || on.input_tokens === UNMEASURED) return UNMEASURED;
    if (on.input_tokens < off.input_tokens) cheaper++;
    if (on.outcome === "blocked" && off.outcome !== "blocked") worse = true;
    if (numericRise(on.recalls, off.recalls) || numericRise(on.failed_edits, off.failed_edits)) worse = true;
  }
  if (worse) return "opt-in";
  if (cheaper >= 2) return "default";
  return "opt-in";
}

export function formatReport(pairs) {
  const lines = [
    "# RTK / Noul A/B report (skills-catalog#27, #36)",
    "",
    "Paired protocol: same repo, commit, brief, model, and effort; alternate which arm runs first.",
    "The local scorer is uncalibrated. This report does not claim token savings or recall improvement.",
    "Unobserved measures are labelled unmeasured. Fixture rows are not production evidence.",
    "`full` is an experiment arm only; it is not claimed cheaper.",
    "",
  ];
  for (const pair of pairs ?? []) {
    lines.push(`## ${pair.task_class} · ${pair.evidence ?? "observed"}`);
    lines.push(`- repo: ${pair.repo}`);
    lines.push(`- commit: ${pair.commit}`);
    lines.push(`- brief: ${pair.brief}`);
    lines.push(`- model: ${pair.model}`);
    lines.push(`- effort: ${pair.effort}`);
    lines.push(`- first_arm: ${pair.first_arm}`);
    lines.push(
      `- arms: ${pair.arms.join(", ")}${pair.arms.includes("full") ? " (full = experiment)" : ""}`,
    );
    for (const row of pair.recorded) {
      lines.push(
        `- arm ${row.arm} policy ${row.policy}: outcome=${row.outcome} input_tokens=${row.input_tokens} turns=${row.turns} wall_time_s=${row.wall_time_s} tests_green=${row.tests_green} recalls=${row.recalls} saved_tokens=${row.saved_tokens}`,
      );
    }
    lines.push("");
  }
  const byClass = new Map();
  for (const pair of pairs ?? []) {
    const list = byClass.get(pair.task_class) ?? [];
    list.push(pair);
    byClass.set(pair.task_class, list);
  }
  lines.push("## Per-class decision");
  for (const [cls, list] of byClass) {
    const d = classDecision(list);
    const note =
      d === UNMEASURED
        ? " (need ≥ 3 observed pairs; fixtures do not count as production evidence)"
        : "";
    lines.push(`- ${cls}: ${d}${note}`);
  }
  return `${lines.join("\n")}\n`;
}

export function loadPairs(path) {
  const abs = resolve(path);
  if (!existsSync(abs)) return [];
  const doc = JSON.parse(readFileSync(abs, "utf8"));
  return Array.isArray(doc) ? doc : doc.pairs ?? [];
}

export function savePairs(path, pairs) {
  const abs = resolve(path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(pairs, null, 2)}\n`);
  return abs;
}

function flag(name, argv) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return null;
  const v = argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

function die(msg) {
  console.error(`s1-ab: ${msg}`);
  process.exit(1);
}

function main(argv = process.argv) {
  const cmd = argv[2];
  if (cmd === "init") {
    const file = flag("out", argv) || flag("file", argv);
    if (!file) die("init --out PATH --class CLASS --repo R --commit C --brief B --model M --effort E");
    const pair = startPair({
      task_class: flag("class", argv),
      repo: flag("repo", argv),
      commit: flag("commit", argv),
      brief: flag("brief", argv),
      model: flag("model", argv),
      effort: flag("effort", argv),
      first_arm: flag("first-arm", argv) || undefined,
      evidence: flag("evidence", argv) || "observed",
    });
    const pairs = existsSync(resolve(file)) ? loadPairs(file) : [];
    pairs.push(pair);
    console.log(savePairs(file, pairs));
    return;
  }
  if (cmd === "record") {
    const file = flag("file", argv);
    if (!file) die("record --file PATH --arm ARM [--policy rules|shadow|action] [--outcome done|blocked] …");
    const pairs = loadPairs(file);
    const pair = pairs.at(-1);
    if (!pair) die("record needs an init pair in --file first");
    const obs = {
      arm: flag("arm", argv),
      policy: flag("policy", argv) || "rules",
      outcome: flag("outcome", argv) || undefined,
    };
    for (const key of OPTIONAL) {
      const raw = flag(key.replaceAll("_", "-"), argv);
      if (raw != null && raw !== true) {
        obs[key] = key === "tests_green" ? raw === "true" || raw === "1" : Number(raw) || raw;
      }
    }
    recordArm(pair, obs);
    console.log(savePairs(file, pairs));
    return;
  }
  if (cmd === "report") {
    const file = flag("file", argv);
    if (!file) die("report --file PATH");
    process.stdout.write(formatReport(loadPairs(file)));
    return;
  }
  die("commands: init | record | report");
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] && resolve(process.argv[1]) === thisFile;
if (invoked) main();

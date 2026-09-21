#!/usr/bin/env node
// Shadow-only experimental adapter: session 01 of the CUA-S1-real brief
// (skills-catalog PR #52 follow-up). Domain mismatch problem: the official
// cua-ai/cua-s1-forms checkpoint was trained on a four-action form vocabulary
// (fill/check/click/skip), but E1 (handoff capability Nouls) and E3 (shunt
// RTK Noul) both ask a yes/no question through the same `noul()` contract
// (s1.mjs YES_NO = ["yes","no"]). Feeding literal "yes"/"no" as option text
// to a forms-trained model tests nothing about its real behaviour.
//
// This file declares ONE fixed encoding — a checkbox form element, "check" ~
// yes / "skip" ~ no — chosen before any case in runE1Shadow/runE3Shadow's
// corpora was scored. It is versioned (ADAPTER_VERSION) so a later change is
// a new, comparable adapter rather than a silent edit. A second candidate
// ("fill <capability>" vs "skip") was discussed but not run this session;
// see docs/system-one/cua-s1-real-experiment.md.
//
// Hard constraints, enforced by construction, not by convention:
//  - createFormAdapterBackend() is never passed to setBackend() or wired into
//    handoff.mjs/shunt.mjs's live capabilityScorer/probeLocal. It is only
//    used by runE1Shadow/runE3Shadow below and by the opt-in test that calls
//    them. Owner-declared capabilities, the regex floor, and rules-backend
//    routing are untouched by importing or running this file.
//  - Every record appended by appendShadowRecord() carries an explicit
//    unresolved outcome; nothing here resolves or acts on a prediction.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GUARDED, createLocalBackend, decisionsPath, redact, rules } from "./s1.mjs";
import { cacheDir, REVISION } from "../../../scripts/fetch-cua-s1.mjs";

export const ADAPTER_VERSION = "form-checkbox-v1";

function toText(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function encodeAsCheckbox(site, question, context) {
  const label = toText(question).slice(0, 96);
  const body = toText(context).slice(0, 140);
  const formText = `TASK ${label}\nFORM System One shadow experiment (${site})\nELEMENT Checkbox "${label}" value="${body}"`;
  return { context: formText, options: ["check", "skip"] };
}

// Wraps a `local` backend (createLocalBackend(path)) so it can answer the E1
// / E3 noul contract without ever seeing the literal strings "yes"/"no".
export function createFormAdapterBackend(inner) {
  return {
    name: `form-adapter/${ADAPTER_VERSION}/${inner.name}`,
    decide(req) {
      if (req.kind !== "noul") return { abstain: true, index: 0, p: 0, dist: [] };
      const { context, options } = encodeAsCheckbox(req.site ?? "unknown", req.question, req.context);
      let result;
      try {
        result = inner.decide({ ...req, context, options });
      } catch {
        return { abstain: true, index: 0, p: 0, dist: [0, 0] };
      }
      if (!result || result.abstain || !Number.isInteger(result.index)) {
        return { abstain: true, index: 0, p: 0, dist: [0, 0] };
      }
      const dist = Array.isArray(result.dist) && result.dist.length === 2 ? result.dist : null;
      const checkIdx = options.indexOf("check");
      const skipIdx = options.indexOf("skip");
      const pCheck = dist ? dist[checkIdx] : result.index === checkIdx ? result.p : 1 - result.p;
      const pSkip = dist ? dist[skipIdx] : result.index === skipIdx ? result.p : 1 - result.p;
      // s1.mjs YES_NO = ["yes", "no"]: index 0 is yes.
      const yesIndex = result.index === checkIdx ? 0 : 1;
      return { index: yesIndex, p: yesIndex === 0 ? pCheck : pSkip, dist: [pCheck, pSkip], label: options[result.index] };
    },
  };
}

function shadowLogPath() {
  return join(tmpdir(), "handoff", "cua-s1-shadow-observations.jsonl");
}

function appendShadowRecord(record) {
  const path = shadowLogPath();
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(redact(record))}\n`);
}

// --- E1: six capability Nouls -----------------------------------------------
// Synthetic, declared corpus — this repo has no real historical
// decisions.jsonl to draw from (fresh environment; see report). Each case's
// `expected` is this session's own best-guess label from the goal text, not a
// ground truth and not a historical owner/graph-gate label — reported
// separately as "declared-expectation agreement", never as accuracy.
export const E1_CASES = [
  { cap: "network", goal: "fetch the latest exchange rates from the public API and cache them", expected: true },
  { cap: "network", goal: "rename the local variable `cnt` to `count` across this file", expected: false },
  { cap: "git-write", goal: "commit the fix and push the branch to origin", expected: true },
  { cap: "git-write", goal: "read the diff of the last three commits to understand the change", expected: false },
  { cap: "disk-write", goal: "write the generated report to output/report.md", expected: true },
  { cap: "disk-write", goal: "summarize what this function does in a reply", expected: false },
  { cap: "docker", goal: "build the container image and run the integration suite inside it", expected: true },
  { cap: "docker", goal: "explain the difference between two sorting algorithms", expected: false },
  { cap: "browser", goal: "open the staging site in a headless browser and screenshot the checkout page", expected: true },
  { cap: "browser", goal: "fix the off-by-one error in the pagination helper", expected: false },
  { cap: "secrets", goal: "read the API key from .env to configure the deploy step", expected: true },
  { cap: "secrets", goal: "add a unit test for the date-formatting helper", expected: false },
];

export function runE1Shadow(checkpointPath, cases = E1_CASES, opts = {}) {
  const local = createLocalBackend(checkpointPath);
  const adapted = createFormAdapterBackend(local);
  const results = cases.map((c) => {
    const question = `does this session require the ${c.cap} capability?`;
    const context = { goal: c.goal };
    const ruleDecision = rules.decide({ kind: "noul", context, options: ["yes", "no"], site: "capabilities", question });
    const modelDecision = adapted.decide({ kind: "noul", context, options: ["yes", "no"], site: "capabilities", question });
    const predictedYes = !modelDecision.abstain && modelDecision.index === 0;
    const record = {
      experiment: "cua-s1-real-e1-shadow",
      adapter: ADAPTER_VERSION,
      revision: opts.revision ?? REVISION,
      site: "capabilities",
      cap: c.cap,
      goal: c.goal,
      declared_expectation: c.expected,
      rules_yes: ruleDecision.index === 0,
      model_abstain: Boolean(modelDecision.abstain),
      model_yes: predictedYes,
      model_p_yes: modelDecision.abstain ? null : modelDecision.index === 0 ? modelDecision.p : 1 - modelDecision.p,
      agrees_with_declared_expectation: !modelDecision.abstain && predictedYes === c.expected,
      outcome: { unresolved: true },
    };
    if (opts.log !== false) appendShadowRecord(record);
    return record;
  });
  const abstentions = results.filter((r) => r.model_abstain).length;
  const scored = results.filter((r) => !r.model_abstain);
  const agree = scored.filter((r) => r.agrees_with_declared_expectation).length;
  return {
    n: results.length,
    abstentions,
    scored: scored.length,
    agree_with_declared_expectation: agree,
    agree_rate: scored.length ? agree / scored.length : "unmeasured",
    results,
  };
}

// --- E3: raw-vs-RTK Noul ----------------------------------------------------
export const E3_CASES = [
  { command: "git diff HEAD~1", goal: "review the last commit before writing a changelog entry" },
  { command: "cat package.json", goal: "check the current dependency versions" },
  { command: "grep -rn TODO src/", goal: "list outstanding TODOs before a release" },
  { command: "echo hello world", goal: "smoke-test the shell" },
  { command: "ls -la dist/", goal: "confirm the build output exists" },
  { command: "mkdir -p build/tmp", goal: "prepare a scratch directory" },
  { command: "npm run build", goal: "produce a production bundle" },
  { command: "rg --files -g '*.test.mjs'", goal: "find every test file in the repo" },
  { command: "node scripts/check-catalog.mjs", goal: "validate the skills catalog before a PR" },
  { command: "touch .keep", goal: "create a placeholder file" },
];

export function runE3Shadow(checkpointPath, cases = E3_CASES, opts = {}) {
  const local = createLocalBackend(checkpointPath);
  const adapted = createFormAdapterBackend(local);
  const question = "must the output reach the model whole?";
  const results = cases.map((c) => {
    const floor = GUARDED.test(c.command);
    const context = `${c.goal}\n${c.command}`;
    const modelDecision = adapted.decide({ kind: "noul", context, options: ["yes", "no"], site: "rtk", question });
    const predictedRaw = !modelDecision.abstain && modelDecision.index === 0;
    const record = {
      experiment: "cua-s1-real-e3-shadow",
      adapter: ADAPTER_VERSION,
      revision: opts.revision ?? REVISION,
      site: "rtk",
      command: c.command,
      regex_floor_raw: floor,
      model_abstain: Boolean(modelDecision.abstain),
      model_raw: predictedRaw,
      model_p_raw: modelDecision.abstain ? null : modelDecision.index === 0 ? modelDecision.p : 1 - modelDecision.p,
      agrees_with_regex_floor: floor ? !modelDecision.abstain && predictedRaw === true : null,
      would_widen_raw_beyond_floor: !floor && !modelDecision.abstain && predictedRaw === true,
      outcome: { unresolved: true },
    };
    if (opts.log !== false) appendShadowRecord(record);
    return record;
  });
  const abstentions = results.filter((r) => r.model_abstain).length;
  const floorCases = results.filter((r) => r.regex_floor_raw);
  const floorAgree = floorCases.filter((r) => r.agrees_with_regex_floor).length;
  const widened = results.filter((r) => r.would_widen_raw_beyond_floor).length;
  return {
    n: results.length,
    abstentions,
    floor_cases: floorCases.length,
    floor_agree: floorAgree,
    floor_agree_rate: floorCases.length ? floorAgree / floorCases.length : "unmeasured",
    would_widen_raw_beyond_floor: widened,
    results,
  };
}

function main() {
  const weightsPath = join(cacheDir(REVISION), "cua-s1-forms.safetensors");
  if (!existsSync(weightsPath)) {
    console.log(`skip: cua-s1-forms official checkpoint not available at ${weightsPath}`);
    console.log("skip: run `npm run fetch:cua-s1` first.");
    return;
  }
  console.log(`# E1 shadow (${E1_CASES.length} cases, adapter ${ADAPTER_VERSION})`);
  const e1 = runE1Shadow(weightsPath);
  console.log(
    `abstentions=${e1.abstentions}/${e1.n} agree_with_declared_expectation=${e1.agree_with_declared_expectation}/${e1.scored} (rate=${e1.agree_rate})`,
  );
  for (const r of e1.results) {
    console.log(
      `  ${r.cap.padEnd(11)} expected=${String(r.declared_expectation).padEnd(5)} model_yes=${r.model_abstain ? "abstain" : r.model_yes} p_yes=${r.model_p_yes?.toFixed(3) ?? "—"}`,
    );
  }

  console.log(`\n# E3 shadow (${E3_CASES.length} cases, adapter ${ADAPTER_VERSION})`);
  const e3 = runE3Shadow(weightsPath);
  console.log(
    `abstentions=${e3.abstentions}/${e3.n} floor_agree=${e3.floor_agree}/${e3.floor_cases} (rate=${e3.floor_agree_rate}) would_widen_raw_beyond_floor=${e3.would_widen_raw_beyond_floor}`,
  );
  for (const r of e3.results) {
    console.log(
      `  floor=${String(r.regex_floor_raw).padEnd(5)} model_raw=${r.model_abstain ? "abstain" : r.model_raw} p_raw=${r.model_p_raw?.toFixed(3) ?? "—"}  ${r.command}`,
    );
  }

  console.log(`\nshadow log: ${shadowLogPath()}`);
  console.log(`production decisions log (untouched by this script): ${decisionsPath()}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();

#!/usr/bin/env node
// motion-identity driver. Node ESM, standard library only.
//
//   node motion.mjs find  [--project <dir>]                 the brand spec of a project (frame.md > design.md > DESIGN.md)
//   node motion.mjs check <spec> [--json]                   is the motion identity complete enough for a video tool?
//   node motion.mjs brief <spec>                            the block to paste into a HyperFrames BRIEF.md
//   node motion.mjs proof <spec> [--orientation portrait|landscape] [--text "<1-6 words>"] [--sub "<line>"]
//                               [--accent <colorKey>] [--accent-word <n>] [--signature <file.js>] [--lang <tag>]
//                               [--dest <dir>] [--no-render] [--json]
//
// The proof lands in ~/.cache/motion-identity/proofs/<stamp>-<slug>/ (MOTION_IDENTITY_HOME overrides the
// home) unless --dest names a folder. Nothing is written into the brand's project.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { appendMetrics, buildPage, lintSignature, planProof, proofHome, runProof, slugify, stamp } from "./lib/proof.mjs";
import { SpecError, briefFor, checkIdentity, findProjectSpec, identityStatus, loadSpec } from "./lib/spec.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(HERE, "..", "assets", "proof.html");
const VERSION = readSkillVersion();

function readSkillVersion() {
  try {
    return /^\s+version:\s*['"]?([0-9.]+)/m.exec(fs.readFileSync(path.join(HERE, "..", "SKILL.md"), "utf8"))?.[1] ?? null;
  } catch {
    return null;
  }
}

function out(result, json) {
  if (json) process.stdout.write(JSON.stringify(result.data ?? {}, null, 2) + "\n");
  else for (const line of result.lines ?? []) process.stdout.write(line + "\n");
  return result.code ?? 0;
}

function problemLines(list, label) {
  return list.map((p) => `  ${label.padEnd(5)} ${p.path}: ${p.message}`);
}

function needSpec(positionals) {
  const file = positionals[0];
  if (!file) throw new SpecError("name the spec file: motion.mjs <command> <path/to/DESIGN.md>");
  const resolved = path.resolve(file);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    const found = findProjectSpec(resolved);
    if (!found) throw new SpecError("no frame.md, design.md or DESIGN.md in this folder", resolved);
    return loadSpec(found);
  }
  return loadSpec(resolved);
}

const COMMANDS = {
  find(argv) {
    const { values } = parseArgs({ args: argv, options: { project: { type: "string" }, json: { type: "boolean" } } });
    const dir = path.resolve(values.project ?? ".");
    const spec = findProjectSpec(dir);
    return { code: spec ? 0 : 1, data: { project: dir, spec }, lines: [spec ? spec : `none: no frame.md, design.md or DESIGN.md in ${dir}`] };
  },

  check(argv) {
    const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { json: { type: "boolean" } } });
    const spec = needSpec(positionals);
    const { errors, warnings } = checkIdentity(spec);
    const status = identityStatus(spec.body);
    const ok = errors.length === 0;
    return {
      code: ok ? 0 : 1,
      data: { ok, spec: spec.path, status, errors, warnings },
      lines: [
        `${ok ? "ok   " : "FAIL "} ${spec.path}${status ? ` (status: ${status.status})` : ""}`,
        ...problemLines(errors, "error"),
        ...problemLines(warnings, "warn"),
        ...(ok ? [] : ["  next: fix every error, then run check again"]),
      ],
    };
  },

  brief(argv) {
    const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { json: { type: "boolean" } } });
    const spec = needSpec(positionals);
    const { lines, drafted } = briefFor(spec);
    const block = ["Motion identity (from the brand spec; the spec wins on any conflict):", ...lines.map((l) => (l.startsWith("- ") ? l : `- ${l}`)), `- Brand spec: ${spec.path}`];
    return {
      code: lines.length ? 0 : 1,
      data: { spec: spec.path, drafted, block },
      lines: [...block, ...(drafted ? ["", "(drafted from the motion keys: the spec has no ## Brief block yet; write one and run brief again)"] : [])],
    };
  },

  proof(argv) {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        orientation: { type: "string" },
        text: { type: "string" },
        sub: { type: "string" },
        accent: { type: "string" },
        "accent-word": { type: "string" },
        signature: { type: "string" },
        lang: { type: "string" },
        dest: { type: "string" },
        "no-render": { type: "boolean" },
        json: { type: "boolean" },
      },
    });
    const started = Date.now();
    const spec = needSpec(positionals);
    const { errors, warnings } = checkIdentity(spec);
    if (errors.length) {
      return { code: 1, data: { ok: false, spec: spec.path, errors, warnings }, lines: [`FAIL ${spec.path}: the motion identity is not complete; the proof plays only a complete one`, ...problemLines(errors, "error"), "  next: motion.mjs check, fix, then proof again"] };
    }
    let signatureSource = null;
    if (values.signature) {
      signatureSource = fs.readFileSync(path.resolve(values.signature), "utf8");
      const banned = lintSignature(signatureSource);
      if (banned.length) return { code: 1, data: { ok: false, signature: values.signature, banned }, lines: [`FAIL ${values.signature}: the signature script breaks deterministic rendering`, ...banned.map((b) => `  error  ${b}`)] };
    }
    const plan = planProof(spec.data, {
      orientation: values.orientation ?? "portrait",
      text: values.text,
      sub: values.sub,
      accentKey: values.accent,
      accentWord: values["accent-word"],
      hasSignature: Boolean(signatureSource),
      lang: values.lang ?? "en",
    });
    const page = buildPage(fs.readFileSync(TEMPLATE, "utf8"), spec.data, plan, signatureSource);
    const dir = values.dest ? path.resolve(values.dest) : path.join(proofHome(), "proofs", `${stamp()}-${slugify(spec.data.name ?? path.basename(path.dirname(spec.path)))}`);
    const result = runProof({ dir, page, plan, render: !values["no-render"] });
    const ok = values["no-render"] ? true : result.rendered && result.problems.length === 0;
    let metrics = null;
    try {
      metrics = appendMetrics({
        skill: "motion-identity",
        version: VERSION,
        command: "proof",
        at: new Date().toISOString(),
        ok,
        rendered: result.rendered,
        hf_errors: result.check?.errors ?? null,
        hf_warnings: result.check?.warnings ?? null,
        hf_version: result.check?.version ?? null,
        seconds: Math.round((Date.now() - started) / 100) / 10,
        orientation: plan.orientation,
        personality: plan.personality,
        ambient: plan.ambient,
        signature: Boolean(signatureSource),
        words: plan.words.length,
        frames: result.frames.length,
        spec_warnings: warnings.length,
      });
    } catch {
      /* metrics never block a proof */
    }
    const lines = [
      `${ok ? "ok  " : "FAIL"} proof of ${spec.path}`,
      `  folder:  ${dir}`,
      `  page:    ${result.page}`,
      `  plan:    ${plan.orientation} ${plan.width}x${plan.height}, ${plan.total}s; ${plan.personality}; enter ${plan.eases.enter}, emphasis ${plan.eases.emphasis}, exit ${plan.eases.exit}, moves ${plan.eases.move}; ambient ${plan.ambient}; accent ${plan.accent.key}`,
      ...(signatureSource ? [`  signature: ${plan.signature.name ?? "(unnamed)"} at ${plan.signature.start}s for ${plan.signature.dur}s`] : ["  signature: not played (pass --signature <file.js> to show the brand's own move)"]),
      ...(result.check ? [`  check:   ${result.check.errors} error(s), ${result.check.warnings} warning(s)${result.check.version ? ` (hyperframes ${result.check.version})` : ""}`] : []),
      ...(result.check?.findings ?? []).slice(0, 12).map((f) => `    ${f.severity.padEnd(7)} ${f.section}/${f.code}${f.selector ? ` ${f.selector}` : ""}${f.time != null ? ` at ${f.time}s` : ""}: ${f.message}`),
      ...(result.mp4 ? [`  video:   ${result.mp4}`] : []),
      ...result.frames.map((f) => `  frame:   ${f.file} (${f.name}, ${f.t}s)`),
      ...(result.contact ? [`  sheet:   ${result.contact}`] : []),
      ...problemLines(warnings, "warn"),
      ...result.problems.map((p) => `  error  ${p}`),
      ...(values["no-render"] ? ["  not rendered (--no-render): open the page or render it with hyperframes"] : []),
      ...(ok && !values["no-render"] ? ["  next: open every frame and the video, then show the owner the sheet and the video"] : []),
    ];
    return { code: ok ? 0 : 1, data: { ok, spec: spec.path, ...result, plan, warnings, metrics }, lines };
  },
};

function usage() {
  return [
    "usage: node motion.mjs <command> ...",
    "  find  [--project <dir>]",
    "  check <spec> [--json]",
    "  brief <spec>",
    '  proof <spec> [--orientation portrait|landscape] [--text "<1-6 words>"] [--sub "<line>"] [--accent <colorKey>]',
    "              [--accent-word <n>] [--signature <file.js>] [--lang <tag>] [--dest <dir>] [--no-render] [--json]",
  ].join("\n");
}

function main(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h" || !COMMANDS[command]) {
    process.stdout.write(usage() + "\n");
    return command && !COMMANDS[command] && command !== "--help" && command !== "-h" ? 2 : 0;
  }
  const json = rest.includes("--json");
  try {
    return out(COMMANDS[command](rest), json);
  } catch (e) {
    const message = e instanceof SpecError || e?.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION" || e instanceof Error ? e.message : String(e);
    if (json) process.stdout.write(JSON.stringify({ ok: false, error: message }) + "\n");
    else process.stderr.write(`error: ${message}\n`);
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));

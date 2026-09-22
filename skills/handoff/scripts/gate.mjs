#!/usr/bin/env node
// gate — verification harness and gate execution for `handoff`.
//
// P17 / P26: A child's pasted output is a claim; the dispatcher's gate run is
// the evidence. The verification harness must not fail silently green:
// 1. Any pipeline sets `pipefail` and captures per-command status (${PIPESTATUS[@]}),
//    not merely the final pipe stage's exit code.
// 2. Empty output where output was expected is classified as failure, catching
//    empty-expansion bugs and silent missing commands.
// 3. Matched evidence is recorded and returned for clear diagnostic output.
//
// Zero dependencies, Node 18+ ESM.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function runGateCommand(cmd, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const timeoutMs = options.timeout_ms ?? 120000;
  const expectOutput = Boolean(options.expect_output);
  const shell = options.shell ?? "bash";

  const statusId = randomBytes(8).toString("hex");
  const statusFile = join(tmpdir(), `gate-status-${statusId}.txt`);

  // Harness wrapper script:
  // Enforces `set -o pipefail`.
  // Evaluates the command passed in $1.
  // Captures PIPESTATUS array from inside the eval context.
  // Computes the pipefail return code (rightmost non-zero exit code).
  // Writes each PIPESTATUS exit code to $2.
  // Exits with the pipeline's overall return code.
  const harnessScript =
    'set -o pipefail; eval "$1; __pipe=(\\"\\${PIPESTATUS[@]}\\"); __rc=0; for c in \\"\\${__pipe[@]}\\"; do [ \\"\\$c\\" -ne 0 ] && __rc=\\$c; done; printf \\"%s\\\\n\\" \\"\\${__pipe[@]}\\" > \\"$2\\"; exit \\$__rc"';

  const startTime = Date.now();
  let spawnResult;
  try {
    spawnResult = spawnSync(shell, ["-c", harnessScript, "gate_harness", cmd, statusFile], {
      cwd,
      env,
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    return {
      cmd,
      exit_code: 1,
      pipe_statuses: [1],
      stdout: "",
      stderr: err.message,
      ok: false,
      status: "failed",
      reason: `spawn failed: ${err.message}`,
      duration_ms: Date.now() - startTime,
    };
  }

  const durationMs = Date.now() - startTime;
  let pipeStatuses = [];
  if (existsSync(statusFile)) {
    try {
      const content = readFileSync(statusFile, "utf8").trim();
      if (content.length > 0) {
        pipeStatuses = content.split("\n").map((s) => Number(s.trim()));
      }
      rmSync(statusFile, { force: true });
    } catch {
      /* ignore removal error */
    }
  }

  const exitCode = spawnResult.status ?? (spawnResult.signal ? 128 : 1);
  if (pipeStatuses.length === 0) {
    pipeStatuses = [exitCode];
  }

  const stdout = spawnResult.stdout ?? "";
  const stderr = spawnResult.stderr ?? "";

  // Check 1: Exit code non-zero or any stage in pipe_statuses non-zero
  const hasPipeFailure = pipeStatuses.some((code) => code !== 0);
  if (exitCode !== 0 || hasPipeFailure) {
    let reason;
    if (pipeStatuses.length > 1 && hasPipeFailure) {
      const failedIndices = pipeStatuses
        .map((code, idx) => (code !== 0 ? { idx, code } : null))
        .filter(Boolean);
      const details = failedIndices
        .map((f) => `stage ${f.idx} exited with code ${f.code}`)
        .join(", ");
      reason = `pipeline failed with pipefail [${pipeStatuses.join(", ")}]: ${details}`;
    } else if (exitCode === 127) {
      reason = `command not found (exit code 127)`;
    } else {
      reason = `command failed with exit code ${exitCode}`;
    }
    return {
      cmd,
      exit_code: exitCode,
      pipe_statuses: pipeStatuses,
      stdout,
      stderr,
      ok: false,
      status: "failed",
      reason,
      duration_ms: durationMs,
    };
  }

  // Check 2: Empty expected output detection
  if (expectOutput) {
    const combinedOutput = stdout.trim() + stderr.trim();
    if (combinedOutput.length === 0) {
      return {
        cmd,
        exit_code: exitCode,
        pipe_statuses: pipeStatuses,
        stdout,
        stderr,
        ok: false,
        status: "failed",
        reason: "empty expected output: gate produced no stdout or stderr",
        duration_ms: durationMs,
      };
    }
  }

  return {
    cmd,
    exit_code: 0,
    pipe_statuses: pipeStatuses,
    stdout,
    stderr,
    ok: true,
    status: "passed",
    reason: null,
    duration_ms: durationMs,
  };
}

export function runSessionGates(gates, options = {}) {
  const list = Array.isArray(gates) ? gates : gates ? [gates] : [];
  if (list.length === 0) {
    return {
      ok: true,
      status: "passed",
      results: [],
      failed_gate: null,
      summary: "no gates declared",
    };
  }

  const results = [];
  for (const item of list) {
    let cmd;
    let expectOutput = options.expect_output ?? false;
    let timeoutMs = options.timeout_ms;
    if (typeof item === "string") {
      cmd = item;
    } else if (typeof item === "object" && item !== null) {
      cmd = item.cmd ?? item.command;
      if (item.expect_output !== undefined) expectOutput = Boolean(item.expect_output);
      if (item.timeout_ms !== undefined) timeoutMs = item.timeout_ms;
    }
    if (!cmd) continue;

    const res = runGateCommand(cmd, {
      ...options,
      expect_output: expectOutput,
      ...(timeoutMs ? { timeout_ms: timeoutMs } : {}),
    });
    results.push(res);
    if (!res.ok) {
      return {
        ok: false,
        status: "failed",
        results,
        failed_gate: res,
        summary: `${cmd} failed: ${res.reason}`,
      };
    }
  }

  return {
    ok: true,
    status: "passed",
    results,
    failed_gate: null,
    summary: `all gates passed (${results.length}/${results.length})`,
  };
}

const isCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCLI) {
  const args = process.argv.slice(2);
  const expectOutput = args.includes("--expect-output");
  const filtered = args.filter((a) => a !== "--expect-output" && !a.startsWith("--cwd="));
  const cwdArg = args.find((a) => a.startsWith("--cwd="))?.slice(6);
  const cmd = filtered.join(" ");
  if (!cmd) {
    console.error("Usage: node gate.mjs [--expect-output] [--cwd=DIR] <command>");
    process.exit(1);
  }
  const res = runGateCommand(cmd, { cwd: cwdArg, expect_output: expectOutput });
  if (res.ok) {
    if (res.stdout) process.stdout.write(res.stdout);
    process.exit(0);
  } else {
    console.error(`gate failure: ${res.reason}`);
    if (res.stderr) process.stderr.write(res.stderr);
    process.exit(res.exit_code || 1);
  }
}

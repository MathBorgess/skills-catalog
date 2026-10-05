#!/usr/bin/env node
// gate.test.mjs — tests and red-path proof fixtures for gate.mjs

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGateCommand, runSessionGates } from "./gate.mjs";

function assert(msg, cond) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  ${msg}`);
}

export function runAllGateTests() {
  console.log("# gate.mjs tests");

  // 1. Pipefail and per-command status
  // A pipeline where an early stage fails but the final stage exits 0
  const rFailingPipe = runGateCommand("sh -c 'exit 2' | cat");
  assert("pipefail: pipeline with early exit 2 fails", rFailingPipe.ok === false);
  assert("pipefail: exit_code reflects the failure", rFailingPipe.exit_code === 2);
  assert("pipefail: pipe_statuses array captures each stage [2, 0]",
    Array.isArray(rFailingPipe.pipe_statuses) &&
    rFailingPipe.pipe_statuses.length === 2 &&
    rFailingPipe.pipe_statuses[0] === 2 &&
    rFailingPipe.pipe_statuses[1] === 0
  );
  assert("pipefail: failure reason names the failed pipeline stage",
    rFailingPipe.reason.includes("pipeline failed with pipefail") &&
    rFailingPipe.reason.includes("stage 0")
  );

  // A pipeline where all stages succeed
  const rSuccessPipe = runGateCommand("echo 'stage1' | cat | cat");
  assert("pipefail: all-green pipeline passes", rSuccessPipe.ok === true);
  assert("pipefail: all pipe_statuses are 0",
    rSuccessPipe.pipe_statuses.length === 3 &&
    rSuccessPipe.pipe_statuses.every((c) => c === 0)
  );

  // A pipeline where middle stage fails
  const rMiddleFail = runGateCommand("echo 'start' | sh -c 'exit 5' | cat");
  assert("pipefail: middle stage failure detected", rMiddleFail.ok === false);
  assert("pipefail: middle stage exit code is 5", rMiddleFail.exit_code === 5);
  assert("pipefail: middle stage pipe_statuses captures [0, 5, 0]",
    rMiddleFail.pipe_statuses.length === 3 &&
    rMiddleFail.pipe_statuses[0] === 0 &&
    rMiddleFail.pipe_statuses[1] === 5 &&
    rMiddleFail.pipe_statuses[2] === 0
  );

  // 2. Empty expected output detection
  // Command exits 0 but produces empty output when output was expected
  const rEmptyTrue = runGateCommand("true", { expect_output: true });
  assert("empty output: 'true' with expect_output: true is classified as failure", rEmptyTrue.ok === false);
  assert("empty output: reason explains empty expected output",
    rEmptyTrue.reason.includes("empty expected output")
  );

  const rWhitespace = runGateCommand("printf '   \n  \t  \n'", { expect_output: true });
  assert("empty output: whitespace-only output is classified as failure", rWhitespace.ok === false);

  // Command exits 0 and produces output when expected
  const rWithOutput = runGateCommand("echo 'verified'", { expect_output: true });
  assert("empty output: non-empty output passes", rWithOutput.ok === true);
  assert("empty output: stdout is captured", rWithOutput.stdout.trim() === "verified");

  // Command exits 0 with empty output when expect_output is false (e.g. fmt check)
  const rEmptyFmt = runGateCommand("true", { expect_output: false });
  assert("empty output: expect_output: false allows empty success", rEmptyFmt.ok === true);

  // 3. Command not found
  const rNotFound = runGateCommand("xyz_cmd_that_does_not_exist_404");
  assert("not found: exit code 127 classified as failure", rNotFound.ok === false && rNotFound.exit_code === 127);
  assert("not found: reason identifies missing command", rNotFound.reason.includes("command not found"));

  // 4. Deliberately failing fixtures proving the verifier's red path (P26)
  const fixDir = join(tmpdir(), `gate-fixture-${Date.now()}`);
  mkdirSync(fixDir, { recursive: true });

  try {
    // Deliberate Fixture 1: Compiler check failure masked by `tail` pipe
    // Mimics P26 failure 1: `clippy | tail` where compiler exits 1 but tail exits 0.
    const clippyScript = join(fixDir, "fake-clippy.sh");
    writeFileSync(clippyScript, "#!/bin/sh\necho 'error: could not compile crate' >&2\nexit 1\n", { mode: 0o755 });

    const rMaskedCompiler = runGateCommand(`${clippyScript} | tail -n 1`, { cwd: fixDir });
    assert("red path fixture 1: verifier catches compiler error masked by pipe to tail",
      rMaskedCompiler.ok === false &&
      rMaskedCompiler.pipe_statuses[0] === 1 &&
      rMaskedCompiler.pipe_statuses[1] === 0
    );

    // Deliberate Fixture 2: Unquoted shell expansion running 0 tests and exiting 0
    // Mimics P26 failure 2: `test $EMPTY_PKGS` running nothing and exiting 0.
    const emptyExpansionCmd = 'PKGS=""; for p in $PKGS; do echo "testing $p"; done; true';
    const rSilentGreenSkipped = runGateCommand(emptyExpansionCmd, { cwd: fixDir, expect_output: true });
    assert("red path fixture 2: verifier catches empty expansion that ran no tests",
      rSilentGreenSkipped.ok === false &&
      rSilentGreenSkipped.reason.includes("empty expected output")
    );

    // Deliberate Fixture 3: runSessionGates with mixed checks
    const sessionGates = [
      { cmd: "echo 'fmt ok'", expect_output: false },
      { cmd: `${clippyScript} | tail -n 1`, expect_output: false },
    ];
    const sessionRes = runSessionGates(sessionGates, { cwd: fixDir });
    assert("red path fixture 3: runSessionGates halts and reports the failing gate",
      sessionRes.ok === false &&
      sessionRes.failed_gate !== null &&
      sessionRes.failed_gate.cmd.includes("fake-clippy") &&
      sessionRes.summary.includes("failed")
    );

    // Green path: session gates all passing
    const greenGates = [
      { cmd: "echo 'fmt clean'" },
      { cmd: "echo 'test 1 passed' | cat" },
    ];
    const greenRes = runSessionGates(greenGates, { cwd: fixDir });
    assert("session gates: all green gates pass", greenRes.ok === true && greenRes.results.length === 2);
  } finally {
    rmSync(fixDir, { recursive: true, force: true });
  }

  console.log("ok: gate tests passed\n");
}

if (process.argv[1] && process.argv[1].endsWith("gate.test.mjs")) {
  runAllGateTests();
}

#!/usr/bin/env node

import { CAPABILITIES as skillCapabilities } from "../../skills/handoff/scripts/handoff.mjs";
import { CAPABILITIES, proposeSession } from "./propose.mjs";

let failed = 0;

function assert(name, cond) {
  if (cond) console.log(`ok  ${name}`);
  else {
    failed++;
    console.error(`FAIL ${name}`);
  }
}

const yesBackend = {
  name: "fake-yes",
  decide() {
    return { index: 0, p: 1, dist: [1, 0] };
  },
};

const compressBackend = {
  name: "fake-compress",
  decide() {
    return { index: 1, p: 1, dist: [0, 1] };
  },
};

const session = {
  id: "01",
  goal: "bind a loopback listener and commit",
  writes: ["src/**"],
  commands: ["git diff", "npm test"],
  reasoned: {
    tier: "design",
    size: "m",
    capability_answers: {
      network: "yes",
      "unix-socket": "no",
      "git-write": "yes",
      pty: "no",
      "disk-write": "no",
      "high-memory": "no",
    },
    needs: ["network", "git-write"],
  },
};

{
  assert(
    "capability list matches the skill",
    JSON.stringify(CAPABILITIES) === JSON.stringify(skillCapabilities),
  );
  const proposal = proposeSession(session);
  assert("rules proposal does not fill the skill", proposal.fills_skill_fields === false);
  assert("rules does not predict tier or size", proposal.fields.tier === null && proposal.fields.size === null);
  assert(
    "rules capability floor is all no",
    CAPABILITIES.every((cap) => proposal.fields.capability_answers[cap] === "no") &&
      proposal.fields.needs.length === 0,
  );
  assert("rules has no shadow", proposal.shadow === null);
  assert(
    "agreement against a reasoned yes is a drop, not a match",
    proposal.agreement.match === false &&
      proposal.agreement.dropped.includes("network") &&
      proposal.agreement.added.length === 0,
  );
  assert("a proposal never claims to beat the reasoned record", proposal.trial.beats_reasoned_record === false);
  const diff = proposal.commands.find((row) => row.command === "git diff");
  const test = proposal.commands.find((row) => row.command === "npm test");
  assert("git diff stays whole on the regex floor", diff.floor_whole === true && diff.emitted_whole === true);
  assert("npm test is not a floor match", test.floor_whole === false && test.emitted_whole === false);
}

{
  const proposal = proposeSession(session, { policy: "shadow", backend: yesBackend });
  assert("shadow records the local yeses", proposal.shadow.needs.includes("network"));
  assert(
    "shadow does not copy local yeses into the floor fields",
    proposal.fields.needs.length === 0,
  );
  assert(
    "agreement compares the shadow to the reasoned record",
    proposal.agreement.added.includes("unix-socket") && proposal.agreement.match === false,
  );
}

{
  const proposal = proposeSession(session, { policy: "action", backend: compressBackend });
  const diff = proposal.commands.find((row) => row.command === "git diff");
  const test = proposal.commands.find((row) => row.command === "npm test");
  assert(
    "action cannot compress a guarded command",
    diff.shadow_whole === false && diff.emitted_whole === true,
  );
  assert(
    "action may compress a command the floor does not keep",
    test.shadow_whole === false && test.emitted_whole === false,
  );
}

{
  let threw = false;
  try {
    proposeSession(session, { policy: "shadow" });
  } catch {
    threw = true;
  }
  assert("shadow without a backend is refused", threw);
}

if (failed) {
  console.error(`\n${failed} propose failed`);
  process.exit(1);
}
console.log("\nok: propose tests");

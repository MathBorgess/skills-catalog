#!/usr/bin/env node
// Propose the same field names handoff reasons, without writing a plan and
// without being imported by a skill. `fields` is the floor. `shadow` is the
// local backend, recorded beside the floor, never copied into `fields`.
// `beats_reasoned_record` stays false: a trial in docs/experiments is what
// may say otherwise, and only with a shuffled-context control.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalBackend, guardedSkip, noul, rules } from "./s1.mjs";

// Keep this list identical to CAPABILITIES in skills/handoff/scripts/handoff.mjs.
export const CAPABILITIES = [
  "network",
  "unix-socket",
  "git-write",
  "pty",
  "disk-write",
  "high-memory",
];

const POLICIES = ["rules", "shadow", "action"];
const WHOLE = "must this command's output reach the model whole?";

function yesNo(decision) {
  return decision?.yes ? "yes" : "no";
}

function yeses(answers) {
  return CAPABILITIES.filter((cap) => answers[cap] === "yes");
}

function agreementWith(reasoned, proposedNeeds) {
  if (!reasoned || !Array.isArray(reasoned.needs)) return null;
  const have = new Set(reasoned.needs);
  const pred = new Set(proposedNeeds);
  const added = proposedNeeds.filter((cap) => !have.has(cap));
  const dropped = reasoned.needs.filter((cap) => !pred.has(cap));
  return { match: added.length === 0 && dropped.length === 0, added, dropped };
}

function localWhole(backend, command) {
  const decision = backend.decide({
    kind: "noul",
    context: command,
    options: ["yes", "no"],
    site: "rtk",
    question: WHOLE,
  });
  if (!decision || decision.abstain) return null;
  return decision.index === 0;
}

export function proposeSession(session = {}, opts = {}) {
  const policy = opts.policy ?? "rules";
  if (!POLICIES.includes(policy)) {
    throw new Error(`policy must be one of: ${POLICIES.join(", ")}`);
  }
  const local =
    opts.backend ?? (opts.checkpoint ? createLocalBackend(opts.checkpoint) : null);
  if ((policy === "shadow" || policy === "action") && !local) {
    throw new Error(`${policy} needs a backend or a checkpoint`);
  }

  const context = {
    goal: session.goal ?? "",
    writes: session.writes ?? [],
    verify: session.verify ?? [],
  };
  const capability_answers = {};
  const shadow_answers = {};
  for (const cap of CAPABILITIES) {
    const question = `does this session require the ${cap} capability?`;
    const floor = noul(context, question, { site: "capabilities", backend: rules });
    capability_answers[cap] = yesNo(floor);
    if (local) {
      const guessed = noul(context, question, { site: "capabilities", backend: local });
      shadow_answers[cap] = yesNo(guessed);
    }
  }

  const commands = (session.commands ?? []).map((command) => {
    const floor_whole = guardedSkip(command);
    const shadow_whole = local ? localWhole(local, command) : null;
    // The regex floor cannot be crossed. Action may compress only a command
    // the floor does not already keep whole, and an abstention stays whole.
    const emitted_whole =
      policy === "action" ? floor_whole || shadow_whole !== false : floor_whole;
    return { command, floor_whole, shadow_whole, emitted_whole };
  });

  const shadow = local
    ? { capability_answers: shadow_answers, needs: yeses(shadow_answers) }
    : null;
  const comparedNeeds = shadow ? shadow.needs : yeses(capability_answers);

  return {
    fills_skill_fields: false,
    policy,
    backend: local ? local.name ?? "local" : "rules",
    fields: {
      tier: null,
      size: null,
      capability_answers,
      needs: yeses(capability_answers),
    },
    shadow,
    commands,
    reasoned: session.reasoned ?? null,
    agreement: agreementWith(session.reasoned, comparedNeeds),
    trial: {
      baseline: "docs/experiments",
      shuffled_control: "unmeasured",
      beats_reasoned_record: false,
    },
  };
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return null;
  const value = process.argv[i + 1];
  return value && !value.startsWith("--") ? value : true;
}

const isMain =
  process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isMain) {
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!file) {
    console.error(
      "usage: node scorers/system-one/propose.mjs session.json [--policy rules|shadow|action] [--checkpoint PATH]",
    );
    process.exit(1);
  }
  const session = JSON.parse(readFileSync(file, "utf8"));
  const proposal = proposeSession(session, {
    policy: arg("policy") ?? "rules",
    checkpoint: arg("checkpoint"),
  });
  console.log(JSON.stringify(proposal, null, 2));
}

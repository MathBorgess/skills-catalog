# 2026-09-21 — cua-s1-forms transfer, v1

**Status: pending.** This trial is not shipped in `skills/handoff` or `skills/shunt`. No scorer call, checkpoint, or opt-in flag was added to either skill. The structural handoff changes that rode along with the trial (a real model name on every session, a stale credential no longer blanking a slot, a gate that records pipe status, a dispatcher that adopts a live pid and treats `result.md` as durable) are in the skill. The scorer is not.

## What was asked

Whether the published `cua-ai/cua-s1-forms` checkpoint (706,048 parameters, MIT, revision `f54adbf447f4ca6ec259f529ee3f2e3e09f8cc71`) carries useful signal for two yes/no decisions outside form filling:

- E1 — does this session require a named capability?
- E3 — must this command's output reach the model whole?

Shadow only. No training. No action mode. The production route and the regex floor were not called.

## What the checkpoint actually is

A jev-like one-pass option scorer. Context plus a list of options in, one probability per option out. There is no separate neural adapter. The whole model is the head, trained on one contract:

```text
TASK fill the form from the document, then submit
FORM <window title>
ELEMENT Edit "Phone number" value=""
```

Options are document pointers (`fill Tel: (503) 555-0142`) and always end with `check`, `click`, `skip`. Context is cut at 224 bytes. Each option is cut at 96 bytes. The model cannot invent a value. Upstream reports 99.95% top-1 on a form-disjoint synthetic test and 37% when the context is shuffled, which is the evidence that, inside this contract, it reads the element.

## What v1 actually fed it

One encoding, frozen before scoring, `form-checkbox-v1`:

```text
TASK does this session require the network capability?
FORM System One shadow experiment (capabilities)
ELEMENT Checkbox "<the same question>" value="<the goal>"
options: ["check", "skip"]
```

`check` was mapped back to yes, `skip` to no. That string is not the training contract:

- `TASK` is the capability question, not `fill the form from the document, then submit`.
- The role is `Checkbox`, not `CheckBox`, and the goal sits in `value` instead of an empty or `unchecked` element.
- The `fill …` pointers and `click` are absent. With no document entity, the training prior is `skip` (11,516 of about 22,054 examples).
- On the six positive E1 goals the string is 229–257 bytes. The 224-byte cut drops the tail of the goal, which is the only text that distinguished the case.

## What came back

Native form control, five hand-built cases in the real contract: argmax matched an independent numpy port on 5/5, max per-logit absolute difference `1.14e-5`. Torch parity is unmeasured (the host disk was too full to install it). Repeat runs were bit-identical. One decision took about 330 ms in pure JavaScript, which is a latency fact, not a quality fact.

E1, 12 declared-synthetic cases, not historical labels: agreement with the report's own expectation was 6/12. Every `p_yes` was `0.000` or `1.000`.

E3, 10 commands, 4 of them on the regex floor: the model agreed with the floor on 1 of 4, and on the other 3 it would have called a guarded command compressible. Shadow did not change any command.

## What that does and does not say

The weights discriminate inside the form contract. This encoding does not elicit that. The smoke does not prove a contract-faithful encoding would transfer, and it does not prove the checkpoint is incapable of every non-form question. It does prove `form-checkbox-v1` is not evidence for turning a scorer on.

It says nothing about the deterministic rules that already route capabilities, and nothing against the regex floor. Those paths were not the thing that scored. The floor's job is to ignore a model that would compress `git diff`, `cat`, or `grep`.

## A larger scorer that speaks this contract

[`pngwn/system-one-qwen3.5-4b-scorer-v2b`](https://huggingface.co/pngwn/system-one-qwen3.5-4b-scorer-v2b) is a different object, not a bigger copy of `cua-s1-forms`.

| | cua-s1-forms | Qwen3.5-4B scorer v2b |
| --- | --- | --- |
| Shape | byte encoder, 2 layers, width 128, 706,048 params | `Qwen/Qwen3.5-4B-Base` plus LoRA r=16 and a scalar head; 30,476,800 trainable of 4,236,230,656 |
| Contract | one form element, `fill` / `check` / `click` / `skip` | typed questions: choice, noul (`yes`/`no`), score; state + question + the caller's options |
| Context limit | 224 bytes | 384 tokens |
| Option cap in training | the form's entities plus 3 actions | 16 (eval may score more) |
| Calibration | not claimed for our sites | temperature 2.35 fitted on its val split; overall ECE 0.022 after calibration |
| Noul on its own val | not this task | 227 questions, accuracy 0.943, ECE 0.025 |
| Choice on its own val | not this task | 1,176 questions, accuracy 0.634 |
| Where it runs | pure JavaScript, about 330 ms, no GPU | the published measurement is 128 ms per query at 5 options, peak GPU memory 15.09 GB |
| License | MIT | CC-BY-NC-4.0, inherited from a ticket component of `pngwn/system-one-decisions` |

The 4B model is trained on `state` / `question` / `options` rows whose noul options are `["yes", "no"]`. Wrapping those questions as checkboxes would repeat v1's mistake in the other direction. Its noul number is on ticket-shaped questions in that dataset, not on handoff capabilities or shunt's raw-vs-compress decision. Choice accuracy of 0.63 is a reminder that "more parameters" is not a uniform win. The non-commercial license cannot sit inside this public catalog's skill.

It is a candidate for a **later** versioned trial, still outside the skill, still shadow, with a shuffled-context control and labels that are not the experimenter's guess. It is not a reason to wire a scorer into the skill now.

## Next directory, when there is one

`2026-09-21-cua-s1-forms-v2` only if someone reruns the same weights with a contract-faithful encoding (canonical `TASK`, `CheckBox`, the goal inside 224 bytes, options that include a `fill` pointer plus `check`/`click`/`skip`) and the probabilities leave 0/1. If that also sits at chance, stop transferring this checkpoint.

A Qwen trial gets its own directory. It does not edit this one. The skill reasons those decision sites itself (`capability_answers`, verdict, risk). The scorer runtime that can propose the same fields, still behind the floors and still outside the skill, is [`scorers/system-one/`](../../../scorers/system-one/README.md). It does not include this encoding. A scorer lands in the skill only when a later trial shows it fills those fields, stays behind the floors, and beats that reasoned record on a shuffled-context control.

# Record return loses its permission check

PR: `fixture-auth` (local fixture); base: `fixed-base-1`; head: `fixed-head-1`; review cutoff: current supplied fixture.

## Change

The diff removes `require_permission(user)` before the code returns a record.
The author calls the change "formatting-only".
That description conflicts with the removed permission check.
These inputs come from [the fixture](fixture.txt), lines 1–4, at `fixed-head-1`.

## Evidence

The supplied result says `exit 1 authorization_regression failed`.
The wrapper reports `success`; it does not erase the raw failure.
See [the fixture](fixture.txt), lines 5–6, at `fixed-head-1`.
No live test occurred in this task.

## Risks and unknowns

The removed check creates a risk of record access without permission.
This risk follows from the diff summary, not a live access test.
The full source, command, logs, and recovery method remain unavailable.
The failed check needs attention before approval.

## Review path

Read the permission check removal first.
Then inspect the raw failure and the wrapper conflict.
The fixture omits the source path and exact lines.
Confirm the intended permission behavior with the author.
The fixture supports no claim of faster human review.

# The gate

Twelve generations are cheap to launch and expensive to redo, and every one of them carries a decision the owner may disagree with. So the plan is approved once, as a whole, before anything is generated. Run the rounds after `route` accepts the plan and before `route --approve`.

## Each round

1. Show the day as a table:

   | Frame | Clock | Light | Person in the reflection | Objects that change here | Route | Breaks if removed |
   |---|---|---|---|---|---|---|

   The last column is `route`'s own count. Show the weakest four-frame window under the table, in its words: *"frames 05–08 destroy 6 transitions"*.
2. Ask numbered questions with a recommended answer each. Every one of these is a real question, not a courtesy:
   - Every warning `route` printed. An ambiguous `window` or `lamp` is resolved by the owner, never by you.
   - Any frame whose `breaks if removed` is 1. It is the closest thing in the series to a frame nobody would miss.
   - The two frames with the longest gap between clocks: is the day skipping something that matters?
   - Any frame where the person's action does not follow from the previous frame's.
   - Each route choice, when routes are mixed, and what that means for the identity drift the axis claims.
   - The cursor coordinate itself, once: it is the one number that cannot change later without re-running everything.
3. Apply the owner's edits to `plan.json`, run `route` again, show the new table. Repeat until they approve.

## What a round is for

Not to confirm the plan is nice. To find the frame that will embarrass the collection when someone asks the seven questions in [`axis.md`](axis.md). The most useful question you can ask in a round is the third attack, out loud, about this specific plan: *if I delete frames 05 to 08, name what breaks.* If the answer is "the day gets coarser", the chain is decorative and the plan is not ready.

## The lock

```bash
node <skill>/scripts/collection.mjs route --run "$SCLD_RUN" --approve
```

This records the hash of that exact plan. `dispatch` refuses a plan that changed afterwards and tells you so. If the owner changes their mind later, edit, `route` again, run one more round, and approve again — never ask for approval of a hash they already approved, and never edit the plan quietly between approval and dispatch.

# Issue tracker: none

This repo has no issue tracker. There are no GitHub issues, no `.scratch/`, and no triage labels —
the `triage` skill is not installed, so `docs/agents/triage-labels.md` does not exist either.

`build_plan.md` is the work list and the stage order.

## When a skill says "fetch the relevant ticket"

Read `build_plan.md` and take the stage or step named. A step's own detail, where it has any, is in
the matching `docs/plan-*.md`.

## When a skill says "publish to the issue tracker" or "open an issue"

Don't. Report the finding in the conversation instead, and ask before writing anything to
`build_plan.md` — it is the user's plan, not a queue an agent appends to.

## Stages end with a check the user runs

Working rule 7: before a stage is committed, write down what to open, type or click to confirm it
works and what a failure looks like. Nothing is pushed until the user confirms. A skill that would
close out work on its own stops here and hands the check to the user.

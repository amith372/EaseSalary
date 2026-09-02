# Domain docs

How the engineering skills consume this repo's domain documentation. `CLAUDE.md` points here; on
any conflict `CLAUDE.md` and `specs.md` win, and nothing in this file creates a new document.

## There is no `CONTEXT.md`

There is no `CONTEXT.md`, no `CONTEXT-MAP.md` and no `docs/adr/`, and none is to be created —
`specs.md` is this repo's glossary and domain model, and a second one would be a second truth.

## Before exploring, read `specs.md`

Where a skill says *read `CONTEXT.md` before exploring*, read `specs.md`:

- **Part 1** — the concepts, what the app is for, and what is deliberately out of scope.
- **Part 5** — the terms whose meaning is counter-intuitive: rates, rounding, column meanings,
  date counting, layout traps. Read this before naming anything.
- **Part 4** — the August 2025 known case and the invalid case, when a worked example is what the
  glossary would have given you.

`specs.md` is read on demand and never auto-loaded, so a session that has not opened it has not
read the domain model.

## Use the spec's vocabulary

When your output names a domain concept — an issue title, a refactor proposal, a hypothesis, a
test name — use the term as `specs.md` defines it. Hebrew is for user-facing strings only; the
identifiers and the prose stay English. If the concept you need is not in `specs.md` yet, that is
a signal: either you are inventing language the project does not use (reconsider), or working
rule 1 applies and the spec is fixed before the code is.

## Where a decision gets written down

Where a skill says *update `CONTEXT.md`* or *record an ADR*, working rule 3 already says where the
decision goes:

| The decision is about | It goes in |
|---|---|
| what the app does — behavior, rules, entitlements | `specs.md` |
| how it is built — stack, conventions, standing constraints | `CLAUDE.md` |
| one stage only, and dies with it | `docs/plan-*.md` |

Edit that file in the same step as the code, and replace superseded wording outright rather than
layering a correction on top; the files describe only what stands now. A rule whose reason is not
self-evident carries its reason in the same sentence.

## Flag conflicts, don't override them

A skill that contradicts a standing decision surfaces the contradiction rather than overriding it,
exactly as it would for an ADR:

> _Contradicts `specs.md` Part 2 (no rate is ever hardcoded) — but worth reopening because…_

The non-negotiables listed in `CLAUDE.md` are the ones most likely to be contradicted by a generic
suggestion, and the ones never to be quietly overridden.

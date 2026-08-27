# EaseSalary — scaffold the repo and implement `דף הבית v2`

## Context

EaseSalary is specified but not started. `specs.md`, `build_plan.md`, `CLAUDE.md`, three
`.xlsx` templates and six holiday JSONs exist in `C:\Users\Amit_PC\Downloads\EaseSalary`.
The working directory `D:\school\LLM vibe coding\EaseSalary` is **empty**, and
`github.com/amith372/EaseSalary.git` has **no commits**. No code implements any of
build_plan's stages 1–6.

This pass does three things:

1. Creates the repo — scaffold, tooling, and the data files moved out of `Downloads`.
2. Implements the home screen from the Claude Design canvas, in Hebrew RTL, built to
   survive Chrome's translate-to-English.
3. Folds the design into `build_plan.md` and records where the canvas and the spec
   disagree.

**On "UI first, then logic":** not quite. The home screen is built against the
calculation engine's **real TypeScript types**, with fixture values filling them. The
contract is fixed now; Stage 1 fills it in later. The home screen is the only screen
that computes nothing — it reads. Every screen that computes (`חישוב החודש`,
`דף המשכורת`) waits for the engine, so build_plan's engine-first principle stands.

**Decisions taken** (from the user, this session):
- Home screen: **the design wins** over `specs.md` item 26. Build v2 as drawn, calendar
  included; amend item 26 to match, per CLAUDE.md rule 1 (fix the spec before the code).
- Other design/spec drift: **document, don't build.**
- Git: init and commit locally, **do not push**.

---

## Step 1 — Repo and scaffold

Target: `D:\school\LLM vibe coding\EaseSalary`

- `create-next-app` — TypeScript, App Router, Tailwind, `src/`, no ESLint prompt churn.
  Add Vitest.
- **git**: `git init` inside `EaseSalary/`, remote `origin` →
  `https://github.com/amith372/EaseSalary.git`. Add `EaseSalary/` to
  `D:\school\LLM vibe coding\.gitignore` so the Price-Comparison repo (whose root is the
  parent directory) does not swallow it. Commit locally; do not push.
- **`.gitignore` trap — must get right:** the parent repo's `.gitignore` ignores
  `*.xlsx`. The three templates are load-bearing data. The new repo's `.gitignore` must
  **not** ignore `.xlsx`, or Stage 2 ships without its templates.

Copy from `Downloads\EaseSalary\` (copy, not move — leave the originals):

| From | To | Note |
|---|---|---|
| `specs.md`, `CLAUDE.md`, `build_plan.md` | repo root | `specs.md` is byte-identical to the canvas's `uploads/specs_1.md` — verified |
| `template_month_standard_1.xlsx` | `data/templates/template_month_standard.xlsx` | drop the `_1` download suffix |
| `template_month_advance_given.xlsx` | `data/templates/` | see reconciliation note below |
| `template_balances_yearly.xlsx` | `data/templates/` | |
| `PH-2026_1.json` | `data/holidays/PH-2026.json` | drop the `_1` |
| `IN/LK/NP/UZ/UA-2026.json` | `data/holidays/` | |

Two data defects to flag in the commit, not silently fix: `UA-2026.json` has an **empty**
`holidays` array, and its `source_url` points at country code `UK`, not `UA`.

## Step 2 — Design tokens, shell, and shared components

Extracted from the canvas (all eleven artboards share one system).

`src/app/globals.css` — Tailwind `@theme` tokens:

```
ink #33291F   ink-soft #7B6A59   ink-faint #9A8874   ink-mute #8C7A67
surface #FFFDFA  line #EADCC9  line-soft #F3EADC  hairline #F0E6D8
forest #3F6047 (primary)  forest-deep #2C4633  bark #2E4636 (sidebar)
cream #EDE4D6  cream-hi #FFFBF4  sand #FDF3E7  sand-line #EEDCC4
clay #C9663C  clay-ink #B0663C  clay-bg #FAECDD
vacation #5B8AA6   sick #C1798A   holiday #C89A4A   rest #DDD5C7
```

Type: Assistant (Google Fonts) 300/400/500/600/700, via `next/font/google`.
Radii 12/13/14/16/20/22/24, pill `999px`. One shadow:
`0 18px 40px -36px rgba(80,52,24,0.5)`.

Components in `src/components/`:

- `AppShell` — the 232px `bark` sidebar (wordmark, five nav items with state dots, the
  "צריך/ה עזרה?" card) plus the top header. Every artboard uses it verbatim.
- `WhyDisclosure` — the circular `?` button and its expanding explanation panel with an
  optional kol-zchut link. **This is the most-repeated element on the canvas** and is the
  UI half of `specs.md` item 24; see improvement note 1.
- `MonthCalendar` — Sunday-first 7-column grid, marks, legend, and **range selection**
  (below).
- `Card`, `StatusPill`, `MoneyValue`, `Bidi`.

`src/lib/`:
- `i18n/he.ts` — every Hebrew string, one file (CLAUDE.md convention).
- `links.ts` — the central kol-zchut reference list (`specs.md` item 25; see note 7).
- `dates.ts` — **UTC-only** month arithmetic. `Date.UTC`, never a local-time constructor;
  Saturday is `6`. Both traps are called out in `specs.md` Part 5.
- `types.ts` — the engine's output shape: month components, balances, and an
  `explanation` per line. Fixtures conform to it. A month's facts are held as
  **`{ kind, from, to, note }` spans, not per-day marks** — see below.
- `fixtures/home.ts` — placeholder values matching the canvas (`[סכום]`, `[מספר]`).

## Step 3 — `src/app/page.tsx` — the home screen

Built as drawn in `EaseSalary - דף הבית v2.dc.html`: worker switcher, the "צריך לטפל"
hero, the interactive calendar, the "מה שולם החודש" panel with per-line `?` disclosures
and the export button, the "יתרות" panel, and the "גם מחכה לך" action list.

The `sc-for` / `sc-if` / `DCLogic` constructs are canvas-runtime only — they become
`.map()`, conditional render, and `useState`. Calendar marks are **client state only**
this pass; there is no persistence until Stage 3, and the plan says so rather than
implying the screen saves.

Two fixes to the canvas that are bugs rather than design intent:
- The canvas hardcodes six leading blank cells for August 2026. Derive them from the UTC
  weekday of the 1st.
- The canvas greys every Saturday and labels that grey "שבת חופשית" in the legend,
  conflating the default weekly rest day with the marked exception. Per `specs.md`
  item 5 a free Saturday is *not* an entitlement — these get two distinct states, the
  default labelled "שבת".

### Range selection

A week's vacation should be one gesture, not seven clicks. And for sickness the range
*is* the correct model: Part 3 requires a spell be stored as the dates it ran between,
which per-day marks cannot express.

So a month's facts are **spans** — `{ kind, from, to, note }` — and a single day is just
a span of one. This is the storage shape, not a UI convenience layered over per-day
marks.

Interaction, with a mark tool (חופש / מחלה / חג / שבת חופשית) selected:

- **Press and sweep** across days — the primary gesture, discoverable without
  instruction. Pointer events, so it works with touch.
- **Click a start day, then shift-click an end day** — the keyboard-reachable
  equivalent. Roving `tabindex` on the grid, `Shift`+arrows to extend, `Space` to commit.
- A live "‎[מ] – ‎[עד] · ‎[מספר] ימים" readout while sweeping, each figure `<bdi>`-isolated.
- Clicking inside an existing span clears that whole span rather than punching a hole in
  it — a span is one thing, and splitting a sick spell would change what it pays.

Rules the range has to respect, all from `specs.md`:

- **A sick span keeps its Saturdays.** Item 8: Saturdays inside a spell count toward it
  and are drawn from the balance, though they are not paid.
- **A vacation span skips Saturdays** — confirmed with the user this session. Saturday is
  already the weekly rest day and sits outside the standard count (item 5), so drawing a
  balance day for it would charge the worker twice. Vacation from 16 to 22 August draws
  six days, not seven. The asymmetry with sickness is deliberate and carries its reason
  into `specs.md` item 5.
- **A sick span may cross the month boundary**, and must (item 8, Part 3). The calendar
  shows one month, so a span running past the end is stored whole and rendered clipped,
  with the overflow shown as text rather than silently truncated.
- **Conflicts apply where valid and report the rest.** A span overlapping a day that
  refuses the mark — a paid holiday on a free Saturday, the invalid case in Part 4 —
  marks the days it legally can and says plainly which it skipped and why. Refusing the
  whole sweep over one bad day would make the user find it themselves, against Part 1's
  "choose the option that requires the user to know less."
- **Part-days stay single-day** (items 7, 10). A span is whole days; a half vacation or
  half holiday is a one-day action with a fraction.

### RTL and Chrome-translate rules

`specs.md` Part 5 warns that RTL failures here are quiet. These are the working rules —
authored once into CLAUDE.md in Step 5, applied here first:

- `<html lang="he" dir="rtl">`. Logical properties only — `ms/me/ps/pe`,
  `text-start/text-end`, `border-s/border-e`. Never `left`/`right`.
- Wrap every number, amount, date, name, and identifier in `<bdi>`. Numeric inputs carry
  `dir="ltr"` inside an isolated wrapper.
- **No text inside images.** The canvas already has none — colored dots and rules do all
  the graphical work. Two things still need replacing: the `›`/`‹` chevrons (text nodes
  that Chrome will try to translate and that read backwards in RTL) and the `X` badge on
  the Excel button. Both become inline `<svg aria-hidden="true">`, mirrored via
  `scale-x-[-1]` under RTL.
- **React + Chrome Translate crash.** Chrome swaps text nodes in place; React then throws
  `NotFoundError` on `removeChild` when a bare dynamic string sits as a sibling of other
  nodes. Hard convention: **every dynamic string gets its own wrapping element** — write
  `<span>שלום, </span><bdi>{name}</bdi>`, never `שלום, {name}`.
- `translate="no"` on the `EaseSalary` wordmark, currency amounts, and (later) passport
  and bank numbers.
- `dir="auto"` on **leaf text elements** (headings, paragraphs, labels) while layout
  containers stay `dir="rtl"`. Hebrew resolves to RTL; translated English resolves to
  LTR and aligns correctly instead of hanging off the right edge.
- No meaningful text in CSS `content:` — Chrome cannot translate it.
- **A sweep is ordered by date, never by screen position.** In RTL the calendar runs
  right-to-left, so a leftward drag moves *forward* in time. Normalise the span with
  `from = min(anchor, cursor)` on the dates themselves; anything keyed off column index
  or `clientX` inverts, and — per the Part 5 warning — looks plausible while being wrong.

## Step 4 — `build_plan.md`

`build_plan.md` is *what to build next*. It must not re-describe work Steps 1–3 finish in
this same pass, and it must not carry tokens or conventions — those live in
`globals.css` and CLAUDE.md. So it gets only what has no other home. Stages 1–6 keep
their numbers.

**A. "The design"**, directly after the ordering principle — the canvas URL and project
id, and the eleven artboards mapped to the stages that consume them. A pointer, not a
copy:

| Artboard | Consumed by |
|---|---|
| `דף הבית v2` | Stage 6 (built now against fixtures) |
| `חישוב החודש`, `החודשים` | Stage 4 |
| `דף המשכורת` | Stages 2 + 4 |
| `העובדות`, `דף העובד`, `הוספת עובד` | Stage 3 |
| `הגדרות`, `תשלומים` | Stages 3 + 5 |
| `דוחות` | Stage 2 (yearly balances) |
| `התראות` | Stage 6 — see reconciliation |

**B. "Stage 0 — repo, scaffold, design system"**, one short entry marked **done**, listing
outcomes only: repo initialised against the EaseSalary remote, data files in
`data/`, tokens and shell in `src/`, home screen rendering from fixtures. It records that
the stage happened; Steps 1–3 above are the description of it.

**C. A "Design ↔ spec reconciliation" section** — the drift, documented and not built:

*In the canvas, not in the spec:* accrued-severance card on `דף העובד` (Part 1: severance
is out of scope) · PDF export on `דף המשכורת` (spec: `.xlsx` only) · payment date, payment
method and "mark as paid" for the salary itself · notification toggles in `הגדרות` ·
"להוריד את כל הנתונים" · **editable "ימי חופשה בשנה" / "ימי מחלה בשנה"** (items 7–8 derive
both; CLAUDE.md: the user never enters a rate) · **configurable weekly rest day** (item 5
fixes it at Saturday for every worker) · "היתר העסקה" number · a separate `התראות` page and
bell (item 26 puts the actions on the opening screen) · "לסיים העסקה" (appendix: out of
scope for v1).

*In the spec, missing from the canvas:* the **two day counts**, standard and actual
(items 2 and 5 — a Wage Protection Act requirement) · **minimum-wage confirmation before
every export** (item 4) · the **pre-export confirmation questions** (item 18 — the
wizard's step 3 is a read-only summary, not questions) · **part-days** for vacation and
holiday (items 7, 10 — the calendar mark is binary) · the **third-party payments** group
(items 5, 16 — column H, never in the worker's total) · the **holiday picker** (item 10 —
the home screen links to it but no artboard exists) · a **sick spell crossing a month
boundary** (item 8) · **an override shown as manual** (item 17) · **a note on every
action** (item 5) · a **future month filled but not exportable** (item 21).

**D. Improvement notes**, folded into the stages they belong to.

## Step 5 — `CLAUDE.md`

CLAUDE.md is *how* to build, and its "Code conventions" section already carries the RTL
rules (logical properties, `<bdi>`, UTC dates). The Chrome-translate rules from Step 3 are
conventions of the same kind and belong there — appended to that section, in one place,
rather than repeated in build_plan or rediscovered per screen.

## Step 6 — `specs.md`

Two amendments, both per CLAUDE.md rule 1 (fix the spec before the code) and rule 3
(replace the old wording outright — the files describe only what stands now).

- **Item 26** — per the design-wins decision, the opening screen may carry the current
  month's calendar, totals and balances alongside the action list. Replaces the sentence
  sending balances to the worker's profile.
- **Item 5** — the user marks a *span* of days, of which a single day is the common case.
  Item 5 currently says the user "marks on a day"; item 8 and Part 3 already require sick
  spells to be stored as ranges, so this closes a gap between the two rather than adding
  behavior. The Saturday rule below goes in the same sentence, with its reason.

---

## build_plan.md — notes to improve

Ordered by how expensive they are to discover late.

1. **Stage 1 must return explanations, not bare numbers.** `specs.md` item 24 requires
   any figure to open and show how it was reached *in words*, and the `?` disclosure
   appears on every single artboard. If Stage 1's engine returns numbers alone, every UI
   stage retrofits an explanation layer over a calculation that has already thrown away
   its intermediate reasoning. The engine's return type should carry an explanation per
   line from the first commit. **This is the one note that changes Stage 1's shape.**
2. **Stage 2 contradicts Part 3 on templates.** Stage 2 says "the three stored
   templates"; Part 3 says the closing block is generated from however many advance
   lines the month has, "rather than from a fixed set of variants." Those cannot both
   hold. Stage 2 should read: one month template plus one balances template, closing
   block generated — with `template_month_advance_given.xlsx` kept as a reference sample
   of the shape, not a second template to branch on.
3. **Item 13's cascade has no home.** "A month can be corrected after it was exported,
   and every later month's balances follow the correction" is a schema decision —
   balances derived on read, or stored with invalidation. It belongs in Stage 3's schema
   bullet. Discovered in Stage 6 it is a migration.
4. **Stage 2 ships export before Stage 5 builds its gate.** Item 4 requires minimum-wage
   confirmation before *every* export, but that lands in Stage 5. Stage 2's export should
   be explicitly internal/test-only until Stage 5 closes the gate.
5. **There is no Stage 0.** Stage 1 assumes a repo, tooling and the data files. None
   existed. Addition B above.
6. **The `*.xlsx` gitignore trap** (Step 1). Worth a line in the plan itself, because the
   failure is silent — the app runs locally and the export breaks only on a fresh clone.
7. **Item 25 is unowned.** The single central list of kol-zchut links, "kept in one list
   rather than scattered through the interface, so a page that moves is fixed in a single
   place." It is referenced by nearly every screen; it belongs beside the translations
   file in Stage 0.
8. **Item 21 is unowned.** A future month may be filled in through the calendar but
   exported only once it has ended. That is a state rule on the month record — Stage 3 or
   Stage 4, but currently neither.
9. **Stage 3 blocks Stage 4 harder than it needs to.** Supabase, auth and RLS gate the
   month screen. A thin repository interface in Stage 1 would let Stage 4 build against
   an in-memory store and let Stage 3 land in parallel.
10. **No stage states a translate/RTL acceptance criterion.** Given the requirement that
    the app read well through Chrome's translation, "done when" for any UI stage should
    include: the screen carries no text inside an image, and it survives translate-to-
    English without a React crash.
11. **Data-file hygiene** — `UA-2026.json` is empty and points at country code `UK`; two
    files carry `_1` download suffixes. Stage 5 should treat an empty cached list as a
    failed fetch, per Part 3's plausibility rule, rather than as "this country has no
    holidays."
12. **No stage carries the spell/span model, and the canvas contradicts it.** Part 3
    requires a sick spell be stored as the dates it ran between; the canvas marks single
    days. Stage 1's month-facts type and Stage 3's schema both need spans rather than
    per-day marks, and Stage 4's calendar needs range entry — otherwise the sick tiers
    (nothing day 1, half days 2–3, full from day 4) cannot be counted from a spell's own
    first day across a month boundary. Added to Stages 1, 3 and 4.

---

## Verification

- `npm run dev` → home screen renders at `/`, matching the canvas.
- **RTL:** Sunday sits rightmost in the calendar header; August 2026 shows the 1st in the
  Saturday column with the correct five Saturdays (1, 8, 15, 22, 29); no horizontal body
  scroll; chevrons point the right way.
- **Dates:** a Vitest case asserting the August 2026 grid offset and Saturday count is
  built in UTC — the DST trap from Part 5.
- **Translate:** load the page in Chrome, right-click → *Translate to English*. Every
  visible string translates (nothing is stranded inside an image), and the page does not
  throw `NotFoundError: Failed to execute 'removeChild'`. Toggle back to Hebrew and
  confirm the layout returns.
- **Interaction:** clicking a calendar day cycles its mark; each `?` opens its
  explanation and its kol-zchut link; the worker switcher moves between the two fixtures.
- **Ranges:** sweeping 16→22 August marks a seven-day span in one gesture; sweeping the
  same days in the opposite direction produces the identical span (the RTL inversion
  trap); shift-clicking an end day does the same; clicking inside a span clears all of
  it. A vacation sweep across a Saturday leaves that Saturday unmarked, a sick sweep
  keeps it, and a Vitest case asserts both. A sick span dragged past the 31st is stored
  whole, not truncated.
- `npx tsc --noEmit` and `npm test` clean.
- `git log` shows one local commit; `git remote -v` shows the EaseSalary remote;
  `git status` in `D:\school\LLM vibe coding` no longer lists `EaseSalary/`.
- `git show --stat HEAD` includes `data/templates/*.xlsx` — proof the ignore trap was
  avoided.

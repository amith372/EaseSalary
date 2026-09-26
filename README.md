# EaseSalary

**A Hebrew web app that turns a family's monthly caregiver payroll spreadsheet into a few taps on a calendar.**

A family employing a live-in foreign caregiver marks what departed from an ordinary month — a rest day worked, a sick day, an advance — and at month's end exports one salary sheet in the same shape as the workbook they already use. Vacation and sick balances carry forward on their own.

<sub>Next.js · TypeScript · Supabase · Tailwind (RTL) · ExcelJS · Vitest · Playwright</sub>

---

## Why it exists

The calculation is already solved in Excel. The problem is that the spreadsheet demands two things the employing family doesn't have: **spreadsheet skill**, and the **legal upkeep** to track a minimum wage that changes, tax brackets that change yearly, and entitlement rules that don't fit in one's head.

So every rule, rate and formula lives in the application instead of in the user's head. The guiding rule when a decision is undecided: **choose the option that requires the user to know less.**

The user supplies *facts about the month*. Never a rate. Never a formula.

## How a month works

```
  1. Mark the calendar          2. Confirm before export      3. Export one sheet
  --------------------          ------------------------      -------------------
  rest days worked              the minimum wage in force     shaped like the family's
  rest-eves, holidays           the recuperation rate         own workbook, with
  sick / vacation days          the income tax to withhold    balances already
  advances, one-off fees                                      carried forward
```

Everything else is derived. A month you confirmed last year still reproduces at *last year's* rates, because the rates that applied are stored with the month.

## What the app decides for you

| The rule | Why it matters |
|---|---|
| **No rate is ever hardcoded** | Everything derives from the worker's base monthly salary, which defaults to the confirmed minimum wage and can't be set below it. |
| **Income tax is calculated** | From the month's gross, the brackets in force that tax year, and credit points derived from the worker's gender — 2.25 for a foreign caregiver, half a point more for a woman. Never asked for. Choose automatic, nothing withheld, or a flat percentage. |
| **Balances are never stored** | They're replayed from the opening position each time, which is why correcting a past month moves every later month for free. |
| **The rest day is a term of employment** | Friday, Saturday or Sunday per worker — not assumed to be Saturday. |
| **Anything computed can be overridden** | An override is marked manual and is never silently recalculated away. |
| **Identifying numbers are encrypted at rest** | Passport, bank account, employment permit and work visa, with the key held outside the database. Their expiry dates stay in the clear so the app can warn you before they lapse. |
| **External data is fetched, never baked in** | Minimum wage, per-country holiday lists and tax brackets are fetched per year and cached in Postgres. |

Money is integer agorot in code, two decimals on screen. The interface is Hebrew and right-to-left throughout.

---

## Getting started

**You'll need** Node.js with npm, and a [Supabase](https://supabase.com) project (free tier is fine).

```bash
# 1 — install (this also points git at the repo's own hooks/)
npm install

# 2 — configure
cp .env.example .env
```

Open `.env` and fill in the four values. Each one is documented in place in `.env.example`, including where to find it in the Supabase dashboard and how to generate the encryption key.

```bash
# 3 — connect to Supabase and apply the schema
npx supabase login
npx supabase link
npx supabase db push        # applies the 28 migrations in supabase/migrations/

# 4 — run it
npm run dev                 # → http://localhost:3000
```

> [!IMPORTANT]
> **Run `npx next typegen` before `npx tsc --noEmit`.** Without it the generated route types are undefined and a freshly cloned repo fails typecheck having changed nothing.

### The schema is migrations, never the dashboard

A table altered by hand in the Supabase dashboard exists in one project and in no clone. Every schema change is a `.sql` file in `supabase/migrations/`.

```bash
npx supabase migration list   # what's applied where
npx supabase db push          # apply what isn't
```

---

## Testing

```bash
npm test              # 1,265 unit tests across 72 files — engine, export, scrapers
npm run test:watch
npm run test:e2e      # 26 Playwright specs, driving the real browser
npm run test:e2e:ui
```

Two conventions worth knowing before you write a test here:

- **Expected figures come from outside the code under test** — the spec, the workbook, the statute, or arithmetic worked by hand. A test that reads the implementation to decide what to expect only proves the engine agrees with itself.
- **Browser tests verify results, not interactions.** A page that loaded and a button that clicked prove nothing; assert the figures on screen and the values inside the exported file.

### Before committing

`hooks/pre-commit` runs typecheck, lint and the unit suite, and scans the staged diff for secrets first. It's wired up by `npm install`, so a fresh clone is gated without anyone remembering to do anything.

```bash
npx next typegen && npx tsc --noEmit
npm run lint
npm test
```

---

## Layout

| Path | What's in it |
|---|---|
| `src/app/` | Routes — home, workers, payments, reports, settings, sign-in, export |
| `src/lib/engine/` | The calculation engine: pure functions over a worker's **series** of months, since balances replay rather than store. Runs without a server. |
| `src/lib/export/` | Fills the committed `.xlsx` templates with ExcelJS |
| `src/lib/scrape/` | Fetches the wage, holiday and tax-bracket pages; every parse is a pure function over an HTML string, so tests never touch the network |
| `src/lib/i18n/he.ts` | Every user-facing Hebrew string, in one file |
| `data/templates/` | The three spreadsheet templates — the only `.xlsx` files the repo permits |
| `supabase/migrations/` | The schema, in order |
| `e2e/` | Playwright specs |

> [!WARNING]
> `.gitignore` excludes every `*.xlsx` except `data/templates/template_*.xlsx`, and the pre-commit hook refuses any other spreadsheet even when force-added. The family's own workbooks carry passport and bank numbers, and a pushed file cannot be taken back. **Never widen that exception.**

## Documentation

This repo keeps four documents with four distinct jobs. Read the one that matches your question:

| Question | File |
|---|---|
| **What** should the app do? Every rule and entitlement | `specs.md` — the source of truth for behaviour |
| **How** do I build in this repo? Conventions and standing rules | `CLAUDE.md` |
| **How** should a screen look? | `DESIGN.md` |
| **What's** next, and in what order? | `build_plan.md` |

`specs.md` is long and meant to be read a part at a time. Find your part with `grep -n '^## Part' specs.md`; its 29 numbered success criteria all live in Part 2 and are cited by number throughout the repo.

## Scope

Deliberately **out** of scope: pension and severance provision. Its row survives in the export template — empty and untouched — so the exported sheet keeps the row numbering of the family's workbook. Other deferred ideas are recorded in `specs.md`'s appendix so they aren't rediscovered as bugs.

Deployment targets Vercel. The encryption key and Supabase keys are environment variables and are never committed.

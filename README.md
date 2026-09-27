# 💼 EaseSalary

**A Hebrew web app that turns a family's monthly caregiver payroll into a few taps on a calendar.**

Mark what departed from an ordinary month — a rest day worked, a sick day, an advance — and at month's end export one salary sheet. Vacation and sick balances carry forward on their own.

<sub>Next.js · TypeScript · Supabase · Tailwind (RTL) · ExcelJS · Vitest · Playwright</sub>

---

## 🎯 Why it exists

Payroll for a live-in caregiver demands two things the employing family doesn't have: **spreadsheet skill**, and the **legal upkeep** to follow a minimum wage that changes, tax brackets that change yearly, and entitlement rules that don't fit in one's head.

So every rule, rate and formula lives in the app instead. The user supplies *facts about the month* — never a rate, never a formula.

> When a decision is undecided, we choose the option that requires the user to know less.

## 🗓️ How a month works

```
 1. Mark the calendar        2. Confirm before export     3. Export one sheet
 ─────────────────────       ────────────────────────     ───────────────────
 rest days worked            the minimum wage in force    with balances already
 rest-eves, holidays         the recuperation rate        carried forward
 sick / vacation days        the income tax to withhold
 advances, one-off fees
```

Everything else is derived. A month confirmed last year still reproduces at *last year's* rates, because the rates that applied are stored with the month.

## ✨ Good to know

- 🧮 **Nothing is hardcoded** — every rate derives from the worker's base salary, and the wage, holiday lists and tax brackets are fetched per year and cached.
- ♻️ **Balances are replayed, never stored** — so correcting a past month moves every later month for free.
- ✍️ **Anything computed can be overridden**, and an override is never silently recalculated away.
- 🔐 **Identifying numbers are encrypted at rest**, with the key held outside the database.
- 🇮🇱 **Hebrew and right-to-left throughout**, with every user-facing string in one file.

---

## 🚀 Getting started

**You'll need** Node.js with npm, and a [Supabase](https://supabase.com) project (the free tier is fine).

```bash
npm install          # also points git at the repo's own hooks/
cp .env.example .env
```

Open `.env` and fill in the four values — each is documented in place, including where to find it and how to generate the encryption key.

```bash
npx supabase login
npx supabase link
npx supabase db push   # applies supabase/migrations/

npm run dev            # → http://localhost:3000
```

> [!IMPORTANT]
> Run `npx next typegen` before `npx tsc --noEmit`. Without it the generated route types are undefined and a fresh clone fails typecheck having changed nothing.

> [!NOTE]
> The schema lives only in `supabase/migrations/` — never a change made in the Supabase dashboard. `npx supabase migration list` says what's applied.

## 🧪 Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Unit tests — engine, export, scrapers |
| `npm run test:watch` | …in watch mode |
| `npm run test:e2e` | Playwright specs, driving the real browser |
| `npm run test:e2e:ui` | …with the Playwright UI |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

`hooks/pre-commit` runs typecheck, lint and the unit suite, and scans the staged diff for secrets first. It's wired up by `npm install`, so a fresh clone is gated without anyone remembering anything.

## 🗂️ Where things live

| Path | What's in it |
|---|---|
| `src/app/` | Routes — home, month, workers, payments, reports, settings, alerts, sign-in |
| `src/lib/engine/` | The calculation engine: pure functions over a worker's **series** of months. Runs without a server |
| `src/lib/export/` | Fills the spreadsheet templates with ExcelJS |
| `src/lib/scrape/` | Fetches the wage, holiday and tax-bracket pages; every parse is a pure function over an HTML string, so tests never touch the network |
| `src/lib/i18n/he.ts` | Every user-facing Hebrew string, in one file |
| `src/components/` | Shared UI — calendar, bands, pickers |
| `data/templates/` | The spreadsheet templates used by the export |
| `supabase/migrations/` | The schema, in order |
| `e2e/` | Playwright specs |

> [!WARNING]
> Spreadsheets other than the export templates are ignored by `.gitignore` and refused by the pre-commit hook — a real workbook carries passport and bank numbers, and a pushed file cannot be taken back.

## 📚 Documentation

Five documents, five distinct jobs. Read the one that matches your question:

| Question | File |
|---|---|
| **What** should the app do? Every rule and entitlement | `specs.md` — the source of truth |
| **Who** is it for, and in what tone? | `PRODUCT.md` |
| **How** do I build in this repo? Conventions and standing rules | `CLAUDE.md` |
| **How** should a screen look? | `DESIGN.md` |
| **What's** next, and in what order? | `build_plan.md` |

`specs.md` is long and meant to be read a part at a time — find your part with `grep -n '^## Part' specs.md`. Its 29 numbered success criteria all live in Part 2 and are cited by number throughout the repo.

## 📦 Scope & deployment

Pension and severance provision are deliberately **out** of scope; other deferred ideas are recorded in `specs.md`'s appendix so they aren't rediscovered as bugs.

Deployment targets Vercel. The encryption key and Supabase keys are environment variables, never committed.

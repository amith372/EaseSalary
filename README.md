# 💼 EaseSalary

**Payroll for a live-in caregiver, in a few taps on a calendar — in Hebrew, right to left.**

You mark what departed from an ordinary month. At month's end EaseSalary produces one salary sheet, with vacation and sick balances already carried forward.

---

## 🎯 Why it exists

Paying a caregiver correctly takes two things a family shouldn't have to own: spreadsheet skill, and the upkeep of a minimum wage that changes, tax brackets that change every year, and entitlement rules that don't fit in anyone's head.

So the rules live in the app. You supply facts about the month — never a rate, never a formula.

## 🗓️ How a month works

```
 1. Mark the calendar        2. Confirm before export     3. Export the sheet
 ─────────────────────       ────────────────────────     ───────────────────
 rest days worked            the minimum wage in force    with balances already
 rest-eves, holidays         the recuperation rate        carried forward
 sick / vacation days        the income tax to withhold
 advances, one-off fees
```

Everything else is worked out for you. A month you filed last year still reproduces at *last year's* rates, because the rates that applied are kept with the month.

## ✨ Good to know

- 🧮 **You never enter a rate.** Everything derives from the worker's base salary, and the wage, holiday lists and tax brackets are looked up for the right year.
- ♻️ **Balances take care of themselves.** Correct a past month and every later month follows.
- ✍️ **Any figure can be overridden** — and once you set it by hand, nothing quietly recalculates it away.
- 🔐 **Passport, bank, permit and visa numbers are encrypted**, with the key held outside the database.
- 👥 **Up to two workers** per account, each with their own terms — including which day of the week is the weekly rest day.
- 🔔 **Expiry warnings** for the permit and the visa, so a renewal isn't missed.

Pension and severance provision are deliberately out of scope.

---

## 🚀 Running it locally

You'll need Node.js with npm and a [Supabase](https://supabase.com) project (the free tier is fine).

```bash
npm install            # also points git at the repo's own hooks/
cp .env.example .env   # each value is documented in place
npx supabase login
npx supabase link
npx supabase db push   # applies supabase/migrations/
npm run dev            # -> http://localhost:3000
```

Two traps, each of which costs a newcomer real time: run `npx next typegen` before `npx tsc --noEmit`, or the generated route types are undefined and a fresh clone fails typecheck having changed nothing; and the schema lives only in `supabase/migrations/`, never in a change made in the Supabase dashboard (`npx supabase migration list` says what is applied).

<sub>Working on the code? `CLAUDE.md` has the conventions and the standing rules, `specs.md` is the source of truth for behaviour, and `DESIGN.md` is how a screen should look.</sub>

import { compareIsoDate, daysInMonth, isoOf } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import type {
  DaySpan,
  HolidaySpan,
  IsoDate,
  MarkKind,
  YearMonth,
} from "@/lib/types";

/**
 * The engine's **inputs**: a worker's standing terms, and the facts of one
 * month. `src/lib/types.ts` holds the engine's **outputs** — the shape the
 * screen and the .xlsx filler read — and does not move.
 *
 * Everything here is a fact the user stated or confirmed. No rate, no formula
 * and no derived figure appears in this file: those come out of
 * `src/lib/engine/rates.ts` and the steps after it, from the wage alone
 * (specs.md item 3; the user never enters a rate or a formula, Part 1).
 */

/**
 * A span as the month stores it. A holiday must say whether the worker worked
 * it — a holiday she takes off is covered by her ordinary salary and earns
 * nothing extra, so "holiday" is never recorded without saying (specs.md
 * Part 5, item 9). Writing the union this way makes a holiday span without
 * `worked` a compile error rather than a silent default that underpays her.
 *
 * The union does the same job for the open end. `DaySpan.to` is nullable
 * because storage has to hold a spell that has not finished, but **only
 * sickness may be open** (item 8): a vacation with no end is not a thing the
 * user can mean, and narrowing it here is what stops the engine having to
 * decide what one would be worth.
 */
export type MonthSpan =
  | (DaySpan & { kind: "sick" })
  | (DaySpan & { kind: Exclude<MarkKind, "holiday" | "sick">; to: IsoDate })
  | HolidaySpan;

/**
 * A span whose end is settled — an open spell resolved to the last day the
 * month counts it to. **Everything inside the engine works on these**, so no
 * counting rule, tier or balance has to carry the open case: the resolution
 * happens once, at `calculateMonth`, and the interior cannot tell an open spell
 * from a closed one of the same days. That is the property the first of item
 * 8's tests asserts directly.
 */
export type ClosedSpan = MonthSpan & { to: IsoDate };

/**
 * The last day a month counts an open spell to.
 *
 * **A fact about the month and not about the present** (specs.md item 8): a
 * finished month's figure is settled once the month has ended and never moves
 * because of when it is looked at. Only the current month's live preview clips
 * at `today`, and `today` reaches the engine as a value its caller passed
 * (`CLAUDE.md`) — nothing here reads a clock.
 */
export function clipEndOf(month: YearMonth, today?: IsoDate): IsoDate {
  const monthEnd = isoOf(month, daysInMonth(month));
  if (today === undefined) return monthEnd;
  return compareIsoDate(today, monthEnd) < 0 ? today : monthEnd;
}

/**
 * Every span with its end resolved, so the engine's interior never meets an
 * open one.
 *
 * A spell that has not reached `clipAt` yet closes at its own first day rather
 * than before it. That cannot arise from a spell a worker actually took — she
 * cannot fall ill after the month being calculated — but a caller asking for a
 * future month would otherwise hand the counting an inverted range, and a range
 * that runs backwards is the kind of thing that produces a plausible number.
 */
function closeSpans(spans: MonthSpan[], clipAt: IsoDate): ClosedSpan[] {
  return spans.map((span) =>
    span.to === null
      ? { ...span, to: compareIsoDate(clipAt, span.from) < 0 ? span.from : clipAt }
      : (span as ClosedSpan),
  );
}

/**
 * What a worker created in the middle of an employment starts from, given once
 * (specs.md item 6). None of these figures originates inside the application;
 * from then on the application keeps them.
 */
export interface OpeningPosition {
  /** Vacation days already accrued and not yet used. */
  vacationDays: number;
  /** Sick days already accrued and not yet used. */
  sickDays: number;
  /** An advance still being repaid, and what has been repaid of it so far. */
  advances: OpeningAdvance[];
}

export interface OpeningAdvance {
  /** Advances are numbered and tracked one by one (specs.md item 20), and the
   * number is the workbook's own — the closing block is built from it. */
  number: number;
  principalAgorot: number;
  repaidAgorot: number;
  note?: string;
}

/**
 * The worker's standing terms — what holds from month to month, as against
 * `MonthFacts`, which is one month alone.
 */
export interface WorkerTerms {
  /** Seniority is counted from here: the vacation accrual tier, the
   * recuperation entitlement, and the year a holiday entitlement is prorated
   * over (specs.md items 7, 10, 15). */
  employedSince: IsoDate;
  /**
   * The salary on the profile. It defaults to the confirmed minimum wage and
   * may not be set below it, and it does not follow a rise on its own: when a
   * fetch finds the minimum wage has changed, the application says so and
   * leaves the decision to the user (specs.md item 3). A month copies it into
   * `ConfirmedWage.baseAgorot` when it is confirmed, which is what keeps a past
   * month reproducible after this figure has moved on.
   */
  baseMonthlySalaryAgorot: number;
  /**
   * The weekly rest day, which is a term of the employment and not a constant
   * (specs.md item 5). Friday, Saturday or Sunday, whichever the worker holds
   * as her own; the profile defaults it to Saturday and refuses any other day.
   */
  restDay: RestDay;
  /**
   * The supplement for one rest-eve, which is also one week's, since a week
   * holds one rest-eve (specs.md item 14). It is a fact about this employment
   * and not a derived rate, which is why it is stored rather than computed from
   * the salary, and it can be changed at any time.
   *
   * It is the rest-eve supplement and not the Friday supplement because Friday
   * is only where it lands for a Saturday-resting worker: the day it falls on
   * is the working day immediately before the weekly rest day, so a
   * Sunday-resting worker earns it on Saturday and a Friday-resting worker on
   * Thursday (item 14).
   */
  restEveSupplementAgorot: number;
  /** 1-12. The month the recuperation payment falls in, set on the profile when
   * the worker is created (specs.md item 15). */
  recuperationMonth: number;
  /** Lines the user set once and that appear in every month afterwards, at the
   * same amount, until they are changed or stopped (specs.md item 20). */
  standingLines: UserLine[];
  /**
   * The country whose holiday list the worker's year is drawn from (specs.md
   * item 10). It identifies the stored list and nothing else: a list for a new
   * year is found by changing the year in the address stored *with* that list,
   * never by rebuilding the address from this value — Ukraine's list is filed
   * under one code and published under another, and an address built from the
   * code returns nothing, which reads exactly like a country that publishes no
   * holidays at all (Part 5).
   */
  country: string;
  openingPosition: OpeningPosition;
}

/**
 * The terms of the employment as they stood when one month was confirmed,
 * stored **on the month** and never read from the profile (specs.md Part 3).
 *
 * The profile keeps the worker's current terms; a month keeps the ones it was
 * calculated with. This is the same argument `ConfirmedWage` already makes for
 * the salary, applied to the rest of what can change: a family that moves the
 * rest day or the supplement in June must not thereby restate every earlier
 * month, and re-exporting August two years later must reproduce August.
 *
 * It is what changes over an employment, not everything about it. When the
 * employment *began* and what it *opened with* are facts about the employment
 * as a whole rather than terms of one month — they belong to `Employment`, and
 * correcting one of them is meant to move every month, which is exactly what
 * snapshotting them per month would prevent.
 */
export interface MonthTerms {
  /**
   * The weekly rest day this month was calculated against (specs.md item 5).
   *
   * Snapshotted like every other term, and it is the one that makes the
   * snapshot matter: a family that moves the rest day from Saturday to Sunday
   * in June must not thereby turn every earlier month's Saturdays into Sundays
   * (Part 3). Every count, every refusal and every label in the month reads it
   * from here.
   */
  restDay: RestDay;
  /**
   * The supplement for one rest-eve, which is also one week's, since a week
   * holds one rest-eve (specs.md item 14). Nothing in law requires it: it is
   * paid because the family agreed to pay it, which is why it is a stored fact
   * about this employment and not a rate derived from the salary.
   */
  restEveSupplementAgorot: number;
  /** 1-12. The month the recuperation payment falls in (specs.md item 15). */
  recuperationMonth: number;
  /**
   * The standing lines this month was calculated with (specs.md item 20).
   *
   * A standing line is a term of the employment like the supplement and the
   * rest day, so it is snapshotted here and read from here: stopping one in June
   * leaves every earlier month exactly as it was, which is the same argument
   * Part 3 makes for the rest of the terms.
   */
  standingLines: UserLine[];
}

/**
 * Copy the profile's current terms onto a month. Called at the moment a month
 * is confirmed (specs.md Part 5, the month's four states) and never afterwards
 * - a confirmed month's terms are then its own.
 */
export function snapshotTerms(worker: WorkerTerms): MonthTerms {
  return {
    restDay: worker.restDay,
    restEveSupplementAgorot: worker.restEveSupplementAgorot,
    recuperationMonth: worker.recuperationMonth,
    standingLines: worker.standingLines,
  };
}

/**
 * The employment itself, as against the terms of one month.
 *
 * The engine takes this rather than the whole of `WorkerTerms` on purpose: it
 * is a structural subset, so a caller still passes its profile object and
 * nothing at the call sites changes, but inside the engine the changeable terms
 * are simply not reachable from it. That is the guard that keeps Part 3's rule
 * - terms are read off the month, never off the profile - true by construction
 * rather than by everyone remembering it.
 */
export type Employment = Pick<WorkerTerms, "employedSince" | "openingPosition">;

/**
 * The wage position confirmed for one month, stored with the month rather than
 * read from the profile at export time. Re-exporting a past month years later
 * reproduces that month rather than recalculating it at today's rates (specs.md
 * Part 3): the rates are re-derived from `baseAgorot` by `deriveRates`, which
 * is a pure function of it, so storing the wage stores the rates without a
 * second calculation path that could drift from the first.
 */
export interface ConfirmedWage {
  /** The base monthly salary this month's rates are derived from — the profile
   * figure as it stood when the month was confirmed. */
  baseAgorot: number;
  /** The minimum wage the user confirmed before exporting this month (specs.md
   * item 4). `baseAgorot` may sit above it and may never sit below it. */
  minimumAgorot: number;
  /** The date that minimum wage took effect, so a month is always valued at the
   * rate in force during it (specs.md Part 3). */
  effectiveFrom: IsoDate;
}

/**
 * The two things a month can record about an advance (specs.md item 20).
 *
 * **The list is the source and the union is derived from it**, as
 * `userLineDirections` already is and for the same reason: the controls that
 * offer the choice, the server check that refuses a value outside it and the
 * engine's own rows read one list, and a member added to a hand-kept union
 * would compile clean against a hand-kept array that had not grown with it.
 */
export const advanceKinds = ["granted", "repaid"] as const;

export type AdvanceKind = (typeof advanceKinds)[number];

/**
 * One movement on one numbered advance. A month may both grant one advance and
 * repay another, each on its own line, and the amount repaid is entered for the
 * month rather than fixed by a schedule (specs.md item 20).
 */
export interface Advance {
  /** The application's own number, minted one past the highest the worker
   * already carries and never typed by the user (specs.md item 20). */
  number: number;
  kind: AdvanceKind;
  /** Always positive. Whether the closing block adds or subtracts it follows
   * from `kind`, so a sign can never disagree with a label. */
  agorot: number;
  note?: string;
}

/**
 * Which way a line the user added moves the month's money (specs.md item 20).
 *
 * The user picks the kind and never types a minus: the sign follows from what
 * the line is, so it can never disagree with the label beside it — the same
 * argument `ClosingLine.amount` already makes for the advances.
 *
 * **The list is the source and the union is derived from it**, which is how
 * `userLinePrefixes` in `month.ts` already does it. The chips that offer these
 * choices and the server check that refuses a value outside them read the same
 * list, and the pair must not drift: a value the form can offer but the server
 * refuses is a control that silently does nothing, and a value the server
 * accepts but the form cannot show is a line the user can never see the shape
 * of. Written the other way round — a hand-kept array annotated with the union
 * — a third member added to the union would compile clean with the array
 * unchanged, and only the drift would say so.
 */
export const userLineDirections = ["addition", "deduction"] as const;

export type UserLineDirection = (typeof userLineDirections)[number];

/**
 * Whether a line the user added is part of what the month came to, or only
 * changes what is transferred at the end (specs.md item 20).
 *
 * **It is the user's own choice and is not implied by the direction**, because
 * the two are different money and no rule the application could apply would tell
 * them apart: a standing payment the family agreed as part of the wage belongs
 * inside the month's cost, and a sum handed over on the side does not. The
 * difference is real — a line placed `beforeGross` enters the month's total and
 * with it the national-insurance estimate, which is 3.6% of the month's full
 * cost (item 19), and a line placed `afterGross` reaches neither.
 *
 * The list is the source and the union derived from it, for the reason given at
 * `userLineDirections`.
 */
export const userLinePlacements = ["beforeGross", "afterGross"] as const;

export type UserLinePlacement = (typeof userLinePlacements)[number];

/**
 * Where a line sits when the user has not said. An addition is usually part of
 * the month and a deduction usually is not, so the default is what the user
 * would have chosen without being asked (item 20) — and it is a default and not
 * a rule, which is the whole reason `placement` is optional rather than absent.
 *
 * **The default is exported on its own because the form that adds a line needs
 * it too.** The chips it offers move with the direction until the user touches
 * them, which is the same rule read forwards; a form that restated it would be
 * a second copy of the sentence that decides which side of the month's total a
 * line lands on.
 */
export function defaultPlacementFor(
  direction: UserLineDirection,
): UserLinePlacement {
  return direction === "addition" ? "beforeGross" : "afterGross";
}

export function placementOf(line: UserLine): UserLinePlacement {
  return line.placement ?? defaultPlacementFor(line.direction);
}

/**
 * A line the user added with a reason of their own (specs.md item 20) — how a
 * shortfall from an earlier month is settled later, and how a family records
 * pocket money without bending the rest-eve supplement into something it is
 * not (item 14).
 *
 * The same shape serves both lifetimes. A **one-off** line lives on the month,
 * in `MonthFacts.userLines`; a **standing** one lives on the profile and is
 * snapshotted onto the month with the other terms, in `MonthTerms`. What
 * differs between them is where they are stored and how long they last, not
 * what they are, so one type describes both and the field it sits in says which
 * it is. Two near-identical interfaces would be two places to add a field to.
 */
export interface UserLine {
  /** Stable, because the line's explanation key is built from it — `extra.<id>`
   * for a one-off and `standing.<id>` for a standing one. The two prefixes are
   * what keep the ids in separate spaces, so a standing line and a one-off line
   * may share an id without colliding on an override (item 17). */
  id: string;
  /** The user's own words, shown as the line's label. Never translated by the
   * application: it is the user's sentence, not the application's. */
  label: string;
  direction: UserLineDirection;
  /**
   * Before the month's total or after it (specs.md item 20). Left out, it falls
   * to `placementOf`'s default — an addition before, a deduction after — which
   * is what every line meant before the choice existed, so an omitted value and
   * the old behaviour are the same thing rather than merely similar.
   */
  placement?: UserLinePlacement;
  /** Always positive. Whether the month adds or withholds it follows from
   * `direction`. */
  agorot: number;
  /** The reason, which is the part the application cannot derive and the part a
   * later reader needs (item 20). */
  note?: string;
}

/**
 * The payments that go to a third party rather than to the worker, in the order
 * the month template numbers them — B10, B12, B13, B14, B15, B16 and B21 of
 * `template_month_standard.xlsx` -> `sheet1` (specs.md item 16).
 *
 * **The list is the source and the union is derived from it**, as
 * `userLineDirections` already is and for the same reason: the chips that offer
 * the choice, the server check that refuses a value outside it and the engine's
 * own rows read one list, and a member added to a hand-kept union would compile
 * clean against a hand-kept array that had not grown with it. The order is the
 * sheet's, so the set can be read against the template without a lookup and
 * neither the chips nor the export has to choose an order of its own.
 *
 * **There are seven because the sheet has two visa rows.** B14 is the fee for
 * extending the work visa and B15 is `ויזת עובד זר`, the visa itself,
 * issued through the private agency against a charge of its own (item 28). A
 * single `visaFee` covering both was not merely a missing member: item 16
 * refuses two payments of one kind, so a month that paid both would have been
 * refused outright and told to sum two figures the sheet keeps apart.
 *
 * `visaExtensionFee` carries item 28's own wording for B14. It was `visaFee`
 * until 2026-09-04, and the rename is deliberate rather than cosmetic: a name
 * meaning "the visa fee" where there are two visa payments preserves exactly
 * the confusion the seventh member exists to end. It costs nothing now because
 * nothing persists it — the store is in memory and no month holds a
 * `thirdParty.visaFee` override — and it would be a migration after stage 3.
 */
export const thirdPartyKinds = [
  "medicalInsurance",
  "placementFee",
  "agencyFee",
  "visaExtensionFee",
  "workerVisa",
  "licenceFee",
  "nationalInsurance",
] as const;

export type ThirdPartyKind = (typeof thirdPartyKinds)[number];

/**
 * Money that actually left the account, recorded only in the month it left it.
 * Column H, and never added into the worker's monthly total (specs.md item 16).
 *
 * This is **not** the national-insurance estimate. Every month carries its own
 * estimate of 3.6% of that month's full cost, which the engine derives and
 * never reads from here, while the money paid appears once — in the month of
 * payment, with the months it covers. Two different figures in two different
 * columns; folding them into one line is the contradiction item 19 exists to
 * close (specs.md item 19).
 */
export interface ThirdPartyPayment {
  kind: ThirdPartyKind;
  agorot: number;
  /** The months this payment covers: the national insurance is paid once a
   * quarter and in arrears (specs.md item 19). */
  coversMonths?: YearMonth[];
  note?: string;
}

/**
 * An amount the user replaced by hand, addressed by the line's explanation key.
 * It is visibly marked as manual and survives every later recalculation of the
 * month (specs.md item 17), which is why it is held as a fact about the month
 * rather than as a patch applied afterwards to a result.
 */
export interface LineOverride {
  agorot: number;
  /**
   * What the row was called when she replaced its amount — a **snapshot** and
   * never a lookup.
   *
   * An override outlives the row it addresses (specs.md item 17): a month whose
   * rest-day work is all unmarked stops drawing that row, and the amount typed
   * over it is still held and comes back with the row. The control has to list
   * such an override so that a stored figure is never out of sight — and at
   * that moment there is no row left to read a name off. The name kept here is
   * the one the row carried when she chose the figure, which is also the only
   * name that is true of the moment she chose it: a label derived from the
   * worker's rest day would otherwise rename an old override the day her rest
   * day changed.
   *
   * Optional, because a month seeded or stored before this field existed
   * carries none, and the control names such a row by its amount and its note.
   */
  label?: string;
  note?: string;
}

/**
 * One month, and everything that changes it.
 *
 * Spans may start before the month and end inside it, or start inside it and
 * end after it: a spell of sickness is stored as the dates it ran between,
 * because its tiers are counted from its own first day and a spell crossing a
 * month boundary has to be read as one thing (specs.md Part 3, item 8). The
 * engine reads such a span whole and clips it to the month itself.
 */
export interface MonthFacts {
  month: YearMonth;
  confirmedWage: ConfirmedWage;
  /** The employment's terms as they stood when this month was confirmed
   * (specs.md Part 3). Read from here and never from the profile. */
  terms: MonthTerms;
  spans: MonthSpan[];
  advances: Advance[];
  /** What was actually paid to a third party in this month. */
  thirdPartyPayments: ThirdPartyPayment[];
  /**
   * Lines the user added to this month alone (specs.md item 20). The standing
   * ones are not here — they are terms, and live on `terms.standingLines`.
   */
  userLines: UserLine[];
  /** Income tax is never calculated: the line defaults to zero and is the
   * user's to edit (specs.md item 17, Part 1). */
  incomeTaxAgorot: number;
  /** Keyed by the line's explanation key — `base`, `restDays`, `extra.<id>` and
   * the rest — so an override is addressed by the same key the explanation is
   * (specs.md items 17, 24). */
  overrides: Record<string, LineOverride>;
}

/**
 * A month whose spans all have an end, which is what the engine works on.
 *
 * `closeMonth` is the only place an open spell is resolved, so no counting
 * rule, tier or balance below it has to carry the open case — and the property
 * item 8's first test asserts, that an open spell pays a month exactly what the
 * closed spell of the same days pays it, holds by construction rather than by
 * every rule agreeing to it separately.
 */
export type ClosedMonthFacts = Omit<MonthFacts, "spans"> & {
  spans: ClosedSpan[];
};

/** Resolve the month's open spells. Pure, idempotent, and reads no clock:
 * `today` arrives from the caller and only where the current month's live
 * preview is being asked for (specs.md item 8). */
export function closeMonth(
  facts: MonthFacts,
  today?: IsoDate,
): ClosedMonthFacts {
  return {
    ...facts,
    spans: closeSpans(facts.spans, clipEndOf(facts.month, today)),
  };
}

/**
 * What the engine needs to know that one month's facts cannot say.
 *
 * Stage 3's repository supplies it; a month handed over on its own is treated
 * as the worker's and the year's first, so the entitlement check fires only on
 * a month carrying more than the whole year's allowance by itself, the balances
 * open from the opening position, and the seven-day warning sees only this
 * month's vacation.
 *
 * It lives here beside `MonthFacts` rather than in `validate.ts`, because it is
 * an input to the calculation as a whole: the balances read it, the refusals
 * read it, and neither module should have to import the other to see it.
 */
export interface MonthContext {
  /**
   * Today, where the caller is asking for the **current** month's live preview
   * (specs.md item 8). Left out, an open spell is counted to the month's own
   * last day, which is what every finished month wants: passing a clock in from
   * outside is how the engine stays free of one, so this is a value and never a
   * default (`CLAUDE.md`).
   */
  today?: IsoDate;
  /** Holiday days already recorded earlier in the same year, counted the way
   * this month counts its own — a part day as its fraction (specs.md item 10). */
  holidayDaysEarlierInYear?: number;
  /**
   * The entitlement for this calendar year, if something outside the engine has
   * settled it. Left out, it is **derived** by `holidayAllowanceFor` from the
   * worker's own terms — nine days for a full year, reduced by the months
   * employed in a year only partly worked (item 10) — so a month standing alone
   * is still refused against the entitlement she actually has rather than
   * against a flat nine.
   */
  holidayAllowance?: number;
  /**
   * The balances this month opens with — the previous month's closing figures.
   * Month N+1 opens with the previous balance plus the accrual less what was
   * used in month N (item 7). Absent for the worker's first month, which opens
   * from the opening position given once (item 6).
   */
  openingBalances?: { vacationDays: number; sickDays: number };
  /**
   * Vacation days drawn from the balance earlier in the same **calendar** year,
   * counted the way this month counts its own. The seven-day warning is a
   * statement about a whole year and one month cannot see the rest of its own,
   * so the figure is handed in (item 7).
   */
  vacationDaysEarlierInYear?: number;
}

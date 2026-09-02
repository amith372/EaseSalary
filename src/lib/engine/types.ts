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
 */
export type MonthSpan =
  | (DaySpan & { kind: Exclude<MarkKind, "holiday"> })
  | HolidaySpan;

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
   * The supplement for one Friday, which is also one week's, since a week holds
   * one Friday (specs.md item 14). It is a fact about this employment and not a
   * derived rate, which is why it is stored rather than computed from the
   * salary, and it can be changed at any time.
   */
  fridaySupplementAgorot: number;
  /** When the supplement counts as pocket money, a Friday the worker did not
   * work is paid it all the same (specs.md item 14) — subject to the sickness
   * rule in item 8, which Step 5 applies. */
  fridayIsPocketMoney: boolean;
  /** 1-12. The month the recuperation payment falls in, set on the profile when
   * the worker is created (specs.md item 15). */
  recuperationMonth: number;
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
   * The supplement for one Friday, which is also one week's, since a week holds
   * one Friday (specs.md item 14). Nothing in law requires it: it is paid
   * because the family agreed to pay it, which is why it is a stored fact about
   * this employment and not a rate derived from the salary.
   */
  fridaySupplementAgorot: number;
  /** When the supplement counts as pocket money, a Friday the worker did not
   * work is paid it all the same (specs.md item 14) - subject to the sickness
   * rule in item 8. */
  fridayIsPocketMoney: boolean;
  /** 1-12. The month the recuperation payment falls in (specs.md item 15). */
  recuperationMonth: number;
}

/**
 * Copy the profile's current terms onto a month. Called at the moment a month
 * is confirmed (specs.md Part 5, the month's four states) and never afterwards
 * - a confirmed month's terms are then its own.
 */
export function snapshotTerms(worker: WorkerTerms): MonthTerms {
  return {
    fridaySupplementAgorot: worker.fridaySupplementAgorot,
    fridayIsPocketMoney: worker.fridayIsPocketMoney,
    recuperationMonth: worker.recuperationMonth,
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
 * One movement on one numbered advance. A month may both grant one advance and
 * repay another, each on its own line, and the amount repaid is entered for the
 * month rather than fixed by a schedule (specs.md item 20).
 */
export interface Advance {
  number: number;
  kind: "granted" | "repaid";
  /** Always positive. Whether the closing block adds or subtracts it follows
   * from `kind`, so a sign can never disagree with a label. */
  agorot: number;
  note?: string;
}

/**
 * A payment the user added to the month with a reason of their own, which is
 * how a shortfall from an earlier month is settled later (specs.md item 20).
 * It reaches the worker, in column G.
 */
export interface ExtraPayment {
  /** Stable, because the line's explanation key is `extra.<id>`. */
  id: string;
  /** The user's own words, shown as the line's label. */
  label: string;
  agorot: number;
  note?: string;
}

/** A payment that goes to a third party rather than to the worker (specs.md
 * item 16). */
export type ThirdPartyKind =
  | "medicalInsurance"
  | "nationalInsurance"
  | "agencyFee"
  | "placementFee"
  | "visaFee"
  | "licenceFee";

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
  extraPayments: ExtraPayment[];
  /** Income tax is never calculated: the line defaults to zero and is the
   * user's to edit (specs.md item 17, Part 1). */
  incomeTaxAgorot: number;
  /** Keyed by the line's explanation key — `base`, `restDays`, `extra.<id>` and
   * the rest — so an override is addressed by the same key the explanation is
   * (specs.md items 17, 24). */
  overrides: Record<string, LineOverride>;
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

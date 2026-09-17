import { rateInForce, type DatedRate } from "@/lib/datedRates";
import {
  addDays,
  addMonths,
  addYears,
  compareIsoDate,
  compareMonth,
  daysInMonth,
  eachMonth,
  fromIsoDate,
  isoOf,
  monthHasEnded,
  monthOf,
  previousQuarter,
  sameMonth,
} from "@/lib/dates";
import type { IsoDate, YearMonth } from "@/lib/types";
import { advanceLedger } from "./advances";
import { holidayYear } from "./holidayYear";
import { holidayAllowanceFor } from "./leave";
import { recuperationDaysInMonth } from "./recuperation";
import type { WorkerProfile } from "./repository";
import type { MonthInSeries } from "./series";
import { coverExpiryOf } from "./thirdParty";
import type { MonthSpan } from "./types";

/**
 * What needs the user to do something about one worker (specs.md item 27).
 *
 * **Two lists, split by urgency and not by kind.** A `blockage` is something
 * without which the salary cannot be produced correctly today, or something
 * that has already lapsed, and it leads the opening screen; a `warning` still
 * has time in it and lights the bell. Where item 27's test leaves an entry open,
 * the list it is on was chosen by the user (2026-09-17): recuperation due this
 * month, an advance still being repaid and a year with fewer than seven vacation
 * days go on the opening screen, and a finished month not yet exported goes to
 * the bell. The national-insurance quarter is on the opening screen by item 19.
 *
 * **Data, never words.** Each entry carries the dates and figures the screen
 * needs and nothing in Hebrew, so the opening screen and `/alerts` phrase one
 * list and cannot disagree about what is on it.
 */
export type ActionList = "blockage" | "warning";

/** The three documents of item 28, and the medical insurance item 27 names
 * beside them. */
export type ExpiringDocument =
  | "employmentPermit"
  | "workVisa"
  | "passport"
  | "medicalInsurance";

export type ActionEntry = { list: ActionList } & (
  | { key: "nationalInsurance"; quarter: { from: YearMonth; to: YearMonth } }
  | { key: "documentExpired"; document: ExpiringDocument; expiresOn: IsoDate }
  | { key: "documentExpiring"; document: ExpiringDocument; expiresOn: IsoDate }
  | { key: "advanceOutstanding"; number: number; outstandingAgorot: number }
  | {
      key: "holidaysUnchosen";
      year: number;
      chosenDays: number;
      allowance: number;
    }
  | { key: "recuperationDue"; month: YearMonth }
  | { key: "recuperationApproaching"; month: YearMonth }
  | { key: "vacationUnderSeven"; year: number; days: number }
  | { key: "monthNotExported"; month: YearMonth }
  | {
      key: "minimumWageChanged";
      exportedAtAgorot: number;
      nowAgorot: number;
      effectiveFrom: IsoDate;
    }
  | { key: "seniorityYearTurning"; years: number; on: IsoDate }
);

/** How far ahead the bell warns of the permit, the visa and the medical
 * insurance running out (the user, 2026-09-17). */
export const EXPIRY_WARNING_DAYS = 60;

/** The passport warns while fewer than this many months are left on it, not
 * when it lapses: the employer must see it stays valid that long (item 28). */
export const PASSPORT_MONTHS_REQUIRED = 18;

/** Item 7: the law asks for at least this many vacation days a year. */
const VACATION_DAYS_THE_LAW_ASKS_FOR = 7;

const DECEMBER = 12;

export interface ActionListInput {
  profile: WorkerProfile;
  /** The replay up to today's month, which `calculateSeries` returns when it is
   * given `today`. */
  series: MonthInSeries[];
  /** Every span the worker has, future ones included: holidays are chosen for
   * the whole year ahead, beyond the months the replay reaches. */
  spans: MonthSpan[];
  rates: DatedRate[];
  today: IsoDate;
}

/** Everything item 27 asks the user to act on, in item 27's order. */
export function actionList(input: ActionListInput): ActionEntry[] {
  return [
    ...nationalInsurance(input),
    ...documents(input),
    ...advances(input),
    ...holidays(input),
    ...recuperation(input),
    ...vacation(input),
    ...unexportedMonths(input),
    ...minimumWage(input),
    ...seniority(input),
  ];
}

/**
 * Every quarter that has ended since the worker's first month and that no
 * national-insurance payment covers yet (item 19): it appears the month after
 * the quarter ends and stays until the payment is recorded.
 *
 * A quarter counts as paid when a payment covers its last month. A payment that
 * names no period covers the month it was filed under, as item 16 says of every
 * payment.
 */
function nationalInsurance({ profile, series, today }: ActionListInput): ActionEntry[] {
  const covered = series.flatMap(({ facts }) =>
    facts.thirdPartyPayments
      .filter((payment) => payment.kind === "nationalInsurance")
      .flatMap((payment) => payment.coversMonths ?? [facts.month]),
  );
  const lastEnded = previousQuarter(monthOf(today));
  const entries: ActionEntry[] = [];
  for (const month of eachMonth(profile.firstMonth, lastEnded.to)) {
    if (month.month % 3 !== 0) continue;
    if (covered.some((one) => sameMonth(one, month))) continue;
    entries.push({
      list: "blockage",
      key: "nationalInsurance",
      quarter: { from: addMonths(month, -2), to: month },
    });
  }
  return entries;
}

/**
 * The permit, the visa, the passport and the medical insurance: lapsed goes on
 * the opening screen, running out soon goes to the bell (item 27). A document
 * is valid through its expiry date itself, which is how `coverExpiryOf` reads a
 * policy. A date nobody entered says nothing either way.
 */
function documents({ profile, series, today }: ActionListInput): ActionEntry[] {
  const soon = addDays(today, EXPIRY_WARNING_DAYS);
  // The day before eighteen months are up: exactly eighteen left is not fewer.
  const passportSoon = addDays(addMonthsToDate(today, PASSPORT_MONTHS_REQUIRED), -1);
  const { employmentPermitExpiry, workVisaExpiry, passportExpiry } = profile.documents;
  const checks: [ExpiringDocument, IsoDate | null, IsoDate][] = [
    ["employmentPermit", employmentPermitExpiry, soon],
    ["workVisa", workVisaExpiry, soon],
    ["passport", passportExpiry, passportSoon],
    ["medicalInsurance", medicalCoverEnds(series), soon],
  ];
  const entries: ActionEntry[] = [];
  for (const [document, expiresOn, warnUntil] of checks) {
    if (expiresOn === null) continue;
    if (compareIsoDate(expiresOn, today) < 0) {
      entries.push({ list: "blockage", key: "documentExpired", document, expiresOn });
    } else if (compareIsoDate(expiresOn, warnUntil) <= 0) {
      entries.push({ list: "warning", key: "documentExpiring", document, expiresOn });
    }
  }
  return entries;
}

/** The latest cover any recorded medical-insurance payment bought (item 16). */
function medicalCoverEnds(series: MonthInSeries[]): IsoDate | null {
  const ends = series.flatMap(({ facts }) =>
    facts.thirdPartyPayments
      .filter((payment) => payment.kind === "medicalInsurance")
      .map((payment) => payment.expiresOn ?? coverExpiryOf(payment.kind, payment.paidOn))
      .filter((end): end is IsoDate => end !== null),
  );
  return ends.sort(compareIsoDate).at(-1) ?? null;
}

function advances({ profile, series }: ActionListInput): ActionEntry[] {
  return advanceLedger(
    profile.openingPosition,
    series.map(({ facts }) => facts),
  )
    .filter((advance) => advance.outstandingAgorot > 0)
    .map((advance) => ({
      list: "blockage",
      key: "advanceOutstanding",
      number: advance.number,
      outstandingAgorot: advance.outstandingAgorot,
    }));
}

/** This calendar year's holidays, measured the way the picker measures them
 * (item 10), so the two cannot disagree about whether the year is chosen. */
function holidays({ profile, spans, today }: ActionListInput): ActionEntry[] {
  const year = fromIsoDate(today).getUTCFullYear();
  const allowance = holidayAllowanceFor(profile.employedSince, year);
  if (allowance === 0) return [];
  const chosen = holidayYear([], spans, allowance, year, profile.restDay);
  if (!chosen.incomplete) return [];
  return [
    {
      list: "blockage",
      key: "holidaysUnchosen",
      year,
      chosenDays: chosen.chosenDays,
      allowance,
    },
  ];
}

/**
 * Recuperation due this month, until its day rate is confirmed; and in the
 * month before a recuperation month, a warning that one is coming (item 15).
 * This month is read off its own terms, next month off the profile's, since
 * next month has not been opened.
 */
function recuperation({ profile, series, today }: ActionListInput): ActionEntry[] {
  const thisMonth = monthOf(today);
  const next = addMonths(thisMonth, 1);
  const current = series.find(({ facts }) => sameMonth(facts.month, thisMonth))?.facts;
  const entries: ActionEntry[] = [];
  if (
    current !== undefined &&
    current.recuperationDayRateAgorot === undefined &&
    recuperationDaysInMonth(profile, current.terms.recuperationMonth, thisMonth) > 0
  ) {
    entries.push({ list: "blockage", key: "recuperationDue", month: thisMonth });
  }
  if (recuperationDaysInMonth(profile, profile.recuperationMonth, next) > 0) {
    entries.push({ list: "warning", key: "recuperationApproaching", month: next });
  }
  return entries;
}

/** In December, a year with fewer than seven vacation days taken (item 7). */
function vacation({ profile, series, today }: ActionListInput): ActionEntry[] {
  const thisMonth = monthOf(today);
  if (thisMonth.month !== DECEMBER) return [];
  const year = thisMonth.year;
  const opening =
    profile.firstMonth.year === year ? profile.openingPosition.vacationUsedThisYear : 0;
  const days = series
    .filter(({ facts }) => facts.month.year === year)
    .reduce(
      (total, { result }) =>
        total + (result.balances.find((line) => line.kind === "vacation")?.used ?? 0),
      opening,
    );
  if (days >= VACATION_DAYS_THE_LAW_ASKS_FOR) return [];
  return [{ list: "blockage", key: "vacationUnderSeven", year, days }];
}

/** Every month that has ended and that no file was produced from (Part 5). */
function unexportedMonths({ series, today }: ActionListInput): ActionEntry[] {
  return series
    .filter(({ facts }) => monthHasEnded(facts.month, today) && facts.exportedAt === undefined)
    .map(({ facts }) => ({ list: "warning", key: "monthNotExported", month: facts.month }));
}

/**
 * The minimum wage in force now, where it differs from the one the most
 * recently exported month was confirmed at (items 4, 27). Before anything has
 * been exported there is nothing for it to have changed since.
 */
function minimumWage({ series, rates, today }: ActionListInput): ActionEntry[] {
  const exported = series
    .filter(({ facts }) => facts.exportedAt !== undefined)
    .sort((a, b) => (a.facts.exportedAt! < b.facts.exportedAt! ? -1 : 1))
    .at(-1)?.facts;
  const now = rateInForce(rates, "minimumWage", monthOf(today));
  if (exported === undefined || now === null) return [];
  if (now.value === exported.confirmedWage.minimumAgorot) return [];
  return [
    {
      list: "blockage",
      key: "minimumWageChanged",
      exportedAtAgorot: exported.confirmedWage.minimumAgorot,
      nowAgorot: now.value,
      effectiveFrom: now.effectiveFrom,
    },
  ];
}

/** In the month before the employment anniversary, the seniority year about to
 * begin (item 27). Measured from the anniversary, as recuperation is (item 15). */
function seniority({ profile, today }: ActionListInput): ActionEntry[] {
  const next = addMonths(monthOf(today), 1);
  const start = monthOf(profile.employedSince);
  if (next.month !== start.month || compareMonth(next, start) <= 0) return [];
  const years = next.year - start.year;
  return [
    {
      list: "warning",
      key: "seniorityYearTurning",
      years,
      on: addYears(profile.employedSince, years),
    },
  ];
}

/** The same day some months later, clamped to the end of a shorter month. */
function addMonthsToDate(iso: IsoDate, months: number): IsoDate {
  const target = addMonths(monthOf(iso), months);
  const day = Math.min(fromIsoDate(iso).getUTCDate(), daysInMonth(target));
  return isoOf(target, day);
}

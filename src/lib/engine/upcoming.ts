import { addMonths, addYears, compareIsoDate, compareMonth, monthOf, sameMonth } from "@/lib/dates";
import type { IsoDate, YearMonth } from "@/lib/types";
import { recuperationDaysInMonth } from "./recuperation";
import type { WorkerProfile } from "./repository";
import type { MonthInSeries } from "./series";
import type { ThirdPartyKind, ThirdPartyPayment } from "./types";

/**
 * What falls due in the next twelve months, this month included, as the
 * payments screen's "לקראת החודשים הבאים" lists it (specs.md item 15). A
 * reminder: it records nothing, and it carries data and never words.
 */

/** The three yearly fees item 15 names, in its order. */
export type UpcomingFee = Extract<ThirdPartyKind, "visaExtensionFee" | "licenceFee" | "agencyFee">;

export type UpcomingEntry =
  | {
      key: "fee";
      kind: UpcomingFee;
      month: YearMonth;
      /** What was paid for this kind the last time, or null if never. */
      lastPaidAgorot: number | null;
    }
  | { key: "recuperation"; month: YearMonth; days: number };

/** The window: this month and the eleven after it. */
const MONTHS_AHEAD = 12;

interface UpcomingInput {
  profile: WorkerProfile;
  /** The replay up to today's month. */
  series: MonthInSeries[];
  today: IsoDate;
}

export function upcoming({ profile, series, today }: UpcomingInput): UpcomingEntry[] {
  const first = monthOf(today);
  const last = addMonths(first, MONTHS_AHEAD - 1);
  const within = (month: YearMonth) =>
    compareMonth(month, first) >= 0 && compareMonth(month, last) <= 0;

  const payments = series.flatMap(({ facts }) => facts.thirdPartyPayments);
  const latest = (kind: UpcomingFee): ThirdPartyPayment | undefined =>
    payments
      .filter((payment) => payment.kind === kind)
      .sort((a, b) => compareIsoDate(a.paidOn, b.paidOn))
      .at(-1);

  // Each fee's due date: the visa's and the permit's are the documents' own
  // (item 28); the agency's is a year after it was last paid.
  const { workVisaExpiry, employmentPermitExpiry } = profile.documents;
  const dueOn: [UpcomingFee, IsoDate | null][] = [
    ["visaExtensionFee", workVisaExpiry],
    ["licenceFee", employmentPermitExpiry],
    ["agencyFee", agencyDueOn(latest("agencyFee"))],
  ];

  const entries: UpcomingEntry[] = [];
  for (const [kind, on] of dueOn) {
    if (on === null || !within(monthOf(on))) continue;
    entries.push({
      key: "fee",
      kind,
      month: monthOf(on),
      lastPaidAgorot: latest(kind)?.agorot ?? null,
    });
  }

  // Recuperation in its month, once owed. This month's is handled when its day
  // rate has been confirmed (item 15); a month ahead reads the profile's terms,
  // since it has not been opened.
  for (let offset = 0; offset < MONTHS_AHEAD; offset += 1) {
    const month = addMonths(first, offset);
    const stored = series.find(({ facts }) => sameMonth(facts.month, month))?.facts;
    if (stored?.recuperationDayRateAgorot !== undefined) continue;
    const recuperationMonth = stored?.terms.recuperationMonth ?? profile.recuperationMonth;
    const days = recuperationDaysInMonth(profile, recuperationMonth, month);
    if (days > 0) entries.push({ key: "recuperation", month, days });
  }

  // Soonest first; a stable sort keeps item 15's order within a month.
  return entries.sort((a, b) => compareMonth(a.month, b.month));
}

function agencyDueOn(payment: ThirdPartyPayment | undefined): IsoDate | null {
  return payment === undefined ? null : addYears(payment.paidOn, 1);
}

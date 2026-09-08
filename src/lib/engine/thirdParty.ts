import {
  compareMonth,
  eachMonth,
  parseYearMonth,
  previousQuarter,
} from "@/lib/dates";
import { type LineDraft, toLine } from "@/lib/engine/lines";
import { thirdPartyKinds } from "@/lib/engine/types";
import type {
  LineOverride,
  MonthFacts,
  ThirdPartyKind,
  ThirdPartyPayment,
} from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";
import type { LegalLinkKey } from "@/lib/links";
import { parseShekels } from "@/lib/money";
import type { Explanation, MonthLine, SheetColumn, YearMonth } from "@/lib/types";

/**
 * The money that goes somewhere other than to the worker — the medical
 * insurance premium, the national-insurance contribution, the agency and
 * placement fees, the visa and licence fees — and the national-insurance
 * estimate that sits beside it without being it.
 *
 * **Nothing in this file ever reaches the worker's total.** The payments are
 * column H, and H is deliberately excluded from the month's total: reading it
 * as salary would overpay her (specs.md item 16, Part 5). The workbook says so
 * in its own formulas — `שכר_חודשי_להאנה2025.xlsx` -> `חודש  7.25` totals the
 * month in E26 as `=E23+F24+G25` while H25 is `=SUM(H6:H22)` and stands apart,
 * carrying that month's ₪936 to the National Insurance Institute.
 *
 * **Two figures, in two different columns, and they are not each other**
 * (specs.md item 19). Every month carries its own *estimate*: 3.6% of that
 * month's full cost, a figure to confirm rather than a fact, because the sum
 * actually billed has differed from it. The money actually *paid* appears only
 * in the month it left the account, with the months it covers. The workbook
 * keeps them in two cells and so does this file: `חודש  8.25` -> D21 holds the
 * per-month figure with H21 empty, because August settled no quarter, while
 * `חודש  7.25` -> D21 and H21 both hold something — the estimate and the ₪936
 * paid on 20.7.25 for 4-6/25, which B21 and I21 both name. One is what the
 * month accrued; the other is what left the account, and a single line carrying
 * both is the contradiction item 19 exists to close.
 *
 * **The estimate is not a line, and that is the workbook's own arrangement.**
 * D is the unit-price column, and Part 5 warns that reading a fee's unit price
 * in D as a charge would invent payments in months where nothing was paid —
 * which is exactly what D21 would become if it were emitted as an H line. It is
 * a reporting figure, like the two day counts, and it enters no subtotal:
 * nothing in the sheet sums column D.
 */

/** Column H — the quarterly, yearly and one-off payments to third parties
 * (`שכר_חודשי_להאנה2025.xlsx` -> `חודש  8.25` -> H5). */
const THIRD_PARTY_COLUMN: SheetColumn = "H";

/**
 * 3.6% of the month's full cost (specs.md item 19).
 *
 * **Derived, never copied.** The workbook's own line is stale: D21 of every
 * month tab in `שכר_חודשי_להאנה2025.xlsx` and `שכר_חודשי_להאנה2026.xlsx` still
 * reads 117.60, which is 2% of the 2024 monthly minimum wage — ₪5,880.02, the
 * figure `שכר_חודשי_להאנה2024.xlsx` -> `חודש  12.24` -> D7 pays the salary at.
 * The rate rose to 3.6% in January 2025 and the cell never followed; I21 of the
 * same 2025 tabs says so in words while the cell beside it disagrees, which is
 * Part 5's rule in one row: where a note and an amount disagree the amount is
 * what happened, and where the workbook and the statute disagree the statute
 * is.
 *
 * **It carries no effective date, and that is the same defect one paragraph
 * up.** The rate rose to 3.6% in January 2025, so a month of 2024 is not valued
 * at it — and this constant cannot say so, which is precisely how D21 went
 * stale. It is not fixed here because the fix is a *table* and not a second
 * constant: `specs.md` item 4 and Part 3 now require every rate the application
 * does not derive to be held with the date it took effect, and stage 5's first
 * bullet builds it with this figure and the minimum wage as its first two rows.
 * Until then the application calculates only months from 2025 onward, where
 * this figure is the one in force, and the debt is written down in three places
 * rather than left in a number.
 */
export const NATIONAL_INSURANCE_RATE = 0.036;

/**
 * This month's estimate: 3.6% of the month's full cost — the salary, the
 * rest-eve supplement, the rest-day and holiday pay, and the one-off payments
 * such as recuperation — taken **before anything to do with advances**
 * (specs.md item 19).
 *
 * That base is columns E, F and G, which is the gross, so the gross is what
 * this takes. Applying it to the net would make the contribution depend on
 * whether the family happened to lend her money, which nothing in the rule
 * says: for August 2025 it is 3.6% of ₪9,305.75 and not of ₪7,305.75 (Part 4).
 *
 * It is an **estimate to be confirmed** and never a fact. It is also never read
 * from `MonthFacts.thirdPartyPayments`: a month that has already settled a
 * quarter still accrues its own, and a month that has settled none still has
 * one.
 */
export function nationalInsuranceEstimateOf(grossAgorot: number): number {
  return Math.round(grossAgorot * NATIONAL_INSURANCE_RATE);
}

/**
 * The line's explanation key (specs.md item 24), stable from Step 3's commit.
 *
 * One key per kind, because the sheet has one row per kind per month. A month
 * carrying two payments of the same kind would produce two lines under one key,
 * which an override (item 17) could not tell apart; the repository in Stage 3
 * is where that is kept out, since the key set is fixed here and cannot grow a
 * discriminator without breaking every caller that addresses one.
 */
export function thirdPartyLineKey(kind: ThirdPartyKind): string {
  return `thirdParty.${kind}`;
}

/**
 * The kinds a month records more than once.
 *
 * The sheet holds one row per kind — rows 10 and 12 to 16 and 21 of a month tab
 * — and a month that recorded two of the same would produce two lines under one
 * key, which an override could not tell apart (specs.md item 17) and an
 * explanation could not either (item 24). `validateMonth` refuses it; two
 * payments of one kind are entered as one summed payment, which is what the
 * workbook itself writes.
 */
export function duplicateThirdPartyKinds(
  payments: ThirdPartyPayment[],
): ThirdPartyKind[] {
  const seen = new Set<ThirdPartyKind>();
  const twice = new Set<ThirdPartyKind>();
  for (const payment of payments) {
    if (seen.has(payment.kind)) twice.add(payment.kind);
    seen.add(payment.kind);
  }
  return [...twice];
}

/**
 * The rule each kind rests on, so a user who wants to check a figure can read
 * it rather than take the application's word (specs.md item 26). The fees, the
 * visa and the employment permit are all in the one guide; the insurances have
 * a page each.
 */
export const LINK_FOR_THIRD_PARTY: Record<ThirdPartyKind, LegalLinkKey> = {
  medicalInsurance: "medicalInsurance",
  placementFee: "employmentGuide",
  agencyFee: "employmentGuide",
  visaExtensionFee: "employmentGuide",
  workerVisa: "employmentGuide",
  licenceFee: "employmentGuide",
  nationalInsurance: "nationalInsurance",
};

/**
 * The national-insurance payment says more than the others do: it is the
 * quarter's money leaving the account, and the thing most easily confused with
 * the month's own estimate. Every other kind is a payment out and needs no more
 * than that said (specs.md item 16).
 */
function explanationFor(kind: ThirdPartyKind): Explanation {
  return {
    text:
      kind === "nationalInsurance"
        ? he.sheet.why.nationalInsurancePaid
        : he.sheet.why.thirdParty,
    link: LINK_FOR_THIRD_PARTY[kind],
  };
}

/**
 * The month's column H lines: what actually left the account, in the month it
 * left it.
 *
 * `units` is 1 and `rate` is the whole payment, so `units × rate` gives the
 * amount as it must on every line (specs.md item 2). A fee has no meaningful
 * unit price — the ₪936 quarter is one payment and not three months at ₪312 —
 * and inventing one here would put a per-month charge in column D, which is the
 * reading Part 5 warns about.
 */
export function thirdPartyLines(
  payments: ThirdPartyPayment[],
  overrides: Record<string, LineOverride>,
): MonthLine[] {
  return payments
    .map<LineDraft>((payment) => ({
      key: thirdPartyLineKey(payment.kind),
      label: he.sheet.thirdParty[payment.kind],
      units: 1,
      rate: payment.agorot,
      column: THIRD_PARTY_COLUMN,
      // The months the payment covers travel with the line: the national
      // insurance is paid once a quarter and in arrears, and the workbook
      // writes those months into the row's own label (specs.md item 19,
      // `שכר_חודשי_להאנה2025.xlsx` -> `חודש  7.25` -> B21).
      ...(payment.coversMonths ? { coversMonths: payment.coversMonths } : {}),
      explanation: explanationFor(payment.kind),
    }))
    .map((draft) => toLine(draft, overrides));
}

/**
 * The covered period the application *offers* for a kind, or `null` where it has
 * none to offer (specs.md items 16, 19).
 *
 * **Only the national insurance has one, and the rest are left empty on
 * purpose.** It is paid once a quarter and in arrears, so the quarter it is for
 * is the last one to have closed before the month it is being recorded in. The
 * yearly fees have no such answer: item 15's year runs from one employment
 * anniversary to the next, so a fee paid in March covers the year *forward*
 * from March while a quarter covers the months *behind* it, and one rule cannot
 * serve both. Guessing a period for them would be worse than leaving it blank,
 * because a period on the sheet's own row reads as a fact somebody checked.
 *
 * **It is an offer and stops following the kind the moment the user touches
 * it**, exactly as item 20's placement chips stop following the direction. A
 * family that paid a quarter late still chooses the quarter it was for.
 */
export function offeredPeriodFor(
  kind: ThirdPartyKind,
  month: YearMonth,
): { from: YearMonth; to: YearMonth } | null {
  return kind === "nationalInsurance" ? previousQuarter(month) : null;
}

/**
 * A payment on its way in from the browser, and the rule that says whether it
 * is a payment at all (specs.md item 16).
 *
 * **Everything travels as the user typed or chose it and is read here**, on the
 * server side of the boundary (Part 3). The kind arrives as a string because a
 * server action is reachable by a crafted request, and a stored kind outside the
 * union would reach `he.sheet.thirdParty[kind]` and come back undefined — a row
 * on the sheet with no label on it.
 */
export interface ThirdPartyDraft {
  kind: string;
  /** As typed — "936", "1,234.50". */
  amount: string;
  /**
   * The covered period as the two month selects hand it up: `YYYY-MM`, or empty
   * for "not said". **Both empty is the ordinary case** — most payments cover
   * the month they were made in and the sheet says nothing more about them.
   */
  coversFrom: string;
  coversTo: string;
  note: string;
}

/**
 * Why a draft is not a payment. Each is a sentence the user is shown rather than
 * a log line (specs.md item 25), and none of them carries a link: every one is
 * about the *form* of an entry, and nothing in law says a period must have two
 * ends. The engine's own `thirdPartyPaidTwice` refusal does carry one, because
 * what it refuses is a row on the sheet.
 */
export type ThirdPartyRefusal =
  | "amount"
  | "shape"
  | "thirdPartyPaidTwice"
  | "periodIncomplete"
  | "periodBackwards";

export type ReviewedThirdParty =
  | { ok: true; payment: ThirdPartyPayment }
  | { ok: false; reason: ThirdPartyRefusal };

/**
 * The longest period a single payment can cover: the employment permit's own
 * four-year cycle, which is the slowest clock this application knows (specs.md
 * items 16, 28). It is a bound on a crafted request and not a rule the user can
 * meet — every period the screen offers is inside it — which is why a period
 * past it comes back as `shape` rather than as a sentence of its own.
 *
 * It exists because `coversMonths` is stored one entry per month: a period of
 * `0001-01` to `9999-12` is ninety-six thousand entries written into a row's
 * label, and the bound is taken from a rule rather than from a round number so
 * that nobody later has to guess what it was protecting.
 */
const LONGEST_COVERED_PERIOD_MONTHS = 4 * 12;

/**
 * The covered months, or the reason the pair is not a period.
 *
 * Half a period is refused rather than completed: a first month with no last
 * one names nothing, and guessing the other end would put months on the sheet's
 * row that the user never chose.
 */
function coveredMonths(
  draft: ThirdPartyDraft,
):
  | { ok: true; months: YearMonth[] | undefined }
  | { ok: false; reason: ThirdPartyRefusal } {
  const fromText = draft.coversFrom.trim();
  const toText = draft.coversTo.trim();

  if (fromText === "" && toText === "") return { ok: true, months: undefined };
  if (fromText === "" || toText === "") {
    return { ok: false, reason: "periodIncomplete" };
  }

  const from = parseYearMonth(fromText);
  const to = parseYearMonth(toText);
  if (from === null || to === null) return { ok: false, reason: "shape" };

  // Refused and never reordered. Which way round she meant it is not the
  // application's to decide, and a period silently flipped is one she will not
  // check (specs.md item 16).
  if (compareMonth(from, to) > 0) return { ok: false, reason: "periodBackwards" };

  const months = eachMonth(from, to);
  if (months.length > LONGEST_COVERED_PERIOD_MONTHS) {
    return { ok: false, reason: "shape" };
  }
  return { ok: true, months };
}

/**
 * The draft as a `ThirdPartyPayment`, or the reason it is not one (specs.md
 * item 16). Pure, so the rule can be tested without a store or a request.
 *
 * **The month's existing payments are passed in because the sheet holds one row
 * per kind.** Two rows under one name can be neither overridden nor explained
 * apart (items 17, 24), so a second payment of a kind is refused here as well
 * as in `validateMonth` — the engine refuses a stored month and this refuses an
 * entry, and the user who reaches this one has not seen that one. The screen
 * additionally does not *offer* a kind already recorded, which is an offer and
 * never the rule (Part 3).
 */
export function reviewThirdPartyPayment(
  draft: ThirdPartyDraft,
  existing: ThirdPartyPayment[],
): ReviewedThirdParty {
  const kind = thirdPartyKinds.find((candidate) => candidate === draft.kind);
  if (kind === undefined) return { ok: false, reason: "shape" };

  if (existing.some((payment) => payment.kind === kind)) {
    return { ok: false, reason: "thirdPartyPaidTwice" };
  }

  const agorot = parseShekels(draft.amount);
  // Zero is refused, as it is for a line the user adds (item 20): a payment
  // that moved no money is not a payment, and it would print in the export as
  // a payment of nothing (item 2). `parseShekels` has already refused a minus.
  if (agorot === null || agorot === 0) return { ok: false, reason: "amount" };

  const covered = coveredMonths(draft);
  if (!covered.ok) return { ok: false, reason: covered.reason };

  const note = draft.note.trim();
  return {
    ok: true,
    payment: {
      kind,
      agorot,
      ...(covered.months === undefined ? {} : { coversMonths: covered.months }),
      ...(note === "" ? {} : { note }),
    },
  };
}

/**
 * The two fields a third-party payment lives in. Written structurally rather
 * than as `MonthFacts`, so the rule below can be read and tested without a
 * month, a wage or a set of terms around it — the same shape
 * `withoutOneOffUserLine` is written in.
 */
type WhereThirdPartyPaymentsLive = Pick<
  MonthFacts,
  "thirdPartyPayments" | "overrides"
>;

/**
 * A month with one third-party payment gone, **and any amount the user typed
 * over it gone with it** (specs.md items 16, 17).
 *
 * The two removals are one operation and are a rule rather than plumbing, for
 * the reason `withoutOneOffUserLine` and `withoutAdvance` already give: an
 * override is addressed by the row's own key, so one left behind is an amount
 * waiting to reattach itself to a row that never asked for it — and since a
 * stored override *replaces* the calculated figure, the row it landed on would
 * show an amount nobody entered for it, marked as manual.
 *
 * The kind is the whole address, which is what the one-row-per-kind rule buys:
 * there is never a second payment of that kind to tell it apart from.
 */
export function withoutThirdPartyPayment<T extends WhereThirdPartyPaymentsLive>(
  month: T,
  kind: ThirdPartyKind,
): T {
  const overrides = { ...month.overrides };
  delete overrides[thirdPartyLineKey(kind)];
  return {
    ...month,
    thirdPartyPayments: month.thirdPartyPayments.filter(
      (payment) => payment.kind !== kind,
    ),
    overrides,
  };
}

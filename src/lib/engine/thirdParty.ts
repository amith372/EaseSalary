import { type LineDraft, toLine } from "@/lib/engine/lines";
import type {
  LineOverride,
  ThirdPartyKind,
  ThirdPartyPayment,
} from "@/lib/engine/types";
import { he } from "@/lib/i18n/he";
import type { LegalLinkKey } from "@/lib/links";
import type { Explanation, MonthLine, SheetColumn } from "@/lib/types";

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
export const THIRD_PARTY_COLUMN: SheetColumn = "H";

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
 */
export const NATIONAL_INSURANCE_RATE = 0.036;

/**
 * This month's estimate: 3.6% of the month's full cost — the salary, the Friday
 * supplement, the Saturday and holiday pay, and the one-off payments such as
 * recuperation — taken **before anything to do with advances** (specs.md
 * item 19).
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
  nationalInsurance: "nationalInsurance",
  agencyFee: "employmentGuide",
  placementFee: "employmentGuide",
  visaFee: "employmentGuide",
  licenceFee: "employmentGuide",
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

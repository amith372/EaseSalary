import { Bidi } from "@/components/Bidi";
import { monthLabel } from "@/lib/dateLabels";
import { he } from "@/lib/i18n/he";
import type { YearMonth } from "@/lib/types";

/**
 * The months a payment covers, where they are not simply the month it appears in
 * — a quarterly national-insurance payment is made in arrears (specs.md item
 * 19), and a yearly fee covers the year running forward from an employment
 * anniversary (item 15).
 *
 * **It is one component because it is one fact.** The month screen draws it
 * beside the sheet's own row and the payments screen beside the row that
 * recorded it, and two screens each rendering it their own way is two places for
 * one period to be written differently — which is what happened when the
 * payments screen was built: `/month` listed every month and `/payments`
 * printed the two ends. The same argument `MonthStepper` and `advanceKey` were
 * extracted for.
 *
 * **It draws the run as its two ends rather than as a list.** A stored period is
 * contiguous by construction — `reviewThirdPartyPayment` builds it with
 * `eachMonth` from a first month and a last one — so the ends carry exactly what
 * the list carries and stay readable at twelve months or at the permit's
 * forty-eight, where a list would not. A single month is drawn alone, because a
 * range from a month to itself reads as an error.
 *
 * The dates travel beside the label rather than inside it and each is isolated:
 * a month written into a Hebrew sentence is a mixed run a browser may reorder
 * (Part 5), and `noTranslate` keeps a translated month from becoming a different
 * month (`CLAUDE.md`).
 */
export function CoveredMonths({ months }: { months: readonly YearMonth[] }) {
  if (months.length === 0) return null;

  const first = months[0];
  const last = months[months.length - 1];

  return (
    <>
      <span dir="auto">{he.sheet.reporting.coversMonths}</span>
      <span> </span>
      <Bidi noTranslate>{monthLabel(first)}</Bidi>
      {months.length > 1 ? (
        <>
          <span> – </span>
          <Bidi noTranslate>{monthLabel(last)}</Bidi>
        </>
      ) : null}
    </>
  );
}

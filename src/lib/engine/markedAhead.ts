import { addMonths, compareIsoDate, isoOf, orderDates } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import type { MonthSpan } from "@/lib/engine/types";
import { balanceDaysOf } from "@/lib/spans";
import type { ClosedDaySpan, IsoDate, YearMonth } from "@/lib/types";

/**
 * Vacation days marked in a month **after** the current one (specs.md item 21).
 *
 * No month after the current one is valued, so nothing marked in one can have
 * come off a balance — and a day the user recorded with nothing on screen to
 * acknowledge it is indistinguishable from a day that was not saved. This is the
 * figure the opening screen states apart from the balance, under its own name.
 *
 * **It counts by the rule a valued month counts by**, which is why the sum runs
 * through `balanceDaysOf` rather than through a count of its own: the two
 * figures answer the same question about different months and must never be
 * able to disagree about what a day is worth. So vacation's rest days are left
 * out, a part day is drawn in its proportion, and a span the store holds
 * backwards is ordered before it is measured.
 *
 * **Strictly after**: days marked later in the *current* month are valued by
 * that month and are already in its balance, and counting them here would state
 * them twice.
 *
 * **Vacation only.** Sickness draws from its balance by the spell and not by
 * what was marked (item 8), and what a spell ahead of the current month means is
 * a question nobody has asked; a free rest day is not an entitlement and draws
 * nothing (item 5). Nothing here is stored and nothing reaches an export: a
 * month that is not valued has nothing to file.
 */
export function vacationMarkedAhead(
  spans: MonthSpan[],
  currentMonth: YearMonth,
  restDay: RestDay,
): number {
  const firstDayAhead = isoOf(addMonths(currentMonth, 1), 1);
  return spans.reduce((days, span) => {
    if (span.kind !== "vacation") return days;
    const ahead = fromDayOn(span, firstDayAhead);
    return ahead === null ? days : days + balanceDaysOf(ahead, restDay);
  }, 0);
}

/** The part of a span falling on or after one day, or `null` where none does.
 * The span keeps everything but its first date, so what is left is counted by
 * the same rules as the whole — `clipToMonth` in `spans.ts` does this for a
 * month, and the window here has no far end. */
function fromDayOn<S extends ClosedDaySpan>(span: S, day: IsoDate): S | null {
  const { from, to } = orderDates(span.from, span.to);
  const start = compareIsoDate(from, day) < 0 ? day : from;
  return compareIsoDate(start, to) > 0 ? null : { ...span, from: start, to };
}

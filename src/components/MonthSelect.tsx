"use client";

import { addMonths, yearMonthText } from "@/lib/dates";
import { monthLabel } from "@/lib/dateLabels";
import type { YearMonth } from "@/lib/types";

import { inputClass } from "@/components/Field";

/**
 * One end of a range of months, as a select over months rather than a typed
 * date.
 *
 * **A `<input type="month">` is not used, and that is deliberate.** Its picker
 * is the browser's own and is laid out and worded by the browser's locale, not
 * the page's — so on a Hebrew right-to-left page it can arrive left-to-right and
 * in another language entirely, which is exactly the mixed-direction failure
 * Part 5 warns about, in a control the application cannot style or isolate. A
 * select holds labels the application wrote.
 *
 * **The empty option is an answer and never a blank**, which is why its wording
 * is the caller's: on a covered period it is "no period named" and on a standing
 * line's lifetime it is "no end on this side" (specs.md items 19, 20). So is the
 * window, because what a control may reach depends on what it is for — a payment
 * covers months already lived through, a lifetime runs forward.
 *
 * Each option carries the month's own label, and the value is `YYYY-MM`, which
 * is what `parseYearMonth` reads on the server.
 */
export function MonthSelect({
  label,
  month,
  value,
  onChange,
  emptyLabel,
  back,
  forward,
}: {
  label: string;
  /** This month, passed in because nothing reads a clock during a render. */
  month: YearMonth;
  value: string;
  onChange: (value: string) => void;
  emptyLabel: string;
  /** How many months before this one the list reaches, and how many after. */
  back: number;
  forward: number;
}) {
  const options = Array.from({ length: back + forward + 1 }, (_, index) =>
    addMonths(month, forward - index),
  );

  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span dir="auto" className="text-[12px] font-light text-ink-quiet">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      >
        <option value="">{emptyLabel}</option>
        {options.map((candidate) => (
          <option key={yearMonthText(candidate)} value={yearMonthText(candidate)}>
            {monthLabel(candidate)}
          </option>
        ))}
      </select>
    </label>
  );
}

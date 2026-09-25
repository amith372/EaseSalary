import { LawLink } from "@/components/AlertsScreen";
import { Card } from "@/components/Card";
import { he } from "@/lib/i18n/he";
import type { RefusedMonth } from "@/lib/refusalView";

/**
 * A month the engine refused, said as a card (`specs.md` item 25, Part 4).
 *
 * **`InvalidMonthError` carries a Hebrew sentence per refusal and this is what
 * draws it.** The engine refuses a month it cannot value correctly rather than
 * valuing it wrongly in silence, and until this card existed that sentence —
 * written for the user, with the dates it concerns and the rule behind it —
 * reached her as a stack trace.
 *
 * **Two refusals in one month are two reasons and not two cards**: they are one
 * month's state, and a screen stacking cards would read as two separate
 * failures.
 *
 * **It names its month.** One refused month stops the replay of every month
 * after it (item 13), so the screen catching the refusal usually asked about a
 * different month than the one at fault — which for twenty years of months is
 * the difference between a sentence she can act on and one she cannot.
 *
 * The card holds no state and reads nothing: everything it draws was worked out
 * by `refusedMonthOf`, which is where the tests are.
 */
export function RefusalCard({
  refused,
  className = "",
  heading: Heading = "h2",
}: {
  refused: RefusedMonth;
  /** The placement, which differs between the screen that keeps its calendar
   * and the three where the card is the screen. */
  className?: string;
  /** The level, not a style. Where the card leads a screen it carries that
   * screen's `h1`; where a strip stands above it, it stays an `h2`. */
  heading?: "h1" | "h2";
}) {
  return (
    <Card
      radius="lg"
      data-role="refusal"
      className={`flex min-w-0 flex-none flex-col gap-2 px-4.5 py-3.5 ${className}`}
    >
      <Heading data-role="refusal-month" dir="auto" className="text-[17px] font-semibold">
        <span>{he.month.refused.title} </span>
        <bdi translate="no">{refused.monthLabel}</bdi>
      </Heading>
      <p dir="auto" className="text-[15px] leading-[1.5] font-light text-ink-mute text-pretty">
        {he.month.refused.body}
      </p>
      <ul className="flex flex-col gap-2.5">
        {refused.reasons.map((reason, index) => (
          <li
            key={`${index} ${reason.message}`}
            data-role="refusal-reason"
            className="flex min-w-0 flex-col gap-1"
          >
            <p dir="auto" className="text-[15px] leading-[1.5] text-pretty">
              {reason.message}
            </p>
            {reason.dates.length > 0 ? (
              <p dir="auto" className="text-[14px] leading-[1.45] text-ink-mute">
                <span>{he.month.refused.dates} </span>
                {reason.dates.map((date, at) => (
                  <span key={date} data-role="refusal-date">
                    {at > 0 ? <span>, </span> : null}
                    <bdi translate="no">{date}</bdi>
                  </span>
                ))}
              </p>
            ) : null}
            <LawLink law={reason.law} className="text-[13px]" />
          </li>
        ))}
      </ul>
      <p dir="auto" className="text-[14px] leading-[1.45] font-light text-ink-quiet text-pretty">
        {he.month.refused.stopsLater}
      </p>
    </Card>
  );
}

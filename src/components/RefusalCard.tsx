import Link from "next/link";
import { LawLink } from "@/components/AlertsScreen";
import { Card } from "@/components/Card";
import { Chevron } from "@/components/icons";
import { he } from "@/lib/i18n/he";
import type { RefusedMonth } from "@/lib/refusalView";

/**
 * A month the engine refused, said as a card (`specs.md` item 25, Part 4).
 *
 * **`InvalidMonthError` carries a Hebrew sentence per refusal and this is what
 * draws it.** The engine refuses a month it cannot value correctly rather than
 * valuing it wrongly in silence, and until this card existed that sentence —
 * written for the user, with the dates it concerns and the rule behind it —
 * reached them as a stack trace.
 *
 * **Two refusals in one month are two reasons and not two cards**: they are one
 * month's state, and a screen stacking cards would read as two separate
 * failures.
 *
 * **It names its month.** One refused month stops the replay of every month
 * after it (item 13), so the screen catching the refusal usually asked about a
 * different month than the one at fault — which for twenty years of months is
 * the difference between a sentence they can act on and one they cannot.
 *
 * **`tone="compact"` is the same card with its prose dropped**, for the two
 * screens that list both workers rather than explain one month: the reason, its
 * dates, the month and the rule stay; the body paragraph and the "every month
 * after this one is waiting" line go. One component and not a second card, so
 * the wording cannot fork between the screens that explain and the screens that
 * list.
 *
 * The card holds no state and reads nothing: everything it draws was worked out
 * by `refusedMonthOf`, which is where the tests are.
 */
export function RefusalCard({
  refused,
  className = "",
  heading: Heading = "h2",
  tone = "full",
  wayHome = false,
}: {
  refused: RefusedMonth;
  /** The placement, which differs between the screen that keeps its calendar
   * and the three where the card is the screen. */
  className?: string;
  /** The level, not a style. Where the card leads a screen it carries that
   * screen's `h1`; where a strip stands above it, it stays an `h2`. */
  heading?: "h1" | "h2";
  /** How much of the refusal is said. `"full"` explains the stop; `"compact"`
   * states it, for a screen whose job is a list. */
  tone?: "full" | "compact";
  /**
   * Whether to offer the way back to the opening screen.
   *
   * **It is not simply "every screen that is not the opening screen".** The
   * opening screen shows one worker at a time, chosen by the switcher's cookie,
   * and only an address that names a worker sets it (`WorkerScope`) — so the
   * link is true on `/workers/[id]`, which does, and would land on whichever
   * worker was last chosen from the list, which does not.
   */
  wayHome?: boolean;
}) {
  const full = tone === "full";

  return (
    <Card
      radius="lg"
      data-role="refusal"
      data-tone={tone}
      className={`flex min-w-0 flex-none flex-col gap-2 px-4.5 py-3.5 ${className}`}
    >
      <Heading data-role="refusal-month" dir="auto" className="text-[17px] font-semibold">
        <span>{he.month.refused.title} </span>
        <bdi translate="no">{refused.monthLabel}</bdi>
      </Heading>
      {full ? (
        <p dir="auto" className="text-[15px] leading-[1.5] font-light text-ink-mute text-pretty">
          {he.month.refused.body}
        </p>
      ) : null}
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
      {full ? (
        <p dir="auto" className="text-[14px] leading-[1.45] font-light text-ink-quiet text-pretty">
          {he.month.refused.stopsLater}
        </p>
      ) : null}
      {/* Inside the card and under the reason, so the refusal and its exit read
          as one thing (the user, 2026-09-27). A link and not a button: nothing
          is submitted, and a withheld control would be a third thing to
          explain. */}
      {wayHome ? (
        <Link
          href="/"
          data-role="refusal-way-home"
          className="flex items-center gap-1.5 self-start text-[15px] font-semibold text-forest transition-colors hover:text-forest-deep"
        >
          <Chevron towards="previous" />
          <span dir="auto">{he.month.refused.wayHome}</span>
        </Link>
      ) : null}
    </Card>
  );
}

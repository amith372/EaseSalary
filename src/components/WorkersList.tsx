import Link from "next/link";
import type { ReactNode } from "react";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { MoneyValue } from "@/components/MoneyValue";
import { fullDayLabel } from "@/lib/dateLabels";
import { he } from "@/lib/i18n/he";
import { formatDays } from "@/lib/money";
import type { IsoDate, Worker } from "@/lib/types";

/**
 * The household's workers — `EaseSalary - העובדות` (specs.md item 11).
 *
 * **Two things the artboard draws are not here, and each is another stage's.**
 * The status chip on each card ("[חודש] ממתין לחישוב" / "הכול מעודכן") names
 * one of the month's four states, which are Part 5's and which nothing in the
 * application can yet set — a chip here would be a state invented to fill a
 * shape. The "משותף/ת עם [שם]" chip and the "להוסיף עובד/ת" card are item 11's
 * invitation and the `הוספת עובד` artboard, and both are stage 3's: a card
 * linking to a screen that does not exist is a 404 promised on every load,
 * which the routes table says is worse than an absence. The limit itself is
 * stated, in the sentence the artboard closes with.
 *
 * It holds no state and no arithmetic: the four facts under each worker are
 * read from the same replay `/month` reads (item 13), on the server.
 */
export interface WorkerSummary {
  worker: Worker;
  employedSince: IsoDate;
  /** The code her holiday list is filed under (item 10), not a country name —
   * stage 5's country list is what names it. */
  country: string;
  baseMonthlySalaryAgorot: number;
  /** Her last month's closing balances, or the opening position for a worker
   * who has no months yet (items 6, 7). */
  vacationDays: number;
  sickDays: number;
  /** What is still owed across every advance she carries (item 20). */
  outstandingAgorot: number;
}

export function WorkersList({ household }: { household: WorkerSummary[] }) {
  const words = he.workers;

  return (
    /* The artboard's narrower measure, which `/payments` already takes: a page
       of facts read across the shell's full 1320px is a line the eye loses on
       the way back. */
    <div className="mx-auto flex w-full max-w-[860px] min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1
          dir="auto"
          className="text-[24px] leading-[1.2] font-bold tracking-[-0.02em]"
        >
          {words.title}
        </h1>
        <p
          dir="auto"
          className="max-w-[62ch] text-[15px] leading-[1.55] font-light text-ink-mute text-pretty"
        >
          {words.lead}
        </p>
      </div>

      {household.map(
        ({
          worker,
          employedSince,
          country,
          baseMonthlySalaryAgorot,
          vacationDays,
          sickDays,
          outstandingAgorot,
        }) => (
          <Card
            key={worker.id}
            id={`worker-${worker.id}`}
            className="flex min-w-0 flex-col gap-3 px-4.5 py-3.5"
          >
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 dir="auto" className="text-[19px] font-bold tracking-[-0.02em]">
                <Bidi>{worker.name}</Bidi>
              </h2>
              <p className="text-[14px] font-light text-ink-mute">
                <span dir="auto">{words.employedSince} </span>
                <Bidi>{fullDayLabel(employedSince)}</Bidi>
                <span aria-hidden="true"> · </span>
                <span dir="auto">{words.country} </span>
                {/* The code the application actually holds, isolated and never
                    translated: a translated identifier is a wrong identifier
                    (`CLAUDE.md`). */}
                <Bidi noTranslate>{country}</Bidi>
              </p>
            </div>

            <Card
              tone="inset"
              radius="panel"
              className="grid grid-cols-1 gap-x-6 gap-y-2 px-3.5 py-3 sm:grid-cols-2"
            >
              <Fact label={words.facts.salary}>
                <MoneyValue agorot={baseMonthlySalaryAgorot} />
              </Fact>
              <Fact label={words.facts.advance}>
                <MoneyValue agorot={outstandingAgorot} />
              </Fact>
              <Fact label={words.facts.vacation}>
                <Bidi noTranslate className="text-[16px] font-semibold">
                  {formatDays(vacationDays)}
                </Bidi>
              </Fact>
              <Fact label={words.facts.sick}>
                <Bidi noTranslate className="text-[16px] font-semibold">
                  {formatDays(sickDays)}
                </Bidi>
              </Fact>
            </Card>

            <Link
              href={`/workers/${worker.id}`}
              className="text-[15px] font-semibold text-forest hover:underline hover:underline-offset-4"
            >
              <span dir="auto">{words.toProfile(worker.firstName)}</span>
            </Link>
          </Card>
        ),
      )}

      <p
        dir="auto"
        className="max-w-[62ch] text-[14px] leading-[1.55] font-light text-ink-quiet text-pretty"
      >
        {words.limit}
      </p>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <span dir="auto" className="text-[14px] font-light text-ink-mute">
        {label}
      </span>
      {children}
    </div>
  );
}

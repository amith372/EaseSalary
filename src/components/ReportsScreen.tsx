"use client";

import Link from "next/link";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { MoneyValue } from "@/components/MoneyValue";
import { useWorkerScope } from "@/components/WorkerScope";
import { monthLabel } from "@/lib/dateLabels";
import type { ExportBlockKey } from "@/lib/engine/beforeExport";
import { he } from "@/lib/i18n/he";
import type { YearMonth } from "@/lib/types";

/**
 * The `דוחות` screen — `EaseSalary - דוחות`, and stage 2's step 3.
 *
 * **It is this stage's address and not only its file.** The shell has linked
 * `דוחות` from every page since stage 0 and the address 404'd, which is worse
 * than a tab that is not there.
 *
 * **It offers files and calculates nothing.** Every figure it shows was drawn
 * by the same `calculateSeries` the month screen and the month export run, and
 * every download is a link to `/reports/file` rather than a second path to the
 * same numbers (Part 3).
 *
 * **Four report cards, settled with the user on 2026-09-10.** The artboard
 * draws four and the build plan's step 3 named three; she chose all four. The
 * fourth, the national insurance by quarter, has the card's own words for its
 * content and no numbered criterion of its own.
 *
 * **The closing line says what is true.** The artboard drew "כל קובץ נשמר גם
 * אצלנו" and no file is stored anywhere — item 23 produces it on request. What
 * survives is the data, and that is what the line now says. Reworded with the
 * user on the same day, and it is a departure from the artboard that is
 * deliberate rather than a screen nobody finished.
 */

/** One month as this screen lists it: what it was, and what it came to. */
export interface ReportMonth {
  month: YearMonth;
  grossAgorot: number | null;
  netAgorot: number | null;
  /**
   * Why this month cannot be exported, empty where it can — `blocksExport`'s
   * own answer, which is what `/month/export/file` refuses on.
   *
   * **The screen has to know, because the route answers 409.** Offering the
   * link anyway is what the built screen did on 2026-09-10: the hero's green
   * button pointed at September 2026, a month that had not ended, and pressing
   * it produced an error page rather than a file. No type, lint or unit test
   * could reach that — the screen and the route simply disagreed.
   */
  blocks: ExportBlockKey[];
}

export interface WorkerReports {
  workerId: string;
  months: ReportMonth[];
  /** The years the worker has months in, newest first. The two yearly reports
   * are downloaded a year at a time (item 29), so the screen needs the list
   * rather than a range it worked out from today's date. */
  years: number[];
  /** The month the `לייצא לאקסל` hero points at — the latest the worker has
   * that can actually be exported, which is not always the latest she has.
   * `null` where she has none, and the hero then says so rather than offering
   * a file the route would refuse. */
  latest: YearMonth | null;
}

interface ReportsScreenProps {
  household: WorkerReports[];
}

function fileHref(
  workerId: string,
  report: string,
  year?: number,
): string {
  const query = new URLSearchParams({ worker: workerId, report });
  if (year !== undefined) query.set("year", String(year));
  return `/reports/file?${query.toString()}`;
}

function monthHref(workerId: string, month: YearMonth, notes = false): string {
  const query = new URLSearchParams({
    worker: workerId,
    month: `${month.year}-${String(month.month).padStart(2, "0")}`,
  });
  if (notes) query.set("notes", "1");
  return `/month/export/file?${query.toString()}`;
}

export function ReportsScreen({ household }: ReportsScreenProps) {
  const { worker } = useWorkerScope();
  const words = he.reports;
  const mine =
    household.find((entry) => entry.workerId === worker?.id) ?? household[0];

  if (mine === undefined) return null;

  // Newest first: a family looking for a month is looking for a recent one, and
  // the replay hands them over oldest first because that is the order balances
  // carry in.
  const months = [...mine.months].reverse();

  return (
    <main className="flex flex-1 justify-center px-7 pt-5 pb-12">
      <div className="flex w-full max-w-[880px] flex-col gap-7.5">
        <section className="flex flex-col gap-1.5">
          <h1 dir="auto" className="text-[34px] font-semibold tracking-tight">
            <Bidi>{words.title}</Bidi>
          </h1>
          <p
            dir="auto"
            className="max-w-[60ch] text-[18px] font-light text-pretty text-ink-soft"
          >
            <Bidi>{words.lead}</Bidi>
          </p>
        </section>

        <Card
          as="section"
          tone="tint"
          radius="lg"
          className="flex flex-wrap items-center justify-between gap-7 px-8.5 py-7.5"
        >
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
            <span
              dir="auto"
              className="self-start text-[13px] font-semibold tracking-[0.06em] text-ink-quiet"
            >
              <Bidi>{words.thisMonth.eyebrow}</Bidi>
            </span>
            {/* Every dynamic string gets its own wrapping element, or Chrome's
                translation swaps a bare text node in place and React throws
                `NotFoundError` on `removeChild` (`CLAUDE.md`). */}
            <h2 className="mt-1 text-[30px] leading-tight font-bold tracking-tight">
              {mine.latest === null ? (
                <Bidi>{words.thisMonth.none}</Bidi>
              ) : (
                <>
                  <span dir="auto">{words.thisMonth.before}</span>{" "}
                  <Bidi>{monthLabel(mine.latest)}</Bidi>{" "}
                  <span dir="auto">{words.thisMonth.after}</span>
                </>
              )}
            </h2>
          </div>
          {mine.latest !== null ? (
            <a
              href={monthHref(mine.workerId, mine.latest)}
              className="flex flex-none items-center justify-center gap-3 rounded-[15px] bg-forest px-8 py-4 text-[19px] font-semibold whitespace-nowrap text-white hover:bg-forest-deep hover:text-white"
            >
              <Bidi>{words.thisMonth.action}</Bidi>
            </a>
          ) : null}
        </Card>

        <section className="flex flex-col gap-4">
          <h2 dir="auto" className="text-[22px] font-semibold">
            <Bidi>{words.previousMonths.title}</Bidi>
          </h2>
          <Card radius="md" className="overflow-hidden">
            {months.length === 0 ? (
              <p dir="auto" className="px-6 py-5 text-[16px] font-light text-ink-soft">
                <Bidi>{words.previousMonths.none}</Bidi>
              </p>
            ) : (
              months.map((entry) => (
                <div
                  key={`${entry.month.year}-${entry.month.month}`}
                  data-report-month={`${entry.month.year}-${entry.month.month}`}
                  className="flex flex-wrap items-center gap-5 border-t border-line px-6 py-4.5 first:border-t-0"
                >
                  <span
                    dir="auto"
                    className="w-[130px] flex-none text-[18px] font-semibold"
                  >
                    <Bidi>{monthLabel(entry.month)}</Bidi>
                  </span>
                  <span className="min-w-0 flex-[1_1_200px] text-[16px] font-light text-ink-mute">
                    <span dir="auto">{words.previousMonths.gross}</span>{" "}
                    <MoneyValue agorot={entry.grossAgorot} />
                    <span> · </span>
                    <span dir="auto">{words.previousMonths.net}</span>{" "}
                    <MoneyValue agorot={entry.netAgorot} />
                  </span>
                  <div className="flex items-center gap-4">
                    {entry.blocks[0] === undefined ? (
                      <a
                        href={monthHref(mine.workerId, entry.month)}
                        className="text-[16px] font-semibold whitespace-nowrap"
                      >
                        <Bidi>{words.previousMonths.excel}</Bidi>
                      </a>
                    ) : (
                      <span className="text-[16px] whitespace-nowrap text-ink-quiet">
                        <Bidi>
                          {words.previousMonths.blocked[entry.blocks[0]]}
                        </Bidi>
                      </span>
                    )}
                    <Link
                      href="/month/payslip"
                      className="text-[16px] whitespace-nowrap text-ink-soft hover:text-forest"
                    >
                      <Bidi>{words.previousMonths.payslip}</Bidi>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </Card>
        </section>

        <section className="flex flex-col gap-4">
          <h2 dir="auto" className="text-[22px] font-semibold">
            <Bidi>{words.more.title}</Bidi>
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {/* The two yearly reports take the newest year the worker has. A
                worker with no months has no year to offer, and the card is
                still drawn: an absent card reads as a report that does not
                exist rather than as one with nothing to say yet. */}
            <ReportCard
              name="yearlySalary"
              title={words.yearlySalary.title}
              note={words.yearlySalary.note}
              href={
                mine.years[0] === undefined
                  ? null
                  : fileHref(mine.workerId, "yearlySalary", mine.years[0])
              }
            />
            <ReportCard
              name="balances"
              title={words.balances.title}
              note={words.balances.note}
              href={
                mine.years[0] === undefined
                  ? null
                  : fileHref(mine.workerId, "balances", mine.years[0])
              }
            />
            <ReportCard
              name="nationalInsurance"
              title={words.nationalInsurance.title}
              note={words.nationalInsurance.note}
              href={fileHref(mine.workerId, "nationalInsurance")}
            />
            <ReportCard
              name="recuperation"
              title={words.recuperation.title}
              note={words.recuperation.note}
              href={fileHref(mine.workerId, "recuperation")}
            />
          </div>
        </section>

        <p
          dir="auto"
          className="max-w-[66ch] text-[16px] font-light text-pretty text-ink-faint"
        >
          <Bidi>{words.closing}</Bidi>
        </p>
      </div>
    </main>
  );
}

function ReportCard({
  name,
  title,
  note,
  href,
}: {
  name: string;
  title: string;
  note: string;
  href: string | null;
}) {
  const body = (
    <>
      <span dir="auto" className="text-[19px] font-semibold">
        <Bidi>{title}</Bidi>
      </span>
      <span dir="auto" className="text-[16px] font-light text-pretty text-ink-soft">
        <Bidi>{note}</Bidi>
      </span>
      <span dir="auto" className="pt-1 text-[15px] font-medium text-forest">
        <Bidi>{he.reports.more.action}</Bidi>
      </span>
    </>
  );

  const shared = "flex flex-col gap-2 px-6 py-5.5";

  return href === null ? (
    <div
      data-report={name}
      className={`${shared} rounded-card border border-line bg-surface opacity-60`}
    >
      {body}
    </div>
  ) : (
    <a
      href={href}
      data-report={name}
      className={`${shared} rounded-card border border-line bg-surface text-ink hover:border-line-hover hover:text-ink`}
    >
      {body}
    </a>
  );
}

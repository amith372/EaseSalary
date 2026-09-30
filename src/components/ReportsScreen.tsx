"use client";

import Link from "next/link";
import { Fragment } from "react";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { SheetBadge, TwoToneIcon } from "@/components/icons";
import { MoneyValue } from "@/components/MoneyValue";
import { RefusalCard } from "@/components/RefusalCard";
import { useWorkerScope } from "@/components/WorkerScope";
import { monthLabel } from "@/lib/dateLabels";
import { sameMonth } from "@/lib/dates";
import type { ExportBlockKey } from "@/lib/engine/beforeExport";
import { he } from "@/lib/i18n/he";
import type { RefusedMonth } from "@/lib/refusalView";
import type { YearMonth } from "@/lib/types";

/**
 * The `דוחות` screen — `EaseSalary - דוחות`.
 *
 * **It offers files and calculates nothing.** Every figure it shows was drawn
 * by the same `calculateSeries` the month screen and the month export run, and
 * every download is a link to `/reports/file` rather than a second path to the
 * same numbers (Part 3).
 *
 * **Four report cards, as the artboard draws them.** The fourth, the national
 * insurance by quarter, has the card's own words for its
 * content and no numbered criterion of its own.
 *
 * **The closing line says what is true.** The artboard drew "כל קובץ נשמר גם
 * אצלנו" and no file is stored anywhere — item 23 produces it on request. What
 * survives is the data, and that is what the line now says. Reworded with the
 * user on the same day, and it is a departure from the artboard that is
 * deliberate rather than a screen nobody finished.
 */

/** One month as this screen lists it: what it was, and what it came to. */
interface ReportMonth {
  month: YearMonth;
  grossAgorot: number | null;
  /** The `נטו` — the `ברוטו` less what was withheld from it, which is the
   * income tax and nothing else today (specs.md Part 5). */
  afterWithholdingAgorot: number | null;
  netAgorot: number | null;
  /** Whether income tax was actually withheld, and whether an advance or a line
   * below the total moved the figure — `monthLevels`, so this row and the
   * payslip cannot disagree about the same month. */
  withholds: boolean;
  transfers: boolean;
  /**
   * Why this month cannot be exported, empty where it can — `blocksExport`'s
   * own answer, which is what `/month/export/file` refuses on.
   *
   * **The screen has to know, because the route answers 409.** A link offered
   * anyway points at a month the route refuses, and pressing it produces an
   * error page rather than a file. No type, lint or unit test reaches that —
   * the screen and the route simply disagree.
   */
  blocks: ExportBlockKey[];
  /** The current month before its last day: it has a file, and the row says it
   * has not ended beside it (item 21). */
  stillRunning: boolean;
  /**
   * Whether the month has been confirmed, which is the other thing
   * `/month/export/file` refuses on (specs.md items 4, 17).
   *
   * **A row offers the confirmation screen where this is false**, rather than
   * withholding the link as a block does: nothing is wrong with the month, and
   * the file is one press further on.
   */
  confirmed: boolean;
}

export interface WorkerReports {
  /** The month their replay refused, where it refused one (`specs.md` item 25).
   * Every figure and every file here comes off the replay, so the card stands
   * in the screen's place for them — and for nobody else. */
  refused: RefusedMonth | null;
  workerId: string;
  months: ReportMonth[];
  /** The years the worker has months in, newest first. The two yearly reports
   * are downloaded a year at a time (item 29), so the screen needs the list
   * rather than a range it worked out from today's date. */
  years: number[];
  /** The month the `לייצא לאקסל` hero points at — the latest the worker has
   * that can actually be exported, which is not always the latest they have.
   * `null` where they have none, and the hero then says so rather than offering
   * a file the route would refuse. */
  latest: YearMonth | null;
}

interface ReportsScreenProps {
  household: WorkerReports[];
}

/**
 * The figures one month's row shows.
 *
 * **`נטו` is always drawn and the other two only when they say something
 * different.** `ברוטו` appears where income tax was withheld, since with
 * nothing withheld it equals the `נטו`; `שולם לעובד/ת` appears where an advance
 * or a line below the total moved the figure, since otherwise it equals the
 * `נטו` too. So an ordinary month shows one figure, a month with tax and an
 * advance shows all three, and no row ever prints one number twice under two
 * headings.
 *
 * It is the same rule the payslip draws its levels by, from the same
 * `monthLevels` answer — the difference is only that a row has no room to walk
 * down them, so it names what it shows.
 */
function figuresOf(
  entry: ReportMonth,
): { key: string; label: string; agorot: number | null }[] {
  const words = he.reports.previousMonths;
  const figures = [];
  if (entry.withholds) {
    figures.push({
      key: "gross",
      label: words.gross,
      agorot: entry.grossAgorot,
    });
  }
  figures.push({
    key: "afterWithholding",
    label: words.afterWithholding,
    agorot: entry.afterWithholdingAgorot,
  });
  if (entry.transfers) {
    figures.push({ key: "net", label: words.net, agorot: entry.netAgorot });
  }
  return figures;
}

function fileHref(workerId: string, report: string, year?: number): string {
  const query = new URLSearchParams({ worker: workerId, report });
  if (year !== undefined) query.set("year", String(year));
  return `/reports/file?${query.toString()}`;
}

/**
 * One month's file, as `/דוחות` links it.
 *
 * **The helper column is on by default here**. The
 * month flow offers the two versions side by side and the family chooses; this
 * screen offers one link per month and no chooser, so the one it hands over is
 * the fuller file. The two surfaces then produce the same file for the same
 * month, which is what "the exports match one another" asks for: a family that
 * re-downloads March from the list must not get a thinner sheet than the one
 * they filed in March.
 */
function monthHref(workerId: string, month: YearMonth, notes = true): string {
  const query = new URLSearchParams({
    worker: workerId,
    month: `${month.year}-${String(month.month).padStart(2, "0")}`,
  });
  if (notes) query.set("notes", "1");
  return `/month/export/file?${query.toString()}`;
}

/** The confirmation screen, opened on one month: what a month nobody has
 * confirmed offers in place of its file (specs.md items 4, 17). */
function confirmHref(month: YearMonth): string {
  return `/month/export?month=${month.year}-${String(month.month).padStart(2, "0")}`;
}

export function ReportsScreen({ household }: ReportsScreenProps) {
  const { worker } = useWorkerScope();
  const words = he.reports;
  const mine =
    household.find((entry) => entry.workerId === worker?.id) ?? household[0];

  if (mine === undefined) return null;
  // Every figure and every file on this screen comes off the replay, so a
  // refused one leaves nothing to list and no file that may be offered. The
  // other worker's reports are on their own screen, one step of the switcher
  // away.
  if (mine.refused !== null) return <RefusalCard refused={mine.refused} />;

  // Whether the month the hero points at has a file yet, which is the same
  // question its own row answers.
  const latestHasFile =
    mine.latest !== null &&
    (mine.months.find((entry) => sameMonth(entry.month, mine.latest!))
      ?.confirmed ??
      false);

  // Newest first: a family looking for a month is looking for a recent one, and
  // the replay hands them over oldest first because that is the order balances
  // carry in.
  const months = [...mine.months].reverse();

  // The same list under a heading per year. It is one row longer every month,
  // and a year is the only boundary in it a reader can aim at; the grouping is
  // done here rather than by comparing a row with the one before it, so the
  // heading cannot fall to a row that is not a year's first.
  const years = months.reduce<{ year: number; months: ReportMonth[] }[]>(
    (groups, entry) => {
      const last = groups.at(-1);
      if (last?.year === entry.month.year) last.months.push(entry);
      else groups.push({ year: entry.month.year, months: [entry] });
      return groups;
    },
    [],
  );

  return (
    /* A `div` and not a `main`: the shell already provides the page's one main
       landmark, and a second one nested inside it leaves a screen reader with
       two "main content" regions and the skip link pointing at the outer. */
    <div className="flex min-w-0 flex-1 justify-center pb-6">
      <div className="flex w-full max-w-[880px] min-w-0 flex-col gap-7.5">
        <section className="flex flex-col gap-1.5">
          {/* The tab's own icon, beside the heading rather than inside it — see
              `PaymentsScreen` for why that matters under `dir="auto"`. */}
          <div className="flex items-center gap-2.5">
            <TwoToneIcon name="doc" className="size-7" />
            <h1 className="text-[28px] font-semibold tracking-tight sm:text-[34px]">
              <Bidi>{words.title}</Bidi>
            </h1>
          </div>
          <p className="max-w-[60ch] text-[17px] font-light text-pretty text-ink-soft sm:text-[18px]">
            <Bidi>{words.lead}</Bidi>
          </p>
        </section>

        <Card
          as="section"
          tone="tint"
          radius="lg"
          className="flex flex-wrap items-center justify-between gap-x-7 gap-y-5 border border-line-strong px-5 py-6 sm:px-8.5 sm:py-7.5"
        >
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
            {/* Every dynamic string gets its own wrapping element, or Chrome's
                translation swaps a bare text node in place and React throws
                `NotFoundError` on `removeChild` (`CLAUDE.md`). */}
            <h2 className="text-[26px] leading-tight font-bold tracking-tight text-balance sm:text-[30px]">
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
          {/* **The hero leads to the file where the month has one, and to the
              confirmation where it has not** — the same rule as the rows below
              it, and the reason the two are read from one field: the month a
              family comes here for is often the one they have not filed yet,
              and a hero pointing at a refusal is the worst place to learn it. */}
          {mine.latest !== null && latestHasFile ? (
            <a
              href={monthHref(mine.workerId, mine.latest)}
              className="flex flex-none items-center justify-center gap-3 rounded-tint bg-forest px-8 py-4 text-[19px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-deep hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest max-sm:w-full"
            >
              <SheetBadge className="size-5.5 text-forest" />
              <Bidi>{words.thisMonth.action}</Bidi>
            </a>
          ) : null}
          {mine.latest !== null && !latestHasFile ? (
            <Link
              href={confirmHref(mine.latest)}
              data-confirm-month
              className="flex flex-none items-center justify-center gap-3 rounded-tint bg-forest px-8 py-4 text-[19px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-deep hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest max-sm:w-full"
            >
              <SheetBadge className="size-5.5 text-forest" />
              <Bidi>{he.beforeExport.confirmAndExport}</Bidi>
            </Link>
          ) : null}
        </Card>

        <section className="flex flex-col gap-4">
          <h2 className="text-[22px] font-semibold">
            <Bidi>{words.previousMonths.title}</Bidi>
          </h2>
          <Card radius="md" className="overflow-hidden">
            {months.length === 0 ? (
              <p className="px-6 py-5 text-[16px] font-light text-ink-soft">
                <Bidi>{words.previousMonths.none}</Bidi>
              </p>
            ) : (
              years.map((group) => (
                <Fragment key={group.year}>
                  <h3
                    data-report-year={group.year}
                    className="border-t border-line-soft bg-ground px-5 py-2 text-[14px] font-semibold text-ink-quiet first:border-t-0 sm:px-6"
                  >
                    <Bidi>{String(group.year)}</Bidi>
                  </h3>
                  {group.months.map((entry) => (
                    <div
                      key={`${entry.month.year}-${entry.month.month}`}
                      data-report-month={`${entry.month.year}-${entry.month.month}`}
                      className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-soft px-5 py-4.5 sm:px-6"
                    >
                      <span className="w-[130px] flex-none text-[18px] font-semibold">
                        <Bidi>{monthLabel(entry.month)}</Bidi>
                      </span>
                      {/* One figure, two or three, by what the month actually did.
                      Each label is its own element beside its own amount, which
                      is the Chrome-translate rule and also what lets a figure
                      drop out without disturbing its neighbours. */}
                      <span className="flex min-w-0 flex-[1_1_200px] flex-wrap items-baseline gap-x-1.5 text-[16px] font-light text-ink-mute">
                        {figuresOf(entry).map((figure, index) => (
                          <span
                            key={figure.key}
                            data-figure={figure.key}
                            className="flex items-baseline gap-1.5"
                          >
                            {index > 0 ? (
                              <span aria-hidden="true">· </span>
                            ) : null}
                            <span dir="auto">{figure.label}</span>
                            <MoneyValue agorot={figure.agorot} />
                          </span>
                        ))}
                      </span>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {/* **One statement and not two.** A month still running
                        offers its file under the condition it is filed on
                        (item 21), so the warning is that link's own note,
                        beneath it, rather than a second thing said beside it. */}
                        {entry.blocks[0] === undefined ? (
                          <span className="flex flex-col items-start gap-0.5">
                            {entry.confirmed ? (
                              <a
                                href={monthHref(mine.workerId, entry.month)}
                                className="flex items-center gap-2 py-1 text-[16px] font-semibold whitespace-nowrap hover:underline hover:underline-offset-4"
                              >
                                <SheetBadge
                                  tile="fill-sage-soft"
                                  className="size-4.5 text-forest"
                                />
                                <Bidi>{words.previousMonths.excel}</Bidi>
                              </a>
                            ) : (
                              <Link
                                href={confirmHref(entry.month)}
                                data-confirm-month
                                className="flex items-center gap-2 py-1 text-[16px] font-semibold whitespace-nowrap hover:underline hover:underline-offset-4"
                              >
                                <SheetBadge
                                  tile="fill-sage-soft"
                                  className="size-4.5 text-forest"
                                />
                                <Bidi>{he.beforeExport.confirmAndExport}</Bidi>
                              </Link>
                            )}
                            {entry.stillRunning ? (
                              <span
                                data-warning="monthNotEnded"
                                dir="auto"
                                className="text-[13px] font-light text-clay-deep"
                              >
                                {he.beforeExport.notEnded.title}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-[16px] whitespace-nowrap text-ink-quiet">
                            <Bidi>
                              {words.previousMonths.blocked[entry.blocks[0]]}
                            </Bidi>
                          </span>
                        )}
                        <Link
                          href={`/month/payslip?month=${entry.month.year}-${String(entry.month.month).padStart(2, "0")}`}
                          className="py-1 text-[16px] whitespace-nowrap text-ink-soft hover:text-forest"
                        >
                          <Bidi>{words.previousMonths.payslip}</Bidi>
                        </Link>
                      </div>
                    </div>
                  ))}
                </Fragment>
              ))
            )}
          </Card>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-[22px] font-semibold">
            <Bidi>{words.more.title}</Bidi>
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <p className="max-w-[66ch] text-[16px] font-light text-pretty text-ink-soft">
          <Bidi>{words.closing}</Bidi>
        </p>
      </div>
    </div>
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
      <span className="text-[19px] font-semibold">
        <Bidi>{title}</Bidi>
      </span>
      <span className="text-[16px] font-light text-pretty text-ink-soft">
        <Bidi>{note}</Bidi>
      </span>
      <span className="pt-1 text-[15px] font-medium text-forest">
        <Bidi>{he.reports.more.action}</Bidi>
      </span>
    </>
  );

  const shared = "flex flex-col gap-2 px-5 py-5 sm:px-6 sm:py-5.5";

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
      className={`${shared} rounded-card border border-line bg-surface text-ink transition-colors hover:border-line-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest`}
    >
      {body}
    </a>
  );
}

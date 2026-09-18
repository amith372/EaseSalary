import Link from "next/link";
import type { ReactNode } from "react";
import { Sentence } from "@/components/AlertsScreen";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { MoneyValue } from "@/components/MoneyValue";
import { WorkerAvatar } from "@/components/WorkerAvatar";
import { WorkerBalances } from "@/components/WorkerBalances";
import type { ProfileBalance } from "@/components/WorkerBalances";
import { WorkerSettingsLink } from "@/components/WorkerSettingsLink";
import type { AlertCard } from "@/lib/alertsView";
import { fullDayLabel, monthLabel } from "@/lib/dateLabels";
import type { AdvanceStanding } from "@/lib/engine/advances";
import type { HolidayAmendment } from "@/lib/engine/holidayAmendments";
import type { MonthState } from "@/lib/engine/monthState";
import type { WorkerProfile } from "@/lib/engine/repository";
import { he } from "@/lib/i18n/he";
import { formatAgorot, formatDays } from "@/lib/money";
import type { YearMonth } from "@/lib/types";

/**
 * The worker's own page — `EaseSalary - דף העובד`.
 *
 * **It reads the worker and changes nothing.** Her terms are edited on
 * `/settings`, which is where the artboard's "פרטים והגדרות" sends them, so a
 * term has one place to be changed.
 *
 * **The hero card is the action list's and not a second opinion.** It carries
 * the first *blockage* this worker has, phrased by `alertsView` exactly as the
 * bell, the opening screen and `/alerts` phrase it (item 27, and the user's
 * choice on 2026-09-17) — so the four cannot list what the others do not. It is
 * absent when she has none.
 *
 * **What the artboard draws and this page does not**, each an absence rather
 * than an invention (`CLAUDE.md` rule 4): the `?` explaining a *month* row. The
 * status badges, the day counts, the seniority, the row's link to its payslip
 * and the closing links row all landed with stage 7.
 */

/** One month as this screen lists it: which month it was, what it came to, what
 * state it is in and what it held. */
export interface ProfileMonth {
  month: YearMonth;
  netAgorot: number | null;
  grossAgorot: number | null;
  /** Part 5's four states, derived from the store's own instants. */
  state: MonthState;
  /**
   * The days behind the figure — the days actually worked, and each kind drawn
   * from a balance. They are the pre-export questions' own counts, which is
   * what the payslip lists a month's days from, so no month is counted twice
   * two ways.
   */
  days: {
    worked: number | null;
    vacation: number;
    sick: number;
    holidays: number;
  };
}

interface WorkerProfileScreenProps {
  profile: WorkerProfile;
  months: ProfileMonth[];
  /** Whole years since the employment began, for the subtitle. */
  seniorityYears: number;
  /** Her three balances with the sentence behind each (`WorkerBalances`). */
  balances: ProfileBalance[];
  /** What is still owed on each advance, walked from the opening position
   * across every month (item 20). */
  ledger: AdvanceStanding[];
  /** Her country of origin in Hebrew, resolved on the server from the shipped
   * holiday lists (`countryNameHe`). */
  countryName: string;
  /** The first thing about her that blocks a correct salary today, or `null`
   * when there is none. */
  needsYou: AlertCard | null;
  /** Her holiday moves agreed once a year's list was in force (item 10). */
  amendments: HolidayAmendment[];
}

export function WorkerProfileScreen({
  profile,
  months,
  seniorityYears,
  balances,
  ledger,
  countryName,
  needsYou,
  amendments,
}: WorkerProfileScreenProps) {
  const words = he.workers;
  const page = words.profile;

  // What she has actually been paid, added up from the same `net` each row
  // shows — one figure reached one way (Part 3). **Only the months that have a
  // figure are counted**: a month still open has no net, and counting it as
  // zero would report a total that quietly grows the day it closes without
  // anything about the worker having changed. Where some month was skipped the
  // sentence under the sum says how many it stands for, rather than the sum
  // standing for a count nobody stated.
  const paid = months.filter((one) => one.netAgorot !== null);
  const paidSoFar = paid.reduce((total, one) => total + (one.netAgorot ?? 0), 0);
  const open = ledger.filter((standing) => standing.outstandingAgorot > 0);

  return (
    <div className="mx-auto flex w-full max-w-[860px] min-w-0 flex-col gap-6 sm:gap-7">
      <div className="flex min-w-0 flex-wrap items-start gap-x-5.5 gap-y-3">
        <WorkerAvatar size="lg" />
        <div className="flex min-w-[min(15rem,100%)] flex-[1_1_15rem] flex-col gap-1.25">
          <h1
            dir="auto"
            className="text-[26px] leading-[1.15] font-bold tracking-[-0.02em] break-words sm:text-[32px]"
          >
            <Bidi>{profile.name}</Bidi>
          </h1>
          <p className="text-[15px] font-light text-ink-mute sm:text-[17px]">
            <span dir="auto">{words.employedSince} </span>
            <Bidi>{fullDayLabel(profile.employedSince)}</Bidi>
            <span aria-hidden="true"> · </span>
            <span dir="auto">{words.country} </span>
            <Bidi>{countryName}</Bidi>
            <span aria-hidden="true"> · </span>
            <span dir="auto">{page.seniority(seniorityYears)}</span>
          </p>
        </div>
        <WorkerSettingsLink
          workerId={profile.id}
          className="rounded-[13px] border border-line bg-surface px-5 py-3 text-[16px] font-medium whitespace-nowrap text-forest transition-colors hover:border-line-hover hover:text-forest-deep"
        >
          <span dir="auto">{words.toSettings}</span>
        </WorkerSettingsLink>
      </div>

      {needsYou === null ? null : (
        <Card
          radius="md"
          data-row="needs-you"
          className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3.5 px-5 py-4.5 sm:px-7.5 sm:py-6"
        >
          <div className="flex min-w-[min(16rem,100%)] flex-[1_1_16rem] flex-col items-start gap-1.5">
            <span
              dir="auto"
              className="rounded-full bg-band-sun px-3 py-1.5 text-[13px] font-semibold text-clay-ink"
            >
              {page.needsYou}
            </span>
            <span className="pt-0.5 text-[20px] font-bold tracking-[-0.02em] sm:text-[24px]">
              <Sentence said={needsYou.title} />
            </span>
            <span className="text-[15px] font-light text-ink-mute text-pretty">
              <Sentence said={needsYou.note} />
            </span>
          </div>
          <Link
            href={needsYou.action.href}
            className="rounded-card-sm bg-forest px-6 py-3.5 text-[17px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-deep hover:text-white sm:text-[18px]"
          >
            <span dir="auto">{needsYou.action.label}</span>
          </Link>
        </Card>
      )}

      <WorkerBalances balances={balances} />

      <section
        id="months"
        aria-labelledby="months-title"
        className="flex min-w-0 scroll-mt-24 flex-col gap-3.5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <h2 id="months-title" dir="auto" className="text-[20px] font-semibold sm:text-[22px]">
            {page.months.title}
          </h2>
          {/* Said once above the column rather than on every row. */}
          <span dir="auto" className="text-[14px] font-light text-ink-quiet">
            {page.months.total}
          </span>
        </div>
        <Card radius="sm" className="flex min-w-0 flex-col overflow-hidden">
          {months.length === 0 ? (
            <div className="px-4.5 py-4 sm:px-6">
              <Empty>{page.months.empty}</Empty>
            </div>
          ) : (
            <ul className="flex flex-col">
              {months.map((one) => (
                <li
                  key={`${one.month.year}-${one.month.month}`}
                  data-month={monthParam(one.month)}
                  className="border-t border-line-soft first:border-t-0"
                >
                  {/* The whole row is the link, as the artboard draws it: the
                      payslip is this month seen in full, and it takes the month
                      off the address exactly as `/reports` names one. */}
                  <Link
                    href={`/month/payslip?month=${monthParam(one.month)}`}
                    className="flex flex-wrap items-center gap-x-4.5 gap-y-2 px-4.5 py-3 transition-colors hover:bg-tint sm:px-6 sm:py-3.5"
                  >
                    <span className="flex-none text-[16px] font-semibold sm:w-[8.5rem] sm:text-[18px]">
                      <Bidi>{monthLabel(one.month)}</Bidi>
                    </span>
                    <span
                      dir="auto"
                      className="min-w-0 flex-[1_1_9rem] text-[14px] font-light text-ink-mute sm:text-[16px]"
                    >
                      {detailOf(one)}
                    </span>
                    <span className="flex flex-col items-end">
                      <MoneyValue agorot={one.netAgorot} size="fact" />
                      <span className="text-[13px] font-light text-ink-faint">
                        <span dir="auto">{he.month.preview.gross} </span>
                        <Bidi noTranslate>
                          {one.grossAgorot === null
                            ? he.placeholder.amount
                            : formatAgorot(one.grossAgorot)}
                        </Bidi>
                      </span>
                    </span>
                    <StateBadge state={one.state} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {paid.length === 0 ? null : (
            <div
              data-row="paid-so-far"
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t-2 border-line bg-tint px-4.5 py-3.5 sm:px-6"
            >
              <div className="flex min-w-0 flex-col">
                <span dir="auto" className="text-[16px] font-semibold sm:text-[17px]">
                  {page.months.soFar}
                </span>
                {paid.length === months.length ? null : (
                  <span dir="auto" className="text-[13px] font-light text-ink-quiet">
                    {page.months.soFarPartial(paid.length, months.length)}
                  </span>
                )}
              </div>
              <MoneyValue agorot={paidSoFar} size="lg" className="sm:text-[20px]" />
            </div>
          )}
        </Card>
      </section>

      <section aria-labelledby="advances-title" className="flex min-w-0 flex-col gap-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <h2
            id="advances-title"
            dir="auto"
            className="text-[20px] font-semibold sm:text-[22px]"
          >
            {page.advances.title}
          </h2>
          <Link
            href="/payments"
            className="text-[15px] font-medium text-forest transition-colors hover:text-forest-deep sm:text-[16px]"
          >
            <span dir="auto">{page.advances.record}</span>
          </Link>
        </div>
        {open.length === 0 ? (
          <Card radius="sm" className="px-4.5 py-4 sm:px-6">
            <Empty>{page.advances.empty}</Empty>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {open.map((standing) => (
              <li key={standing.number} data-advance={standing.number}>
                <Card
                  tone="inset"
                  radius="sm"
                  className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3 px-4.5 py-4 sm:px-6.5 sm:py-5"
                >
                  <div className="flex min-w-0 flex-[1_1_10rem] flex-col gap-1">
                    <span className="text-[17px] font-semibold sm:text-[18px]">
                      <Bidi>{he.month.actions.advances.name(standing.number)}</Bidi>
                    </span>
                    {standing.grantedIn === null ? null : (
                      <span className="text-[15px] font-light text-ink-soft">
                        <span dir="auto">{page.advances.granted}</span>
                        <Bidi>{monthLabel(standing.grantedIn)}</Bidi>
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-[min(12rem,100%)] flex-[1_1_14rem] flex-col gap-2">
                    <div className="flex flex-wrap justify-between gap-x-3 text-[14px] text-ink-mute sm:text-[15px]">
                      <span>
                        <span dir="auto">{page.advances.repaid} </span>
                        <Bidi noTranslate>{formatAgorot(standing.repaidAgorot)}</Bidi>
                      </span>
                      <span>
                        <span dir="auto">{page.advances.of} </span>
                        <Bidi noTranslate>{formatAgorot(standing.principalAgorot)}</Bidi>
                      </span>
                    </div>
                    <Progress
                      done={standing.repaidAgorot}
                      of={standing.principalAgorot}
                    />
                  </div>
                  <MoneyValue agorot={standing.outstandingAgorot} size="lg" />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Drawn only once there is one: the list as first agreed is otherwise
          the list she has, and an empty section would say nothing (item 10). */}
      {amendments.length > 0 ? (
        <section aria-labelledby="amendments-title" className="flex min-w-0 flex-col gap-3.5">
          <h2
            id="amendments-title"
            dir="auto"
            className="text-[20px] font-semibold sm:text-[22px]"
          >
            {page.amendments.title}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {amendments.map((amendment) => (
              <li key={amendment.id} data-amendment={amendment.from}>
                <Card
                  tone="inset"
                  radius="sm"
                  className="flex min-w-0 flex-col gap-1 px-4.5 py-4 sm:px-6.5"
                >
                  <span className="text-[17px] font-semibold">
                    <span dir="auto">{page.amendments.from}</span>
                    <Bidi>{fullDayLabel(amendment.from)}</Bidi>
                    <span dir="auto"> {page.amendments.to}</span>
                    <Bidi>{fullDayLabel(amendment.to)}</Bidi>
                  </span>
                  <span className="text-[15px] font-light text-ink-soft">
                    <span dir="auto">{page.amendments.agreed}</span>
                    <Bidi>{fullDayLabel(amendment.agreedOn)}</Bidi>
                  </span>
                  <p dir="auto" className="text-[15px] font-light text-ink-warm">
                    {amendment.note}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* The two things about her that live on another screen, which is the
          artboard's closing row. `לשתף` goes to the account section of
          `/settings`, where an invitation is actually sent (stage 3). */}
      <section className="flex flex-wrap items-center gap-x-5.5 gap-y-2.5 border-t border-line pt-5">
        <Link
          href="/payments"
          className="text-[16px] text-ink-soft transition-colors hover:text-forest sm:text-[17px]"
        >
          <span dir="auto">{page.links.payments}</span>
        </Link>
        <Link
          href="/settings#account"
          className="text-[16px] text-ink-soft transition-colors hover:text-forest sm:text-[17px]"
        >
          <span dir="auto">{page.links.share}</span>
        </Link>
      </section>
    </div>
  );
}

/** The month as the payslip's address names one — zero-padded, so the string
 * sorts as the date does and `/reports` and this page cannot spell it two
 * ways. */
function monthParam(month: YearMonth): string {
  return `${month.year}-${String(month.month).padStart(2, "0")}`;
}

/**
 * What the month held, in one line: the days actually worked, then each kind of
 * day drawn from a balance that the month in fact has.
 *
 * A kind with no days is left out rather than drawn as a zero — nine rows each
 * ending "0 ימי מחלה" is a column of noise to read past, and the absence says
 * the same thing. A month with no figures yet says it is waiting instead.
 */
function detailOf(one: ProfileMonth): string {
  if (one.days.worked === null) return he.workers.profile.months.awaiting;
  const words = he.workers.profile.months.days;
  return [
    words.worked(formatDays(one.days.worked)),
    ...(one.days.vacation > 0 ? [words.vacation(formatDays(one.days.vacation))] : []),
    ...(one.days.sick > 0 ? [words.sick(formatDays(one.days.sick))] : []),
    ...(one.days.holidays > 0 ? [words.holidays(formatDays(one.days.holidays))] : []),
  ].join(" · ");
}

/** Which of Part 5's four states the month is in. The exported one is the calm
 * colour and the other three are the attention colour, because exported is the
 * only one of the four that asks nothing of the user. */
function StateBadge({ state }: { state: MonthState }) {
  return (
    <span
      dir="auto"
      data-state={state}
      className={[
        "flex-none rounded-full px-3 py-1.5 text-[14px] font-semibold whitespace-nowrap",
        state === "exported" ? "bg-chip text-ink-warm" : "bg-band-sun text-clay-ink",
      ].join(" ")}
    >
      {he.workers.profile.months.state[state]}
    </span>
  );
}

/** How much of an advance is repaid, as a bar. The figures above it say the
 * same thing in words; the bar is for the eye and is hidden from a reader. */
function Progress({ done, of }: { done: number; of: number }) {
  const share = of <= 0 ? 0 : Math.min(1, Math.max(0, done / of));
  return (
    <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-advance-track">
      <div
        className="h-full rounded-full bg-advance-dot"
        style={{ width: `${(share * 100).toFixed(1)}%` }}
      />
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p dir="auto" className="text-[15px] font-light text-ink-quiet">
      {children}
    </p>
  );
}

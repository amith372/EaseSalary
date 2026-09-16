import Link from "next/link";
import type { ReactNode } from "react";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { MoneyValue } from "@/components/MoneyValue";
import { WorkerAvatar } from "@/components/WorkerAvatar";
import { WorkerSettingsLink } from "@/components/WorkerSettingsLink";
import { fullDayLabel, monthLabel } from "@/lib/dateLabels";
import type { AdvanceStanding } from "@/lib/engine/advances";
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
 * **What the artboard draws and this page does not** — each an absence rather
 * than an invention (`CLAUDE.md` rule 4): the "צריך לטפל" hero card and the
 * months' status badges name the month's four states, which are Part 5's and
 * which nothing can yet set; the seniority in the subtitle, the day counts on a
 * month row, a row linking to that month's payslip, and the "?" behind each
 * balance have nothing that supplies them to this page yet; and the closing
 * links row. `build_plan.md` carries them.
 */

/** One month as this screen lists it: which month it was, and what it came to.
 * No status, for the reason given above. */
export interface ProfileMonth {
  month: YearMonth;
  netAgorot: number | null;
  grossAgorot: number | null;
}

interface WorkerProfileScreenProps {
  profile: WorkerProfile;
  months: ProfileMonth[];
  /** Her closing balances after the last month the store holds — the replay's
   * own figures and not a second count (items 7, 13). */
  vacationDays: number;
  sickDays: number;
  /** What is still owed on each advance, walked from the opening position
   * across every month (item 20). */
  ledger: AdvanceStanding[];
  /** Her country of origin in Hebrew, resolved on the server from the shipped
   * holiday lists (`countryNameHe`). */
  countryName: string;
}

export function WorkerProfileScreen({
  profile,
  months,
  vacationDays,
  sickDays,
  ledger,
  countryName,
}: WorkerProfileScreenProps) {
  const words = he.workers;
  const page = words.profile;

  const outstanding = ledger.reduce(
    (total, standing) => total + standing.outstandingAgorot,
    0,
  );

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
          </p>
        </div>
        <WorkerSettingsLink
          workerId={profile.id}
          className="rounded-[13px] border border-line bg-surface px-5 py-3 text-[16px] font-medium whitespace-nowrap text-forest transition-colors hover:border-line-hover hover:text-forest-deep"
        >
          <span dir="auto">{words.toSettings}</span>
        </WorkerSettingsLink>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-4.5">
        <Balance
          label={he.home.balances.vacation}
          dot="bg-vacation-dot"
          rowKey="vacation"
        >
          <Bidi noTranslate>{formatDays(vacationDays)}</Bidi>
        </Balance>
        <Balance label={he.home.balances.sick} dot="bg-sick-dot" rowKey="sick">
          <Bidi noTranslate>{formatDays(sickDays)}</Bidi>
        </Balance>
        <Balance label={words.facts.advance} dot="bg-advance-dot" rowKey="advance">
          <Bidi noTranslate>{formatAgorot(outstanding)}</Bidi>
        </Balance>
      </div>

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
              {months.map(({ month, netAgorot, grossAgorot }) => (
                <li
                  key={`${month.year}-${month.month}`}
                  data-month={`${month.year}-${String(month.month).padStart(2, "0")}`}
                  className="flex items-center justify-between gap-4 border-t border-line-soft px-4.5 py-3 first:border-t-0 sm:px-6 sm:py-3.5"
                >
                  <span className="text-[16px] font-semibold sm:text-[18px]">
                    <Bidi>{monthLabel(month)}</Bidi>
                  </span>
                  <span className="flex flex-col items-end">
                    <MoneyValue agorot={netAgorot} size="fact" />
                    <span className="text-[13px] font-light text-ink-faint">
                      <span dir="auto">{he.month.preview.gross} </span>
                      <Bidi noTranslate>
                        {grossAgorot === null ? he.placeholder.amount : formatAgorot(grossAgorot)}
                      </Bidi>
                    </span>
                  </span>
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
    </div>
  );
}

function Balance({
  label,
  dot,
  rowKey,
  children,
}: {
  label: string;
  /** The mark's own dot colour from the calendar legend, so a balance and the
   * days that draw on it read as one thing. */
  dot: string;
  rowKey: string;
  children: ReactNode;
}) {
  return (
    <Card
      radius="sm"
      data-balance={rowKey}
      className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-4.5 py-3.5 sm:flex-col sm:flex-nowrap sm:items-stretch sm:px-6 sm:py-5"
    >
      <span className="flex min-w-0 items-center gap-2.25 text-[15px] font-light text-ink-soft sm:text-[16px]">
        <span aria-hidden="true" className={`size-2.25 flex-none rounded-full ${dot}`} />
        <span dir="auto">{label}</span>
      </span>
      <span className="text-[22px] font-bold tracking-[-0.02em] whitespace-nowrap sm:text-[26px]">
        {children}
      </span>
    </Card>
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

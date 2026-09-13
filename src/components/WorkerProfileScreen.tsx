"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { MoneyValue } from "@/components/MoneyValue";
import { useWorkerScope } from "@/components/WorkerScope";
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
 * `/settings`, which is where the artboard's "פרטים והגדרות" sends them. They
 * were edited here from 2026-09-09, while `/settings` did not exist, and moved
 * there when it did (the user, 2026-09-13), so a term has one place to be changed.
 *
 * **Three things the artboard draws are not here.** The "צריך לטפל" hero card
 * and the months list's status badges name the month's four states, which are
 * Part 5's and which nothing can yet set; "לשתף עם בן/בת משפחה" is item 11's
 * invitation and belongs to stage 3. Each is an absence rather than an
 * invention, which is the choice `CLAUDE.md` rule 4 asks for.
 */

/** One month as this screen lists it: which month it was, and what it came to.
 * No status, for the reason given above. */
export interface ProfileMonth {
  month: YearMonth;
  netAgorot: number | null;
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
   * holiday lists (`countryNameHe`). The profile printed the two-letter filing
   * code here until 2026-09-11, which is a key and not a country. */
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
  const { select } = useWorkerScope();

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
    <div className="mx-auto flex w-full max-w-[860px] min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1
            dir="auto"
            className="text-[24px] leading-[1.2] font-bold tracking-[-0.02em]"
          >
            <Bidi>{profile.name}</Bidi>
          </h1>
          <p className="text-[15px] font-light text-ink-mute">
            <span dir="auto">{words.employedSince} </span>
            <Bidi>{fullDayLabel(profile.employedSince)}</Bidi>
            <span aria-hidden="true"> · </span>
            <span dir="auto">{words.country} </span>
            <Bidi>{countryName}</Bidi>
          </p>
        </div>
        {/* The artboard's "פרטים והגדרות". `/settings` shows whichever worker the
            switcher holds, so following the link from her page selects her. */}
        <Link
          href="/settings"
          onClick={() => select(profile.id)}
          className="rounded-tab border border-line px-3.5 py-2 text-[15px] font-medium text-forest transition-colors hover:border-line-hover"
        >
          <span dir="auto">{page.terms.title}</span>
        </Link>
      </div>

      <div className="flex min-w-0 flex-col gap-2.5">
        <Card className="grid grid-cols-1 gap-x-6 gap-y-2 px-4.5 py-3.5 sm:grid-cols-3">
          <Balance
            label={he.home.balances.vacation}
            value={formatDays(vacationDays)}
            rowKey="vacation"
          />
          <Balance
            label={he.home.balances.sick}
            value={formatDays(sickDays)}
            rowKey="sick"
          />
          <Balance
            label={words.facts.advance}
            value={formatAgorot(outstanding)}
            rowKey="advance"
          />
        </Card>

        <Card className="flex min-w-0 flex-col gap-2 px-4.5 py-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h2 dir="auto" className="text-[17px] font-semibold">
              {page.months.title}
            </h2>
            {/* Said once above the column rather than on every row. */}
            <span dir="auto" className="text-[13px] font-light text-ink-quiet">
              {page.months.total}
            </span>
          </div>
          {months.length === 0 ? (
            <Empty>{page.months.empty}</Empty>
          ) : (
            <ul className="flex flex-col">
              {months.map(({ month, netAgorot }) => (
                <li
                  key={`${month.year}-${month.month}`}
                  data-month={`${month.year}-${String(month.month).padStart(2, "0")}`}
                  className="flex items-baseline justify-between gap-4 border-t border-line py-2 first:border-t-0"
                >
                  <span className="text-[15px] font-medium">
                    <Bidi>{monthLabel(month)}</Bidi>
                  </span>
                  <MoneyValue agorot={netAgorot} />
                </li>
              ))}
            </ul>
          )}
          {paid.length === 0 ? null : (
            <div
              data-row="paid-so-far"
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t-2 border-line pt-2.5"
            >
              <div className="flex min-w-0 flex-col">
                <span dir="auto" className="text-[15px] font-semibold">
                  {page.months.soFar}
                </span>
                {paid.length === months.length ? null : (
                  <span
                    dir="auto"
                    className="text-[12px] font-light text-ink-quiet"
                  >
                    {page.months.soFarPartial(paid.length, months.length)}
                  </span>
                )}
              </div>
              <MoneyValue agorot={paidSoFar} />
            </div>
          )}
        </Card>

        <Card className="flex min-w-0 flex-col gap-2 px-4.5 py-3.5">
          <h2 dir="auto" className="text-[17px] font-semibold">
            {page.advances.title}
          </h2>
          {open.length === 0 ? (
            <Empty>{page.advances.empty}</Empty>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {open.map((standing) => (
                <li
                  key={standing.number}
                  data-advance={standing.number}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
                >
                  <span className="text-[15px] font-medium">
                    <Bidi>
                      {he.month.actions.advances.name(standing.number)}
                    </Bidi>
                  </span>
                  <span className="flex items-baseline gap-2 text-[13px] font-light text-ink-mute">
                    <span dir="auto">{page.advances.repaid} </span>
                    <Bidi noTranslate>
                      {formatAgorot(standing.repaidAgorot)}
                    </Bidi>
                    <span dir="auto">{page.advances.of} </span>
                    <Bidi noTranslate>
                      {formatAgorot(standing.principalAgorot)}
                    </Bidi>
                  </span>
                  <MoneyValue agorot={standing.outstandingAgorot} />
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/payments"
            className="self-start text-[14px] font-medium text-forest hover:underline hover:underline-offset-4"
          >
            <span dir="auto">{page.advances.record}</span>
          </Link>
        </Card>

      </div>
    </div>
  );
}

function Balance({
  label,
  value,
  rowKey,
}: {
  label: string;
  value: string;
  rowKey: string;
}) {
  return (
    <div
      data-balance={rowKey}
      className="flex min-w-0 flex-col gap-0.5"
    >
      <span dir="auto" className="text-[14px] font-light text-ink-mute">
        {label}
      </span>
      <Bidi noTranslate className="text-[19px] font-bold tracking-[-0.02em]">
        {value}
      </Bidi>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p dir="auto" className="text-[14px] font-light text-ink-quiet">
      {children}
    </p>
  );
}

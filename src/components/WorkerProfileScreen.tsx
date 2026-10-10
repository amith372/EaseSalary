import Link from "next/link";
import type { ReactNode } from "react";
import { Sentence } from "@/components/AlertsScreen";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { MoneyValue } from "@/components/MoneyValue";
import { MonthsSection } from "@/components/MonthsSection";
import type { ProfileMonth } from "@/components/MonthsSection";
import { WorkerAvatar } from "@/components/WorkerAvatar";
import { WorkerBalances } from "@/components/WorkerBalances";
import { WorkerDocuments } from "@/components/WorkerDocuments";
import type { ProfileBalance } from "@/components/WorkerBalances";
import { WorkerSettingsLink } from "@/components/WorkerSettingsLink";
import type { AlertCard } from "@/lib/alertsView";
import { fullDayLabel, monthLabel } from "@/lib/dateLabels";
import type { AdvanceStanding } from "@/lib/engine/advances";
import type { HolidayAmendment } from "@/lib/engine/holidayAmendments";
import type { WorkerProfile } from "@/lib/engine/repository";
import { he } from "@/lib/i18n/he";
import { formatAgorot } from "@/lib/money";
import type { IsoDate } from "@/lib/types";

/**
 * The worker's own page — `EaseSalary - דף העובד`.
 *
 * **It reads the worker and changes nothing.** Their terms are edited on
 * `/settings`, which is where the artboard's "פרטים והגדרות" sends them, so a
 * term has one place to be changed.
 *
 * **The hero card is the action list's and not a second opinion.** It carries
 * the first *blockage* this worker has, phrased by `alertsView` exactly as the
 * bell, the opening screen and `/alerts` phrase it (item 27) — so the four
 * cannot list what the others do not. It is absent when they have none.
 *
 * **What the artboard draws and this page does not**, each an absence rather
 * than an invention (`CLAUDE.md` rule 4): the `?` explaining a *month* row. The
 * status badges, the day counts, the seniority, the row's link to its payslip
 * and the closing links row are all drawn.
 */

interface WorkerProfileScreenProps {
  profile: WorkerProfile;
  months: ProfileMonth[];
  /** Whole years since the employment began, for the subtitle. */
  seniorityYears: number;
  /** Passed in and never read from a clock here, or the server and the browser
   * disagree about how far off a date is (`CLAUDE.md`). */
  today: IsoDate;
  /** Their three balances with the sentence behind each (`WorkerBalances`). */
  balances: ProfileBalance[];
  /** What is still owed on each advance, walked from the opening position
   * across every month (item 20). */
  ledger: AdvanceStanding[];
  /** Their country of origin in Hebrew, resolved on the server from the shipped
   * holiday lists (`countryNameHe`). */
  countryName: string;
  /** The first thing about them that blocks a correct salary today, or `null`
   * when there is none. */
  needsYou: AlertCard | null;
  /** Their holiday moves agreed once a year's list was in force (item 10). */
  amendments: HolidayAmendment[];
}

export function WorkerProfileScreen({
  profile,
  months,
  seniorityYears,
  today,
  balances,
  ledger,
  countryName,
  needsYou,
  amendments,
}: WorkerProfileScreenProps) {
  const words = he.workers;
  const page = words.profile;

  const open = ledger.filter((standing) => standing.outstandingAgorot > 0);

  return (
    <div className="mx-auto flex w-full max-w-[860px] min-w-0 flex-col gap-6 sm:gap-7">
      <div className="flex min-w-0 flex-wrap items-start gap-x-5.5 gap-y-3">
        <WorkerAvatar size="lg" />
        <div className="flex min-w-[min(15rem,100%)] flex-[1_1_15rem] flex-col gap-1.25">
          <h1
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

      {/* **Beside the balances and above the months**, because the three dates
          are standing facts about the employment as the balances are, and
          because the complaint they answer is that they were hidden — which a
          place at the foot of a long page would not fix. */}
      <WorkerDocuments documents={profile.documents} today={today} />

      <MonthsSection
        workerId={profile.id}
        gender={profile.gender}
        months={months}
      />

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
          the list they have, and an empty section would say nothing (item 10). */}
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

      {/* The two things about them that live on another screen, which is the
          artboard's closing row. `לשתף` goes to the account section of
          `/settings`, where an invitation is actually made. */}
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

/** The list of months is `MonthsSection`'s, and so is the shape of a row on it.
 * Re-exported here because this screen is what a page builds, so the page has
 * one import for the screen and its data. */
export type { ProfileMonth };

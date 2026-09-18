"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import {
  inviteToHousehold,
  removeShare,
  signOut,
  withdrawInvitation,
  type InvitationResult,
} from "@/app/settings/actions";
import type { ProfileActionResult } from "@/app/workers/actions";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { FoldSection } from "@/components/FoldSection";
import { TwoToneIcon } from "@/components/icons";
import { useWorkerScope } from "@/components/WorkerScope";
import { INVITATION_TOKEN_PARAM } from "@/lib/invitationCookie";
import {
  DocumentsControl,
  EmployedSinceControl,
  GenderControl,
  HolidaysRow,
  IncomeTaxControl,
  InsurerControl,
  OpeningPositionControl,
  IdentifyingNumberControl,
  RecuperationControl,
  RestDayControl,
  RestEveSupplementControl,
  SalaryControl,
  StandingLinesControl,
  TermRow,
} from "@/components/WorkerTerms";
import { fullDayLabel } from "@/lib/dateLabels";
import type { DatedRate } from "@/lib/datedRates";
import type { WorkerProfile } from "@/lib/engine/repository";
import { he } from "@/lib/i18n/he";
import type { IdentifyingNumbers } from "@/lib/identifyingNumbers";
import { formatAgorot, formatDays } from "@/lib/money";
import type { YearMonth } from "@/lib/types";

/**
 * `EaseSalary - הגדרות`, for whichever worker the switcher holds.
 *
 * The artboard's four groups in its order. Each group holds the artboard's rows
 * and, beside them, the terms the worker's page had changed that the artboard
 * does not draw — gender, income tax, standing lines and the opening position
 * among the employment's terms, the recuperation month beside the holidays —
 * because every term has one place to be changed and this is it.
 */

/** One worker's settings as the server prepared them. */
export interface WorkerSettings {
  profile: WorkerProfile;
  holidayDaysChosen: number;
  holidayAllowance: number;
  recuperationDays: number;
  vacationDaysPerYear: number;
  /** The four numbers, opened on the server for this screen alone (items 22,
   * 28). A number never entered is absent. */
  numbers: IdentifyingNumbers;
}

interface SettingsScreenProps {
  household: WorkerSettings[];
  /** The calendar year the holiday and vacation rows report on, passed in
   * because nothing reads a clock during a render (`CLAUDE.md`). */
  year: number;
  /** This month, for the salary in force during it. */
  month: YearMonth;
  sickDaysPerYear: number;
  minimumWage: DatedRate | null;
  nationalInsurance: DatedRate | null;
  /** The household's invitations, pending and accepted (item 11). */
  invitations: Invitation[];
}

export function SettingsScreen({
  household,
  year,
  month,
  sickDaysPerYear,
  minimumWage,
  nationalInsurance,
  invitations,
}: SettingsScreenProps) {
  const words = he.settings;
  const { worker } = useWorkerScope();
  const entry =
    household.find((candidate) => candidate.profile.id === worker.id) ??
    household[0];

  // A change reaches the store and the page re-renders from it, so nothing here
  // predicts what was saved; the screen dims while the round trip is in flight.
  const [saving, startSaving] = useTransition();
  function handleAction(
    action: () => Promise<ProfileActionResult>,
    onResult: (result: ProfileActionResult) => void,
  ) {
    startSaving(async () => onResult(await action()));
  }

  if (entry === undefined) return null;
  const { profile } = entry;

  return (
    <div className="mx-auto flex w-full max-w-[820px] min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        {/* The tab's own icon, beside the heading rather than inside it — see
            `PaymentsScreen` for why the distinction matters under `dir="auto"`. */}
        <div className="flex items-center gap-2">
          <TwoToneIcon name="gear" className="size-5.5" />
          <h1
            dir="auto"
            className="text-[24px] leading-[1.2] font-bold tracking-[-0.02em]"
          >
            {words.title}
          </h1>
        </div>
        <p
          dir="auto"
          className="max-w-[60ch] text-[15px] font-light text-ink-mute text-pretty"
        >
          {words.lead}
        </p>
      </div>

      {/* Keyed by worker: every control seeds its draft from the profile, and a
          switch must not leave the other worker's draft in the fields. */}
      <div
        key={profile.id}
        aria-busy={saving}
        className={[
          "flex min-w-0 flex-col gap-6 transition-opacity",
          saving ? "opacity-60" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Group
          id="employment"
          title={words.employment.title}
          note={
            <>
              <span dir="auto">{words.employment.note} </span>
              <Bidi>{profile.name}</Bidi>
            </>
          }
        >
          <SalaryControl
            workerId={profile.id}
            profile={profile}
            month={month}
            onSubmit={handleAction}
          />
          <RestEveSupplementControl
            workerId={profile.id}
            agorot={profile.restEveSupplementAgorot}
            onSubmit={handleAction}
          />
          <RestDayControl
            workerId={profile.id}
            restDay={profile.restDay}
            onSubmit={handleAction}
          />
          <EmployedSinceControl
            workerId={profile.id}
            employedSince={profile.employedSince}
            firstMonth={profile.firstMonth}
            onSubmit={handleAction}
          />
          <GenderControl
            workerId={profile.id}
            gender={profile.gender}
            onSubmit={handleAction}
          />
          <IncomeTaxControl
            workerId={profile.id}
            setting={profile.incomeTax}
            onSubmit={handleAction}
          />
          <StandingLinesControl
            workerId={profile.id}
            standingLines={profile.standingLines}
            onSubmit={handleAction}
          />
          <OpeningPositionControl
            workerId={profile.id}
            profile={profile}
            onSubmit={handleAction}
          />
        </Group>

        <Group id="leave" title={words.leave.title} note={words.leave.note}>
          <ValueRow
            label={words.leave.vacation.label}
            hint={words.leave.vacation.hint}
            value={formatDays(entry.vacationDaysPerYear)}
            rowKey="vacation-per-year"
            derived
          />
          <ValueRow
            label={words.leave.sick.label}
            hint={words.leave.sick.hint}
            value={formatDays(sickDaysPerYear)}
            rowKey="sick-per-year"
            derived
          />
          <HolidaysRow
            year={year}
            chosen={entry.holidayDaysChosen}
            allowance={entry.holidayAllowance}
          />
          <RecuperationControl
            workerId={profile.id}
            recuperationMonth={profile.recuperationMonth}
            days={entry.recuperationDays}
            onSubmit={handleAction}
          />
        </Group>

        <Group id="rates" title={words.rates.title} note={words.rates.note}>
          <ValueRow
            label={words.rates.minimumWage.label}
            hint={words.rates.minimumWage.hint}
            value={minimumWage === null ? null : formatAgorot(minimumWage.value)}
            since={minimumWage?.effectiveFrom}
            rowKey="minimum-wage"
            derived
          />
          <ValueRow
            label={words.rates.nationalInsurance.label}
            hint={words.rates.nationalInsurance.hint}
            value={
              nationalInsurance === null
                ? null
                : percentOf(nationalInsurance.value)
            }
            since={nationalInsurance?.effectiveFrom}
            rowKey="national-insurance"
            derived
          />
          <InsurerControl
            workerId={profile.id}
            insurer={profile.insurer}
            onSubmit={handleAction}
          />
        </Group>

        <Group
          id="documents"
          title={words.documents.title}
          note={words.documents.note}
        >
          {(["passport", "workVisa", "employmentPermit", "bankAccount"] as const).map(
            (name) => (
              <IdentifyingNumberControl
                key={name}
                workerId={profile.id}
                name={name}
                number={entry.numbers[name] ?? null}
                onSubmit={handleAction}
              />
            ),
          )}
          <DocumentsControl
            workerId={profile.id}
            documents={profile.documents}
            onSubmit={handleAction}
          />
        </Group>
      </div>

      <section className="flex flex-col gap-2 border-t border-line pt-5">
        <h2 dir="auto" className="text-[17px] font-semibold">
          {words.account.title}
        </h2>
        <ShareSection invitations={invitations} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            href="/reports"
            className="text-[15px] font-medium text-forest hover:underline hover:underline-offset-4"
          >
            <span dir="auto">{words.account.yearlySummary}</span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="text-[15px] font-medium text-clay-deep hover:underline hover:underline-offset-4"
            >
              <span dir="auto">{words.account.signOut}</span>
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

/** One of the household's invitations, as `/settings` lists it. */
export interface Invitation {
  id: string;
  email: string;
  /** What the link carries and acceptance requires. */
  token: string;
  accepted: boolean;
  /** Only the member who sent an invitation may remove the person who accepted it. */
  sentByMe: boolean;
}

/**
 * The address an invited person opens: the sign-up form with their address
 * already in it, and the invitation's token, which is the only thing that
 * accepts it (migration `an_invitation_is_accepted_through_its_link`). Built in
 * a click handler and never during a render, because the origin is the
 * browser's and the server does not know it.
 */
function invitationLink(email: string, token: string): string {
  const query = new URLSearchParams({ invite: email, [INVITATION_TOKEN_PARAM]: token });
  return `${window.location.origin}/sign-in?${query}`;
}

/**
 * `לשתף עובד/ת עם בן/בת משפחה` — an invitation passed on by the member (specs.md
 * item 11).
 *
 * **Nothing is sent from here**. The member copies a
 * message with the link and sends it however the family talks; the person
 * invited opens their own account with that address, and the row reads
 * "accepted" from then on.
 *
 * It holds no rule. Whether this person may invite, and into which household,
 * is the server's and the database's.
 */
function ShareSection({ invitations }: { invitations: Invitation[] }) {
  const words = he.settings.account.share;
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<InvitationResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [sending, startSending] = useTransition();

  async function copyInvitation(address: string, token: string) {
    try {
      await navigator.clipboard.writeText(
        words.message(address, invitationLink(address, token)),
      );
      setCopied(address);
    } catch {
      setCopied(null);
    }
  }

  const message =
    result === null
      ? null
      : result.ok
        ? copied === result.email
          ? words.copied
          : words.created
        : result.reason === "email"
          ? words.badEmail
          : words.failed;

  return (
    <div data-share className="flex flex-col gap-2.5" aria-busy={sending}>
      <div className="flex flex-col gap-0.5">
        <h3 dir="auto" className="text-[15px] font-semibold">
          {words.title}
        </h3>
        <p dir="auto" className="max-w-[62ch] text-[13px] leading-[1.5] font-light text-ink-quiet text-pretty">
          {words.lead}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex min-w-0 flex-col gap-1">
          <span dir="auto" className="text-[13px] font-medium text-ink-warm">
            {words.email}
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            dir="ltr"
            translate="no"
            autoComplete="off"
            className="w-72 max-w-full rounded-card-sm border border-line-field bg-surface px-3 py-2 text-start text-[15px] text-ink transition-colors hover:border-ink-quiet focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest"
          />
        </label>
        <button
          type="button"
          disabled={sending || email.trim() === ""}
          onClick={() =>
            startSending(async () => {
              const outcome = await inviteToHousehold(email);
              setResult(outcome);
              if (outcome.ok) {
                setEmail("");
                await copyInvitation(outcome.email, outcome.token);
              }
            })
          }
          className="rounded-card-sm bg-forest px-3.5 py-2 text-[14px] font-semibold text-surface transition-colors hover:bg-forest-deep disabled:opacity-50"
        >
          <span dir="auto">{words.send}</span>
        </button>
      </div>
      {message === null ? null : (
        <p aria-live="polite" dir="auto" className="text-[13px] leading-[1.5] font-light text-ink-mute text-pretty">
          {message}
        </p>
      )}
      {invitations.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <span dir="auto" className="text-[13px] font-medium text-ink-warm">
            {words.invitations}
          </span>
          <ul className="flex flex-col gap-1">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                data-invitation={invitation.accepted ? "accepted" : "pending"}
                className="flex flex-wrap items-center gap-3 text-[14px]"
              >
                <Bidi noTranslate>{invitation.email}</Bidi>
                <span
                  dir="auto"
                  className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${
                    invitation.accepted
                      ? "bg-sage-soft text-sage-ink"
                      : "bg-chip text-ink-mute"
                  }`}
                >
                  {invitation.accepted ? words.accepted : words.pending}
                </span>
                {invitation.accepted ? (
                  invitation.sentByMe ? (
                    <button
                      type="button"
                      onClick={() => startSending(() => removeShare(invitation.id))}
                      className="text-[13px] font-medium text-ink-mute transition-colors hover:text-ink"
                    >
                      <span dir="auto">{words.remove}</span>
                    </button>
                  ) : null
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void copyInvitation(invitation.email, invitation.token)}
                      className="text-[13px] font-medium text-forest transition-colors hover:text-forest-deep"
                    >
                      <span dir="auto">
                        {copied === invitation.email ? words.copiedShort : words.copy}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startSending(() => withdrawInvitation(invitation.id))}
                      className="text-[13px] font-medium text-ink-mute transition-colors hover:text-ink"
                    >
                      <span dir="auto">{words.withdraw}</span>
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * A fraction as a percentage, worked out by hand rather than through `Intl`,
 * for the reason `money.ts` gives: the server and the browser must print the
 * same string or the page throws a hydration mismatch.
 */
function percentOf(fraction: number): string {
  return `${Math.round(fraction * 10000) / 100}%`;
}

/**
 * One of the four groups, folded until its heading is pressed, as the payments
 * screen's sections are. Its own state, inside the list keyed by worker, so a
 * worker switch folds every group again.
 */
function Group({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <FoldSection
      group={id}
      title={title}
      fold={{ open, onToggle: () => setOpen((current) => !current) }}
      className="flex min-w-0 flex-col gap-2.5"
    >
      <p className="text-[14px] font-light text-ink-quiet text-pretty">
        {typeof note === "string" ? <span dir="auto">{note}</span> : note}
      </p>
      <Card className="flex min-w-0 flex-col px-4 sm:px-6">
        {children}
      </Card>
    </FoldSection>
  );
}

/** A row the user reads and does not change here: a term with no control yet,
 * or a figure the law settles, which carries the artboard's badge. */
function ValueRow({
  label,
  hint,
  value,
  since,
  rowKey,
  derived = false,
}: {
  label: string;
  hint: string;
  value: string | null;
  since?: string;
  rowKey: string;
  derived?: boolean;
}) {
  const words = he.settings;
  return (
    <TermRow label={label} hint={hint}>
      <div
        data-setting={rowKey}
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[15px]"
      >
        {value === null ? (
          <span dir="auto" className="font-light text-ink-mute">
            {words.noRate}
          </span>
        ) : (
          <Bidi noTranslate className="font-semibold">
            {value}
          </Bidi>
        )}
        {since === undefined ? null : (
          <span className="font-light text-ink-mute">
            <span dir="auto">{words.since}</span>
            <Bidi>{fullDayLabel(since)}</Bidi>
          </span>
        )}
        {derived ? (
          <span
            dir="auto"
            className="rounded-full bg-hover px-2.75 py-1 text-[13px] text-ink-quiet"
          >
            {words.derived}
          </span>
        ) : null}
      </div>
    </TermRow>
  );
}

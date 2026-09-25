import { addDays, compareIsoDate } from "@/lib/dates";
import { todayInIsrael } from "@/lib/today";
import type { IsoDate, YearMonth } from "@/lib/types";
import type { ActionEntry } from "./actionList";
import { recuperationDaysInMonth } from "./recuperation";
import type { WorkerProfile } from "./repository";
import type { MonthInSeries } from "./series";
import type { ThirdPartyKind } from "./types";

/**
 * What the alerts page adds to the action list (specs.md item 27): the warnings
 * the household switched off or put off are left out, and what was already
 * handled is read off the months.
 */

/** Every kind of warning `actionList` raises, each with its own switch in the
 * settings. A blockage has none, because the salary cannot be produced
 * correctly while it stands. */
export const warningKinds = [
  "documentExpiring",
  "recuperationApproaching",
  "monthNotExported",
  "seniorityYearTurning",
  "advanceOutstanding",
  "vacationUnderSeven",
] as const satisfies readonly ActionEntry["key"][];

export type WarningKind = (typeof warningKinds)[number];

/** How long 'not now' hides a warning. */
const DEFER_DAYS = 7;

/** How far back the handled list reaches. */
const HANDLED_DAYS = 90;

/**
 * A warning put off. **The whole entry is its fingerprint**, so a date or a
 * figure it carries that changes is a different entry and shows again at once,
 * which is the spec's "whichever comes first" without a second rule.
 */
export interface Deferral {
  workerId: string;
  fingerprint: string;
  /** The first day the warning shows again. */
  until: IsoDate;
}

export function fingerprintOf(entry: ActionEntry): string {
  return JSON.stringify(entry);
}

export function deferralOf(workerId: string, entry: ActionEntry, today: IsoDate): Deferral {
  return { workerId, fingerprint: fingerprintOf(entry), until: addDays(today, DEFER_DAYS) };
}

/** "Mark as handled" on a finished month not yet exported: the same record as
 * "not now", with no day on which it shows again. It stamps no export. */
const FOREVER: IsoDate = "9999-12-31";

export function markedHandledOf(workerId: string, entry: ActionEntry): Deferral {
  return { workerId, fingerprint: fingerprintOf(entry), until: FOREVER };
}

/** Which of the two a warning offers: a month not yet exported is marked as
 * handled, and every other warning is put off. */
export function dismissalOf(entry: ActionEntry): "markHandled" | "notNow" | null {
  if (entry.list !== "warning") return null;
  return entry.key === "monthNotExported" ? "markHandled" : "notNow";
}

/** The entries one worker's alerts show and the bell counts: blockages always,
 * warnings unless their kind is switched off or they are put off today. */
export function shownEntries(
  entries: ActionEntry[],
  {
    workerId,
    switchedOff,
    deferrals,
    today,
  }: { workerId: string; switchedOff: WarningKind[]; deferrals: Deferral[]; today: IsoDate },
): ActionEntry[] {
  const deferred = new Set(
    deferrals
      .filter((one) => one.workerId === workerId && compareIsoDate(today, one.until) < 0)
      .map((one) => one.fingerprint),
  );
  return entries.filter(
    (entry) =>
      entry.list === "blockage" ||
      (!(switchedOff as string[]).includes(entry.key) && !deferred.has(fingerprintOf(entry))),
  );
}

export type HandledEntry =
  | { key: "monthExported"; month: YearMonth; on: IsoDate }
  | { key: "paymentRecorded"; kind: ThirdPartyKind; month: YearMonth; on: IsoDate }
  | { key: "recuperationConfirmed"; month: YearMonth; on: IsoDate };

/**
 * What was handled in the last ninety days, newest first. Read off the facts
 * that record each event and never stored (item 13's reason). An instant is
 * dated by the Israeli calendar, as the rest of the application dates one.
 */
export function handledList(
  profile: WorkerProfile,
  series: MonthInSeries[],
  today: IsoDate,
): HandledEntry[] {
  const dayOf = (instant: string) => todayInIsrael(new Date(instant));
  const entries: HandledEntry[] = series.flatMap(({ facts }) => [
    ...(facts.exportedAt !== undefined
      ? [{ key: "monthExported" as const, month: facts.month, on: dayOf(facts.exportedAt) }]
      : []),
    ...facts.thirdPartyPayments.map((payment) => ({
      key: "paymentRecorded" as const,
      kind: payment.kind,
      month: facts.month,
      on: payment.paidOn,
    })),
    ...(facts.confirmedAt !== undefined &&
    recuperationDaysInMonth(profile, facts.terms.recuperationMonth, facts.month) > 0
      ? [{ key: "recuperationConfirmed" as const, month: facts.month, on: dayOf(facts.confirmedAt) }]
      : []),
  ]);
  const since = addDays(today, -HANDLED_DAYS);
  return entries
    .filter(({ on }) => compareIsoDate(on, since) >= 0 && compareIsoDate(on, today) <= 0)
    .sort((a, b) => compareIsoDate(b.on, a.on));
}

/**
 * The kinds one replay raises for several months at once. Recuperation's two
 * entries carry a month as well and neither can repeat: one is raised for this
 * month and the other for the next.
 */
const GATHERED: readonly ActionEntry["key"][] = ["monthUnconfirmed", "monthNotExported"];

/** One card and every entry drawn as it (item 27). */
export interface EntryGroup {
  /** The entry the card is phrased from, which is the first of them. */
  lead: ActionEntry;
  /** The entries behind the card, the lead included, in item 27's order. */
  entries: ActionEntry[];
}

/**
 * Entries of one kind that differ only in the month they are about, drawn as
 * one card naming those months (item 27). Counting the groups is therefore
 * counting what is drawn, which is what the bell and the opening screen give.
 *
 * It runs after `shownEntries`, so a month put off on its own leaves the group
 * rather than taking the rest of them with it.
 */
export function groupedEntries(entries: ActionEntry[]): EntryGroup[] {
  const groups: EntryGroup[] = [];
  const gathered = new Map<string, EntryGroup>();
  for (const entry of entries) {
    const into = GATHERED.includes(entry.key) ? gathered.get(entry.key) : undefined;
    if (into !== undefined) {
      into.entries.push(entry);
      continue;
    }
    const group: EntryGroup = { lead: entry, entries: [entry] };
    if (GATHERED.includes(entry.key)) gathered.set(entry.key, group);
    groups.push(group);
  }
  return groups;
}

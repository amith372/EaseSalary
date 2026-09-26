import { cache } from "react";
import {
  coveredMonthsLabel,
  dayLabel,
  fullDayLabel,
  monthListLabel,
  monthLabel,
} from "@/lib/dateLabels";
import { daysBetween } from "@/lib/dates";
import { actionList, type ActionEntry } from "@/lib/engine/actionList";
import {
  dismissalOf,
  fingerprintOf,
  groupedEntries,
  handledList,
  shownEntries,
  type HandledEntry,
  type WarningKind,
} from "@/lib/engine/alerts";
import type { SalaryRepository } from "@/lib/engine/repository";
import { householdSeries } from "@/lib/householdSeries";
import { he, type Said } from "@/lib/i18n/he";
import { legalLink, type LegalLinkKey } from "@/lib/links";
import { getRepository } from "@/lib/store";
import { readToday } from "@/lib/requestToday";
import { formatAgorot, formatDays } from "@/lib/money";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * The household's alerts as `/alerts` draws them (specs.md item 27): every
 * worker's action list after the switches and the deferrals, phrased, and the
 * ninety days of what was handled. Worked out on the server; the screen only
 * draws it.
 */

export interface AlertCard {
  id: string;
  workerId: string;
  /** Named only when the household has two workers. */
  workerName: string | null;
  blockage: boolean;
  tag: Said;
  title: Said;
  note: Said;
  action: { label: string; href: string };
  law: { label: string; url: string } | null;
  /**
   * What the dismissal sends back, and which button it is; absent on a
   * blockage, which cannot be put off.
   *
   * **One per month the card stands for** (the user, 2026-09-25): "mark as
   * handled" cannot be undone from the screen, so a card naming four months
   * offers four presses and never one that silences all four.
   *
   * **The two shapes are told apart by the type and not by a count**, because
   * the screen draws two different controls: `one` is the single plain button a
   * card has always had, and `each` is the row of month chips. Only the two
   * kinds `groupedEntries` gathers carry a month, so a chip always has a name
   * to wear — said here, where it is built, rather than left to a fallback on
   * the screen that would draw a button named after nothing.
   */
  dismiss:
    | { label: string; one: string }
    | { label: string; each: { fingerprint: string; month: string }[] }
    | null;
}

export interface HandledRow {
  id: string;
  workerName: string | null;
  title: Said;
  when: string;
}

export interface AlertsView {
  /** The warning kinds the household switched off, for the pop-up. */
  switchedOff: WarningKind[];
  open: AlertCard[];
  done: HandledRow[];
}

/**
 * One card's words. `months` is every month the card stands for (item 27's
 * grouping): one, for all but the two kinds a replay raises month after month.
 */
/** The three sentences an entry is drawn as: its heading, the line under it,
 * and the words on the button beside them. */
type AlertSaid = { title: Said; note: Said; action: string };

function phrase(
  entry: ActionEntry,
  months: YearMonth[],
  workerId: string,
): { said: AlertSaid; href: string; law: LegalLinkKey } {
  const words = he.alerts.entry;
  switch (entry.key) {
    case "nationalInsurance":
      return {
        said: words.nationalInsurance(coveredMonthsLabel([entry.quarter.from, entry.quarter.to])),
        href: "/payments",
        law: "nationalInsurance",
      };
    case "documentExpired":
    case "documentExpiring": {
      const medical = entry.document === "medicalInsurance";
      return {
        said: words[entry.key](entry.document, fullDayLabel(entry.expiresOn)),
        href: medical ? "/payments" : "/settings",
        law: medical ? "medicalInsurance" : "employmentGuide",
      };
    }
    case "advanceOutstanding":
      return {
        said: words.advanceOutstanding(entry.number, formatAgorot(entry.outstandingAgorot)),
        href: "/payments",
        law: "wageDeductions",
      };
    case "holidaysUnchosen":
      return {
        said: words.holidaysUnchosen(
          entry.year,
          formatDays(entry.chosenDays),
          formatDays(entry.allowance),
        ),
        href: "/settings/holidays",
        law: "holidayWork",
      };
    case "recuperationDue":
      return {
        said: words.recuperationDue(monthLabel(entry.month)),
        href: "/month/export",
        law: "recuperation",
      };
    case "recuperationApproaching":
      return {
        said: words.recuperationApproaching(monthLabel(entry.month)),
        href: "/settings",
        law: "recuperation",
      };
    case "vacationUnderSeven":
      return {
        said: words.vacationUnderSeven(
          entry.year,
          formatDays(entry.days),
          formatDays(entry.required),
        ),
        href: "/",
        law: "annualLeave",
      };
    case "monthNotExported":
      return {
        said: gathered(entry.month, months, words.monthNotExported, words.monthsNotExported),
        href: "/reports",
        law: "wageProtection",
      };
    case "monthUnconfirmed":
      return {
        said: gathered(entry.month, months, words.monthUnconfirmed, words.monthsUnconfirmed),
        href: "/month/export",
        law: "wageProtection",
      };
    case "minimumWageChanged":
      return {
        said: words.minimumWageChanged(
          formatAgorot(entry.exportedAtAgorot),
          formatAgorot(entry.nowAgorot),
          fullDayLabel(entry.effectiveFrom),
        ),
        href: "/settings",
        law: "minimumWage",
      };
    case "seniorityYearTurning":
      return {
        said: words.seniorityYearTurning(entry.years, fullDayLabel(entry.on)),
        href: `/workers/${workerId}`,
        law: "annualLeave",
      };
  }
}

/**
 * Which dismissal a card offers, if any: one press for the card, or one per
 * month where it gathered several.
 *
 * **A month is required to gather**, which is what makes the `each` shape safe
 * for the screen to draw: an entry that carries none cannot be told apart from
 * its siblings by a chip, so the card falls back to the single button rather
 * than drawing one named after nothing.
 */
function dismissal(
  how: ReturnType<typeof dismissalOf>,
  lead: ActionEntry,
  behind: ActionEntry[],
): AlertCard["dismiss"] {
  if (how === null) return null;
  const label = how === "markHandled" ? he.alerts.markHandled : he.alerts.notNow;
  const each = behind.flatMap((one) =>
    "month" in one
      ? [{ fingerprint: fingerprintOf(one), month: monthLabel(one.month) }]
      : [],
  );
  return each.length > 1 ? { label, each } : { label, one: fingerprintOf(lead) };
}

/**
 * What a gathered kind says: one sentence for a single month, another for the
 * several a card stands for (item 27).
 *
 * **Written once so that a third gathered kind is a call and not a third copy**
 * of the same branch. `many` is handed the count *and* the list; a sentence
 * that names only the count simply takes the first of the two.
 */
function gathered(
  month: YearMonth,
  months: YearMonth[],
  one: (month: string) => AlertSaid,
  many: (count: number, list: string) => AlertSaid,
): AlertSaid {
  return months.length > 1
    ? many(months.length, monthListLabel(months))
    : one(monthLabel(month));
}

function tagOf(entry: ActionEntry, today: IsoDate): Said {
  if (entry.list === "blockage") return [he.alerts.tag.blockage];
  if (entry.key === "documentExpiring") {
    return he.alerts.tag.inDays(daysBetween(today, entry.expiresOn));
  }
  return [he.alerts.tag.warning];
}

function handledTitle(entry: HandledEntry): Said {
  const month = monthLabel(entry.month);
  switch (entry.key) {
    case "monthExported":
      return he.alerts.handled.monthExported(month);
    case "paymentRecorded":
      return he.alerts.handled.paymentRecorded(he.sheet.thirdParty[entry.kind], month);
    case "recuperationConfirmed":
      return he.alerts.handled.recuperationConfirmed(month);
  }
}

async function alertsView(
  repository: SalaryRepository,
  today: IsoDate,
): Promise<AlertsView> {
  // The household's own replay, so the bell and the page it is drawn over read
  // one walk rather than two that could disagree.
  const [replayed, rates, switchedOff, deferrals] = await Promise.all([
    householdSeries(),
    repository.listRates(),
    repository.listSwitchedOffWarnings(),
    repository.listDeferrals(),
  ]);
  const named = replayed.length > 1;

  const perWorker = await Promise.all(
    replayed.map(async ({ profile, months: series }) => {
      const spans = await repository.listSpans(profile.id);
      const workerName = named ? profile.firstName : null;
      const entries = shownEntries(actionList({ profile, series, spans, rates, today }), {
        workerId: profile.id,
        switchedOff,
        deferrals,
        today,
      });
      const open: AlertCard[] = groupedEntries(entries).map(({ lead, entries: behind }) => {
        // The months the card stands for, in item 27's order; one, wherever
        // nothing was gathered.
        const months = behind.flatMap((one) => ("month" in one ? [one.month] : []));
        const { said, href, law } = phrase(lead, months, profile.id);
        const how = dismissalOf(lead);
        return {
          id: `${profile.id}:${fingerprintOf(lead)}`,
          workerId: profile.id,
          workerName,
          blockage: lead.list === "blockage",
          tag: tagOf(lead, today),
          title: said.title,
          note: said.note,
          action: { label: said.action, href },
          law: legalLink(law),
          dismiss: dismissal(how, lead, behind),
        };
      });
      const done = handledList(profile, series, today).map((entry, index) => ({
        on: entry.on,
        row: {
          id: `${profile.id}:${index}`,
          workerName,
          title: handledTitle(entry),
          when: dayLabel(entry.on),
        },
      }));
      return { open, done };
    }),
  );

  return {
    switchedOff,
    // One list, the blockages above the warnings; within each, item 27's order.
    open: perWorker
      .flatMap(({ open }) => open)
      .sort((a, b) => Number(b.blockage) - Number(a.blockage)),
    done: perWorker
      .flatMap(({ done }) => done)
      .sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : 0))
      .map(({ row }) => row),
  };
}

/** How many entries the bell's panel and the opening screen's strip each list;
 * the rest are counted and left to the page (specs.md item 27). */
const FIRST_SHOWN = 4;

/** The first entries of a list, and how many more the page holds. */
export interface FirstOf {
  shown: AlertCard[];
  more: number;
}

function firstOf(cards: AlertCard[]): FirstOf {
  return { shown: cards.slice(0, FIRST_SHOWN), more: Math.max(0, cards.length - FIRST_SHOWN) };
}

export interface BellView extends FirstOf {
  /** The household's warnings as the page shows them. A blockage belongs on
   * the opening screen, not in the bell. */
  count: number;
  switchedOff: WarningKind[];
}

/**
 * The household's alerts for this request, worked out once: the bar's bell,
 * the opening screen's strip and `/alerts` all read this one result, so none of
 * them can list what another does not, and the household is replayed once per
 * request rather than once per reader.
 */
export const householdAlerts = cache(
  async (): Promise<AlertsView> => alertsView(await getRepository(), await readToday()),
);

/** The first blockages, which lead the opening screen (item 27). */
export function blockagesOf(view: AlertsView): FirstOf {
  return firstOf(view.open.filter((card) => card.blockage));
}

/** What the bell in the bar shows, read from the page's own view so it never
 * counts or lists what the page does not. */
export function bellOf(view: AlertsView): BellView {
  const warnings = view.open.filter((card) => !card.blockage);
  return {
    count: warnings.length,
    ...firstOf(warnings),
    switchedOff: view.switchedOff,
  };
}

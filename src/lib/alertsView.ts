import { cache } from "react";
import { coveredMonthsLabel, dayLabel, fullDayLabel, monthLabel } from "@/lib/dateLabels";
import { daysBetween } from "@/lib/dates";
import { actionList, type ActionEntry } from "@/lib/engine/actionList";
import {
  dismissalOf,
  fingerprintOf,
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
import type { IsoDate } from "@/lib/types";

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
  /** What the dismissal button sends back, and which button it is; absent on a
   * blockage, which cannot be put off. */
  dismiss: { fingerprint: string; label: string } | null;
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

function phrase(
  entry: ActionEntry,
  workerId: string,
): {
  said: { title: Said; note: Said; action: string };
  href: string;
  law: LegalLinkKey;
} {
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
        said: words.monthNotExported(monthLabel(entry.month)),
        href: "/reports",
        law: "wageProtection",
      };
    case "monthUnconfirmed":
      return {
        said: words.monthUnconfirmed(monthLabel(entry.month)),
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
      const open: AlertCard[] = entries.map((entry) => {
        const { said, href, law } = phrase(entry, profile.id);
        const fingerprint = fingerprintOf(entry);
        const how = dismissalOf(entry);
        return {
          id: `${profile.id}:${fingerprint}`,
          workerId: profile.id,
          workerName,
          blockage: entry.list === "blockage",
          tag: tagOf(entry, today),
          title: said.title,
          note: said.note,
          action: { label: said.action, href },
          law: legalLink(law),
          dismiss:
            how === null
              ? null
              : {
                  fingerprint,
                  label: how === "markHandled" ? he.alerts.markHandled : he.alerts.notNow,
                },
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

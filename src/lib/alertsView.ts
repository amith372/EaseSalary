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
import { calculateSeries } from "@/lib/engine/series";
import { he, type Said } from "@/lib/i18n/he";
import { legalLink, type LegalLinkKey } from "@/lib/links";
import { getRepository } from "@/lib/store";
import { todayInIsrael } from "@/lib/today";
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

function phrase(entry: ActionEntry, workerId: string) {
  const words = he.alerts.entry;
  switch (entry.key) {
    case "nationalInsurance":
      return {
        said: words.nationalInsurance(coveredMonthsLabel([entry.quarter.from, entry.quarter.to])),
        href: "/payments",
        law: "nationalInsurance" as LegalLinkKey,
      };
    case "documentExpired":
    case "documentExpiring": {
      const medical = entry.document === "medicalInsurance";
      return {
        said: words[entry.key](entry.document, fullDayLabel(entry.expiresOn)),
        href: medical ? "/payments" : "/settings",
        law: (medical ? "medicalInsurance" : "employmentGuide") as LegalLinkKey,
      };
    }
    case "advanceOutstanding":
      return {
        said: words.advanceOutstanding(entry.number, formatAgorot(entry.outstandingAgorot)),
        href: "/payments",
        law: "wageDeductions" as LegalLinkKey,
      };
    case "holidaysUnchosen":
      return {
        said: words.holidaysUnchosen(
          entry.year,
          formatDays(entry.chosenDays),
          formatDays(entry.allowance),
        ),
        href: "/settings/holidays",
        law: "holidayWork" as LegalLinkKey,
      };
    case "recuperationDue":
      return {
        said: words.recuperationDue(monthLabel(entry.month)),
        href: "/month/export",
        law: "recuperation" as LegalLinkKey,
      };
    case "recuperationApproaching":
      return {
        said: words.recuperationApproaching(monthLabel(entry.month)),
        href: "/settings",
        law: "recuperation" as LegalLinkKey,
      };
    case "vacationUnderSeven":
      return {
        said: words.vacationUnderSeven(entry.year, formatDays(entry.days)),
        href: "/",
        law: "annualLeave" as LegalLinkKey,
      };
    case "monthNotExported":
      return {
        said: words.monthNotExported(monthLabel(entry.month)),
        href: "/reports",
        law: "wageProtection" as LegalLinkKey,
      };
    case "minimumWageChanged":
      return {
        said: words.minimumWageChanged(
          formatAgorot(entry.exportedAtAgorot),
          formatAgorot(entry.nowAgorot),
          fullDayLabel(entry.effectiveFrom),
        ),
        href: "/settings",
        law: "minimumWage" as LegalLinkKey,
      };
    case "seniorityYearTurning":
      return {
        said: words.seniorityYearTurning(entry.years, fullDayLabel(entry.on)),
        href: `/workers/${workerId}`,
        law: "annualLeave" as LegalLinkKey,
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

export async function alertsView(
  repository: SalaryRepository,
  today: IsoDate,
): Promise<AlertsView> {
  const [workers, rates, switchedOff, deferrals] = await Promise.all([
    repository.listWorkers(),
    repository.listRates(),
    repository.listSwitchedOffWarnings(),
    repository.listDeferrals(),
  ]);
  const named = workers.length > 1;

  const perWorker = await Promise.all(
    workers.map(async (profile) => {
      const [months, spans] = await Promise.all([
        repository.listMonths(profile.id),
        repository.listSpans(profile.id),
      ]);
      const series = calculateSeries(months, profile, today, rates);
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

/** The most warnings the bell lists in its panel; with more it opens the page
 * (specs.md item 27). */
export const BELL_PANEL_MAX = 4;

export interface BellView {
  /** The household's warnings as the page shows them. A blockage belongs on
   * the opening screen, not in the bell. */
  count: number;
  /** Those warnings, when there are few enough for the panel; otherwise null
   * and the bell opens the page. */
  panel: AlertCard[] | null;
  switchedOff: WarningKind[];
}

/**
 * The household's alerts for this request, worked out once: the bar's bell,
 * the opening screen's strip and `/alerts` all read this one result, so none of
 * them can list what another does not, and the household is replayed once per
 * request rather than once per reader.
 */
export const householdAlerts = cache(
  async (): Promise<AlertsView> => alertsView(await getRepository(), todayInIsrael()),
);

/** The blockages, which lead the opening screen (item 27). */
export function blockagesOf(view: AlertsView): AlertCard[] {
  return view.open.filter((card) => card.blockage);
}

/** What the bell in the bar shows, read from the page's own view so it never
 * counts or lists what the page does not. */
export function bellOf(view: AlertsView): BellView {
  const warnings = view.open.filter((card) => !card.blockage);
  return {
    count: warnings.length,
    panel: warnings.length <= BELL_PANEL_MAX ? warnings : null,
    switchedOff: view.switchedOff,
  };
}

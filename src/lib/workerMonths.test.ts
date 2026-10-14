import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import { actionList } from "@/lib/engine/actionList";
import { shownEntries } from "@/lib/engine/alerts";
import { calculateSeries } from "@/lib/engine/series";
import { SEEDED_RATES } from "@/lib/datedRates";
import { createInMemoryRepository } from "@/lib/engine/repository";
import type { WorkerProfile } from "@/lib/engine/repository";
import { createMonthsBeforeToday } from "@/lib/workerMonths";

/**
 * The months a worker entered after the fact arrives with (specs.md item 6).
 *
 * **Every expectation here is the criterion applied to a calendar by hand.**
 * Added 11.10.2026 from a first month of January 2026 is nine months, January
 * through September: the month they are added in has not ended, so it is not
 * one the application can have confirmed. The rule that produced the January is
 * the user's of 2026-10-11 and is tested in `profile.test.ts`; what is tested
 * here is what happens to the months once it has.
 */

const TODAY = "2026-10-11";
const NOW = "2026-10-11T09:00:00.000Z";

const profile: WorkerProfile = {
  id: "worker-late",
  name: "עובדת",
  firstName: "עובדת",
  gender: "female",
  employedSince: "2025-06-01",
  restDay: SATURDAY,
  recuperationMonth: 7,
  // The minimum wage in force in 2026 (`SEEDED_RATES`), so no month is refused
  // for sitting below it.
  baseMonthlySalaryAgorot: 644385,
  restEveSupplementAgorot: 0,
  country: "PH",
  incomeTax: { mode: "none" },
  insurer: "",
  standingLines: [],
  documents: {
    employmentPermitExpiry: null,
    workVisaExpiry: null,
    passportExpiry: null,
  },
  firstMonth: { year: 2026, month: 1 },
  openingPosition: {
    vacationDays: 0,
    sickDays: 0,
    vacationUsedThisYear: 0,
    holidayUsedThisYear: 0,
    recuperationPaidIn: null,
    advances: [],
  },
};

describe("the months a worker entered after the fact is given", () => {
  it("creates every month from the first to the one before today's, confirmed", async () => {
    const repository = createInMemoryRepository({ workers: [profile] });

    const created = await createMonthsBeforeToday(repository, profile, {
      today: TODAY,
      now: NOW,
    });

    expect(created.map((month) => `${month.year}-${month.month}`)).toEqual([
      "2026-1",
      "2026-2",
      "2026-3",
      "2026-4",
      "2026-5",
      "2026-6",
      "2026-7",
      "2026-8",
      "2026-9",
    ]);

    const months = await repository.listMonths(profile.id);
    expect(months).toHaveLength(9);
    // Confirmed, and confirmed at the wage the table holds for the month and
    // not at today's: April 2026 is the first month of the 2026 figure, so
    // March is still valued at the 2025 one (item 4).
    for (const month of months) {
      expect(month.confirmedAt).toBe(NOW);
      expect(month.exportedAt).toBeUndefined();
    }
    const march = months.find((one) => one.month.month === 3);
    const april = months.find((one) => one.month.month === 4);
    expect(march?.confirmedWage.effectiveFrom).toBe("2025-04-01");
    expect(april?.confirmedWage.effectiveFrom).toBe("2026-04-01");
  });

  /**
   * **The whole point of creating them confirmed**, and the assertion that
   * would catch the fingerprint of the handled record drifting from the one
   * the action list writes: a mismatch leaves nine reminders standing, which
   * is nine of the thing this feature exists to avoid.
   */
  it("leaves the worker with nothing outstanding", async () => {
    const repository = createInMemoryRepository({ workers: [profile] });
    await createMonthsBeforeToday(repository, profile, { today: TODAY, now: NOW });

    const entries = actionList({
      profile,
      series: calculateSeries(
        await repository.listMonths(profile.id),
        profile,
        TODAY,
        SEEDED_RATES,
        await repository.listTaxBrackets(),
      ),
      spans: [],
      rates: SEEDED_RATES,
      today: TODAY,
    });

    // **The warning is raised before it is dismissed**, asserted here so the
    // two below cannot pass by the action list having stopped raising it: nine
    // confirmed months with no file produced from them are nine warnings, and
    // the handled records are what take them off the screen.
    expect(entries.filter((entry) => entry.key === "monthNotExported")).toHaveLength(9);

    const shown = shownEntries(entries, {
      workerId: profile.id,
      switchedOff: [],
      deferrals: await repository.listDeferrals(),
      today: TODAY,
    });

    expect(shown.filter((entry) => entry.key === "monthUnconfirmed")).toEqual([]);
    expect(shown.filter((entry) => entry.key === "monthNotExported")).toEqual([]);
  });

  it("creates nothing for a worker whose first month is this one", async () => {
    const thisMonth: WorkerProfile = {
      ...profile,
      firstMonth: { year: 2026, month: 10 },
    };
    const repository = createInMemoryRepository({ workers: [thisMonth] });

    expect(
      await createMonthsBeforeToday(repository, thisMonth, { today: TODAY, now: NOW }),
    ).toEqual([]);
    expect(await repository.listMonths(thisMonth.id)).toEqual([]);
  });

  /**
   * A month the rates table begins after can only be created as a draft, and a
   * draft whose month has ended is a blockage (item 27) — so it is not created
   * at all. With the table reaching 1.4.2025, a worker added in March 2025
   * gets January and February of that year and nothing else.
   */
  it("creates no month the rates table cannot value", async () => {
    const early: WorkerProfile = {
      ...profile,
      employedSince: "2024-02-01",
      firstMonth: { year: 2025, month: 1 },
    };
    const repository = createInMemoryRepository({ workers: [early] });

    expect(
      await createMonthsBeforeToday(repository, early, {
        today: "2025-03-10",
        now: NOW,
      }),
    ).toEqual([]);
  });
});

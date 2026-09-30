import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import { SEEDED_RATES } from "@/lib/datedRates";
import { lineKeys } from "@/lib/engine/lines";
import { taxToConfirm } from "@/lib/engine/taxConfirmation";
import { DEFAULT_INCOME_TAX } from "@/lib/engine/types";
import type {
  IncomeTaxSetting,
  MonthFacts,
  WorkerTerms,
  Employment,
} from "@/lib/engine/types";
import { SEEDED_TAX_BRACKETS } from "@/lib/taxBrackets";
import type { YearMonth } from "@/lib/types";

/**
 * The income tax a month is about to be confirmed with (specs.md item 17: the
 * tax is confirmed before an export and stored with the month like the minimum
 * wage is).
 *
 * **The month underneath is Part 4's own August 2025**, so the gross every
 * expectation below is taken of is the workbook's ₪9,305.75 and not a figure
 * this module produced: ₪6,247.65 base + ₪500 of rest-eve supplement in column
 * E, and two worked holidays and four rest days at ₪426.35 in column F. A flat
 * 2.5% of it is ₪232.64375, which is ₪232.64 at the nearest agora — the
 * arithmetic is written out here so a reader can check it without running
 * anything.
 *
 * The flat rate is used rather than the automatic mode on purpose: at the
 * minimum wage the automatic answer is zero (item 17), and a test whose every
 * expectation is zero cannot tell a working calculation from a silent one.
 */

const AUGUST: YearMonth = { year: 2025, month: 8 };
const SALARY = 624765;
const FLAT = { mode: "percentage", percentage: 0.025 } as const;
const FLAT_TAX = 23264; // 2.5% of ₪9,305.75 = ₪232.64375 → ₪232.64

const worker = (incomeTax: IncomeTaxSetting): WorkerTerms & Employment => ({
  // Part 4's worker, but starting the application in the month itself, so the
  // replay is one month long and what is asserted is that month's own answer.
  employedSince: "2024-04-01",
  firstMonth: AUGUST,
  gender: "female",
  baseMonthlySalaryAgorot: SALARY,
  restDay: SATURDAY,
  restEveSupplementAgorot: 10000,
  recuperationMonth: 7,
  incomeTax,
  standingLines: [],
  country: "PH",
  openingPosition: {
    vacationDays: 0,
    sickDays: 0,
    vacationUsedThisYear: 0,
    holidayUsedThisYear: 0,
    // Paid in July 2025, as Part 4's own worker has it: without this the replay
    // catches the payment up in its first month and the gross is no longer the
    // workbook's (item 15).
    recuperationPaidIn: { year: 2025, month: 7 },
    advances: [],
  },
});

const august = (over: Partial<MonthFacts> = {}): MonthFacts => ({
  month: AUGUST,
  terms: {
    restDay: SATURDAY,
    restEveSupplementAgorot: 10000,
    recuperationMonth: 7,
    // **The terms are read off the month and never off the profile** (Part 3),
    // so this is the setting every expectation below is of. The repository is
    // what keeps a draft month's terms in step with the profile; by the time
    // the engine sees a month, the question is already settled.
    incomeTax: FLAT,
    standingLines: [],
  },
  confirmedWage: {
    baseAgorot: SALARY,
    minimumAgorot: SALARY,
    effectiveFrom: "2025-04-01",
  },
  // Part 4: one free Saturday on the 16th, two worked holidays on the 19th and
  // the 21st. They are what makes column F ₪2,558.10.
  spans: [
    { id: "free-16", kind: "freeRestDay", from: "2025-08-16", to: "2025-08-16" },
    { id: "hol-19", kind: "holiday", from: "2025-08-19", to: "2025-08-19", worked: true },
    { id: "hol-21", kind: "holiday", from: "2025-08-21", to: "2025-08-21", worked: true },
  ],
  advances: [],
  thirdPartyPayments: [],
  userLines: [],
  overrides: {},
  ...over,
});

const confirm = (
  facts: MonthFacts,
  profile: WorkerTerms & Employment,
  month: YearMonth = AUGUST,
) =>
  taxToConfirm(
    [facts],
    profile,
    "2025-08-31",
    SEEDED_RATES,
    SEEDED_TAX_BRACKETS,
    month,
  );

describe("the income tax a month is confirmed with", () => {
  /** The figure the screen shows and the action stores is worked out now, from
   * the month as it now stands. */
  it("takes the share the worker's terms withhold, of the month's own gross", () => {
    expect(confirm(august(), worker(FLAT))?.agorot).toBe(FLAT_TAX);
  });

  /**
   * **The question is asked again and not answered from the last time it was
   * asked** (item 17: a past month reproduces rather than recalculates, and
   * confirming is the moment that figure is set). A month exported once and
   * corrected since carries a figure that is no longer right, and it is exactly
   * that month the user is being asked about.
   *
   * **What it would catch**: the figure being read off the month, which passes
   * every first export and is wrong on every re-export after a correction —
   * the family would confirm the old number and file it again.
   */
  it("ignores the figure the month already carries", () => {
    const stored = august({ incomeTaxAgorot: 99900 });
    expect(confirm(stored, worker(FLAT))?.agorot).toBe(FLAT_TAX);
  });

  /** An override still wins on the sheet — it is left on the month and only the
   * figure under it is refreshed — so it must not stand in as the answer to
   * what the application makes of the month now. */
  it("ignores an amount typed over the tax row", () => {
    const overridden = august({
      overrides: { [lineKeys.incomeTax]: { agorot: 50000 } },
    });
    expect(confirm(overridden, worker(FLAT))?.agorot).toBe(FLAT_TAX);
  });

  /**
   * The setting reported is the month's own and never the profile's (Part 3).
   * A family that switched to a flat rate in September must not thereby restate
   * August, which was filed under `none` — so a month whose terms say one thing
   * is confirmed under that thing however the profile now reads.
   */
  it("reads the month's own terms and not the profile's", () => {
    const filed = august({
      confirmedAt: "2025-09-02T09:00:00.000Z",
      terms: { ...august().terms, incomeTax: { mode: "none" } },
    });
    const answer = confirm(filed, worker(FLAT));
    expect(answer?.setting).toEqual({ mode: "none" });
    // Nothing is withheld, said as a term of the employment rather than as a
    // zero nobody typed (item 17).
    expect(answer?.agorot).toBe(0);
  });

  /**
   * **What the sheet will print travels beside what is stored** (item 17). An
   * override replaces the calculated amount and leaves it standing underneath,
   * so both are needed: the screen shows the user the figure their file will
   * carry, and the action stores the one beneath it.
   *
   * **What it would catch**: the card showing ₪0.00 in front of a file that
   * prints ₪450, which is the one thing a confirmation may not do.
   */
  it("reports the amount typed over the row beside the one under it", () => {
    const overridden = august({
      overrides: { [lineKeys.incomeTax]: { agorot: 45000 } },
    });
    const answer = confirm(overridden, worker(FLAT));
    expect(answer?.manualAgorot).toBe(45000);
    expect(answer?.agorot).toBe(FLAT_TAX);
  });

  it("says there is no manual amount where nobody typed one", () => {
    expect(confirm(august(), worker(FLAT))?.manualAgorot).toBeNull();
  });

  it("reports the setting the figure was arrived at under", () => {
    expect(confirm(august(), worker(FLAT))?.setting).toEqual(FLAT);
  });

  it("says nothing about a month the worker does not have", () => {
    expect(confirm(august(), worker(FLAT), { year: 2025, month: 7 })).toBeNull();
  });
});

/**
 * The year with no bracket table (item 17: the line stays at zero and says so).
 *
 * 2030 is outside every seeded table, and the automatic mode is the only one
 * that needs a table at all — a flat rate and `none` are answers the statute's
 * brackets have nothing to do with.
 */
describe("a year the application holds no bracket table for", () => {
  const january2030: YearMonth = { year: 2030, month: 1 };
  const inThirty = (over: Partial<MonthFacts> = {}): MonthFacts => ({
    ...august(over),
    month: january2030,
    spans: [],
    terms: { ...august().terms, incomeTax: DEFAULT_INCOME_TAX },
  });
  const profile = {
    ...worker(DEFAULT_INCOME_TAX),
    firstMonth: january2030,
  };
  const ask = (facts: MonthFacts) =>
    taxToConfirm(
      [facts],
      profile,
      "2030-01-31",
      SEEDED_RATES,
      SEEDED_TAX_BRACKETS,
      january2030,
    );

  it("names the year, and leaves the figure at zero", () => {
    const answer = ask(inThirty());
    expect(answer?.missingTableYear).toBe(2030);
    expect(answer?.agorot).toBe(0);
  });

  /**
   * **It says so on a re-export too**, which the month's own warning does not:
   * a month already carrying a confirmed figure raises no missing-table warning,
   * because that figure is exactly what the table is not needed for. Confirming
   * again works the tax out afresh, so the table is needed again.
   *
   * **What it would catch**: the screen reading the month's warnings instead of
   * this calculation's — it would fall silent on the one export that is about
   * to replace a real figure with a zero.
   */
  it("still names it for a month that was confirmed once with a figure", () => {
    const answer = ask(
      inThirty({
        incomeTaxAgorot: 40000,
        confirmedAt: "2030-02-02T09:00:00.000Z",
      }),
    );
    expect(answer?.missingTableYear).toBe(2030);
    expect(answer?.agorot).toBe(0);
  });

  /** A flat rate is the figure an accountant handed the family, so a missing
   * bracket table has nothing to stop. */
  it("says nothing where the terms do not use the brackets", () => {
    const flat = { ...profile, incomeTax: FLAT };
    const answer = taxToConfirm(
      [{ ...inThirty(), terms: { ...august().terms, incomeTax: FLAT } }],
      flat,
      "2030-01-31",
      SEEDED_RATES,
      SEEDED_TAX_BRACKETS,
      january2030,
    );
    expect(answer?.missingTableYear).toBeNull();
    // 2.5% of a month with no holidays and no free rest day: the base and the
    // rest-eve supplement alone. Asserted as "something was withheld" rather
    // than as a figure, since January 2030's own gross is not a workbook one.
    expect(answer?.agorot).toBeGreaterThan(0);
  });
});

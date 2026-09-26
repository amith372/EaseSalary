import { describe, expect, it } from "vitest";
import { SATURDAY } from "@/lib/dates";
import { calculateMonth } from "@/lib/engine/month";
import { DEFAULT_INCOME_TAX, snapshotTerms } from "@/lib/engine/types";
import type { ClosedMonthFacts, ClosedSpan, WorkerTerms } from "@/lib/engine/types";
import { InvalidMonthError, validateMonth } from "@/lib/engine/validate";
import { legalLinks } from "@/lib/links";
import { refusedMonthOf } from "@/lib/refusalView";

/**
 * The card's input, built from the error the engine throws (`specs.md` item 25,
 * Part 4).
 *
 * **Every refusal here is one the engine actually raised**, never an error
 * assembled by hand: what the card has to survive is the shape the engine
 * produces, and a refusal kind that stopped carrying dates or a link would pass
 * a test written against a hand-made one.
 *
 * What these would catch: a card drawn empty because a refusal arrived with no
 * sentence; a date written into the Hebrew paragraph instead of beside it,
 * which a browser may reorder (Part 5); a month taken from the screen rather
 * than from the error, which is wrong for every refusal in a past month; and a
 * refusal reaching the user without the rule it rests on (item 25).
 */

const terms: WorkerTerms = {
  employedSince: "2024-04-01",
  firstMonth: { year: 2024, month: 4 },
  gender: "female",
  baseMonthlySalaryAgorot: 624765,
  restDay: SATURDAY,
  restEveSupplementAgorot: 10000,
  recuperationMonth: 7,
  incomeTax: DEFAULT_INCOME_TAX,
  standingLines: [],
  country: "PH",
  openingPosition: {
    vacationDays: 0,
    sickDays: 0,
    vacationUsedThisYear: 0,
    holidayUsedThisYear: 0,
    recuperationPaidIn: null,
    advances: [],
  },
};

function facts(
  spans: ClosedSpan[],
  extras: Partial<ClosedMonthFacts> = {},
): ClosedMonthFacts {
  return {
    terms: snapshotTerms(terms, { year: 2025, month: 8 }),
    month: { year: 2025, month: 8 },
    confirmedWage: {
      baseAgorot: 624765,
      minimumAgorot: 624765,
      effectiveFrom: "2025-04-01",
    },
    spans,
    advances: [],
    thirdPartyPayments: [],
    userLines: [],
    incomeTaxAgorot: 0,
    overrides: {},
    ...extras,
  };
}

/** The error as the screens meet it: the engine's own refusals, raised by the
 * engine, and the month they were raised for. */
function refusedBy(given: ClosedMonthFacts): InvalidMonthError {
  const refusals = validateMonth(given, terms);
  expect(refusals.length).toBeGreaterThan(0);
  // The engine throws exactly these, which is what the screens catch.
  expect(() => calculateMonth(given, terms)).toThrow(InvalidMonthError);
  return new InvalidMonthError(refusals, given.month);
}

const holiday = (date: string): ClosedSpan => ({
  id: `hol-${date}`,
  kind: "holiday",
  from: date,
  to: date,
  worked: true,
});

describe("a refused month as the card draws it", () => {
  it("names the month the error carries, in Hebrew", () => {
    const august = refusedBy(
      facts([
        { id: "sick-13", kind: "sick", from: "2025-08-13", to: "2025-08-13" },
        holiday("2025-08-13"),
      ]),
    );
    const view = refusedMonthOf(august);
    expect(view.month).toEqual({ year: 2025, month: 8 });
    expect(view.monthLabel).toBe("אוגוסט 2025");
  });

  it("writes the dates a refusal names out, beside the sentence and not inside it", () => {
    const view = refusedMonthOf(
      refusedBy(
        facts([
          { id: "sick-13", kind: "sick", from: "2025-08-13", to: "2025-08-13" },
          holiday("2025-08-13"),
        ]),
      ),
    );
    const [reason] = view.reasons;
    expect(reason.dates).toEqual(["13 באוגוסט 2025"]);
    // The sentence itself carries no date: an unisolated date in a Hebrew
    // paragraph is a mixed run a browser may reorder (Part 5).
    expect(reason.message).not.toContain("13");
    expect(reason.message.length).toBeGreaterThan(0);
  });

  it("carries the rule the refused action rests on (item 25)", () => {
    const view = refusedMonthOf(
      refusedBy(
        facts([
          {
            id: "free-13",
            kind: "freeRestDay",
            from: "2025-08-13",
            to: "2025-08-13",
          },
        ]),
      ),
    );
    // A free rest day rests on the weekly-rest rule, so that is what the card
    // links — the rule of the action refused, not of the check that refused it.
    expect(view.reasons[0]?.law).toEqual(legalLinks.restDayWork);
  });

  it("gives two refusals in one month two reasons and one card", () => {
    const view = refusedMonthOf(
      refusedBy(
        facts(
          [
            {
              id: "free-13",
              kind: "freeRestDay",
              from: "2025-08-13",
              to: "2025-08-13",
            },
          ],
          {
            thirdPartyPayments: [
              { kind: "medicalInsurance", agorot: 32559, paidOn: "2025-08-15" },
              { kind: "medicalInsurance", agorot: 34816, paidOn: "2025-08-15" },
            ],
          },
        ),
      ),
    );
    expect(view.reasons).toHaveLength(2);
    expect(new Set(view.reasons.map((reason) => reason.message)).size).toBe(2);
  });

  it("leaves the dates empty where the refusal concerns no date", () => {
    // An advance's movements carry no date of their own; what they concern is
    // an advance, so the card names no day for them.
    const view = refusedMonthOf(
      refusedBy(
        facts([], {
          advances: [
            { number: 1, kind: "granted", agorot: 50000 },
            { number: 1, kind: "granted", agorot: 40000 },
          ],
        }),
      ),
    );
    expect(view.reasons).toHaveLength(1);
    expect(view.reasons[0]?.dates).toEqual([]);
    expect(view.reasons[0]?.law).toEqual(legalLinks.wageProtection);
  });

  it("gives every refusal the engine raised a sentence, a rule and a label", () => {
    const view = refusedMonthOf(
      refusedBy(
        facts(
          [
            { id: "sick-13", kind: "sick", from: "2025-08-13", to: "2025-08-13" },
            holiday("2025-08-13"),
            {
              id: "free-17",
              kind: "freeRestDay",
              from: "2025-08-17",
              to: "2025-08-17",
            },
          ],
          {
            thirdPartyPayments: [
              { kind: "medicalInsurance", agorot: 32559, paidOn: "2025-08-15" },
              { kind: "medicalInsurance", agorot: 34816, paidOn: "2025-08-15" },
            ],
          },
        ),
      ),
    );
    expect(view.reasons.length).toBeGreaterThanOrEqual(3);
    for (const reason of view.reasons) {
      expect(reason.message.length).toBeGreaterThan(0);
      expect(reason.law.label.length).toBeGreaterThan(0);
      expect(reason.law.url).toContain("kolzchut.org.il");
    }
  });
});

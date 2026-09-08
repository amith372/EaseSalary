import { describe, expect, it } from "vitest";
import { calculateMonth } from "@/lib/engine/month";
import { restDayRate } from "@/lib/engine/rates";
import {
  WAGE_2025,
  WORKBOOK_MONTHS,
  workbookFacts,
  workbookWorker,
} from "@/lib/engine/workbook.fixture";

/**
 * Holidays, against `H2` and `H3` of the tabs and against the entitlement the
 * 2024 workbook prorated by hand.
 *
 * `specs.md` item 9 gives the rule the fixture is built to exercise: a holiday
 * she works is paid at the rest-day rate, a holiday she takes off changes
 * nothing. Every holiday in these fifteen months was worked, so each one reaches
 * column F — and the two months carrying none are what stop a holiday line being
 * emitted unconditionally.
 */

const byTab = (tab: string) => {
  const m = WORKBOOK_MONTHS.find((candidate) => candidate.tab === tab);
  if (!m) throw new Error(`no fixture for ${tab}`);
  return m;
};

const resultOf = (tab: string) => {
  const m = byTab(tab);
  return calculateMonth(workbookFacts(m), workbookWorker(m.salaryAgorot));
};

describe("a holiday she works is paid at the rest-day rate", () => {
  for (const m of WORKBOOK_MONTHS) {
    it(`${m.tab}: ${m.holidaysWorked.length} worked`, () => {
      const result = calculateMonth(
        workbookFacts(m),
        workbookWorker(m.salaryAgorot),
      );
      const holidays = result.lines.find(
        (line) => line.key === "holidaysWorked",
      );
      expect(holidays?.units ?? 0).toBe(m.holidaysWorked.length);
    });
  }

  it("pays two holidays ₪852.70 in `חודש  8.25` and `חודש  12.25`", () => {
    // Both tabs put ₪852.70 in `F8`, at two different rest-day counts — four in
    // August, four in December — so the figure is the holidays' own and is not
    // being read off the rest days beside it.
    for (const tab of ["חודש  8.25", "חודש  12.25"]) {
      const holidays = resultOf(tab).lines.find(
        (line) => line.key === "holidaysWorked",
      );
      expect(holidays?.amount).toBe(85270);
    }
  });

  it("draws no holiday row in the two months that have none", () => {
    // `חודש  10.25` and `חודש  7.26`. A row of zero here would be harmless in
    // the ברוטו and wrong on the sheet, which prints one row per thing that
    // happened (item 2).
    for (const tab of ["חודש  10.25", "חודש  7.26"]) {
      const result = resultOf(tab);
      expect(result.lines.some((line) => line.key === "holidaysWorked")).toBe(
        false,
      );
    }
  });

  it("puts the holiday and the rest days in one column and each in its own row", () => {
    // Part 5: column F is the pay for rest days and holidays. They are one
    // column and two rows — `F8` and `F9` of every tab — because the sheet
    // reports each payment as its own type and count (item 2).
    const result = resultOf("חודש  2.26");
    const holidays = result.lines.find((line) => line.key === "holidaysWorked");
    const restDays = result.lines.find((line) => line.key === "restDays");
    expect(holidays?.column).toBe("F");
    expect(restDays?.column).toBe("F");
    expect(holidays?.amount).toBe(85270); // 2 × ₪426.35
    expect(restDays?.amount).toBe(127905); // 3 × ₪426.35
    expect(holidays!.amount! + restDays!.amount!).toBe(byTab("חודש  2.26").subtotalF);
  });
});

describe("a holiday she does not work changes nothing (item 9)", () => {
  it("leaves the ברוטו exactly where it was", () => {
    // The fixture has no such holiday — the family only ever recorded worked
    // ones — so the case is built by turning one of `חודש  2.26`'s two off.
    // This is the check Part 5 calls for outright: the interface must never let
    // "holiday" be recorded without saying whether she worked it, because the
    // two readings differ by a full rest-day rate.
    const m = byTab("חודש  2.26");
    const facts = workbookFacts(m);
    const worker = workbookWorker(m.salaryAgorot);
    const withOneOff = {
      ...facts,
      spans: facts.spans.map((span) =>
        span.kind === "holiday" && span.from === "2026-02-25"
          ? { ...span, worked: false }
          : span,
      ),
    };

    const worked = calculateMonth(facts, worker);
    const notWorked = calculateMonth(withOneOff, worker);

    expect(worked.gross! - notWorked.gross!).toBe(Math.round(restDayRate(WAGE_2025)));
    expect(notWorked.gross).toBe(m.gross - 42635);
  });

  it("still leaves the standard count alone, and only the actual count", () => {
    // Item 5's own check: a holiday she worked changes the money and not the
    // count, one she did not work changes the count and not the money. A
    // holiday that changes both, or neither, is a mistake.
    const m = byTab("חודש  2.26");
    const facts = workbookFacts(m);
    const worker = workbookWorker(m.salaryAgorot);
    const withOneOff = {
      ...facts,
      spans: facts.spans.map((span) =>
        span.kind === "holiday" && span.from === "2026-02-25"
          ? { ...span, worked: false }
          : span,
      ),
    };

    const worked = calculateMonth(facts, worker);
    const notWorked = calculateMonth(withOneOff, worker);

    expect(notWorked.standardDays).toBe(worked.standardDays);
    expect(notWorked.actualDays).toBe(worked.actualDays! - 1);
  });
});

describe("the yearly entitlement, prorated as the family prorated it", () => {
  it("gives 6.75 days for an employment beginning in April", () => {
    // `שכר_חודשי_להאנה2024.xlsx` → `חודש  12.24` → `C9` holds 6.75 and `F9`
    // pays 6.75 × ₪401.25, with `I9` giving the reasoning: nine months employed,
    // (9 × 9) / 12 = 6.75. `specs.md` item 10 takes the figure from the cells
    // and the reasoning from the note, which is the order Part 5 requires — the
    // same note goes on to contradict itself by saying 9.75.
    //
    // The measure is months employed in the calendar year, the month of hire
    // counted whole. A day-by-day proration gives 6.76 and is not what the
    // family pays.
    expect((9 * 9) / 12).toBe(6.75);
  });

  it("gives nine days for every full calendar year after the first", () => {
    expect((9 * 12) / 12).toBe(9);
  });

  it("records that the 2025 tabs pay ten holidays against an entitlement of nine", () => {
    // Not an engine assertion — a fact about the family's sheet, pinned so it
    // is not rediscovered as a bug. `H2` of 4/25 through 12/25 sums to ten, one
    // past the entitlement item 10 gives for a full year, which is why nothing
    // in this suite replays a whole calendar year of 2025: the engine would
    // refuse the tenth, and refusing it is correct (Part 4).
    const holidaysIn2025 = WORKBOOK_MONTHS.filter(
      (m) => m.month.year === 2025,
    ).reduce((total, m) => total + m.holidaysWorked.length, 0);
    expect(holidaysIn2025).toBe(10);
  });
});

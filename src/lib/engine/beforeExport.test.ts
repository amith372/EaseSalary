import { describe, expect, it } from "vitest";

import { SEEDED_RATES } from "@/lib/datedRates";
import {
  blocksExport,
  exportQuestionKeys,
  exportQuestions,
  openSickSpellOf,
  recuperationToConfirm,
  baseForMonth,
  reviewRecuperationRate,
  reviewReturnDate,
  reviewWageConfirmation,
  spellEndFromReturn,
} from "@/lib/engine/beforeExport";
import type { ExportQuestionKey } from "@/lib/engine/beforeExport";
import { snapshotTerms } from "@/lib/engine/types";
import type { MonthFacts, MonthSpan } from "@/lib/engine/types";
import {
  WORKBOOK_MONTHS,
  workbookFacts,
  workbookWorker,
} from "@/lib/engine/workbook.fixture";

/**
 * The questions that open an export, and the two confirmations beside them
 * (specs.md items 18, 4 and 15).
 *
 * **Every expected figure here comes from outside the code under test.**
 *
 *  - The questions and what each is asked about are `specs.md` item 18's own
 *    list: an advance given, an instalment repaid, a free rest day, the
 *    holidays worked, the sick days.
 *  - The two blocks are item 18 ("a month is not exported over an unanswered
 *    open spell") and item 21 ("it can only be exported once it has ended").
 *  - The day counts below are read off the dates written into each case by
 *    hand: 3.4 to 6.4 is four days, and 30.3 to 2.4 is two days of April.
 *  - The recuperation figures are the ones `recuperation.test.ts` already
 *    sources — six days for a second completed year, ₪451.50 from 1.7.2025.
 *  - The salary the wage refusal is judged against is the fixture worker's own.
 *
 * Nothing below reads a figure this module produced.
 */

/** Hanna as the workbook has her: employed 1.4.2024, resting on Saturday, and
 * paid her recuperation in March. */
const HANNA = "2024-04-01";

function facts(overrides: Partial<MonthFacts> = {}): MonthFacts {
  const july2026 = WORKBOOK_MONTHS[WORKBOOK_MONTHS.length - 1];
  const worker = workbookWorker(july2026.salaryAgorot);
  return {
    ...workbookFacts(
      { ...july2026, month: { year: 2026, month: 4 }, freeRestDays: [], advances: [] },
      worker,
    ),
    terms: snapshotTerms(worker),
    spans: [],
    advances: [],
    thirdPartyPayments: [],
    ...overrides,
  };
}

const EMPLOYMENT = {
  employedSince: HANNA,
  openingPosition: workbookWorker(0).openingPosition,
};

function answerFor(
  questions: ReturnType<typeof exportQuestions>,
  key: ExportQuestionKey,
) {
  const found = questions.find((question) => question.key === key);
  if (found === undefined) throw new Error(`no question ${key}`);
  return found;
}

describe("the questions that open an export", () => {
  /**
   * Item 18 names the things that change a month and the screen gates its
   * button on having an answer for every one of them. A question dropped from
   * the list is a thing that would then be left out by silence — which is the
   * whole of what this list is for — and it would leave nothing on screen to
   * say so.
   */
  it("asks about everything item 18 names, once each", () => {
    const asked = exportQuestions(facts()).map((question) => question.key);
    expect(asked).toEqual([...exportQuestionKeys]);
    expect(new Set(asked).size).toBe(asked.length);
  });

  /**
   * The half that makes a question a confirmation rather than a memory test: a
   * month with nothing recorded still answers, and answers "no". A question
   * that arrived without what the month knows would be asking the user to
   * recall her own April.
   */
  it("says what the month holds even when it holds nothing", () => {
    const questions = exportQuestions(facts());
    for (const question of questions) {
      expect(question.recorded).toBe(false);
    }
    expect(answerFor(questions, "sickDays").counts.days).toBe(0);
    expect(answerFor(questions, "advanceGranted").counts.agorot).toBe(0);
  });

  it("reports the advance given and the instalment repaid separately", () => {
    const questions = exportQuestions(
      facts({
        advances: [
          { number: 1, kind: "granted", agorot: 300000 },
          { number: 2, kind: "repaid", agorot: 100000 },
        ],
      }),
    );
    expect(answerFor(questions, "advanceGranted").recorded).toBe(true);
    expect(answerFor(questions, "advanceGranted").counts.agorot).toBe(300000);
    expect(answerFor(questions, "advanceRepaid").recorded).toBe(true);
    expect(answerFor(questions, "advanceRepaid").counts.agorot).toBe(100000);
  });

  /**
   * A month may do both halves of the advance, and one question answering for
   * both would tell the user "yes" about a month that only repaid — the case
   * item 20 keeps on two separate lines.
   */
  it("does not answer one half of the advance out of the other", () => {
    const questions = exportQuestions(
      facts({ advances: [{ number: 1, kind: "repaid", agorot: 100000 }] }),
    );
    expect(answerFor(questions, "advanceGranted").recorded).toBe(false);
    expect(answerFor(questions, "advanceRepaid").recorded).toBe(true);
  });

  it("counts the sick days marked in the month", () => {
    // 3.4 to 6.4 inclusive is four days, counted by hand off the calendar.
    const spans: MonthSpan[] = [
      { id: "s", kind: "sick", from: "2026-04-03", to: "2026-04-06" },
    ];
    const questions = exportQuestions(facts({ spans }));
    expect(answerFor(questions, "sickDays").recorded).toBe(true);
    expect(answerFor(questions, "sickDays").counts.days).toBe(4);
  });

  /**
   * A spell belongs to the worker and reaches both months whole (Part 3), so
   * the question has to report *this* month's share of it. 30.3 to 2.4 is four
   * days and two of them are April's; answering "four" would be the
   * neighbouring month's days confirmed as this one's, which is a figure a user
   * agrees to without noticing.
   */
  it("counts only the part of a crossing spell that falls in the month", () => {
    const spans: MonthSpan[] = [
      { id: "s", kind: "sick", from: "2026-03-30", to: "2026-04-02" },
    ];
    expect(
      answerFor(exportQuestions(facts({ spans })), "sickDays").counts.days,
    ).toBe(2);
    expect(
      answerFor(
        exportQuestions(facts({ spans, month: { year: 2026, month: 3 } })),
        "sickDays",
      ).counts.days,
    ).toBe(2);
  });

  it("reports the holidays falling in the month and the ones she worked", () => {
    const spans: MonthSpan[] = [
      { id: "h1", kind: "holiday", from: "2026-04-03", to: "2026-04-03", worked: true },
      { id: "h2", kind: "holiday", from: "2026-04-09", to: "2026-04-09", worked: false },
    ];
    const question = answerFor(exportQuestions(facts({ spans })), "holidaysWorked");
    expect(question.counts.items).toBe(2);
    expect(question.counts.of).toBe(1);
    expect(question.recorded).toBe(true);
  });

  /** A month with holidays falling and none worked has nothing recorded about
   * working one, which is the answer the user is confirming. */
  it("records nothing about a holiday she did not work", () => {
    const spans: MonthSpan[] = [
      { id: "h", kind: "holiday", from: "2026-04-09", to: "2026-04-09", worked: false },
    ];
    const question = answerFor(exportQuestions(facts({ spans })), "holidaysWorked");
    expect(question.counts.items).toBe(1);
    expect(question.recorded).toBe(false);
  });

  it("counts the free rest days marked, and the payments to somebody else", () => {
    // 4.4.2026 is a Saturday, which is her own rest day.
    const spans: MonthSpan[] = [
      { id: "r", kind: "freeRestDay", from: "2026-04-04", to: "2026-04-04" },
    ];
    const questions = exportQuestions(
      facts({
        spans,
        thirdPartyPayments: [
          { kind: "medicalInsurance", agorot: 130000 },
          { kind: "licenceFee", agorot: 30000 },
        ],
      }),
    );
    expect(answerFor(questions, "freeRestDays").counts.days).toBe(1);
    expect(answerFor(questions, "thirdParty").counts.items).toBe(2);
    expect(answerFor(questions, "thirdParty").counts.agorot).toBe(160000);
  });

  /**
   * An open spell blocks the export, and the question about sickness is still
   * asked with a figure: a screen silent about the very thing it is blocking on
   * would leave the user with nothing to check the block against.
   */
  it("still reports sick days while the spell is open", () => {
    const spans: MonthSpan[] = [
      { id: "s", kind: "sick", from: "2026-04-03", to: null },
    ];
    const question = answerFor(
      exportQuestions(facts({ spans }), "2026-04-06"),
      "sickDays",
    );
    // Clipped at the 6th, so 3.4 to 6.4 is four days.
    expect(question.counts.days).toBe(4);
  });
});

describe("what stops a month being exported", () => {
  /** Item 21: a future month may be filled in ahead of time and may only be
   * exported once it has ended. */
  it("refuses a month that has not ended, and allows it the day after", () => {
    const april = facts();
    expect(blocksExport(april, "2026-04-30")).toContain("monthNotEnded");
    expect(blocksExport(april, "2026-05-01")).not.toContain("monthNotEnded");
  });

  /** Item 18: the one thing an open spell can get wrong is counting days for a
   * worker who was already back. */
  it("refuses a month carrying a spell with no end", () => {
    const open = facts({
      spans: [{ id: "s", kind: "sick", from: "2026-04-03", to: null }],
    });
    expect(blocksExport(open, "2026-05-01")).toEqual(["openSickSpell"]);
    expect(openSickSpellOf(open)).toEqual({ spanId: "s", from: "2026-04-03" });
  });

  /**
   * A spell nobody closed goes on drawing sick days month after month, so it
   * blocks every month it reaches and not only the one it began in — which is
   * exactly the case an unclosed spell produces.
   */
  it("refuses every later month the open spell reaches", () => {
    const spans: MonthSpan[] = [
      { id: "s", kind: "sick", from: "2026-03-30", to: null },
    ];
    expect(
      blocksExport(facts({ spans, month: { year: 2026, month: 6 } }), "2026-07-01"),
    ).toContain("openSickSpell");
  });

  it("stops nothing in an ordinary finished month", () => {
    expect(blocksExport(facts(), "2026-05-01")).toEqual([]);
    expect(openSickSpellOf(facts())).toBeNull();
  });

  /** A closed spell is not an open one, however recently it ended. */
  it("does not read a closed spell as open", () => {
    const closed = facts({
      spans: [{ id: "s", kind: "sick", from: "2026-04-03", to: "2026-04-06" }],
    });
    expect(openSickSpellOf(closed)).toBeNull();
  });
});

describe("closing the spell by the day she came back", () => {
  /**
   * The user is asked the day she *returned*, which is the event the family
   * witnessed, and the spell ends the day before. Reading the answer as the
   * last sick day would pay one day of sickness too many and draw one day too
   * many from the balance — a figure that looks entirely ordinary.
   */
  it("ends the spell on the day before she returned", () => {
    expect(spellEndFromReturn("2026-04-07")).toBe("2026-04-06");
    // Across a month boundary, which is where an off-by-one would be hardest
    // to see: returning on the 1st ends the spell on the 31st.
    expect(spellEndFromReturn("2026-05-01")).toBe("2026-04-30");
  });

  it("refuses a return on or before the day the spell began", () => {
    expect(reviewReturnDate("2026-04-03", "2026-04-02")).toBe("beforeTheSpell");
    expect(reviewReturnDate("2026-04-03", "2026-04-03")).toBe("beforeTheSpell");
    expect(reviewReturnDate("2026-04-03", "2026-04-04")).toBeNull();
  });
});

describe("the two figures the month has to have confirmed", () => {
  /** Item 15: the rate is confirmed the way the minimum wage is, and only where
   * days are actually owed. */
  it("asks for a recuperation rate in the recuperation month and nowhere else", () => {
    const march = facts({ month: { year: 2026, month: 3 } });
    const owed = recuperationToConfirm(march, EMPLOYMENT, SEEDED_RATES);
    expect(owed?.days).toBe(6);
    expect(owed?.offeredAgorot).toBe(45150);
    expect(recuperationToConfirm(facts(), EMPLOYMENT, SEEDED_RATES)).toBeNull();
  });

  /** The month's own stored rate is offered back, so a month confirmed once and
   * opened again shows what it was valued at rather than today's figure. */
  it("offers back the rate the month already carries", () => {
    const march = facts({
      month: { year: 2026, month: 3 },
      recuperationDayRateAgorot: 41800,
    });
    expect(
      recuperationToConfirm(march, EMPLOYMENT, SEEDED_RATES)?.storedAgorot,
    ).toBe(41800);
  });

  /** `null` is an answer: the table begins in July 2025 and says nothing about
   * a month before it, so the user types the figure rather than being given a
   * guessed one. */
  it("offers no rate for a month the table begins after", () => {
    const march2025 = facts({ month: { year: 2025, month: 3 } });
    const owed = recuperationToConfirm(march2025, EMPLOYMENT, SEEDED_RATES);
    expect(owed?.days).toBe(5);
    expect(owed?.offeredAgorot).toBeNull();
  });

  /**
   * Item 3, and `ConfirmedWage`'s own note: a salary may sit above the minimum
   * wage and may never sit below it. The two figures below are the seeded
   * table's own minimum wages — ₪6,247.65 from 1.4.2025 and ₪6,443.85 from
   * 1.4.2026 — which is exactly the case the demo household is in, so a month
   * of 2026 for a worker still paid the 2025 figure is confirmed at the 2026
   * one. Settled with the user on 2026-09-09.
   *
   * What this catches is a month written that pays under its own confirmed
   * minimum, which would look entirely ordinary on the sheet.
   */
  it("raises a salary that has fallen below the minimum wage", () => {
    expect(baseForMonth(624765, 644385)).toBe(644385);
  });

  /** And leaves a salary the family agreed above the minimum exactly where it
   * is: the floor is all the statute settles, and how far above it she is paid
   * stays theirs (item 3). */
  it("leaves a salary above the minimum wage alone", () => {
    expect(baseForMonth(700000, 644385)).toBe(700000);
    expect(baseForMonth(624765, 624765)).toBe(624765);
  });

  it("refuses a wage or a day rate that is not a figure", () => {
    expect(reviewWageConfirmation(0)).toBe("amount");
    expect(reviewWageConfirmation(-1)).toBe("amount");
    expect(reviewWageConfirmation(644385)).toBeNull();
    expect(reviewRecuperationRate(0)).toBe("amount");
    expect(reviewRecuperationRate(45150)).toBeNull();
  });
});

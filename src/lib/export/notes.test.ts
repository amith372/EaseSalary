import { describe, expect, it } from "vitest";
import {
  plainAugustFacts,
  plainWorker,
} from "@/lib/engine/august-2025.fixture";
import { advanceKey } from "@/lib/engine/advances";
import { lineKeys } from "@/lib/engine/lines";
import { thirdPartyLineKey } from "@/lib/engine/thirdParty";
import type { MonthFacts, UserLine } from "@/lib/engine/types";
import { VACATION_NOTES_KEY, notesOf } from "@/lib/export/notes";

/**
 * The user's notes, gathered by the row each action's money lands on
 * (specs.md items 2 and 5).
 *
 * **What these would catch**: a note attached to the wrong row, which puts the
 * family's own words beside a figure they were not about; and a note dropped
 * because two actions reached one row, which loses something the user chose to
 * write and which nothing on the sheet would show as missing.
 */

const standing: UserLine = {
  id: "phone",
  label: "השתתפות בטלפון",
  direction: "deduction",
  placement: "beforeGross",
  agorot: 5000,
  note: "לפי ההסכם",
};

function facts(over: Partial<MonthFacts> = {}): MonthFacts {
  const worker = plainWorker();
  return { ...plainAugustFacts(worker), ...over };
}

describe("the notes the month's actions carry", () => {
  it("puts a note on the row the action's money reaches", () => {
    const notes = notesOf(
      facts({
        spans: [
          { id: "s", kind: "sick", from: "2025-08-04", to: "2025-08-06", note: "שפעת" },
          {
            id: "h",
            kind: "holiday",
            from: "2025-08-19",
            to: "2025-08-19",
            worked: true,
            note: "עבדה לבקשתנו",
          },
          { id: "v", kind: "vacation", from: "2025-08-11", to: "2025-08-12", note: "נסעה" },
        ],
        thirdPartyPayments: [
          { kind: "agencyFee", agorot: 12000, paidOn: "2025-08-15", note: "חויב באיחור" },
        ],
        advances: [],
      }),
    );

    expect(notes[lineKeys.sickDeduction]).toBe("שפעת");
    expect(notes[lineKeys.holidaysWorked]).toBe("עבדה לבקשתנו");
    // The vacation row has no engine line at all, because there is no vacation
    // payment (item 7), so its notes are addressed by a key of their own.
    expect(notes[VACATION_NOTES_KEY]).toBe("נסעה");
    expect(notes[thirdPartyLineKey("agencyFee")]).toBe("חויב באיחור");
  });

  it("joins two notes that reach one row rather than losing one", () => {
    // Two spells of sickness in a month are two notes on one deduction row. A
    // note the user wrote and the sheet dropped is worse than a crowded cell.
    const notes = notesOf(
      facts({
        spans: [
          { id: "a", kind: "sick", from: "2025-08-04", to: "2025-08-05", note: "שפעת" },
          { id: "b", kind: "sick", from: "2025-08-20", to: "2025-08-21", note: "שיניים" },
        ],
      }),
    );
    expect(notes[lineKeys.sickDeduction]).toBe("שפעת · שיניים");
  });

  it("addresses a standing line and a one-off line by their own prefixes", () => {
    const base = facts();
    const notes = notesOf({
      ...base,
      terms: { ...base.terms, standingLines: [standing] },
      userLines: [{ ...standing, id: "phone", note: "החודש בלבד" }],
    });
    // The same id under two prefixes, which is exactly what the prefixes exist
    // to keep apart (item 17).
    expect(notes["standing.phone"]).toBe("לפי ההסכם");
    expect(notes["extra.phone"]).toBe("החודש בלבד");
  });

  it("puts an override's note on the row whose amount it replaced", () => {
    // The mark says the figure is manual; only the note says why, and without
    // it the sheet carries a number that departs from the calculation with
    // nothing beside it.
    const notes = notesOf(
      facts({
        overrides: {
          [lineKeys.restDays]: { agorot: 50000, note: "סוכם בעל פה" },
        },
      }),
    );
    expect(notes[lineKeys.restDays]).toBe("סוכם בעל פה");
  });

  it("joins an override's note with the note the same row's action carried", () => {
    const notes = notesOf(
      facts({
        spans: [
          { id: "s", kind: "sick", from: "2025-08-04", to: "2025-08-05", note: "שפעת" },
        ],
        overrides: {
          [lineKeys.sickDeduction]: { agorot: 10000, note: "עיגול לפי ההסכם" },
        },
      }),
    );
    expect(notes[lineKeys.sickDeduction]).toBe("שפעת · עיגול לפי ההסכם");
  });

  it("puts the hospital overtime's note on its own row", () => {
    const notes = notesOf(
      facts({ hospitalOvertime: { agorot: 30000, note: "שני לילות בבית חולים" } }),
    );
    expect(notes[lineKeys.hospitalOvertime]).toBe("שני לילות בבית חולים");
  });

  /**
   * The day an advance was given reaches the sheet through `הערות` and never as
   * a column of its own, so the 2026 workbook's month tab keeps its structure
   * (specs.md item 20).
   *
   * **The two cases are the grant with a reason and the grant without one**, and
   * the date is said either way: it is added as a note of its own and joined by
   * the same separator two notes on one row are. The expected strings are written
   * out here rather than built from the module, so a date that stopped reaching
   * the column — or reached it in digits nobody can read in two countries — would
   * fail this.
   */
  it("puts the day an advance was given in the note column, beside the reason", () => {
    const notes = notesOf(
      facts({
        advances: [
          {
            number: 1,
            kind: "granted",
            agorot: 500000,
            givenOn: "2025-08-21",
            note: "לכרטיס טיסה",
          },
          { number: 2, kind: "granted", agorot: 100000, givenOn: "2025-08-03" },
        ],
      }),
    );

    expect(notes[advanceKey(1, "granted")]).toBe(
      "ניתנה ב-21 באוגוסט 2025 · לכרטיס טיסה",
    );
    expect(notes[advanceKey(2, "granted")]).toBe("ניתנה ב-3 באוגוסט 2025");
  });

  it("holds no key for an action that carried no note", () => {
    const notes = notesOf(
      facts({
        spans: [{ id: "s", kind: "sick", from: "2025-08-04", to: "2025-08-05" }],
        advances: [{ number: 1, kind: "repaid", agorot: 20000, note: "   " }],
      }),
    );
    // An empty note is not a note: writing one would put a blank string into a
    // cell the plain version hides, which reads as a note nobody can find.
    expect(Object.keys(notes)).toEqual([]);
  });
});

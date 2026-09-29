import { describe, expect, it } from "vitest";
import { genders } from "@/lib/engine/types";
import type { Gender } from "@/lib/engine/types";
import { he, workerWords } from "@/lib/i18n/he";

/**
 * Every screen sentence that names the worker agrees with the worker.
 *
 * **The defect this exists to catch is the one the family cannot correct.** A
 * sentence written once as "בדף שלה" reads as broken Hebrew for every man the
 * application serves, and nothing about it looks like a bug: the screen
 * renders, the flow completes and the wrong word sits in the middle of a
 * correct paragraph. `specs.md` Part 3 already requires it of the exported
 * sheet — "so a sheet never calls a man a woman" — and these are the screens
 * saying the same thing before the sheet does.
 *
 * **The expected words come from Hebrew grammar and not from the code.** Each
 * is a masculine/feminine pair written out by hand, which is the only source
 * there is for wording: reading them back off `WORKER_WORDS` would assert that
 * the table equals itself and would pass on the day a form in it is wrong.
 */
describe("the worker's own words", () => {
  /** Written out rather than derived, as `WORKER_WORDS` itself is: Hebrew
   * inflects a verb in more than its ending, so a suffix rule would be wrong
   * for half of these. */
  const expected = {
    female: {
      hers: "שלה",
      toHer: "לה",
      role: "עובדת",
      roleDefinite: "העובדת",
      worked: "עבדה",
      thatWorked: "שעבדה",
      entitled: "זכאית",
      returned: "חזרה",
    },
    male: {
      hers: "שלו",
      toHer: "לו",
      role: "עובד",
      roleDefinite: "העובד",
      worked: "עבד",
      thatWorked: "שעבד",
      entitled: "זכאי",
      returned: "חזר",
    },
  } as const;

  it.each(genders)("are written out for %s", (gender) => {
    expect(workerWords(gender)).toEqual(expected[gender]);
  });

  /**
   * **The sheet and the screens draw on one table** (`CLAUDE.md` rule 12's
   * argument, applied to words rather than to figures). The export's four
   * placeholders and the screens' sentences describing the same person are one
   * calculation shown twice, and two tables would be two places for a man to
   * become a woman in — the half nobody would check being whichever half the
   * change did not touch.
   */
  it.each(genders)("reach the exported sheet unchanged for %s", (gender) => {
    const tokens = he.sheet.genderTokens(gender);
    expect(tokens.worker_role).toBe(expected[gender].role);
    expect(tokens.worker_definite).toBe(expected[gender].roleDefinite);
    expect(tokens.worked).toBe(expected[gender].thatWorked);
  });
});

/**
 * The sentences themselves, as a man and as a woman reads them.
 *
 * **Each is asserted whole and not by a substring**, because the failure being
 * guarded against is a single word inside an otherwise correct paragraph: a
 * test looking only for "שלו" would pass on a sentence that said "שלו" once
 * and "שלה" twice more, which is exactly what a half-finished edit produces.
 */
describe("the screens that name her", () => {
  /** The confirmation step of the add-worker wizard — the four sentences a
   * family meets immediately after saying which she is. */
  const done = he.addWorker.done;

  it("ends the wizard in the gender the wizard just collected", () => {
    expect(done.lead("male")).toBe("שמרנו את הפרטים. אפשר לשנות כל דבר בדף שלו.");
    expect(done.lead("female")).toBe(
      "שמרנו את הפרטים. אפשר לשנות כל דבר בדף שלה.",
    );

    expect(done.toWorker("male")).toBe("לדף שלו");
    expect(done.toWorker("female")).toBe("לדף שלה");

    expect(done.steps("male")).toEqual([
      "החודש הראשון שלו כבר מחכה בדף הבית — אפשר להתחיל לסמן בלוח.",
      "יתרות החופשה והמחלה מתעדכנות מכאן בכל חודש, לפי הוותק שלו.",
      "מספרי הדרכון והאשרה, התאריכים שלהם והמצב שממנו התחלנו — אפשר להוסיף ולתקן בדף שלו.",
    ]);
  });

  it("asks the calendar's holiday question in her gender", () => {
    expect(he.calendar.holiday.question("male")).toBe("עבד בחג?");
    expect(he.calendar.holiday.question("female")).toBe("עבדה בחג?");
    expect(he.calendar.holiday.yes("male")).toBe("כן, עבד");
    expect(he.calendar.holiday.no("male")).toBe("לא עבד");
    expect(he.calendar.holiday.yes("female")).toBe("כן, עבדה");
    expect(he.calendar.holiday.no("female")).toBe("לא עבדה");
  });

  it("asks about an open spell of sickness in her gender", () => {
    expect(he.beforeExport.openSpell.ask("male")).toBe(
      "האם העובד חזר לעבודה, ובאיזה יום?",
    );
    expect(he.beforeExport.openSpell.ask("female")).toBe(
      "האם העובדת חזרה לעבודה, ובאיזה יום?",
    );
  });

  /**
   * **A sweep over every sentence that takes a gender**, so a sentence added
   * later is covered without anyone remembering to add it here. The named
   * cases above say what the words should be; this one says only that no
   * feminine form survives into a man's copy, which is the failure itself.
   *
   * The feminine forms are listed rather than pattern-matched: "שלה" ends a
   * great many correct masculine sentences as a possessive of a feminine noun
   * — "היתרה שלה" of a balance — so the list holds only the forms that can
   * *only* describe a person.
   */
  const feminineOnly = ["עבדה", "העובדת", "זכאית", " חזרה", "לעובדת"];

  const sentencesFor = (gender: Gender): string[] => [
    he.addWorker.done.lead(gender),
    he.addWorker.done.toWorker(gender),
    ...he.addWorker.done.steps(gender),
    he.addWorker.when.opening.lead(gender),
    he.addWorker.when.opening.advancesHint(gender),
    he.addWorker.pay.automaticNote(gender),
    he.calendar.holiday.question(gender),
    he.calendar.holiday.yes(gender),
    he.calendar.holiday.no(gender),
    he.beforeExport.openSpell.ask(gender),
    he.beforeExport.openSpell.note(gender),
    he.beforeExport.wage.raised(600000, 620000, gender),
    he.holidays.add.amendment.hint(gender),
    he.month.actions.lines.standing(gender),
    he.month.actions.incomeTax.ruleNone(gender),
    he.month.actions.incomeTax.rulePercentage("2.5", gender),
    he.workers.profile.terms.employedSince.hint(gender),
    he.workers.profile.terms.employedSince.afterFirstMonth.after(gender),
    he.workers.profile.terms.restEveSupplement.hint(gender),
    he.sheet.warnings.recuperationRateMissing(7, gender),
  ];

  it("never calls a man a woman", () => {
    for (const sentence of sentencesFor("male")) {
      for (const feminine of feminineOnly) {
        expect(sentence).not.toContain(feminine);
      }
    }
  });

  /** The other half of the same guard: a sentence that inflects nothing would
   * pass the test above by saying the masculine form to everybody. */
  it("says something different to a woman", () => {
    const male = sentencesFor("male");
    const female = sentencesFor("female");
    expect(female).toHaveLength(male.length);
    for (const [at, sentence] of male.entries()) {
      expect(sentence).not.toBe(female[at]);
    }
  });
});

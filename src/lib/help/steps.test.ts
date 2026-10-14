import { describe, expect, it } from "vitest";

import { HELP_TOPICS, stepsOf, type TopicId } from "@/lib/help/topics";
import { SATURDAY } from "@/lib/dates";
import { he } from "@/lib/i18n/he";

/**
 * The step lists, held to the controls they name (specs.md item 24).
 *
 * **Every expected string below is read off the control's own key** and never
 * off the step that quotes it (`CLAUDE.md` rule 11). That is the whole of what
 * this file proves: a step may quote a control, and may not retype it. A step
 * that spelled `חצי יום` out as text would pass a test comparing it with
 * itself and would go stale silently the day the button was renamed — here it
 * fails, because the string it must equal comes from the button.
 *
 * **What it cannot prove is that the control is on the screen**; that is
 * `e2e/help.spec.ts`'s half, where a control with the quoted accessible name
 * is looked for on the screen the steps name.
 */

/** Every label a step is allowed to quote: the controls, as `he.ts` writes
 * them. A step quoting anything else is a step that invented a label. */
const CONTROL_LABELS: readonly string[] = [
  he.calendar.picker.title,
  he.calendar.picker.more.withPart,
  he.calendar.picker.part.label,
  he.calendar.picker.part.half,
  he.calendar.marks(SATURDAY).vacation,
  he.month.actions.thirdParty.add,
  he.month.actions.thirdParty.kind,
  he.month.actions.thirdParty.amount,
  he.month.actions.thirdParty.period,
  he.month.actions.thirdParty.paidOn,
  he.month.actions.thirdParty.submit,
  he.sheet.thirdParty.nationalInsurance,
  he.month.actions.advances.grant,
  he.month.actions.advances.amount,
  he.month.actions.advances.givenOn,
  he.month.actions.advances.submitGrant,
  he.month.actions.advances.submitRepay,
  he.month.actions.lines.add,
  he.month.actions.lines.label,
  he.month.actions.lines.amount,
  he.month.actions.lines.direction.addition,
  he.month.actions.lines.direction.deduction,
  he.month.actions.lines.submit,
];

/** The labels one topic's steps quote, in the order the steps quote them. */
function quotedIn(topic: TopicId): string[] {
  return stepsOf(topic).flatMap((step) =>
    step.flatMap((part) => (typeof part === "string" ? [] : [part.value])),
  );
}

/** Which topics carry steps, which is a decision and not an accident: a gesture
 * of one press stays the one line it already is (item 24). */
const WITH_STEPS: TopicId[] = [
  "markHalfVacation",
  "addPayment",
  "addAdvance",
  "recordNationalInsurance",
];

describe("the topics that answer with presses", () => {
  it("gives steps to the four gestures that take more than one press", () => {
    const carrying = HELP_TOPICS.filter((topic) => stepsOf(topic.id).length > 0).map(
      (topic) => topic.id,
    );
    expect(carrying.sort()).toEqual([...WITH_STEPS].sort());
  });

  it("answers every other topic in its one line alone", () => {
    for (const topic of HELP_TOPICS) {
      if (WITH_STEPS.includes(topic.id)) continue;
      expect(stepsOf(topic.id), topic.id).toEqual([]);
    }
  });

  it("never draws a list of one step", () => {
    // A single numbered row is a sentence with a circle beside it.
    for (const id of WITH_STEPS) {
      expect(stepsOf(id).length, id).toBeGreaterThan(1);
    }
  });

  it("writes something in every step", () => {
    for (const id of WITH_STEPS) {
      for (const [index, step] of stepsOf(id).entries()) {
        const said = step
          .map((part) => (typeof part === "string" ? part : part.value))
          .join("");
        expect(said.trim(), `${id} step ${index + 1}`).not.toBe("");
      }
    }
  });
});

describe("the labels the steps name", () => {
  it("quotes only strings the controls themselves hold", () => {
    for (const id of WITH_STEPS) {
      for (const quoted of quotedIn(id)) {
        expect(CONTROL_LABELS, `${id} quotes ${quoted}`).toContain(quoted);
      }
    }
  });

  it("names, for the half day, the fold and the two presses behind it", () => {
    // The three the gesture cannot be performed without, and the one a
    // `where` line could never carry: the fold, the part, and the kind.
    const quoted = quotedIn("markHalfVacation");
    expect(quoted).toContain(he.calendar.picker.more.withPart);
    expect(quoted).toContain(he.calendar.picker.part.half);
    expect(quoted).toContain(he.calendar.marks(SATURDAY).vacation);
  });

  it("asks for the half before the kind, because the kind commits the mark", () => {
    // Item 7's order, and the reason a one-line answer could not carry this
    // gesture: a chip pressed first saves a whole day, and the half is then a
    // correction rather than what was asked for.
    const quoted = quotedIn("markHalfVacation");
    expect(quoted.indexOf(he.calendar.picker.part.half)).toBeLessThan(
      quoted.indexOf(he.calendar.marks(SATURDAY).vacation),
    );
  });

  it("names both ways in to a national-insurance payment, and the panel's fields", () => {
    const quoted = quotedIn("recordNationalInsurance");
    // The alert's own button and the section's say the same words, so the
    // label is quoted twice — once per way in (the user, 2026-10-14).
    expect(
      quoted.filter((label) => label === he.month.actions.thirdParty.add),
    ).toHaveLength(2);
    for (const field of [
      he.month.actions.thirdParty.kind,
      he.month.actions.thirdParty.amount,
      he.month.actions.thirdParty.period,
      he.month.actions.thirdParty.paidOn,
      he.month.actions.thirdParty.submit,
    ]) {
      expect(quoted).toContain(field);
    }
    expect(quoted).toContain(he.sheet.thirdParty.nationalInsurance);
  });

  it("names both gestures of the advances, the grant and the instalment", () => {
    // The one line already says there are two; the steps are what tells them
    // apart, and `לפרוע` is the half a family typing `קיזוז` came for.
    const quoted = quotedIn("addAdvance");
    expect(quoted).toContain(he.month.actions.advances.grant);
    expect(quoted).toContain(he.month.actions.advances.submitGrant);
    expect(quoted).toContain(he.month.actions.advances.submitRepay);
  });

  it("names the one-off line's button and its fields", () => {
    const quoted = quotedIn("addPayment");
    expect(quoted).toContain(he.month.actions.lines.add);
    expect(quoted).toContain(he.month.actions.lines.label);
    expect(quoted).toContain(he.month.actions.lines.submit);
  });

  it("names no worker, no month and no figure", () => {
    // Item 24: the list is account-blind, so a household with no worker in it
    // still gets every step.
    for (const id of WITH_STEPS) {
      for (const step of stepsOf(id)) {
        const said = step
          .map((part) => (typeof part === "string" ? part : part.value))
          .join("");
        expect(said, id).not.toMatch(/[0-9]/);
      }
    }
  });
});

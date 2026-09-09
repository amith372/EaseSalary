import { describe, expect, it } from "vitest";
import {
  orphanedOverrides,
  reviewOverride,
  withOverride,
  withoutOverride,
  type OverrideDraft,
} from "@/lib/engine/overrides";
import type { LineOverride } from "@/lib/engine/types";
import type { ClosingLine, MonthLine } from "@/lib/types";

/**
 * What the user may replace by hand, and what she may not (specs.md item 17).
 *
 * The expectations come from the criterion and never from the function: an
 * override addresses a figure the **application worked out** and an amount the
 * month itself recorded is edited instead; zero is an ordinary override where a
 * line the user adds refuses it; clearing is its own gesture; and an override
 * whose row the month no longer draws is still held and still listed.
 */

const line = (over: Partial<MonthLine> = {}): MonthLine => ({
  key: "restEveSupplement",
  label: "תוספת ערב מנוחה",
  amount: 40000,
  units: 4,
  rate: 10000,
  column: "E",
  manual: false,
  overridable: true,
  explanation: { text: "" },
  ...over,
});

const draft = (over: Partial<OverrideDraft> = {}): OverrideDraft => ({
  key: "restEveSupplement",
  amount: "380",
  note: "",
  ...over,
});

describe("an amount the application worked out", () => {
  it("takes the figure the user typed, and the row's own name with it", () => {
    const reviewed = reviewOverride(draft(), [line()]);
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    expect(reviewed.key).toBe("restEveSupplement");
    expect(reviewed.override).toEqual({
      agorot: 38000,
      label: "תוספת ערב מנוחה",
    });
  });

  /**
   * **Zero is an ordinary override, and this is where it parts company with a
   * line the user adds** (items 17, 20). A derived figure of zero is a real
   * answer — a month in which the family did not pay the rest-eve supplement —
   * and it is the only way to say so without pretending the row is absent.
   */
  it("accepts zero", () => {
    const reviewed = reviewOverride(draft({ amount: "0" }), [line()]);
    expect(reviewed.ok && reviewed.override.agorot).toBe(0);
  });

  /** An override is a magnitude and the row gives it its sign (item 17), so a
   * minus is refused rather than carried — `parseShekels` is where that
   * happens, and it is why a figure typed over the sickness deduction cannot
   * turn a deduction into a payment. */
  it("refuses a minus, and anything that is not a figure", () => {
    for (const amount of ["-380", "", "  ", "שלוש מאות"]) {
      expect(reviewOverride(draft({ amount }), [line()])).toEqual({
        ok: false,
        reason: "amount",
      });
    }
  });

  it("carries the reason where she gave one, and no key where she did not", () => {
    const withNote = reviewOverride(draft({ note: " סוכם אחרת " }), [line()]);
    expect(withNote.ok && withNote.override.note).toBe("סוכם אחרת");

    const without = reviewOverride(draft({ note: "   " }), [line()]);
    expect(without.ok && "note" in without.override).toBe(false);
  });
});

/**
 * The division item 17 draws, asked of the line the engine drew and never of a
 * list of keys: an amount **this month recorded** is edited in this month, and
 * an amount that reached this month from somewhere else is overridden in it.
 */
describe("an amount the month itself recorded", () => {
  it("is refused, because there is nothing under it to replace", () => {
    const oneOff = line({ key: "extra.a", label: "החזר", overridable: false });
    expect(reviewOverride(draft({ key: "extra.a" }), [oneOff])).toEqual({
      ok: false,
      reason: "notOverridable",
    });
  });

  it("is refused by the same sentence as a row this month does not draw", () => {
    expect(reviewOverride(draft({ key: "restDays" }), [line()])).toEqual({
      ok: false,
      reason: "notOverridable",
    });
  });
});

describe("putting an override on a month and taking it off", () => {
  const month = {
    overrides: {
      base: { agorot: 624765 },
      restDays: { agorot: 170540, label: "עבודה בשבת" },
    } satisfies Record<string, LineOverride>,
  };

  it("adds one without touching the others", () => {
    const after = withOverride(month, "sickDeduction", { agorot: 30000 });
    expect(after.overrides).toEqual({
      base: { agorot: 624765 },
      restDays: { agorot: 170540, label: "עבודה בשבת" },
      sickDeduction: { agorot: 30000 },
    });
    expect(Object.keys(month.overrides)).toHaveLength(2);
  });

  /**
   * **Clearing is its own gesture and never the typing back of the calculated
   * figure** (item 17). The two produce the same number and mean opposite
   * things: one leaves the row derived, the other stores that number by hand
   * and leaves it manual for ever, so a later correction to the wage would move
   * every figure on the sheet except that one.
   */
  it("takes one off and leaves the row derived again", () => {
    const after = withoutOverride(month, "base");
    expect(after.overrides).toEqual({
      restDays: { agorot: 170540, label: "עבודה בשבת" },
    });
  });

  /** An override whose row the month no longer draws is exactly the one that
   * most needs clearing, so clearing asks nothing about the key. */
  it("clears a key no row on the month answers to", () => {
    const after = withoutOverride(month, "restDays");
    expect("restDays" in after.overrides).toBe(false);
  });
});

/**
 * An override outlives the row it addresses, which is what "survives every
 * later recalculation" means — and it is therefore never stored out of sight
 * (item 17). An amount that is stored, will reappear, and cannot be seen is the
 * one failure in the criterion that looks like nothing went wrong.
 */
describe("an override whose row the month no longer draws", () => {
  const closing: ClosingLine[] = [
    {
      key: "advance.1.repaid",
      label: "מקדמה שנפרעה",
      amount: -20000,
      manual: false,
      block: "transfer",
      overridable: false,
      explanation: { text: "" },
    },
  ];

  it("is listed, with the name the row had when she typed the figure", () => {
    const orphans = orphanedOverrides(
      { lines: [line()], closing },
      {
        restEveSupplement: { agorot: 38000 },
        restDays: { agorot: 170540, label: "עבודה בשבת" },
      },
    );
    expect(orphans).toEqual([
      { key: "restDays", override: { agorot: 170540, label: "עבודה בשבת" } },
    ]);
  });

  /** The closing block reads overrides too and draws every row it holds one
   * for, so an amount over one of them is on screen — calling it invisible
   * would offer a clear button for a figure the user can already see. */
  it("does not count a row of the closing block as unseen", () => {
    const orphans = orphanedOverrides({ lines: [line()], closing }, {
      "advance.1.repaid": { agorot: 19000 },
    });
    expect(orphans).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  reviewUserLine,
  withoutOneOffUserLine,
  type UserLineDraft,
} from "@/lib/engine/userLines";
import { placementOf } from "@/lib/engine/types";
import type { UserLine } from "@/lib/engine/types";

/**
 * What the user may add to a month, and what she may not (specs.md item 20).
 *
 * The expectations come from the criterion and not from the function: a line
 * has three independent choices and every combination of them is meant, the
 * user never types a minus, and the reason travels with the line because it is
 * the part the application cannot derive.
 */

const draft = (over: Partial<UserLineDraft> = {}): UserLineDraft => ({
  label: "השלמה מחודש קודם",
  amount: "250",
  direction: "addition",
  placement: "beforeGross",
  note: "",
  ...over,
});

describe("a line the user adds", () => {
  it("keeps her own words and her own amount", () => {
    const reviewed = reviewUserLine(draft(), "line-1");
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    expect(reviewed.line).toEqual({
      id: "line-1",
      label: "השלמה מחודש קודם",
      direction: "addition",
      placement: "beforeGross",
      agorot: 25000,
    });
  });

  it("carries the reason where she gave one, and no key where she did not", () => {
    const withNote = reviewUserLine(draft({ note: " סוכם בעל פה " }), "l");
    expect(withNote.ok && withNote.line.note).toBe("סוכם בעל פה");

    const without = reviewUserLine(draft({ note: "   " }), "l");
    expect(without.ok && "note" in without.line).toBe(false);
  });

  /**
   * All four combinations are ordinary and the defaults are not rules
   * (item 20): a deduction placed before the total lowers what the month cost,
   * and an addition placed after it adds to the transfer alone.
   */
  it("takes every combination of direction and placement", () => {
    for (const direction of ["addition", "deduction"] as const) {
      for (const placement of ["beforeGross", "afterGross"] as const) {
        const reviewed = reviewUserLine(draft({ direction, placement }), "l");
        expect(reviewed.ok).toBe(true);
        if (!reviewed.ok) continue;
        expect(reviewed.line.direction).toBe(direction);
        expect(reviewed.line.placement).toBe(placement);
      }
    }
  });

  /**
   * The stored placement is what the user chose, even where it repeats the
   * default. A line saved without one would follow `placementOf`'s default if
   * that default were ever changed, which would move money the user had already
   * decided about.
   */
  it("stores the placement even where it equals the default", () => {
    const reviewed = reviewUserLine(
      draft({ direction: "deduction", placement: "afterGross" }),
      "l",
    );
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    expect(reviewed.line.placement).toBe("afterGross");
    expect(placementOf(reviewed.line)).toBe("afterGross");
  });

  it("keeps the amount positive and leaves the sign to the direction", () => {
    const reviewed = reviewUserLine(
      draft({ direction: "deduction", amount: "180" }),
      "l",
    );
    expect(reviewed.ok && reviewed.line.agorot).toBe(18000);
  });
});

describe("what is not a line", () => {
  it("refuses a line with no words on it", () => {
    expect(reviewUserLine(draft({ label: "   " }), "l")).toEqual({
      ok: false,
      reason: "label",
    });
  });

  it("refuses an amount that is not one", () => {
    for (const amount of ["", "  ", "abc", "-50"]) {
      expect(reviewUserLine(draft({ amount }), "l")).toEqual({
        ok: false,
        reason: "amount",
      });
    }
  });

  /** A line that moves no money is not a line she meant, and it would print in
   * the export as a payment of nothing (item 2). */
  it("refuses zero", () => {
    expect(reviewUserLine(draft({ amount: "0" }), "l")).toEqual({
      ok: false,
      reason: "amount",
    });
    expect(reviewUserLine(draft({ amount: "0.00" }), "l")).toEqual({
      ok: false,
      reason: "amount",
    });
  });

  /**
   * No chip can produce these. A server action is reachable by a crafted
   * request, so the two unions are checked rather than assumed from the form —
   * a stored `placement` outside the union would reach `placementOf`, fall
   * through to neither branch, and put the line in whichever half the engine's
   * filter happened to leave it in.
   */
  it("refuses a direction or a placement it does not recognise", () => {
    const bad = { direction: "refund" } as unknown as Partial<UserLineDraft>;
    expect(reviewUserLine(draft(bad), "l")).toEqual({
      ok: false,
      reason: "shape",
    });

    const alsoBad = { placement: "middle" } as unknown as Partial<UserLineDraft>;
    expect(reviewUserLine(draft(alsoBad), "l")).toEqual({
      ok: false,
      reason: "shape",
    });
  });
});

describe("a line removed", () => {
  const kept: UserLine = {
    id: "kept",
    label: "השלמה מחודש קודם",
    direction: "addition",
    agorot: 25000,
  };
  const going: UserLine = {
    id: "going",
    label: "השתתפות בנזק",
    direction: "deduction",
    agorot: 18000,
  };

  const month = {
    userLines: [kept, going],
    overrides: {
      "extra.going": { agorot: 20000 },
      "extra.kept": { agorot: 30000 },
      base: { agorot: 600000 },
    },
  };

  it("takes the line and leaves the others", () => {
    expect(withoutOneOffUserLine(month, "going").userLines).toEqual([kept]);
  });

  /**
   * The failure this exists to stop: an override outlives the line it was
   * typed for, and — because a stored override *replaces* the calculated
   * figure (specs.md item 17) — the next thing addressed by that key shows an
   * amount nobody entered for it, marked as manual.
   */
  it("takes the amount the user typed over it with it", () => {
    expect(withoutOneOffUserLine(month, "going").overrides).toEqual({
      "extra.kept": { agorot: 30000 },
      base: { agorot: 600000 },
    });
  });

  it("leaves an override on a line that is not being removed", () => {
    const after = withoutOneOffUserLine(month, "kept");
    expect(after.overrides["extra.going"]).toEqual({ agorot: 20000 });
    expect(after.overrides.base).toEqual({ agorot: 600000 });
  });

  it("changes nothing when the line is not there", () => {
    expect(withoutOneOffUserLine(month, "never-existed")).toEqual(month);
  });

  it("does not mutate the month it was given", () => {
    withoutOneOffUserLine(month, "going");
    expect(month.userLines).toHaveLength(2);
    expect(month.overrides["extra.going"]).toEqual({ agorot: 20000 });
  });
});

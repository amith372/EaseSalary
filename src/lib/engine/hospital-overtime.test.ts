import { describe, expect, it } from "vitest";
import { lineKeys } from "@/lib/engine/lines";
import { calculateMonth } from "@/lib/engine/month";
import {
  plainAugustFacts,
  plainWorker,
} from "@/lib/engine/august-2025.fixture";
import type { MonthFacts } from "@/lib/engine/types";

/**
 * Hospital overtime is an amount typed, never worked out (specs.md item 20).
 *
 * **What these would catch**: the amount landing outside the one-off column,
 * so it misses the gross or lands in the salary; a line offered for override,
 * which would give a typed figure a second place to be typed; and a line drawn
 * in a month that recorded none.
 */
describe("hospital overtime (specs.md item 20)", () => {
  const worker = plainWorker();
  const bare = calculateMonth(plainAugustFacts(worker), worker);
  const facts: MonthFacts = {
    ...plainAugustFacts(worker),
    hospitalOvertime: { agorot: 35000, note: "שלושה לילות" },
  };
  const result = calculateMonth(facts, worker);
  const line = result.lines.find((l) => l.key === lineKeys.hospitalOvertime);

  it("is one line in column G at exactly the amount typed", () => {
    expect(line?.column).toBe("G");
    expect(line?.amount).toBe(35000);
    expect(line?.units).toBe(1);
  });

  it("adds exactly that amount to the gross and the net", () => {
    // ₪350 more, by definition of a line that reaches the worker.
    expect(result.gross).toBe((bare.gross ?? 0) + 35000);
    expect(result.net).toBe((bare.net ?? 0) + 35000);
  });

  it("is not overridable, and its explanation carries the note and the rule's link", () => {
    expect(line?.overridable).toBe(false);
    expect(line?.explanation.link).toBe("hospitalOvertime");
    expect(line?.explanation.text).toContain("שלושה לילות");
  });

  it("draws no line in a month that recorded none", () => {
    expect(
      bare.lines.find((l) => l.key === lineKeys.hospitalOvertime),
    ).toBeUndefined();
  });
});

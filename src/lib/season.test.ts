import { describe, expect, it } from "vitest";
import { seasonOf, type Season } from "@/lib/season";

/**
 * The mapping the user settled on 2026-09-27, month by month, and not a
 * restatement of what `seasonOf` does: Israel's long summer runs June to
 * September, so autumn is October and November alone (`DESIGN.md`).
 *
 * All twelve are listed because the rule has four boundaries and every one of
 * them is a month somebody's calendar opens on.
 */
const expected: Record<number, Season> = {
  1: "winter",
  2: "winter",
  3: "spring",
  4: "spring",
  5: "spring",
  6: "summer",
  7: "summer",
  8: "summer",
  9: "summer",
  10: "autumn",
  11: "autumn",
  12: "winter",
};

describe("seasonOf", () => {
  it.each(Object.entries(expected))("gives %s the right scene", (month, season) => {
    expect(seasonOf({ year: 2026, month: Number(month) })).toBe(season);
  });

  it("names the four months the user drew a band for", () => {
    // The mockups themselves: אוגוסט 2025, אוקטובר 2025, דצמבר 2025, אפריל 2025.
    expect(seasonOf({ year: 2025, month: 8 })).toBe("summer");
    expect(seasonOf({ year: 2025, month: 10 })).toBe("autumn");
    expect(seasonOf({ year: 2025, month: 12 })).toBe("winter");
    expect(seasonOf({ year: 2025, month: 4 })).toBe("spring");
  });

  it("does not read the year", () => {
    expect(seasonOf({ year: 1999, month: 9 })).toBe(seasonOf({ year: 2030, month: 9 }));
  });
});

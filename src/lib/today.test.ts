import { describe, expect, it } from "vitest";
import { instantFor, todayFor, todayInIsrael } from "./today";

// 18 September 2026 at 22:30 UTC is already the 19th in Israel (UTC+3 in
// summer), so the clock's answer is told apart from a fixed "2026-09-18".
const NOW = new Date("2026-09-18T22:30:00Z");

describe("todayFor", () => {
  it("reads the clock in Israel when no day is fixed", () => {
    expect(todayFor(undefined, false, NOW)).toBe("2026-09-19");
  });

  it("returns the fixed day outside production", () => {
    expect(todayFor("2026-12-03", false, NOW)).toBe("2026-12-03");
  });

  it("ignores the fixed day in production", () => {
    expect(todayFor("2026-12-03", true, NOW)).toBe("2026-09-19");
  });

  it.each(["2026-9-18", "2026-02-30", "tomorrow", ""])(
    "raises on %j rather than falling back to the clock",
    (fixed) => {
      expect(() => todayFor(fixed, false, NOW)).toThrow();
    },
  );
});

describe("instantFor", () => {
  it("is the clock itself when no day is fixed", () => {
    expect(instantFor(undefined, false, NOW)).toBe("2026-09-18T22:30:00.000Z");
  });

  // Israel reads the 19th, so a fixed 17th is two days back at the same time:
  // 22:30 UTC on the 16th, which Israel reads as 01:30 on the 17th.
  it("moves the clock by whole days onto the fixed day", () => {
    const instant = instantFor("2026-09-17", false, NOW);
    expect(instant).toBe("2026-09-16T22:30:00.000Z");
    expect(todayInIsrael(new Date(instant))).toBe("2026-09-17");
  });

  it("ignores the fixed day in production", () => {
    expect(instantFor("2026-09-17", true, NOW)).toBe("2026-09-18T22:30:00.000Z");
  });

  it("raises on a fixed value that is not a date", () => {
    expect(() => instantFor("tomorrow", false, NOW)).toThrow();
  });
});

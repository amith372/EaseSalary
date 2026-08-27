import { describe, expect, it } from "vitest";
import { formatAgorot, formatDays } from "@/lib/money";

describe("formatAgorot", () => {
  it("writes the four totals of the August 2025 known case", () => {
    // specs.md Part 4. The figures are what the export must read to the agora;
    // this asserts only that the formatter writes them, not that the engine
    // arrives at them.
    expect(formatAgorot(674765)).toBe("6,747.65 ₪");
    expect(formatAgorot(255810)).toBe("2,558.10 ₪");
    expect(formatAgorot(930575)).toBe("9,305.75 ₪");
    expect(formatAgorot(730575)).toBe("7,305.75 ₪");
  });

  it("keeps two decimals, so a column of amounts lines up", () => {
    expect(formatAgorot(0)).toBe("0.00 ₪");
    expect(formatAgorot(5)).toBe("0.05 ₪");
    expect(formatAgorot(50)).toBe("0.50 ₪");
    expect(formatAgorot(100)).toBe("1.00 ₪");
  });

  it("groups thousands and millions", () => {
    expect(formatAgorot(100000)).toBe("1,000.00 ₪");
    expect(formatAgorot(100000000)).toBe("1,000,000.00 ₪");
    expect(formatAgorot(99999)).toBe("999.99 ₪");
  });

  it("marks a deduction with a leading minus and keeps its magnitude", () => {
    expect(formatAgorot(-200000)).toBe("-2,000.00 ₪");
    expect(formatAgorot(-5)).toBe("-0.05 ₪");
  });

  it("rounds to the nearest agora rather than truncating", () => {
    expect(formatAgorot(100.4)).toBe("1.00 ₪");
    expect(formatAgorot(100.5)).toBe("1.01 ₪");
  });
});

describe("formatDays", () => {
  it("writes a whole number without a decimal point", () => {
    expect(formatDays(14)).toBe("14");
    expect(formatDays(0)).toBe("0");
  });

  it("shows a remainder that is not a whole number", () => {
    // specs.md item 10: the holiday remainder is displayed even when it is not
    // a whole number, and the sick balance accrues at 1.5 a month.
    expect(formatDays(1.5)).toBe("1.50");
    expect(formatDays(8.25)).toBe("8.25");
  });

  it("keeps the accrual as a fraction rather than the workbook's 1.17", () => {
    // specs.md Part 5: rounding the monthly vacation accrual per month drifts a
    // hundredth of a day a year and stops tying out against the workbook.
    expect(formatDays(14 / 12)).toBe("1.17");
    expect(formatDays((14 / 12) * 12)).toBe("14");
  });
});

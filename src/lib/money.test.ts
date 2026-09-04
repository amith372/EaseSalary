import { describe, expect, it } from "vitest";
import { formatAgorot, formatDays, parseShekels } from "@/lib/money";

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

/**
 * `parseShekels` — the figure a user types, on its way into the calculation.
 *
 * **Every expectation below is derived from the rule and not from the
 * function** (CLAUDE.md): money is integer agorot, rounded to the nearest
 * agora, and never held as floating-point shekels. The rounding cases were
 * worked out on paper first, which is what makes the float case below a test
 * and not a transcription of what the code happens to do.
 */

describe("a whole figure", () => {
  it("reads shekels as a hundred agorot each", () => {
    expect(parseShekels("0")).toBe(0);
    expect(parseShekels("1")).toBe(100);
    expect(parseShekels("450")).toBe(45000);
  });

  it("takes both decimal places", () => {
    expect(parseShekels("450.00")).toBe(45000);
    expect(parseShekels("6247.65")).toBe(624765);
    // One place is tenths of a shekel and not hundredths: "1.5" is a shekel and
    // fifty agorot, which is the reading a user typing in a hurry means.
    expect(parseShekels("1.5")).toBe(150);
    expect(parseShekels(".5")).toBe(50);
  });
});

describe("the third decimal place", () => {
  /**
   * The case a float gets wrong, and the reason this function exists. The
   * nearest agora to 1.005 shekels is 100.5 rounded away from zero, which is
   * 101; the double nearest to 1.005 sits just below it, so the float path
   * gives 100 and loses an agora.
   *
   * **Which figures it gets wrong cannot be read off the decimal**, which is
   * the point: 12.345 comes out right through a float and 1.005 does not, so
   * there is no set of "careful" amounts to route around.
   */
  it("rounds half away from zero, where a float loses the agora", () => {
    expect(Math.round(Number("1.005") * 100)).toBe(100);
    expect(parseShekels("1.005")).toBe(101);

    expect(Math.round(Number("0.145") * 100)).toBe(14);
    expect(parseShekels("0.145")).toBe(15);

    // The one that reads as the dangerous case and is not.
    expect(parseShekels("12.345")).toBe(1235);
  });

  it("rounds down below half and up above it", () => {
    expect(parseShekels("75.494")).toBe(7549);
    expect(parseShekels("75.495")).toBe(7550);
    expect(parseShekels("75.496")).toBe(7550);
  });

  it("carries into the shekels when the agorot round up to a hundred", () => {
    expect(parseShekels("1.999")).toBe(200);
    expect(parseShekels("9.9999")).toBe(1000);
  });
});

describe("what a figure arrives wrapped in", () => {
  it("ignores the shekel sign, the separators and the spaces", () => {
    expect(parseShekels("6,247.65")).toBe(624765);
    expect(parseShekels(" 450.00 ₪ ")).toBe(45000);
    expect(parseShekels("1 234.5")).toBe(123450);
  });

  it("ignores the bidi controls a paste picks up on a right-to-left page", () => {
    expect(parseShekels("\u200f1,234.50\u200e")).toBe(123450);
    expect(parseShekels("\u2066450\u2069")).toBe(45000);
  });
});

describe("what is not a figure", () => {
  it("refuses an empty field, because it is a question unanswered", () => {
    expect(parseShekels("")).toBeNull();
    expect(parseShekels("   ")).toBeNull();
    expect(parseShekels(".")).toBeNull();
  });

  /**
   * Nothing asks the user to type a minus: a line's direction carries its sign
   * and an income tax is entered as what is withheld (specs.md items 17, 20).
   * A typed minus can only disagree with the label beside it, so it is refused
   * rather than quietly made positive.
   */
  it("refuses a minus rather than making it positive", () => {
    expect(parseShekels("-5")).toBeNull();
    expect(parseShekels("-0.01")).toBeNull();
  });

  it("refuses anything that is not digits and one point", () => {
    expect(parseShekels("abc")).toBeNull();
    expect(parseShekels("1.2.3")).toBeNull();
    expect(parseShekels("12e3")).toBeNull();
    expect(parseShekels("5%")).toBeNull();
  });
});

/**
 * The figure the user reads and the figure that comes back are the same one.
 * This belongs beside neither function: it is a test that two things *agree*,
 * and it would otherwise never be written (CLAUDE.md).
 */
describe("what is shown and what is read back", () => {
  it("round-trips every amount the application prints", () => {
    for (const agorot of [0, 1, 99, 100, 45000, 624765, 930575, 100000000]) {
      expect(parseShekels(formatAgorot(agorot))).toBe(agorot);
    }
  });
});

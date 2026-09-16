import { describe, expect, it } from "vitest";
import { partOfDay } from "./partOfDay";

// The boundaries are the user's (2026-09-16): each is checked on both sides, so
// an off-by-one hour at any of the four changes a greeting and fails here.
describe("partOfDay", () => {
  it.each([
    [4, "night"],
    [5, "morning"],
    [11, "morning"],
    [12, "noon"],
    [16, "noon"],
    [17, "evening"],
    [20, "evening"],
    [21, "night"],
    [0, "night"],
    [23, "night"],
  ] as const)("hour %i is %s", (hour, expected) => {
    expect(partOfDay(hour)).toBe(expected);
  });
});

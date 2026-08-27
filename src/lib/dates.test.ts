import { describe, expect, it } from "vitest";

// Placeholder: proves the Vitest harness runs. Real UTC month-arithmetic
// cases land with src/lib/dates.ts in Step 2.
describe("vitest harness", () => {
  it("builds dates in UTC", () => {
    expect(new Date(Date.UTC(2026, 7, 1)).getUTCDay()).toBe(6);
  });
});

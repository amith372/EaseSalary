import { describe, expect, it } from "vitest";
import { monthState } from "./monthState";

/**
 * The four states of Part 5, each asserted against the sentence that defines it
 * rather than against what the function returns.
 *
 * What these would catch: a month read as *corrected* from the moment it was
 * filed, because the two clocks that write the instants are a few milliseconds
 * apart; an export treated as an edit; and, the one that breaks criterion 13, a
 * correction to an exported month reported as still exported, which is how a
 * later month's balances would be left standing on a figure nobody moved.
 */
describe("the four states of a month", () => {
  const confirmedAt = "2026-08-31T21:00:00.000Z";

  it("is a draft while it only holds facts", () => {
    expect(monthState({})).toBe("draft");
    // Nothing else can outrank the absent confirmation: a month never confirmed
    // is a draft even where the store stamped an edit on it.
    expect(monthState({ updatedAt: "2026-09-02T08:00:00.000Z" })).toBe("draft");
  });

  it("is confirmed once the user has confirmed the wage against it", () => {
    expect(monthState({ confirmedAt, updatedAt: confirmedAt })).toBe(
      "confirmed",
    );
  });

  it("is confirmed and not corrected when the two instants differ in shape", () => {
    // Postgres returns `+00:00` where Node writes `Z`, and the same instant in
    // the two shapes orders wrongly when compared as text.
    expect(
      monthState({
        confirmedAt: "2026-08-31T21:00:00.000Z",
        updatedAt: "2026-08-31T21:00:00+00:00",
      }),
    ).toBe("confirmed");
  });

  it("is exported once a file has been produced from it", () => {
    expect(
      monthState({
        confirmedAt,
        updatedAt: confirmedAt,
        exportedAt: "2026-09-01T06:30:00.000Z",
      }),
    ).toBe("exported");
  });

  it("is corrected when a confirmed month's facts are then edited", () => {
    expect(
      monthState({ confirmedAt, updatedAt: "2026-09-03T10:15:00.000Z" }),
    ).toBe("corrected");
  });

  it("is corrected, and not exported, when an exported month is then edited", () => {
    // Exported is not the end of the line (criterion 13): the correction sends
    // the month back through confirmed and moves every later month with it.
    expect(
      monthState({
        confirmedAt,
        exportedAt: "2026-09-01T06:30:00.000Z",
        updatedAt: "2026-09-03T10:15:00.000Z",
      }),
    ).toBe("corrected");
  });
});

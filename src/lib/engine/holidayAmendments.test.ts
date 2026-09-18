import { describe, expect, it } from "vitest";
import { listInForce, reviewHolidayAmendment } from "./holidayAmendments";

/**
 * Item 10's amendment rule. Every expectation is read off the item's own
 * sentence — "freely until any month of that year has been confirmed", "the old
 * and the new date must both fall after that date and outside every confirmed
 * month", and "it records the date it was agreed on and a note" — and none from
 * what the function returned.
 */

const CONFIRMED = "2026-02-02T08:00:00.000Z";
const january = { month: { year: 2026, month: 1 }, confirmedAt: CONFIRMED };
const march = { month: { year: 2026, month: 3 }, confirmedAt: CONFIRMED };
const aprilDraft = { month: { year: 2026, month: 4 } };

describe("whether a move is an amendment", () => {
  it("is not, while no month of the year is confirmed", () => {
    expect(listInForce(2026, [aprilDraft])).toBe(false);
    expect(listInForce(2026, [])).toBe(false);
  });

  it("is, once any month of that year is confirmed", () => {
    expect(listInForce(2026, [january, aprilDraft])).toBe(true);
  });

  it("is judged per year: last year's confirmed December leaves this year free", () => {
    const december = { month: { year: 2025, month: 12 }, confirmedAt: CONFIRMED };
    expect(listInForce(2026, [december])).toBe(false);
    expect(listInForce(2025, [december])).toBe(true);
  });
});

describe("an amendment", () => {
  const months = [january, march, aprilDraft];
  const move = { from: "2026-05-01", to: "2026-05-15", agreedOn: "2026-04-20", note: "סוכם בעל פה" };

  it("is accepted with both dates after the agreement and outside confirmed months", () => {
    expect(reviewHolidayAmendment(move, months)).toEqual({ ok: true });
  });

  it("is refused when the holiday it moves falls before the agreement", () => {
    expect(reviewHolidayAmendment({ ...move, agreedOn: "2026-05-10" }, months)).toEqual({
      ok: false,
      reason: "agreedOn",
    });
  });

  it("is refused when a date falls on the agreement day itself — 'after' is strict", () => {
    expect(reviewHolidayAmendment({ ...move, agreedOn: "2026-05-01" }, months)).toEqual({
      ok: false,
      reason: "agreedOn",
    });
  });

  it("is refused when the holiday leaves a confirmed month", () => {
    // 10 March 2026 sits in March, which is confirmed: moving it away would
    // rewrite a month already filed.
    expect(
      reviewHolidayAmendment({ ...move, from: "2026-03-10", agreedOn: "2026-03-01" }, months),
    ).toEqual({ ok: false, reason: "confirmedMonth" });
  });

  it("is refused when the holiday lands in a confirmed month", () => {
    expect(
      reviewHolidayAmendment({ ...move, to: "2026-03-20", agreedOn: "2026-03-01" }, months),
    ).toEqual({ ok: false, reason: "confirmedMonth" });
  });

  it("may be agreed on a past day, when neither date touches a confirmed month", () => {
    // Settled with the user on 2026-09-18: the agreement may predate the day
    // it is recorded.
    expect(reviewHolidayAmendment({ ...move, agreedOn: "2026-04-01" }, months)).toEqual({
      ok: true,
    });
  });

  it("is refused without a note", () => {
    expect(reviewHolidayAmendment({ ...move, note: "  " }, months)).toEqual({
      ok: false,
      reason: "note",
    });
  });

  it("is refused with an agreed date that is not a real date", () => {
    expect(reviewHolidayAmendment({ ...move, agreedOn: "2026-02-30" }, months)).toEqual({
      ok: false,
      reason: "agreedOn",
    });
  });
});

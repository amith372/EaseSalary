import { describe, expect, it } from "vitest";
import { recordRequestHref, recordRequestOf } from "@/lib/recordRequest";

/**
 * The address an alert's button writes and the payments screen reads (specs.md
 * items 16, 27).
 *
 * **Every expectation here is the rule as item 27 states it and never what the
 * function returned** (`CLAUDE.md` rule 11). No money is involved: what is
 * being proved is that a crafted or stale address opens the screen as it opens
 * without one, rather than choosing a worker, a kind or a period on the user's
 * behalf.
 */

const HOUSEHOLD = [{ id: "w1" }, { id: "w2" }];

/** The link as `alertsView` builds it for a quarter in arrears, read back. */
const VALID = {
  record: "nationalInsurance",
  worker: "w2",
  from: "2026-04",
  to: "2026-06",
};

describe("recordRequestOf", () => {
  it("reads the worker, the kind and the quarter out of the link", () => {
    expect(recordRequestOf(VALID, HOUSEHOLD)).toEqual({
      kind: "nationalInsurance",
      workerId: "w2",
      from: { year: 2026, month: 4 },
      to: { year: 2026, month: 6 },
    });
  });

  it("refuses a kind that is not one of the sheet's own rows", () => {
    expect(recordRequestOf({ ...VALID, record: "pension" }, HOUSEHOLD)).toBeNull();
  });

  it("refuses a worker the household does not hold", () => {
    // The case a link outlives: the worker was removed, or the link was shared
    // between two accounts. Honouring it would scope the screen to somebody
    // else's months.
    expect(recordRequestOf({ ...VALID, worker: "w9" }, HOUSEHOLD)).toBeNull();
  });

  it("refuses a period whose months run backwards", () => {
    expect(
      recordRequestOf({ ...VALID, from: "2026-06", to: "2026-04" }, HOUSEHOLD),
    ).toBeNull();
  });

  it("takes a single month as a period of one", () => {
    // Not an error: a period of one month is a period, and item 16 lets the
    // user change either end to it.
    expect(recordRequestOf({ ...VALID, from: "2026-05", to: "2026-05" }, HOUSEHOLD)).toEqual({
      kind: "nationalInsurance",
      workerId: "w2",
      from: { year: 2026, month: 5 },
      to: { year: 2026, month: 5 },
    });
  });

  it("refuses half a period rather than completing it", () => {
    const half = { record: VALID.record, worker: VALID.worker, from: VALID.from };
    expect(recordRequestOf(half, HOUSEHOLD)).toBeNull();
    expect(recordRequestOf({ ...VALID, to: "" }, HOUSEHOLD)).toBeNull();
  });

  it("reads nothing out of an address that asks for nothing", () => {
    expect(recordRequestOf({}, HOUSEHOLD)).toBeNull();
    // The bare `/payments` every other alert still links to.
    expect(recordRequestOf({ month: "2026-08" }, HOUSEHOLD)).toBeNull();
  });

  it("refuses junk in any one of the four parameters", () => {
    expect(recordRequestOf({ ...VALID, record: "" }, HOUSEHOLD)).toBeNull();
    expect(recordRequestOf({ ...VALID, worker: "" }, HOUSEHOLD)).toBeNull();
    expect(recordRequestOf({ ...VALID, from: "April" }, HOUSEHOLD)).toBeNull();
    expect(recordRequestOf({ ...VALID, to: "2026-13" }, HOUSEHOLD)).toBeNull();
    expect(recordRequestOf({ ...VALID, from: "2026-6" }, HOUSEHOLD)).toBeNull();
  });

  it("takes the first of a parameter that arrives repeated", () => {
    // `?worker=w2&worker=w1` is a hand-edited address rather than one the
    // application wrote; the first value is taken, as the holiday picker's
    // `from` is, instead of refusing the whole link.
    expect(
      recordRequestOf({ ...VALID, worker: ["w2", "w1"] }, HOUSEHOLD),
    ).toMatchObject({ workerId: "w2" });
  });

  it("reads back what it writes", () => {
    // The one assertion that holds the two halves together: a spelling changed
    // in the link and not in the parser is a hand-off that silently carries
    // nothing (`CLAUDE.md` rule 12's reason, applied to an address).
    const request = {
      kind: "nationalInsurance" as const,
      workerId: "w1",
      from: { year: 2025, month: 10 },
      to: { year: 2025, month: 12 },
    };
    const href = recordRequestHref(request);
    expect(href.startsWith("/payments?")).toBe(true);
    const asked = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(recordRequestOf(asked, HOUSEHOLD)).toEqual(request);
  });
});

import { describe, expect, it } from "vitest";

import { documentDates } from "@/lib/documentDates";
import type { IsoDate } from "@/lib/types";

/**
 * The order the three documents are listed in, and what each row says
 * (`specs.md` item 28, `build_plan.md` stage 17 step 3).
 *
 * **Every figure below is arithmetic on the dates, done on paper against a
 * fixed today, and never read back from the function** (`CLAUDE.md` rule 11).
 * The two thresholds are `actionList.ts`'s own and are the reason the ordering
 * is not the obvious one: the permit and the visa are warned about sixty days
 * before they expire, and the passport while fewer than eighteen months remain
 * on it.
 *
 * Today is Friday 18 September 2026 throughout, so:
 *
 * - the permit and the visa need attention on their expiry **less sixty days**;
 * - the passport needs it on its expiry **less eighteen months**, which from
 *   this today is 17 March 2028 — the day before eighteen months are up.
 */

const TODAY: IsoDate = "2026-09-18";

describe("the three documents, in the order they will ask for something", () => {
  /**
   * **The case the whole ordering rule exists for.** Sorted by the date each
   * expires, this reads visa (31.3.2027), permit (30.6.2027), passport
   * (30.4.2028). Sorted by when each needs attention it reads the other way
   * round at both ends:
   *
   * - the passport is 44 days from its own threshold (17.3.2028 → 30.4.2028),
   * - the visa is 134 (17.11.2026 → 31.3.2027),
   * - the permit is 225 (17.11.2026 → 30.6.2027).
   *
   * So the passport comes **first** although it expires more than a year after
   * the other two, which is the whole point: renewing a passport from abroad is
   * the thing this family has to start on soonest.
   *
   * **What it would catch:** the list sorted by raw expiry, which is the
   * obvious implementation and ranks the passport last here — telling a family
   * the one document they should act on first is the one they can leave.
   */
  it("ranks a passport above documents that expire a year before it", () => {
    const rows = documentDates(
      {
        employmentPermitExpiry: "2027-06-30",
        workVisaExpiry: "2027-03-31",
        passportExpiry: "2028-04-30",
      },
      TODAY,
    );

    expect(rows.map((row) => row.document)).toEqual([
      "passport",
      "workVisa",
      "employmentPermit",
    ]);
    expect(rows.map((row) => row.state)).toEqual(["distant", "distant", "distant"]);
    // 18.9.2026 → 31.3.2027 is 194 days; → 30.6.2027 is 285.
    expect(rows.map((row) => row.daysLeft)).toEqual([null, 194, 285]);
  });

  /**
   * A date that has passed, a date nobody entered, and the boundary day.
   *
   * The visa lapsed on 1.9.2026, seventeen days before today. The passport
   * expires **today**, which is the day a document is still valid through
   * (`actionList.ts`: "a document is valid through its expiry date itself"), so
   * it is not expired — it is due, with nought days left. The permit has no
   * date at all.
   *
   * The passport sorts first because it has been past its own threshold for 546
   * days, where the visa has been past its for 77: by this list's one rule,
   * eighteen months overdue outranks seventeen days overdue.
   *
   * **What it would catch:** a negative day count anywhere, which is what a
   * past date produces unless it is caught; a blank where no date was entered,
   * which reads as a screen that failed to load; a document treated as expired
   * on the last day it is still valid; and a missing date sorted among the
   * real ones rather than after them.
   */
  it("says expired, says nothing entered, and counts no day backwards", () => {
    const rows = documentDates(
      {
        employmentPermitExpiry: null,
        workVisaExpiry: "2026-09-01",
        passportExpiry: TODAY,
      },
      TODAY,
    );

    expect(rows.map((row) => row.document)).toEqual([
      "passport",
      "workVisa",
      "employmentPermit",
    ]);
    expect(rows.map((row) => row.state)).toEqual(["due", "expired", "missing"]);
    expect(rows.map((row) => row.daysLeft)).toEqual([null, null, null]);
    for (const row of rows) expect(row.daysLeft ?? 0).toBeGreaterThanOrEqual(0);
  });

  /**
   * **The passport never carries a day count, in either state.** 31.1.2028 is
   * before the 17.3.2028 threshold, so it is due — and what the row says is
   * which side of its eighteen months it is on, not that 500 days remain.
   *
   * What it would catch: a day count on the passport, which beside the other
   * two reads as a list that failed to sort — 135 days there outranks 27 days
   * on a visa, correctly, and looks like a bug.
   */
  it("gives the passport no day count, inside its eighteen months or outside", () => {
    const inside = documentDates(
      { employmentPermitExpiry: null, workVisaExpiry: null, passportExpiry: "2028-01-31" },
      TODAY,
    )[0];
    expect(inside?.state).toBe("due");
    expect(inside?.daysLeft).toBeNull();

    const outside = documentDates(
      { employmentPermitExpiry: null, workVisaExpiry: null, passportExpiry: "2028-04-30" },
      TODAY,
    )[0];
    expect(outside?.state).toBe("distant");
    expect(outside?.daysLeft).toBeNull();
  });
});

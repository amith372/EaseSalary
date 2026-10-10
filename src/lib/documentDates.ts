import { compareIsoDate, daysBetween } from "@/lib/dates";
import { warnsIfExpiringBy } from "@/lib/engine/actionList";
import type { ExpiringDocument } from "@/lib/engine/actionList";
import type { IsoDate } from "@/lib/types";

/**
 * The three documents an employment rests on, with their expiry dates, in the
 * order they will ask something of the family (`specs.md` item 28).
 *
 * **Why they need a place of their own.** Two of the three reach the user only
 * as the fee they trigger — `upcoming.ts` dates the visa extension off
 * `workVisaExpiry` and the licence fee off `employmentPermitExpiry` — so "the
 * visa runs out in March" is readable as "visa fee, March" and nowhere as a
 * date. The passport triggers no fee at all and is thresholded at eighteen
 * months *remaining*, so it appears in no list until its warning fires. The
 * three existed together in one place only: a fold that is shut by default.
 *
 * **The order is how soon each needs attention, not when each expires**, and
 * for two of the three those are the same day. The passport's threshold is
 * eighteen months before its expiry, so a list sorted by raw date would put a
 * passport two months from needing action below a visa ten months from needing
 * anything — ordered by something nobody can act on. Every row still prints its
 * own expiry date, so the ordering hides nothing; it only ranks.
 *
 * `warnsIfExpiringBy` is the bell's own threshold, read rather than restated
 * (`actionList.ts` says why).
 *
 * **The medical insurance is not here.** Its cover is replayed from the
 * payments rather than typed on the profile, and item 28's three documents are
 * the three the profile holds.
 */

/** The three the profile carries. The medical insurance is not one of them. */
export type ProfileDocument = Extract<
  ExpiringDocument,
  "employmentPermit" | "workVisa" | "passport"
>;

/**
 * How a row reads, which is four states and not a number:
 *
 * - `missing` — nobody entered a date. It says so rather than drawing a blank,
 *   which reads as a screen that failed to load.
 * - `expired` — the date has passed. It says so rather than counting days
 *   backwards, which is where a negative number would otherwise appear.
 * - `due` — inside its own warning window.
 * - `distant` — above its threshold, with nothing to do yet.
 *
 * **The passport carries no day count in either state**, and the other two
 * always do. Its rule is in months, and a count beside the others' would read
 * as mis-sorted: a passport 135 days from expiring is 411 days *past* its own
 * threshold and belongs above a visa expiring in 27, but "in 135 days" over
 * "in 27 days" looks like a list that failed to sort. So it says which side of
 * its eighteen months it is on, which is the fact, and the two day counts
 * beneath it stay in the order they read in.
 */
export type DocumentDateState = "missing" | "expired" | "due" | "distant";

export interface DocumentDateRow {
  document: ProfileDocument;
  expiresOn: IsoDate | null;
  state: DocumentDateState;
  /** Days from today to the expiry. `null` with no date, on an expired one,
   * and on the passport, which says months in both its states. Never negative:
   * a past date is `expired`. */
  daysLeft: number | null;
}

const ORDER: ProfileDocument[] = ["employmentPermit", "workVisa", "passport"];

export function documentDates(
  documents: {
    employmentPermitExpiry: IsoDate | null;
    workVisaExpiry: IsoDate | null;
    passportExpiry: IsoDate | null;
  },
  today: IsoDate,
): DocumentDateRow[] {
  const expiry: Record<ProfileDocument, IsoDate | null> = {
    employmentPermit: documents.employmentPermitExpiry,
    workVisa: documents.workVisaExpiry,
    passport: documents.passportExpiry,
  };

  // **The key is days until this document needs attention**, which is days to
  // its expiry for the permit and the visa and days to eighteen months before
  // it for the passport. One number across all four states: already past is
  // negative and sorts first, inside the window is a small positive, years of
  // slack is a large one. A date nobody entered asks nothing of anybody, so it
  // sorts last whatever the others are doing.
  const untilItAsks = (document: ProfileDocument, on: IsoDate | null): number =>
    on === null
      ? Number.POSITIVE_INFINITY
      : daysBetween(warnsIfExpiringBy(document, today), on);

  return ORDER.map((document) => {
    const on = expiry[document];
    if (on === null) {
      return { document, expiresOn: null, state: "missing" as const, daysLeft: null };
    }
    if (compareIsoDate(on, today) < 0) {
      return { document, expiresOn: on, state: "expired" as const, daysLeft: null };
    }
    const within = untilItAsks(document, on) <= 0;
    return {
      document,
      expiresOn: on,
      state: within ? ("due" as const) : ("distant" as const),
      daysLeft: document === "passport" ? null : daysBetween(today, on),
    };
  }).sort(
    (a, b) =>
      untilItAsks(a.document, a.expiresOn) - untilItAsks(b.document, b.expiresOn),
  );
}

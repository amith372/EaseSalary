import { daysBetween, isIsoDate } from "@/lib/dates";
import type { IsoDate } from "@/lib/types";

/**
 * Today, read once on the server and handed down as a value.
 *
 * **Nothing else in the application reads a clock** (`CLAUDE.md`): the engine
 * takes `today` from its caller, and a component that read one during a render
 * would make the server and the browser disagree on a date and throw a
 * hydration mismatch. This is the single place the clock is read, and it is
 * read where there is only one of it — on the server, before anything is sent.
 *
 * **The zone is named rather than left to the machine.** "Today" is a local
 * fact, not a UTC one: a container running in UTC reads the 1st of September
 * for three hours after Israel has reached the 2nd, which would move an open
 * spell's last counted day and the month the calendar opens on. Building dates
 * *inside* a local zone is the mistake `CLAUDE.md` warns against — that is
 * about arithmetic over dates, and there is none here. This formats one instant
 * in one zone and hands back a plain calendar date, which the rest of the
 * application then works with in UTC as it always does.
 */

/** The employment is Israeli and so is every rule the application applies. */
const ZONE = "Asia/Jerusalem";

// "en-CA" is the locale whose short date format is already YYYY-MM-DD, so the
// date comes out in the application's own shape without being reassembled from
// parts.
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayInIsrael(now: Date = new Date()): IsoDate {
  return formatter.format(now);
}

/**
 * The cookie that fixes today for a request, so the browser suite reads the
 * same day whatever the machine's clock says. Its specs and its seed are
 * written against one day, and on any other the calendar opens on a different
 * month and a test either fails for no defect or passes having tested nothing.
 */
export const TODAY_COOKIE = "today";

/**
 * Today for a request: the fixed day its cookie names, or the clock.
 *
 * **Refused in production**, for the reason the `household` cookie is
 * (`store.ts`): anyone can set a cookie, and a user who set this one would move
 * which months are running and which exports are allowed.
 *
 * **A value that is not a real date raises** rather than falling back to the
 * clock. The cookie is only ever set by the browser suite, and falling back
 * would quietly put a spec back on the real date, which is the failure the
 * cookie exists to prevent.
 */
export function todayFor(
  fixed: string | undefined,
  production: boolean,
  now: Date = new Date(),
): IsoDate {
  if (fixed === undefined || production) return todayInIsrael(now);
  if (!isIsoDate(fixed)) {
    throw new Error(`The ${TODAY_COOKIE} cookie is not a date: ${fixed}`);
  }
  return fixed;
}

/**
 * The instant a month is stamped with — confirmed, exported — on the same day
 * `todayFor` reads: the clock, moved by whole days when the day is fixed.
 *
 * **A stamp follows the fixed day**, or the browser suite, whose day is fixed,
 * files an export "in the future" the moment the real clock passes it, and a
 * list bounded by today loses it. **The time of day stays the clock's**, because
 * Postgres stamps an edit with its own `now()` and *corrected* is
 * `updated_at > confirmed_at`: moving whole days keeps every stamp this request
 * writes in the order it was written.
 */
export function instantFor(
  fixed: string | undefined,
  production: boolean,
  now: Date = new Date(),
): string {
  const shift = daysBetween(todayInIsrael(now), todayFor(fixed, production, now));
  return new Date(now.getTime() + shift * 86_400_000).toISOString();
}

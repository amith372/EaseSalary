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

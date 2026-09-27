import type { YearMonth } from "@/lib/types";

/** The four scenes the home calendar's band is drawn in (`CalendarBand`). */
export type Season = "winter" | "spring" | "summer" | "autumn";

/**
 * The season a month falls in, on Israel's calendar rather than the
 * astronomical one: **summer runs June to September** and autumn is only
 * October and November, because September here is summer by any thermometer.
 * The other two keep the ordinary three months each.
 *
 * It reads the month the calendar is showing and never a clock (`CLAUDE.md`),
 * so a family opening March in July is shown spring.
 */
export function seasonOf({ month }: YearMonth): Season {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 9) return "summer";
  return "autumn";
}

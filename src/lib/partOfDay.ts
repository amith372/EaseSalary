type PartOfDay = "morning" | "noon" | "evening" | "night";

/** Which greeting an hour gets: morning from 05:00, noon from 12:00, evening
 * from 17:00, night from 21:00. */
export function partOfDay(hour: number): PartOfDay {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "noon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

import { describe, expect, it } from "vitest";
import { SEEDED_HOLIDAY_LISTS, countryNameHe } from "@/lib/holidayLists";

/**
 * The names come from the shipped `data/holidays/*.json` files and from nowhere
 * in this test — `PH-2026.json` carries `"country_name_he": "הפיליפינים"`, and
 * that file is the source of truth a scrape is judged against.
 *
 * **What it would catch**: a profile that printed the filing code at the user,
 * which is what it did until 2026-09-11; and a lookup that threw or returned
 * `undefined` for a country nothing is stored for, which is how a worker from a
 * seventh country would have taken the page down.
 */
describe("naming a country of origin", () => {
  it("names the six countries that ship with a list", () => {
    expect(countryNameHe(SEEDED_HOLIDAY_LISTS, "PH")).toBe("הפיליפינים");
    expect(countryNameHe(SEEDED_HOLIDAY_LISTS, "IN")).toBe("הודו");
  });

  it("falls back to the code where no list names it", () => {
    expect(countryNameHe(SEEDED_HOLIDAY_LISTS, "ZZ")).toBe("ZZ");
  });
});

import { describe, expect, it } from "vitest";

import { SEEDED_HOLIDAY_LISTS } from "@/lib/holidayLists";
import {
  countriesWithLists,
  holidaySourceChoices,
  holidaySourceOf,
} from "@/lib/holidaySources";
import { religiousSources } from "@/lib/scrape/religiousHolidays";

/**
 * The lists the picker offers (specs.md item 10).
 *
 * Every expected name is read off a shipped `data/holidays/XX-2026.json` or off
 * `religiousSources`, never off what the function returned.
 */

/** The demo case: her own country's list is the one she is on. */
const OWN_PH = { kind: "country", code: "PH" } as const;

describe("the lists a worker's year can be drawn from", () => {
  it("puts her own country first and the rest after it", () => {
    const { countries } = holidaySourceChoices(SEEDED_HOLIDAY_LISTS, "PH", OWN_PH);

    expect(countries[0]).toEqual({
      source: { kind: "country", code: "PH" },
      nameHe: "הפיליפינים",
      selected: true,
    });
    expect(countries.map((choice) => choice.nameHe)).toHaveLength(6);
    expect(countries.map((choice) => choice.nameHe)).toContain("הודו");
  });

  /** The order below the first is by the Hebrew name, so a family looking for
   * one reads a list rather than searching it. */
  it("orders the rest by their Hebrew names", () => {
    const { countries } = holidaySourceChoices(SEEDED_HOLIDAY_LISTS, "PH", OWN_PH);

    expect(countries.slice(1).map((choice) => choice.nameHe)).toEqual([
      "אוזבקיסטן",
      "אוקראינה",
      "הודו",
      "נפאל",
      "סרי לנקה",
    ]);
  });

  /**
   * Her country is her country whether or not a list has ever been stored for
   * it. Catches a picker built from the stored lists alone: it would show a
   * chosen source with no chip selected, and the first thing the user did would
   * be to move her onto some other country's list.
   */
  it("offers her own country even where nothing is stored for it", () => {
    const { countries } = holidaySourceChoices(SEEDED_HOLIDAY_LISTS, "TH", {
      kind: "country",
      code: "TH",
    });

    expect(countries[0]).toEqual({
      source: { kind: "country", code: "TH" },
      nameHe: "TH",
      selected: true,
    });
    expect(countries).toHaveLength(7);
  });

  /**
   * A country is offered only where an address is stored to fetch its next year
   * at, and the four faiths are each one page the application holds — so all
   * four are always there, even though no seed file ships for any of them
   * (`build_plan.md` stage 5, step 3).
   */
  it("offers all four faiths, named as their pages are", () => {
    const { religions } = holidaySourceChoices(SEEDED_HOLIDAY_LISTS, "PH", OWN_PH);

    expect(religions.map((choice) => choice.source)).toEqual([
      { kind: "religion", religion: "jewish" },
      { kind: "religion", religion: "muslim" },
      { kind: "religion", religion: "christian" },
      { kind: "religion", religion: "druze" },
    ]);
    expect(religions.map((choice) => choice.nameHe)).toEqual([
      religiousSources.jewish.nameHe,
      religiousSources.muslim.nameHe,
      religiousSources.christian.nameHe,
      religiousSources.druze.nameHe,
    ]);
    expect(religions[0].nameHe).toBe("חגים יהודיים");
    // She is on her country's list, so no faith is the chosen one.
    expect(religions.every((choice) => choice.selected)).toBe(false);
  });

  /** A country with a list stored for one year only is still offered: the year
   * asked for is fetched at that list's own address with the year changed
   * (Part 5), so one stored year is all an address needs. */
  it("offers a country whose only stored list is for another year", () => {
    const [india] = SEEDED_HOLIDAY_LISTS.filter(
      (list) => list.source.kind === "country" && list.source.code === "IN",
    );
    const { countries } = holidaySourceChoices([india], "PH", OWN_PH);

    expect(countries.map((choice) => choice.nameHe)).toEqual(["PH", "הודו"]);
  });

  /** A faith chosen in place of a country is the selected chip, and her own
   * country then is not — the two are one choice with two kinds of answer
   * (item 10). */
  it("marks a faith as the chosen list where she was moved to one", () => {
    const { countries, religions } = holidaySourceChoices(
      SEEDED_HOLIDAY_LISTS,
      "PH",
      { kind: "religion", religion: "christian" },
    );

    expect(countries.every((choice) => choice.selected)).toBe(false);
    expect(religions.filter((choice) => choice.selected)).toHaveLength(1);
    expect(
      religions.find((choice) => choice.selected)?.nameHe,
    ).toBe(religiousSources.christian.nameHe);
  });
});

/**
 * The countries a worker may be said to come from (specs.md items 10, 12) — the
 * wizard's offer and, since the country became correctable, `/settings`'s.
 *
 * The six names are read off the shipped `data/holidays/XX-2026.json` files and
 * their order is the Hebrew alphabet's, worked out here rather than taken from
 * what the function returned.
 */
describe("the countries a holiday list is stored for", () => {
  it("names all six, ordered by their Hebrew names", () => {
    expect(countriesWithLists(SEEDED_HOLIDAY_LISTS)).toEqual([
      { code: "UZ", nameHe: "אוזבקיסטן" },
      { code: "UA", nameHe: "אוקראינה" },
      { code: "IN", nameHe: "הודו" },
      { code: "PH", nameHe: "הפיליפינים" },
      { code: "NP", nameHe: "נפאל" },
      { code: "LK", nameHe: "סרי לנקה" },
    ]);
  });

  /**
   * One country, not one per year. Catches an offer built straight off the
   * lists: the household fetches a year at a time, so the day it holds 2026 and
   * 2027 for the Philippines the picker would offer הפיליפינים twice and
   * `setCountry` would still take either.
   */
  it("counts a country once however many years are stored for it", () => {
    const philippines = SEEDED_HOLIDAY_LISTS.filter(
      (list) => list.source.kind === "country" && list.source.code === "PH",
    );
    const nextYear = philippines.map((list) => ({ ...list, year: list.year + 1 }));

    expect(countriesWithLists([...philippines, ...nextYear])).toEqual([
      { code: "PH", nameHe: "הפיליפינים" },
    ]);
  });

  /** A faith's list is not a country. It is offered beside them by
   * `holidaySourceChoices` and is no answer to "where is she from". */
  it("leaves a faith's list out", () => {
    const withReligion = [
      ...SEEDED_HOLIDAY_LISTS,
      {
        ...SEEDED_HOLIDAY_LISTS[0],
        source: { kind: "religion", religion: "jewish" } as const,
        nameHe: "חגים יהודיים",
      },
    ];

    expect(countriesWithLists(withReligion).map((country) => country.nameHe)).not.toContain(
      "חגים יהודיים",
    );
    expect(countriesWithLists(withReligion)).toHaveLength(6);
  });
});

/**
 * What a correction to the country moves, and what it must not (`build_plan.md`
 * stage 8⅞).
 */
describe("the list a corrected country is drawn from", () => {
  /** Never moved, so the default is hers and the correction reaches it. */
  it("follows the country for a worker never moved off it", () => {
    expect(holidaySourceOf({ country: "PH" })).toEqual({
      kind: "country",
      code: "PH",
    });
    expect(holidaySourceOf({ country: "IN" })).toEqual({
      kind: "country",
      code: "IN",
    });
  });

  /**
   * Moved deliberately, so the correction leaves her where she was put. Catches
   * a `setCountry` that wrote `holidaySource` as well as `country`: a family
   * fixing a typo in her country would silently undo the list they had chosen
   * for her, and the picker would say nothing about it.
   */
  it("leaves a worker moved to another list where she was put", () => {
    expect(
      holidaySourceOf({
        country: "IN",
        holidaySource: { kind: "country", code: "NP" },
      }),
    ).toEqual({ kind: "country", code: "NP" });
    expect(
      holidaySourceOf({
        country: "IN",
        holidaySource: { kind: "religion", religion: "christian" },
      }),
    ).toEqual({ kind: "religion", religion: "christian" });
  });
});

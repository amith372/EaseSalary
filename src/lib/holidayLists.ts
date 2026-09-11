import IN2026 from "../../data/holidays/IN-2026.json";
import LK2026 from "../../data/holidays/LK-2026.json";
import NP2026 from "../../data/holidays/NP-2026.json";
import PH2026 from "../../data/holidays/PH-2026.json";
import UA2026 from "../../data/holidays/UA-2026.json";
import UZ2026 from "../../data/holidays/UZ-2026.json";

import { compareIsoDate } from "@/lib/dates";
import type { IsoDate } from "@/lib/types";

/**
 * The holiday candidate lists, one per source and per calendar year, held the
 * way the dated-rates table holds a rate: seeded with what ships, updated by a
 * fetch, and never a figure the code invented (specs.md item 12, Part 3).
 *
 * **Two kinds of list, and the user chooses between them** (item 10, decided
 * with the user on 2026-09-09): the worker's country of origin, or a religion.
 * They differ only in where the list is fetched from — a country's list is one
 * page per year, a religion's is one page carrying every year it knows — so
 * they are one type here and one picker later, and the `source` field is what
 * says which was chosen.
 *
 * **A list is per calendar year**, as item 10's entitlement is, so the year is
 * part of a list's identity and not a filter applied to it.
 */

/** One date the source published, with the name it published beside it. */
export interface Holiday {
  date: IsoDate;
  /**
   * Exactly the name the source printed, never translated and never tidied.
   * The Christian page publishes each holiday twice, once per rite, and the
   * rite is appended here because two rows otherwise arrive as one name on two
   * dates with nothing to tell the user which is which.
   */
  name: string;
}

/**
 * Which page a list came from. A country code identifies a page per year; a
 * religion identifies one page for all years.
 */
export const religions = ["jewish", "muslim", "christian", "druze"] as const;

export type Religion = (typeof religions)[number];

export type HolidaySource =
  | { kind: "country"; code: string }
  | { kind: "religion"; religion: Religion };

/**
 * One source's holidays for one calendar year.
 *
 * `sourceUrl` is the address the list actually came from and is the address the
 * *next* year is fetched at, with the year in it changed — never an address
 * rebuilt from `source` (Part 5). It is therefore part of the stored list and
 * not something a caller may reconstruct.
 */
export interface HolidayList {
  source: HolidaySource;
  year: number;
  sourceUrl: string;
  /** Hebrew, for the picker. Shipped with the seed files as `country_name_he`. */
  nameHe: string;
  holidays: Holiday[];
}

/** The shape of a shipped `data/holidays/XX-YYYY.json` file. */
interface SeedFile {
  country_code: string;
  country_name_he: string;
  year: number;
  source_url: string;
  holidays: { date: string; name: string }[];
}

function fromSeedFile(file: SeedFile): HolidayList {
  return {
    source: { kind: "country", code: file.country_code },
    year: file.year,
    sourceUrl: file.source_url,
    nameHe: file.country_name_he,
    holidays: file.holidays,
  };
}

/**
 * What the application ships knowing, before any fetch has run.
 *
 * They are **seed data for years already gathered and not the only years it can
 * ever know** (Part 3): a year with no list here is fetched, and the shipped
 * year is what the fetch is judged against. Only countries are seeded — the
 * four religious pages have no shipped file, so a religion's first fetch has
 * nothing to compare against and is believed if it is not empty, which is the
 * same rule item 12 already applies to a country nobody has fetched before.
 */
export const SEEDED_HOLIDAY_LISTS: HolidayList[] = [
  IN2026,
  LK2026,
  NP2026,
  PH2026,
  UA2026,
  UZ2026,
].map(fromSeedFile);

export function sameSource(a: HolidaySource, b: HolidaySource): boolean {
  if (a.kind === "country" && b.kind === "country") return a.code === b.code;
  if (a.kind === "religion" && b.kind === "religion") {
    return a.religion === b.religion;
  }
  return false;
}

/** The stored list for one source and one year, or `null` if none is stored. */
export function holidayListFor(
  lists: HolidayList[],
  source: HolidaySource,
  year: number,
): HolidayList | null {
  return (
    lists.find((list) => list.year === year && sameSource(list.source, source)) ??
    null
  );
}

/**
 * The stored list for this source whose year is closest to `year`, which is
 * what a fetched list's length is judged against.
 *
 * Closest and not latest, for the reason the wage check reads the row *in
 * force* rather than the newest one: the two differ the moment a year arrives
 * that is earlier than something already stored, and the nearer year is the
 * better comparison in both directions.
 */
export function nearestStoredYear(
  lists: HolidayList[],
  source: HolidaySource,
  year: number,
): HolidayList | null {
  const candidates = lists
    .filter((list) => sameSource(list.source, source) && list.year !== year)
    .sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year));
  return candidates[0] ?? null;
}

/**
 * The address a year's list is fetched at: the address stored *with* that
 * source's list, with the year in it changed (Part 5).
 *
 * **It is never rebuilt from the country code**, and the reason is written into
 * Part 5. The year is replaced only as the address's **last** segment, which is
 * where both sources put it: a year-like number anywhere else in the address is
 * left alone, and an address whose last segment is not the stored year is
 * refused rather than fetched unchanged, since fetching it would return the
 * stored year a second time and look like a successful fetch of a different
 * one.
 */
export function addressForYear(
  storedUrl: string,
  storedYear: number,
  year: number,
): string | null {
  const trailing = new RegExp(`/${storedYear}/?$`);
  if (!trailing.test(storedUrl)) return null;
  return storedUrl.replace(trailing, `/${year}`);
}

/**
 * The fetched list written into the table, replacing any list already held for
 * the same source and year rather than being appended beside it.
 *
 * Replacing and not appending, for the reason `withFetchedRate` replaces a row:
 * two lists under one source and one year make every lookup answer with
 * whichever the array order left first, which is correct until the day it is
 * not.
 */
export function withFetchedList(
  lists: HolidayList[],
  fetched: HolidayList,
): HolidayList[] {
  const kept = lists.filter(
    (list) =>
      !(list.year === fetched.year && sameSource(list.source, fetched.source)),
  );
  return [...kept, fetched];
}

/** Ordered by date, which is the order a picker shows a year in. */
export function byDate(holidays: Holiday[]): Holiday[] {
  return [...holidays].sort((a, b) => compareIsoDate(a.date, b.date));
}

/**
 * What a country of origin is called, in Hebrew.
 *
 * **The name is already here and was not being read**: every shipped list
 * carries `country_name_he`, which is what the holiday picker's own chips are
 * labelled with. The profile was printing the two-letter code beside
 * `ארץ מוצא`, so one screen said `הפיליפינים` and another said `PH` about the
 * same worker (found by the user on 2026-09-11). A code is a filing key and
 * nothing a family employing a caregiver has any reason to read.
 *
 * **The code is the fallback and not a failure.** A country with no stored list
 * has no name this application knows, and inventing one is exactly the guess
 * `CLAUDE.md` rule 4 refuses — `holidaySourceChoices` already resolves the same
 * case the same way, so the picker and the profile fall back alike. Stage 5's
 * country list is what will name the rest.
 */
export function countryNameHe(lists: HolidayList[], code: string): string {
  const named = lists.find(
    (list) => list.source.kind === "country" && list.source.code === code,
  );
  return named?.nameHe ?? code;
}

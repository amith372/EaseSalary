import { compareMonth, eachMonth, monthOf } from "@/lib/dates";
import { salaryFor } from "@/lib/engine/salary";
import { SEEDED_RATES, rateInForce, withFetchedRate } from "@/lib/datedRates";
import type { DatedRate, RateKey } from "@/lib/datedRates";
import type { Deferral, WarningKind } from "@/lib/engine/alerts";
import type { HolidayAmendment } from "@/lib/engine/holidayAmendments";
import { snapshotTerms } from "@/lib/engine/types";
import type {
  ConfirmedWage,
  MonthFacts,
  MonthSpan,
  WorkerTerms,
} from "@/lib/engine/types";
import {
  SEEDED_HOLIDAY_LISTS,
  withFetchedList,
  type HolidayList,
  type HolidaySource,
} from "@/lib/holidayLists";
import type { SealedNumber } from "@/lib/encryption";
import type { CachedPage } from "@/lib/scrape/pageSections";
import { SEEDED_TAX_BRACKETS, withFetchedBrackets } from "@/lib/taxBrackets";
import type { TaxYearBrackets } from "@/lib/taxBrackets";
import { overlapsMonth } from "@/lib/spans";
import type { Worker, WorkerDocuments, YearMonth } from "@/lib/types";

/**
 * Where a worker's facts are kept, said in a way that names no database.
 *
 * **No database client is named in this file or in anything it imports**, which
 * is the whole of its job. The in-memory implementation below and the Postgres
 * one stand *beside* each other, so the screens and the tests need no auth,
 * row-level security or schema in order to be right. The vendor is deliberately not written down even
 * here, because the rule is checked by grepping this directory for the name: a
 * comment explaining the rule would be the one hit that makes the grep useless.
 *
 * **It stores facts and never results.** `specs.md` Part 3 requires one
 * calculation path serving both the preview and the export, and a stored figure
 * is a second path that drifts the first time the engine is corrected. Balances
 * in particular are never stored: they are replayed from the opening position by
 * `calculateSeries`, which is what makes criterion 13 free — a month corrected
 * years later moves every later month's balances because those balances were
 * never anything but a replay, so there is nothing to find and invalidate.
 *
 * Every method is asynchronous, including the in-memory one's. A synchronous
 * interface cannot be implemented over a network round trip, so making it
 * asynchronous here is what lets Postgres substitute for the in-memory store
 * without a rewrite of every caller.
 */

/**
 * The worker as the store holds her: who she is, and the terms that hold from
 * month to month.
 *
 * The two halves are one record because they are one row — `Worker` is what a
 * screen shows in a switcher and `WorkerTerms` is what the engine reads. It is
 * structurally an `Employment`, so a caller hands the profile straight to
 * `calculateMonth` and nothing has to be unpacked; what a month was *calculated*
 * with still comes off the month and never off this (Part 3).
 */
export interface WorkerProfile extends Worker, WorkerTerms {
  /**
   * The list her year's holidays are chosen from, where it is not her own
   * country's (specs.md item 10).
   *
   * **Absent is her country's list**, which is what item 10 makes the default:
   * the candidate list is "her country of origin's, with another country's
   * selectable instead" — and a religion's beside it. Storing the exception
   * rather than restating `country` is what keeps one worker from having two
   * fields that can disagree about where her holidays come from.
   *
   * **It is on the profile and not in `WorkerTerms`**, for the reason the
   * documents are: it is not a term of a month. A family that switches her from
   * her country's list to a faith's in June does not restate May — the dates
   * already chosen are spans, and they stay exactly where they are.
   */
  holidaySource?: HolidaySource;
  /**
   * The three documents the employment rests on, as dates (specs.md item 28).
   *
   * **They are on the profile and not in `WorkerTerms`**, because they are not
   * terms of a month: a passport renewed in June does not restate May, and
   * nothing snapshots them. What reads them is item 27's warnings, which ask
   * what is coming due now and never what was due in a month already exported.
   */
  documents: WorkerDocuments;
  /**
   * Who the medical insurance premium is paid through — the agency, the
   * insurer, the health fund, in the family's own words (specs.md item 16).
   *
   * **It exists because the template carried one family's arrangement.** Cell
   * `B10` of both month templates read "שולם באמצעות סוכנות ביטוח …" with a
   * real agency and a real insurer written into the binary, which is precisely
   * what Part 3 forbids: a template may never carry one family's data into
   * another's sheet. It survived because the names appeared in no text file, so
   * no diff and no search ever showed them.
   *
   * **On the profile and not in `WorkerTerms`**, for the reason the documents
   * and the holiday source are: it is not a term of a month and changes no
   * figure. Nothing snapshots it, so a family that changes insurer re-exports
   * an older month under the new name — the row is a label saying who the
   * premium goes to, not a sum the month was calculated with.
   *
   * The empty string is "not entered yet" and is the state of every worker the
   * family has not typed one for. A month that records a medical-insurance
   * payment while this is empty raises the warning of item 27 rather than
   * printing half a sentence.
   */
  insurer: string;
}

/**
 * A month as the store holds it — everything in `MonthFacts` except its spans
 * and the instant it was last edited.
 *
 * **`updatedAt` is omitted for the reason the database maintains it**: it is
 * what tells a *corrected* month from a confirmed one (Part 5), so a save that
 * forgot to move it would leave a month looking untouched since its
 * confirmation, which is the one state it is read for. The store stamps it.
 *
 * **The spans omission is the point and not an economy.** Spans belong to the worker
 * (Part 3): a spell crossing a boundary is one spell, stored once, and reaching
 * both months whole is what lets each place a day at its right tier. A month's
 * `spans` are therefore *assembled* on the way out and can never be written on
 * the way in — the compiler refuses it, so nobody has to remember. Save a span
 * with `saveSpan` and the months it overlaps carry it from then on.
 */
export type MonthRecord = Omit<MonthFacts, "spans" | "updatedAt">;

/**
 * Asked for a worker who is not in the store.
 *
 * A month that does not exist is an ordinary answer and comes back as `null`; a
 * worker id that does not exist is a bug in the caller, because ids in this
 * application come from the store itself and never from a user. Failing loudly
 * here is what stops a month being written against nobody and found later as a
 * balance chain with a hole in it.
 */
export class UnknownWorkerError extends Error {
  constructor(readonly workerId: string) {
    super(`No worker with id ${workerId}`);
    this.name = "UnknownWorkerError";
  }
}

export interface SalaryRepository {
  listWorkers(): Promise<WorkerProfile[]>;
  getWorker(workerId: string): Promise<WorkerProfile | null>;
  /** Creates the worker or replaces her wholesale, keyed by `id`. */
  saveWorker(profile: WorkerProfile): Promise<void>;
  /** Whether the person's own household holds fewer than two workers (item
   * 11). A worker shared from another household is not counted, so this is
   * not the same question as `listWorkers().length < 2`. */
  hasRoomForWorker(): Promise<boolean>;

  /** Every span the worker has, whichever month each falls in. */
  listSpans(workerId: string): Promise<MonthSpan[]>;
  /** Records the span or replaces it, keyed by `id` — which is also how an
   * open spell is closed: the same span saved again with a `to`. */
  saveSpan(workerId: string, span: MonthSpan): Promise<void>;
  deleteSpan(workerId: string, spanId: string): Promise<void>;

  /** The month with its spans assembled, or `null` if it was never recorded. */
  getMonth(workerId: string, month: YearMonth): Promise<MonthFacts | null>;
  /** Every month the worker has, **oldest first** — the order `calculateSeries`
   * replays them in. */
  listMonths(workerId: string): Promise<MonthFacts[]>;
  saveMonth(workerId: string, record: MonthRecord): Promise<void>;
  /** Several months in one write, so a change that reaches them all lands on
   * all of them or on none — never half re-snapshotted. */
  saveMonths(workerId: string, records: MonthRecord[]): Promise<void>;

  /**
   * The holiday lists the household holds, seeded with what ships and added to
   * by a fetch (specs.md item 12).
   *
   * **They belong to the household and not to a worker**, because a list is a
   * source and a year and nothing about one worker: two workers from the same
   * country share one list, and a list fetched for the first is the list the
   * second reads. Which list a worker's year is drawn from is her own, and that
   * is `holidaySource` above.
   */
  listHolidayLists(): Promise<HolidayList[]>;
  /** Records the list, replacing any held for the same source and year rather
   * than being appended beside it (`withFetchedList`). */
  saveHolidayList(list: HolidayList): Promise<void>;

  /**
   * The dated-rates table — every rate the application does not derive, with
   * the date it took effect (specs.md item 4).
   *
   * **Seeded and never empty.** `SEEDED_RATES` is what the application ships
   * knowing, so a household that has never fetched anything still values a
   * month; a fetch updates the table rather than introducing one, which is why
   * this returns rows rather than `null`.
   *
   * **They belong to the household and not to a worker**, for the reason the
   * holiday lists do: the minimum wage is the state's figure and not one
   * worker's. What a *month* was valued at is on the month (`ConfirmedWage`)
   * and is never read back from here.
   */
  listRates(): Promise<DatedRate[]>;
  /** Records the row, replacing any held for the same key and effective date
   * rather than being appended beside it (`withFetchedRate`). */
  saveRate(rate: DatedRate): Promise<void>;
  /** When a row for `key` read from `source` was last saved, or `null` if none
   * ever was. The source is named because a figure the user confirmed is saved
   * to the same table and says nothing about when the page was last read. */
  lastFetched(key: RateKey, source: string): Promise<string | null>;

  /**
   * The income-tax bracket tables, one per tax year (specs.md item 17).
   *
   * **Seeded and never empty**, exactly as `listRates` is and for its reason:
   * a household that has never fetched anything still taxes a month at the
   * table the application ships knowing, and a fetch updates that table rather
   * than introducing one.
   *
   * **They belong to the household and not to a worker**, like the rates and
   * the holiday lists: the brackets are the state's table and not one
   * worker's.
   */
  listTaxBrackets(): Promise<TaxYearBrackets[]>;
  /** Records the year's table, replacing any held for the same year rather
   * than being appended beside it (`withFetchedBrackets`). */
  saveTaxBrackets(table: TaxYearBrackets): Promise<void>;
  /**
   * When a bracket table was last saved from a fetch, or `null` if none ever
   * was — the newest such stamp across every year held.
   *
   * **Not keyed by year, because the year is what the fetch returns.** The
   * source page publishes one year's table and names the year in its own
   * heading, so a caller asking "is this due to be read again" has no year to
   * ask about yet; what it wants to know is when the page was last read, and
   * that is one stamp. The seeded tables carry none, so a household that has
   * never fetched reads as due.
   */
  lastFetchedBrackets(): Promise<string | null>;

  /**
   * The corpus: the text of the article pages a fetch has read, segmented by
   * each page's own headings (specs.md Part 3).
   *
   * **Kept beside the figure taken from it rather than thrown away**, because
   * the help screen answers out of it and a corpus discarded at the moment of
   * the fetch would have to be scraped a second time to get it back. It is
   * never load-bearing: nothing calculated is read from here, so a household
   * that has stored none values its months exactly as one that has.
   *
   * **Empty until something has been fetched**, which is where this differs
   * from the rates and the brackets: there is nothing to seed it with, and
   * nothing goes wrong while it is empty.
   */
  listCachedPages(): Promise<CachedPage[]>;
  /** Records the page, replacing any held for the same address rather than
   * being appended beside it — a re-fetch is the page as it now reads. */
  saveCachedPage(page: CachedPage): Promise<void>;

  /**
   * The four identifying numbers, **as sealed bytes and never as numbers**
   * (specs.md items 22 and 28).
   *
   * **The store holds a sealed box and cannot open it.** The key lives outside
   * the database (Part 3), so the sealing happens above this interface, in
   * `src/lib/identifyingNumbers.ts`; what crosses this boundary in either
   * direction is bytes. That is what keeps the rule true of *both*
   * implementations rather than of the Postgres one alone — an in-memory store
   * holding plaintext identifiers would be exactly the thing item 22 forbids,
   * and nothing about it would look wrong.
   *
   * **They are not on `WorkerProfile`**, which is the object every screen, the
   * engine and the switcher pass around. A number that travelled on it would
   * reach the browser on every page that names a worker, where item 22 allows
   * it only on the screen that shows it and in the export.
   */
  sealedNumbers(workerId: string): Promise<SealedNumbers>;
  /**
   * Writes the numbers named and leaves the rest exactly as they were.
   *
   * **Partial and not wholesale**, unlike `saveWorker`, and the difference is
   * load-bearing: the employment permit's number belongs to the *household*
   * (item 28), so a second worker saved with a full record of nulls would erase
   * the number the first worker's household already held. An absent key is "not
   * mine to say"; an explicit `null` is "clear it".
   */
  saveSealedNumbers(workerId: string, numbers: SealedNumbers): Promise<void>;

  /** The warning kinds the household switched off (specs.md item 27). */
  listSwitchedOffWarnings(): Promise<WarningKind[]>;
  saveSwitchedOffWarnings(kinds: WarningKind[]): Promise<void>;
  /** The warnings put off with 'not now', across the household's workers. */
  listDeferrals(): Promise<Deferral[]>;
  /** Records the deferral, replacing one held for the same worker and entry. */
  deferWarning(deferral: Deferral): Promise<void>;

  /** The holiday moves recorded as amendments (specs.md item 10), oldest
   * agreement first. */
  listHolidayAmendments(workerId: string): Promise<HolidayAmendment[]>;
  /** Records one. Never edited afterwards: it is the record of what was agreed. */
  saveHolidayAmendment(workerId: string, amendment: HolidayAmendment): Promise<void>;
}

/**
 * The four numbers, keyed by what each one is.
 *
 * Three belong to the worker and one to the household — the employment permit
 * is the employer's position, and a household with two workers holds one permit
 * and two visas (item 28) — but they are one record here because they are one
 * screen: the family types them in one place and reads them in one place, and
 * which table each lands in is the repository's business and not the caller's.
 *
 * Every key is optional, which is what makes a partial write expressible. A key
 * that is present and `null` is a number the family cleared; a key that is
 * absent was not asked about.
 */
export type SealedNumbers = Partial<{
  passport: SealedNumber | null;
  bankAccount: SealedNumber | null;
  workVisa: SealedNumber | null;
  employmentPermit: SealedNumber | null;
}>;

/**
 * A month read back out of the store, on its way in again — `MonthFacts` less
 * the two fields the store owns.
 *
 * It spreads rather than listing the fields, and that is deliberate: a field
 * added to `MonthFacts` later would be silently dropped on every save by a
 * function that named them one by one, which is a month quietly losing a fact
 * nobody would see until an export. `spans` is discarded rather than ignored,
 * because writing them back would write a second copy of a spell that belongs
 * to the worker and must stay one thing; `updatedAt` because the store stamps
 * it and a caller carrying the old instant back in would freeze it.
 */
export function recordOf(facts: MonthFacts): MonthRecord {
  const { spans, updatedAt, ...record } = facts;
  void spans;
  void updatedAt;
  return record;
}

/**
 * The wage position a month opened after the fact carries.
 *
 * **The minimum wage comes from the dated-rates table and not from the
 * neighbouring month** (specs.md item 4: "a month is valued at the rate in
 * force during it and never at the current one"). A neighbouring month's wage
 * would value a July 2026 opened by a mark at the wage of April 2025, below the
 * wage in force during it, with nothing about the month saying so.
 *
 * **The base is floored at that minimum and never rewritten above it**, which
 * is `baseForMonth`'s rule read here: a family paying above the minimum keeps
 * their figure, and a profile still holding last year's cannot open a month
 * that pays under the law. The profile itself is left alone — how far above the
 * minimum this worker is paid stays the family's decision (item 3).
 *
 * **A month the table cannot answer falls back to the nearest confirmed
 * position**, because a month earlier than every row has no minimum this application can cite, and
 * item 4 says it guesses nothing. The carried figure is not necessarily the
 * right one, and it does not have to be — the wage is confirmed before every
 * export, which is where a carried figure is replaced by a real one.
 *
 * `null` for a worker with no months at all *and* no row in force: there is
 * nothing to open from, and inventing one is what this returns `null` rather
 * than doing.
 */
export function wageToCarry(
  months: MonthFacts[],
  month: YearMonth,
  profile: Pick<WorkerProfile, "baseMonthlySalaryAgorot" | "salaryChanges">,
  rates: DatedRate[],
): ConfirmedWage | null {
  const inForce = rateInForce(rates, "minimumWage", month);
  if (inForce !== null) {
    return {
      // The salary in force during this month and not the latest one: a raise
      // from September does not reach a June opened after it (`salary.ts`).
      baseAgorot: Math.max(salaryFor(profile, month), inForce.value),
      minimumAgorot: inForce.value,
      effectiveFrom: inForce.effectiveFrom,
    };
  }

  const ordered = [...months].sort((a, b) => compareMonth(a.month, b.month));
  const before = ordered.filter((each) => compareMonth(each.month, month) < 0);
  const nearest = before.length > 0 ? before[before.length - 1] : ordered[0];
  return nearest?.confirmedWage ?? null;
}

/**
 * A month the store had no record of, as the replay values it and as it is
 * opened so that a fact can be recorded in it (specs.md item 21, Part 3).
 *
 * **It holds nothing but the position it opens from**, which is the whole of
 * what a draft month is (Part 5): no advance, no payment, no line of the user's
 * own, and no confirmed income tax, so the engine works the tax out as it does
 * for any month not yet confirmed (item 17). The facts arrive afterwards, one
 * gesture at a time. The replay builds a month nobody opened from this same
 * function, which is what makes opening a month change nothing about it.
 *
 * The terms are snapshotted off the profile as they stand now, the way every
 * other month's were: a month keeps the terms it was calculated with and never
 * reads the profile again (Part 3).
 */
export function openMonthRecord(
  profile: WorkerTerms,
  month: YearMonth,
  confirmedWage: ConfirmedWage,
): MonthRecord {
  return {
    month,
    confirmedWage,
    terms: snapshotTerms(profile, month),
    advances: [],
    thirdPartyPayments: [],
    userLines: [],
    overrides: {},
  };
}

/** The month's own spans, in the order they were recorded. Exported because
 * every implementation owes the same answer, and two implementations deciding
 * separately what "in this month" means is two engines. */
function spansOf(spans: MonthSpan[], month: YearMonth): MonthSpan[] {
  return spans.filter((span) => overlapsMonth(span, month));
}

function monthKey(month: YearMonth): string {
  return `${month.year}-${String(month.month).padStart(2, "0")}`;
}

/**
 * Tells the months a span covers that they changed.
 *
 * **A mark is an edit to its month**, and the month cannot see it: spans belong
 * to the worker and not to the month (Part 3), so nothing on a month moves when
 * a day is marked, cleared or moved. Without this, a day marked on a month
 * already exported left the month reporting itself as exported — criterion 13's
 * chain standing on a file nobody would know to produce again. The Postgres
 * store owes the same answer, and pays it in `touchMonths` there.
 *
 * Only months the store already holds are touched: a mark in a month with no
 * record changes no recorded month, and the replay values it from the facts
 * either way.
 */
function touchMonthsOf(row: WorkerRow, spans: MonthSpan[]): void {
  const at = new Date().toISOString();
  for (const span of spans) {
    for (const month of eachMonth(monthOf(span.from), monthOf(span.to ?? span.from))) {
      const record = row.months.get(monthKey(month));
      if (record !== undefined) record.updatedAt = at;
    }
  }
}

interface WorkerRow {
  profile: WorkerProfile;
  spans: MonthSpan[];
  months: Map<string, StoredMonth>;
  /** Sealed bytes, never numbers — this store cannot open them any more than
   * Postgres can, which is what makes the rule the same rule in both. */
  numbers: SealedNumbers;
  amendments: HolidayAmendment[];
}

/**
 * The store the vertical slice runs on, and the one the tests run on.
 *
 * **It copies on the way in and on the way out.** A caller that mutated what it
 * read would otherwise be mutating the store, which is a bug that cannot happen
 * against Postgres and so would pass every test here and fail nowhere else. The
 * copies are what make this
 * implementation *behave* like a database rather than merely satisfy its
 * signature.
 */
/**
 * A copy of a sealed value, so a caller holding one cannot reach back into the
 * store through it — the same reason everything else here is cloned.
 * `structuredClone` is not used: it turns a `Buffer` into a plain `Uint8Array`,
 * and the difference would surface only where the bytes are opened.
 */
function copyOf(value: SealedNumber | null | undefined): SealedNumber | null {
  return value === null || value === undefined ? null : Buffer.from(value);
}

/** A month as this store holds it: the record the caller saved, plus the
 * instant the store stamped on it. */
type StoredMonth = MonthRecord & { updatedAt: string };

/**
 * Whether a save changes nothing but when the month was exported, or its note —
 * the condition `private.touch_updated_at` applies in Postgres, so a month edited
 * here reaches the *corrected* state on the same rule it reaches it there.
 *
 * Producing a file is not an edit: without this, every download would move
 * `updatedAt` past `confirmedAt` and report the month as corrected. Nor is a
 * note, which reaches no sheet, so the file already produced still matches.
 */
function onlyTheExportMoved(before: StoredMonth, after: MonthRecord): boolean {
  const without = ({
    exportedAt,
    updatedAt,
    note,
    ...rest
  }: Partial<StoredMonth>): unknown => {
    void exportedAt;
    void updatedAt;
    void note;
    return rest;
  };
  return JSON.stringify(without(before)) === JSON.stringify(without(after));
}

/**
 * The instant a save stamps on a month, on the rule Postgres applies to the
 * same save — so `monthState` reads the same four states against either store.
 *
 * Three cases, and the first two are the ones that would otherwise report a
 * month as *corrected* the moment it was filed: **confirming** a month takes the
 * confirmation's own instant, because two clocks a few milliseconds apart would
 * otherwise order the confirmation after itself; **exporting** one leaves the
 * stamp alone, because producing a file is not an edit. Everything else is an
 * edit and moves it.
 */
function stampFor(
  before: StoredMonth | undefined,
  record: MonthRecord,
): string {
  if (
    record.confirmedAt !== undefined &&
    record.confirmedAt !== before?.confirmedAt
  ) {
    return record.confirmedAt;
  }
  if (before !== undefined && onlyTheExportMoved(before, record)) {
    return before.updatedAt;
  }
  return new Date().toISOString();
}

export function createInMemoryRepository(
  seed: {
    workers?: WorkerProfile[];
    spans?: Record<string, MonthSpan[]>;
    months?: Record<string, MonthRecord[]>;
    /** Defaults to what the application ships knowing, which is what a
     * household starts from before any fetch has run (item 12). */
    holidayLists?: HolidayList[];
    /** Defaults to `SEEDED_RATES`, for the same reason (item 4). */
    rates?: DatedRate[];
    /** Defaults to `SEEDED_TAX_BRACKETS`, for the same reason (item 17). */
    taxBrackets?: TaxYearBrackets[];
  } = {},
): SalaryRepository {
  const workers = new Map<string, WorkerRow>();
  /**
   * The household's employment-permit number, held here rather than on a worker
   * because that is where it belongs: one permit position per household, and
   * two workers share it (item 28). The Postgres store keeps it on the
   * household row for the same reason.
   */
  let employmentPermitNumber: SealedNumber | null = null;
  let holidayLists = structuredClone(
    seed.holidayLists ?? SEEDED_HOLIDAY_LISTS,
  );
  let rates = structuredClone(seed.rates ?? SEEDED_RATES);
  let taxBrackets = structuredClone(seed.taxBrackets ?? SEEDED_TAX_BRACKETS);
  const fetchedAt = new Map<string, string>();
  let bracketsFetchedAt: string | null = null;
  const cachedPages = new Map<string, CachedPage>();
  let switchedOff: WarningKind[] = [];
  let deferrals: Deferral[] = [];

  function rowOf(workerId: string): WorkerRow {
    const row = workers.get(workerId);
    if (row === undefined) throw new UnknownWorkerError(workerId);
    return row;
  }

  function factsOf(row: WorkerRow, record: MonthRecord): MonthFacts {
    return structuredClone({
      ...record,
      spans: spansOf(row.spans, record.month),
    });
  }

  const repository: SalaryRepository = {
    async listWorkers() {
      return structuredClone([...workers.values()].map((row) => row.profile));
    },

    async getWorker(workerId) {
      const row = workers.get(workerId);
      return row === undefined ? null : structuredClone(row.profile);
    },

    async hasRoomForWorker() {
      // A seeded store is one household with nothing shared into it.
      return workers.size < 2;
    },

    async saveWorker(profile) {
      const existing = workers.get(profile.id);
      workers.set(profile.id, {
        profile: structuredClone(profile),
        spans: existing?.spans ?? [],
        months: existing?.months ?? new Map(),
        // Kept across a wholesale save of the profile: the numbers are not on
        // it, so a save that dropped them would erase a passport every time a
        // rest day changed.
        numbers: existing?.numbers ?? {},
        amendments: existing?.amendments ?? [],
      });
    },

    async listSpans(workerId) {
      return structuredClone(rowOf(workerId).spans);
    },

    async saveSpan(workerId, span) {
      const row = rowOf(workerId);
      const copy = structuredClone(span);
      const at = row.spans.findIndex((existing) => existing.id === span.id);
      // Both ranges, because a span moved off a month corrects the month it
      // left as much as the one it landed on.
      const before = at === -1 ? [] : [row.spans[at]];
      if (at === -1) row.spans.push(copy);
      else row.spans[at] = copy;
      touchMonthsOf(row, [copy, ...before]);
    },

    async deleteSpan(workerId, spanId) {
      const row = rowOf(workerId);
      const removed = row.spans.filter((span) => span.id === spanId);
      row.spans = row.spans.filter((span) => span.id !== spanId);
      touchMonthsOf(row, removed);
    },

    async getMonth(workerId, month) {
      const row = rowOf(workerId);
      const record = row.months.get(monthKey(month));
      return record === undefined ? null : factsOf(row, record);
    },

    async listMonths(workerId) {
      const row = rowOf(workerId);
      return [...row.months.entries()]
        // Keyed as "2026-03", zero-padded, so the string order *is* the date
        // order. Sorted here rather than trusted from insertion, because the
        // order is part of what this method promises and a caller correcting an
        // old month writes it last.
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, record]) => factsOf(row, record));
    },

    async saveMonth(workerId, record) {
      await repository.saveMonths(workerId, [record]);
    },

    async saveMonths(workerId, records) {
      const row = rowOf(workerId);
      for (const record of records) {
        const key = monthKey(record.month);
        const before = row.months.get(key);
        row.months.set(key, {
          ...structuredClone(record),
          updatedAt: stampFor(before, record),
        });
      }
    },

    async listHolidayLists() {
      return structuredClone(holidayLists);
    },

    async saveHolidayList(list) {
      holidayLists = withFetchedList(holidayLists, structuredClone(list));
    },

    async listRates() {
      return structuredClone(rates);
    },

    async saveRate(rate) {
      rates = withFetchedRate(rates, structuredClone(rate));
      fetchedAt.set(`${rate.key} ${rate.source}`, new Date().toISOString());
    },

    async lastFetched(key, source) {
      return fetchedAt.get(`${key} ${source}`) ?? null;
    },

    async listTaxBrackets() {
      return structuredClone(taxBrackets);
    },

    async saveTaxBrackets(table) {
      taxBrackets = withFetchedBrackets(taxBrackets, structuredClone(table));
      bracketsFetchedAt = new Date().toISOString();
    },

    async lastFetchedBrackets() {
      return bracketsFetchedAt;
    },

    async listCachedPages() {
      return structuredClone([...cachedPages.values()]);
    },

    async saveCachedPage(page) {
      // Keyed by the address, so a re-fetch replaces the page rather than
      // standing beside the way it read last year.
      cachedPages.set(page.url, structuredClone(page));
    },

    async sealedNumbers(workerId) {
      const row = rowOf(workerId);
      return {
        passport: copyOf(row.numbers.passport),
        bankAccount: copyOf(row.numbers.bankAccount),
        workVisa: copyOf(row.numbers.workVisa),
        employmentPermit: copyOf(employmentPermitNumber),
      };
    },

    async saveSealedNumbers(workerId, numbers) {
      const row = rowOf(workerId);
      // `in` and not a truthiness test: an explicit `null` clears a number and
      // an absent key leaves it, and the two are different instructions.
      for (const key of ["passport", "bankAccount", "workVisa"] as const) {
        if (key in numbers) row.numbers[key] = copyOf(numbers[key] ?? null);
      }
      if ("employmentPermit" in numbers) {
        employmentPermitNumber = copyOf(numbers.employmentPermit ?? null);
      }
    },

    async listSwitchedOffWarnings() {
      return [...switchedOff];
    },

    async saveSwitchedOffWarnings(kinds) {
      switchedOff = [...kinds];
    },

    async listDeferrals() {
      return structuredClone(deferrals);
    },

    async deferWarning(deferral) {
      deferrals = [
        ...deferrals.filter(
          (one) =>
            one.workerId !== deferral.workerId || one.fingerprint !== deferral.fingerprint,
        ),
        structuredClone(deferral),
      ];
    },

    async listHolidayAmendments(workerId) {
      return structuredClone(
        [...rowOf(workerId).amendments].sort((a, b) => a.agreedOn.localeCompare(b.agreedOn)),
      );
    },

    async saveHolidayAmendment(workerId, amendment) {
      rowOf(workerId).amendments.push(structuredClone(amendment));
    },
  };

  for (const profile of seed.workers ?? []) {
    workers.set(profile.id, {
      profile: structuredClone(profile),
      numbers: {},
      amendments: [],
      spans: structuredClone(seed.spans?.[profile.id] ?? []),
      months: new Map(
        (seed.months?.[profile.id] ?? []).map((record) => [
          monthKey(record.month),
          {
            ...structuredClone(record),
            // A seeded month was not edited after it was confirmed, so the two
            // instants are equal and it reads as *confirmed* rather than as
            // *corrected* (Part 5). A month the seed never confirmed is a draft
            // and this stamp values nothing.
            updatedAt: record.confirmedAt ?? new Date().toISOString(),
          },
        ]),
      ),
    });
  }

  return repository;
}

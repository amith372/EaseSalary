import type { SupabaseClient } from "@supabase/supabase-js";
import type { RestDay } from "@/lib/dates";
import { SEEDED_RATES, withFetchedRate } from "@/lib/datedRates";
import type { DatedRate, RateKey } from "@/lib/datedRates";
import type { SealedNumber } from "@/lib/encryption";
import { UnknownWorkerError } from "@/lib/engine/repository";
import type {
  MonthRecord,
  SalaryRepository,
  WorkerProfile,
} from "@/lib/engine/repository";
import type {
  Advance,
  Gender,
  IncomeTaxMode,
  IncomeTaxSetting,
  LineOverride,
  MonthFacts,
  MonthSpan,
  OpeningAdvance,
  ThirdPartyPayment,
  UserLine,
} from "@/lib/engine/types";
import type { SalaryChange } from "@/lib/engine/salary";
import {
  SEEDED_HOLIDAY_LISTS,
  withFetchedList,
  type Holiday,
  type HolidayList,
  type HolidaySource,
  type Religion,
} from "@/lib/holidayLists";
import { overlapsMonth } from "@/lib/spans";
import type { IsoDate, SpanKind } from "@/lib/types";

/**
 * The store the application actually keeps a household's facts in
 * (`build_plan.md` stage 3).
 *
 * **It is a substitution and not a rewrite**, which is what
 * `src/lib/engine/repository.ts` was shaped for: every caller in the
 * application already awaits a `SalaryRepository`, so the only line that
 * changes when this lands is the one in `src/lib/store.ts` that decides
 * which implementation a request gets. Nothing here is imported by the engine,
 * and the engine still names no vendor.
 *
 * **Row-level security is the isolation and this file adds none of its own.**
 * Every statement below goes through the signed-in person's own client, so the
 * policies of migrations 1 and 5 decide which rows it can see — a repository
 * that filtered by household in its own `where` clause would be a second
 * statement of the same rule, and the second copy is the one that comes to
 * disagree. The household id is passed in because a row being *written* has to
 * name one, never to decide what may be read.
 *
 * **It stores facts and never results** (`specs.md` Part 3), which the schema
 * already holds to: there is no column for a balance, and balances are replayed
 * from the opening position on every read.
 */

/**
 * The rates and the holiday lists a household holds, over what the application
 * ships knowing.
 *
 * **A fresh household has no rows and must still value a month.** The interface
 * promises `listRates` is seeded and never empty, and writing the seed into
 * every household at creation would put a copy of `SEEDED_RATES` in the
 * database — where a corrected seed would then reach no household that already
 * existed. Merging on the way out instead means the shipped figures are always
 * the current ones, and a fetched row replaces the shipped row for the same key
 * and date exactly as `withFetchedRate` already says it does.
 */
function ratesOver(stored: DatedRate[]): DatedRate[] {
  return stored.reduce(withFetchedRate, SEEDED_RATES);
}

function listsOver(stored: HolidayList[]): HolidayList[] {
  return stored.reduce(withFetchedList, SEEDED_HOLIDAY_LISTS);
}

interface WorkerRow {
  id: string;
  household_id: string;
  name: string;
  first_name: string;
  gender: Gender;
  employed_since: IsoDate;
  base_monthly_salary_agorot: number;
  rest_eve_supplement_agorot: number;
  rest_day: RestDay;
  recuperation_month: number;
  country: string;
  insurer: string;
  opening_vacation_days: number | string;
  opening_sick_days: number | string;
  opening_advances: OpeningAdvance[];
  standing_lines: UserLine[];
  salary_changes: SalaryChange[];
  holiday_source_kind: "country" | "religion" | null;
  holiday_source_religion: Religion | null;
  income_tax_mode: IncomeTaxMode;
  income_tax_percentage: number | string | null;
  work_visa_expiry: IsoDate | null;
  passport_expiry: IsoDate | null;
}

interface SpanRow {
  id: string;
  kind: SpanKind;
  from: IsoDate;
  to: IsoDate | null;
  note: string | null;
  fraction: number | string | null;
  worked: boolean | null;
}

interface MonthRow {
  year: number;
  month: number;
  confirmed_base_agorot: number;
  confirmed_minimum_agorot: number;
  confirmed_effective_from: IsoDate;
  terms_rest_day: RestDay;
  terms_rest_eve_supplement_agorot: number;
  terms_recuperation_month: number;
  terms_standing_lines: UserLine[];
  terms_income_tax_mode: IncomeTaxMode;
  terms_income_tax_percentage: number | string | null;
  advances: Advance[];
  third_party_payments: ThirdPartyPayment[];
  user_lines: UserLine[];
  overrides: Record<string, LineOverride>;
  income_tax_agorot: number;
  recuperation_day_rate_agorot: number | null;
  confirmed_at: string | null;
}

interface HolidayListRow {
  source_kind: "country" | "religion";
  source_key: string;
  year: number;
  source_url: string;
  name_he: string;
  holidays: Holiday[];
}

interface RateRow {
  key: RateKey;
  value: number | string;
  effective_from: IsoDate;
  source: string;
}

/**
 * A `numeric` arrives as a string from PostgREST, because a JSON number cannot
 * hold every `numeric` exactly and the wire format refuses to be the place that
 * loses the difference. Every `numeric` column in this schema holds a quantity
 * the application works in as a number — days accrued, a fraction of a day, a
 * tax rate, a rate in the dated table — so it is converted once, here, and
 * nowhere else.
 */
function numberOf(value: number | string): number {
  return typeof value === "string" ? Number(value) : value;
}

function holidaySourceOf(row: WorkerRow): HolidaySource | undefined {
  if (row.holiday_source_kind === null) return undefined;
  if (row.holiday_source_kind === "religion") {
    return {
      kind: "religion",
      religion: row.holiday_source_religion as Religion,
    };
  }
  return { kind: "country", code: row.country };
}

function incomeTaxOf(
  mode: IncomeTaxMode,
  percentage: number | string | null,
): IncomeTaxSetting {
  return percentage === null
    ? { mode }
    : { mode, percentage: numberOf(percentage) };
}

function profileOf(row: WorkerRow, permitExpiry: IsoDate | null): WorkerProfile {
  return {
    id: row.id,
    name: row.name,
    firstName: row.first_name,
    gender: row.gender,
    employedSince: row.employed_since,
    baseMonthlySalaryAgorot: row.base_monthly_salary_agorot,
    restEveSupplementAgorot: row.rest_eve_supplement_agorot,
    restDay: row.rest_day,
    recuperationMonth: row.recuperation_month,
    country: row.country,
    insurer: row.insurer,
    incomeTax: incomeTaxOf(row.income_tax_mode, row.income_tax_percentage),
    standingLines: row.standing_lines,
    salaryChanges: row.salary_changes,
    holidaySource: holidaySourceOf(row),
    openingPosition: {
      vacationDays: numberOf(row.opening_vacation_days),
      sickDays: numberOf(row.opening_sick_days),
      advances: row.opening_advances,
    },
    documents: {
      // **The permit is the employer's and the other two are the worker's**
      // (`specs.md` item 28): a household with two workers holds one permit
      // position and two visas, which is why this one is read off the household
      // row and written back to it.
      employmentPermitExpiry: permitExpiry,
      workVisaExpiry: row.work_visa_expiry,
      passportExpiry: row.passport_expiry,
    },
  };
}

function workerRowOf(profile: WorkerProfile, householdId: string) {
  const source = profile.holidaySource;
  return {
    id: profile.id,
    household_id: householdId,
    name: profile.name,
    first_name: profile.firstName,
    gender: profile.gender,
    employed_since: profile.employedSince,
    base_monthly_salary_agorot: profile.baseMonthlySalaryAgorot,
    rest_eve_supplement_agorot: profile.restEveSupplementAgorot,
    rest_day: profile.restDay,
    recuperation_month: profile.recuperationMonth,
    country: profile.country,
    insurer: profile.insurer,
    opening_vacation_days: profile.openingPosition.vacationDays,
    opening_sick_days: profile.openingPosition.sickDays,
    opening_advances: profile.openingPosition.advances,
    standing_lines: profile.standingLines,
    salary_changes: profile.salaryChanges ?? [],
    // **Her own country's list is stored as null and never as a copy of
    // `country`**, which is the interface's own rule: storing the exception is
    // what keeps one worker from having two fields that can disagree about
    // where her holidays come from.
    holiday_source_kind:
      source === undefined || source.kind === "country" ? null : "religion",
    holiday_source_religion:
      source !== undefined && source.kind === "religion"
        ? source.religion
        : null,
    income_tax_mode: profile.incomeTax.mode,
    income_tax_percentage: profile.incomeTax.percentage ?? null,
    work_visa_expiry: profile.documents.workVisaExpiry,
    passport_expiry: profile.documents.passportExpiry,
  };
}

function spanOf(row: SpanRow): MonthSpan {
  const span = {
    id: row.id,
    kind: row.kind,
    from: row.from,
    to: row.to,
    ...(row.note === null ? {} : { note: row.note }),
    ...(row.fraction === null ? {} : { fraction: numberOf(row.fraction) }),
    ...(row.worked === null ? {} : { worked: row.worked }),
  };
  // The check constraints of migration 5 are what make this cast a true
  // statement rather than a hope: only sickness may be open, and a holiday
  // always says whether she worked it.
  return span as MonthSpan;
}

function spanRowOf(workerId: string, span: MonthSpan) {
  return {
    worker_id: workerId,
    id: span.id,
    kind: span.kind,
    from: span.from,
    to: span.to ?? null,
    note: span.note ?? null,
    fraction: span.fraction ?? null,
    worked: "worked" in span ? span.worked : null,
  };
}

function recordOfRow(row: MonthRow): MonthRecord {
  return {
    month: { year: row.year, month: row.month },
    confirmedWage: {
      baseAgorot: row.confirmed_base_agorot,
      minimumAgorot: row.confirmed_minimum_agorot,
      effectiveFrom: row.confirmed_effective_from,
    },
    terms: {
      restDay: row.terms_rest_day,
      restEveSupplementAgorot: row.terms_rest_eve_supplement_agorot,
      recuperationMonth: row.terms_recuperation_month,
      incomeTax: incomeTaxOf(
        row.terms_income_tax_mode,
        row.terms_income_tax_percentage,
      ),
      standingLines: row.terms_standing_lines,
    },
    advances: row.advances,
    thirdPartyPayments: row.third_party_payments,
    userLines: row.user_lines,
    overrides: row.overrides,
    incomeTaxAgorot: row.income_tax_agorot,
    // Null is "not confirmed for this month" and never "worth nothing", so it
    // comes back absent and the engine falls back to the dated-rates table —
    // the same figure from the same source (`specs.md` item 15).
    ...(row.recuperation_day_rate_agorot === null
      ? {}
      : { recuperationDayRateAgorot: row.recuperation_day_rate_agorot }),
    ...(row.confirmed_at === null ? {} : { confirmedAt: row.confirmed_at }),
  };
}

function monthRowOf(workerId: string, record: MonthRecord) {
  return {
    worker_id: workerId,
    year: record.month.year,
    month: record.month.month,
    confirmed_base_agorot: record.confirmedWage.baseAgorot,
    confirmed_minimum_agorot: record.confirmedWage.minimumAgorot,
    confirmed_effective_from: record.confirmedWage.effectiveFrom,
    terms_rest_day: record.terms.restDay,
    terms_rest_eve_supplement_agorot: record.terms.restEveSupplementAgorot,
    terms_recuperation_month: record.terms.recuperationMonth,
    terms_standing_lines: record.terms.standingLines,
    terms_income_tax_mode: record.terms.incomeTax.mode,
    terms_income_tax_percentage: record.terms.incomeTax.percentage ?? null,
    advances: record.advances,
    third_party_payments: record.thirdPartyPayments,
    user_lines: record.userLines,
    overrides: record.overrides,
    income_tax_agorot: record.incomeTaxAgorot ?? 0,
    recuperation_day_rate_agorot: record.recuperationDayRateAgorot ?? null,
    confirmed_at: record.confirmedAt ?? null,
  };
}

function listOf(row: HolidayListRow): HolidayList {
  return {
    source:
      row.source_kind === "country"
        ? { kind: "country", code: row.source_key }
        : { kind: "religion", religion: row.source_key as Religion },
    year: row.year,
    sourceUrl: row.source_url,
    nameHe: row.name_he,
    holidays: row.holidays,
  };
}

function rateOf(row: RateRow): DatedRate {
  return {
    key: row.key,
    value: numberOf(row.value),
    effectiveFrom: row.effective_from,
    source: row.source,
  };
}

/** Postgres's hex-literal prefix, written with `String.raw` so the one
 * backslash in it cannot be read as an escape by anybody editing this line. */
const BYTEA = String.raw`\x`;

/**
 * A `bytea` on its way to PostgREST, which carries one as Postgres's own hex
 * literal -- a backslash, an x, and then two characters a byte. There is no
 * binary JSON, so this is the format and not a choice.
 */
function hexOf(sealed: SealedNumber | null | undefined): string | null {
  return sealed === null || sealed === undefined
    ? null
    : `${BYTEA}${Buffer.from(sealed).toString("hex")}`;
}

/**
 * The same on the way back. A column that is null is a number the family has
 * not entered, which is the ordinary state of every worker whose papers nobody
 * has typed in.
 */
function bytesOf(value: string | null | undefined): SealedNumber | null {
  if (value === null || value === undefined) return null;
  const hex = value.startsWith(BYTEA) ? value.slice(BYTEA.length) : value;
  return Buffer.from(hex, "hex");
}

/**
 * Every statement's failure is raised rather than swallowed.
 *
 * **A write that quietly did nothing is the worst failure this application can
 * have**: a mark that did not save looks exactly like a mark the user never
 * made, and the month it belongs to is exported wrong months later. PostgREST
 * reports a refusal — a policy that denied the row, a constraint that refused
 * the value — in the response rather than by throwing, so a caller that ignored
 * the error would carry on as though the row were there.
 */
function raise(error: { message: string } | null, what: string): void {
  if (error !== null) throw new Error(`${what}: ${error.message}`);
}

export function createPostgresRepository(
  client: SupabaseClient,
  householdId: string,
): SalaryRepository {
  /** Every span the worker has, which is how a month's are assembled: a spell
   * crossing a boundary is one spell and belongs to the worker (Part 3). */
  async function spansOf(workerId: string): Promise<MonthSpan[]> {
    const { data, error } = await client
      .from("spans")
      // `*` rather than the seven columns by name: two of them are `from` and
      // `to`, which a select list has to quote, and a quoting rule got wrong
      // here would read as a worker with no spans rather than as an error.
      .select("*")
      .eq("worker_id", workerId);
    raise(error, "could not read the spans");
    return ((data ?? []) as SpanRow[]).map(spanOf);
  }

  /**
   * Refuses a worker the household cannot reach, before anything is written
   * against her.
   *
   * **A worker who is not there and a worker in somebody else's household are
   * one answer here**, and that is row-level security working rather than a
   * distinction being lost: the policies make another household's worker
   * invisible, so the honest thing this can say is that there is no such
   * worker — which is what `UnknownWorkerError` already means.
   */
  async function requireWorker(workerId: string): Promise<void> {
    const { data, error } = await client
      .from("workers")
      .select("id")
      .eq("id", workerId)
      .maybeSingle();
    raise(error, "could not read the worker");
    if (data === null) throw new UnknownWorkerError(workerId);
  }

  async function permitExpiry(): Promise<IsoDate | null> {
    const { data, error } = await client
      .from("households")
      .select("employment_permit_expiry")
      .eq("id", householdId)
      .maybeSingle();
    raise(error, "could not read the household");
    return (data?.employment_permit_expiry as IsoDate | null) ?? null;
  }

  return {
    async listWorkers() {
      const [{ data, error }, permit] = await Promise.all([
        client.from("workers").select("*").order("created_at"),
        permitExpiry(),
      ]);
      raise(error, "could not read the workers");
      return ((data ?? []) as WorkerRow[]).map((row) => profileOf(row, permit));
    },

    async getWorker(workerId) {
      const [{ data, error }, permit] = await Promise.all([
        client.from("workers").select("*").eq("id", workerId).maybeSingle(),
        permitExpiry(),
      ]);
      raise(error, "could not read the worker");
      return data === null ? null : profileOf(data as WorkerRow, permit);
    },

    async saveWorker(profile) {
      const { error } = await client
        .from("workers")
        .upsert(workerRowOf(profile, householdId));
      raise(error, "could not save the worker");

      // The permit is the employer's, so saving her profile saves it on the
      // household. Written every time rather than only when it changed: the
      // profile is saved whole, and a conditional write here would be a second
      // rule about when a field is current.
      const { error: onHousehold } = await client
        .from("households")
        .update({
          employment_permit_expiry: profile.documents.employmentPermitExpiry,
        })
        .eq("id", householdId);
      raise(onHousehold, "could not save the employment permit");
    },

    async listSpans(workerId) {
      await requireWorker(workerId);
      return spansOf(workerId);
    },

    async saveSpan(workerId, span) {
      await requireWorker(workerId);
      const { error } = await client
        .from("spans")
        .upsert(spanRowOf(workerId, span), { onConflict: "worker_id,id" });
      raise(error, "could not save the span");
    },

    async deleteSpan(workerId, spanId) {
      await requireWorker(workerId);
      const { error } = await client
        .from("spans")
        .delete()
        .eq("worker_id", workerId)
        .eq("id", spanId);
      raise(error, "could not delete the span");
    },

    async getMonth(workerId, month) {
      await requireWorker(workerId);
      const { data, error } = await client
        .from("months")
        .select("*")
        .eq("worker_id", workerId)
        .eq("year", month.year)
        .eq("month", month.month)
        .maybeSingle();
      raise(error, "could not read the month");
      if (data === null) return null;

      const spans = await spansOf(workerId);
      return {
        ...recordOfRow(data as MonthRow),
        spans: spans.filter((span) => overlapsMonth(span, month)),
      };
    },

    async listMonths(workerId) {
      await requireWorker(workerId);
      // Oldest first, which is the order `calculateSeries` replays them in. The
      // primary key is `worker_id, year, month`, so this reads the index in
      // order and sorts nothing.
      const [{ data, error }, spans] = await Promise.all([
        client
          .from("months")
          .select("*")
          .eq("worker_id", workerId)
          .order("year")
          .order("month"),
        spansOf(workerId),
      ]);
      raise(error, "could not read the months");

      return ((data ?? []) as MonthRow[]).map((row): MonthFacts => {
        const record = recordOfRow(row);
        return {
          ...record,
          spans: spans.filter((span) => overlapsMonth(span, record.month)),
        };
      });
    },

    async saveMonth(workerId, record) {
      await requireWorker(workerId);
      const { error } = await client
        .from("months")
        .upsert(monthRowOf(workerId, record), {
          onConflict: "worker_id,year,month",
        });
      raise(error, "could not save the month");
    },

    async listHolidayLists() {
      const { data, error } = await client.from("holiday_lists").select("*");
      raise(error, "could not read the holiday lists");
      return listsOver(((data ?? []) as HolidayListRow[]).map(listOf));
    },

    async saveHolidayList(list) {
      const { error } = await client.from("holiday_lists").upsert(
        {
          household_id: householdId,
          source_kind: list.source.kind,
          source_key:
            list.source.kind === "country"
              ? list.source.code
              : list.source.religion,
          year: list.year,
          source_url: list.sourceUrl,
          name_he: list.nameHe,
          holidays: list.holidays,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "household_id,source_kind,source_key,year" },
      );
      raise(error, "could not save the holiday list");
    },

    async listRates() {
      const { data, error } = await client.from("dated_rates").select("*");
      raise(error, "could not read the rates");
      return ratesOver(((data ?? []) as RateRow[]).map(rateOf));
    },

    /**
     * The four sealed numbers: three off the worker's row and one off the
     * household's (item 28).
     *
     * Read through the caller's own client like everything else here, so a
     * worker in another household comes back as no worker rather than as bytes
     * somebody else's key opens.
     */
    async sealedNumbers(workerId) {
      const [worker, household] = await Promise.all([
        client
          .from("workers")
          .select(
            "passport_number_encrypted,bank_account_number_encrypted,work_visa_number_encrypted",
          )
          .eq("id", workerId)
          .maybeSingle(),
        client
          .from("households")
          .select("employment_permit_number_encrypted")
          .eq("id", householdId)
          .maybeSingle(),
      ]);
      raise(worker.error, "could not read the identifying numbers");
      raise(household.error, "could not read the employment permit number");
      if (worker.data === null) throw new UnknownWorkerError(workerId);

      const row = worker.data as Record<string, string | null>;
      return {
        passport: bytesOf(row.passport_number_encrypted),
        bankAccount: bytesOf(row.bank_account_number_encrypted),
        workVisa: bytesOf(row.work_visa_number_encrypted),
        employmentPermit: bytesOf(
          (household.data as Record<string, string | null> | null)
            ?.employment_permit_number_encrypted ?? null,
        ),
      };
    },

    async saveSealedNumbers(workerId, numbers) {
      await requireWorker(workerId);

      // Built by `in` rather than by truthiness, because an explicit `null`
      // clears a number and an absent key leaves it: an object assembled from
      // "whatever is not undefined" would silently make those two the same
      // instruction, and the household's permit number is shared, so the
      // difference is somebody else's number being erased.
      const onWorker: Record<string, string | null> = {};
      if ("passport" in numbers) {
        onWorker.passport_number_encrypted = hexOf(numbers.passport);
      }
      if ("bankAccount" in numbers) {
        onWorker.bank_account_number_encrypted = hexOf(numbers.bankAccount);
      }
      if ("workVisa" in numbers) {
        onWorker.work_visa_number_encrypted = hexOf(numbers.workVisa);
      }
      if (Object.keys(onWorker).length > 0) {
        const { error } = await client
          .from("workers")
          .update(onWorker)
          .eq("id", workerId);
        raise(error, "could not save the identifying numbers");
      }

      if ("employmentPermit" in numbers) {
        const { error } = await client
          .from("households")
          .update({
            employment_permit_number_encrypted: hexOf(numbers.employmentPermit),
          })
          .eq("id", householdId);
        raise(error, "could not save the employment permit number");
      }
    },

    async saveRate(rate) {
      const { error } = await client.from("dated_rates").upsert(
        {
          household_id: householdId,
          key: rate.key,
          value: rate.value,
          effective_from: rate.effectiveFrom,
          source: rate.source,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "household_id,key,effective_from" },
      );
      raise(error, "could not save the rate");
    },
  };
}

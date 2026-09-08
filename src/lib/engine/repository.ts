import { compareMonth } from "@/lib/dates";
import { snapshotTerms } from "@/lib/engine/types";
import type {
  ConfirmedWage,
  MonthFacts,
  MonthSpan,
  WorkerTerms,
} from "@/lib/engine/types";
import { overlapsMonth } from "@/lib/spans";
import type { Worker, YearMonth } from "@/lib/types";

/**
 * Where a worker's facts are kept, said in a way that names no database.
 *
 * **No database client is named in this file or in anything it imports**, which
 * is the whole of its job (`build_plan.md`, the vertical slice). Stage 4's month
 * screen runs against the in-memory implementation below, and stage 3 lands its
 * Postgres one *beside* it rather than in front of it; without the interface the
 * screen would be gated on auth, row-level security and a schema, none of which
 * it needs in order to be right. The vendor is deliberately not written down even
 * here: `docs/plan-calculation-engine.md` verifies the rule by grepping this
 * directory for the name, and a comment explaining the rule would be the one hit
 * that makes the grep useless.
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
 * asynchronous here is what keeps stage 3 a substitution rather than a rewrite
 * of every caller.
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
export interface WorkerProfile extends Worker, WorkerTerms {}

/**
 * A month as the store holds it — everything in `MonthFacts` except its spans.
 *
 * **The omission is the point and not an economy.** Spans belong to the worker
 * (Part 3): a spell crossing a boundary is one spell, stored once, and reaching
 * both months whole is what lets each place a day at its right tier. A month's
 * `spans` are therefore *assembled* on the way out and can never be written on
 * the way in — the compiler refuses it, so nobody has to remember. Save a span
 * with `saveSpan` and the months it overlaps carry it from then on.
 */
export type MonthRecord = Omit<MonthFacts, "spans">;

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
}

/**
 * A month read back out of the store, on its way in again — `MonthFacts` less
 * the spans the store assembled onto it.
 *
 * It spreads rather than listing the fields, and that is deliberate: a field
 * added to `MonthFacts` later would be silently dropped on every save by a
 * function that named them one by one, which is a month quietly losing a fact
 * nobody would see until an export. `spans` is discarded rather than ignored,
 * because writing them back would write a second copy of a spell that belongs
 * to the worker and must stay one thing.
 */
export function recordOf(facts: MonthFacts): MonthRecord {
  const { spans, ...record } = facts;
  void spans;
  return record;
}

/**
 * The wage position a month opened after the fact carries — the position last
 * confirmed nearest to it.
 *
 * **A month the store has no record of has to get its wage from somewhere**
 * (specs.md item 4), and until stage 5 lands the dated-rates table there is
 * exactly one source in the application: the months the worker already has.
 * The latest month *before* the new one is the position that was standing when
 * it began, which is the answer for the ordinary case — a month filled in ahead
 * of time (item 21).
 *
 * **A month opened behind the whole history falls back to the earliest one**,
 * which is a family correcting a month from before they started using the
 * application. It is the closest figure that exists and it is not necessarily
 * the right one, because a minimum wage that rose since is not the one that was
 * in force then — and it does not have to be: the wage is confirmed by the user
 * before every export (item 4), which is where a carried figure is replaced by
 * a real one, and stage 5's dated-rates table is what answers this without
 * asking.
 *
 * `null` for a worker with no months at all, which is a worker who has nothing
 * to carry: there is no figure to invent one from, and inventing one is what
 * this returns `null` rather than doing.
 */
export function wageToCarry(
  months: MonthFacts[],
  month: YearMonth,
): ConfirmedWage | null {
  const ordered = [...months].sort((a, b) => compareMonth(a.month, b.month));
  const before = ordered.filter((each) => compareMonth(each.month, month) < 0);
  const nearest = before.length > 0 ? before[before.length - 1] : ordered[0];
  return nearest?.confirmedWage ?? null;
}

/**
 * A month the store had no record of, opened so that a fact can be recorded in
 * it (specs.md item 21).
 *
 * **It holds nothing but the position it opens from**, which is the whole of
 * what a draft month is (Part 5): no advance, no payment, no line of the user's
 * own, and an income-tax line at zero, because zero is what every month holds
 * until she says otherwise (item 17). The facts arrive afterwards, one gesture
 * at a time, which is what a month created by its first mark means.
 *
 * The terms are snapshotted off the profile as they stand now, the way every
 * other month's were: a month keeps the terms it was calculated with and never
 * reads the profile again (Part 3).
 */
export function openMonthRecord(
  profile: WorkerProfile,
  month: YearMonth,
  confirmedWage: ConfirmedWage,
): MonthRecord {
  return {
    month,
    confirmedWage,
    terms: snapshotTerms(profile),
    advances: [],
    thirdPartyPayments: [],
    userLines: [],
    incomeTaxAgorot: 0,
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

interface WorkerRow {
  profile: WorkerProfile;
  spans: MonthSpan[];
  months: Map<string, MonthRecord>;
}

/**
 * The store the vertical slice runs on, and the one the tests run on.
 *
 * **It copies on the way in and on the way out.** A caller that mutated what it
 * read would otherwise be mutating the store, which is a bug that cannot happen
 * against Postgres and would therefore appear only after stage 3 replaced this —
 * the worst possible moment to find it. The copies are what make this
 * implementation *behave* like a database rather than merely satisfy its
 * signature.
 */
export function createInMemoryRepository(
  seed: {
    workers?: WorkerProfile[];
    spans?: Record<string, MonthSpan[]>;
    months?: Record<string, MonthRecord[]>;
  } = {},
): SalaryRepository {
  const workers = new Map<string, WorkerRow>();

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

    async saveWorker(profile) {
      const existing = workers.get(profile.id);
      workers.set(profile.id, {
        profile: structuredClone(profile),
        spans: existing?.spans ?? [],
        months: existing?.months ?? new Map(),
      });
    },

    async listSpans(workerId) {
      return structuredClone(rowOf(workerId).spans);
    },

    async saveSpan(workerId, span) {
      const row = rowOf(workerId);
      const copy = structuredClone(span);
      const at = row.spans.findIndex((existing) => existing.id === span.id);
      if (at === -1) row.spans.push(copy);
      else row.spans[at] = copy;
    },

    async deleteSpan(workerId, spanId) {
      const row = rowOf(workerId);
      row.spans = row.spans.filter((span) => span.id !== spanId);
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
      const row = rowOf(workerId);
      row.months.set(monthKey(record.month), structuredClone(record));
    },
  };

  for (const profile of seed.workers ?? []) {
    workers.set(profile.id, {
      profile: structuredClone(profile),
      spans: structuredClone(seed.spans?.[profile.id] ?? []),
      months: new Map(
        (seed.months?.[profile.id] ?? []).map((record) => [
          monthKey(record.month),
          structuredClone(record),
        ]),
      ),
    });
  }

  return repository;
}

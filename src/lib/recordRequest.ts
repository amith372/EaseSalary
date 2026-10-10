import { compareMonth, parseYearMonth, yearMonthText } from "@/lib/dates";
import { thirdPartyKinds, type ThirdPartyKind } from "@/lib/engine/types";
import type { Worker, YearMonth } from "@/lib/types";

/**
 * What an alert's own button carries to `/payments` (specs.md item 27): the
 * worker the entry is about, the payment it names, and the months that payment
 * covers — so the user arrives at the control that settles the entry rather
 * than at the screen that holds it.
 *
 * **It is read here and nowhere else, because the application wrote none of
 * what arrives.** The address is editable, bookmarkable and reachable from
 * outside (Part 3), so every part of it is checked against something real: the
 * kind against `thirdPartyKinds`, the worker against the household the request
 * already assembled, and the two months against each other. Anything that does
 * not answer is `null`, and the screen opens as it opens without it — a link
 * naming a worker who has left the household is a link that must not choose one
 * of the remaining workers on the user's behalf.
 *
 * **Nothing here decides whether the payment may be recorded.** What is carried
 * is an offer like any other (item 16): the kind the month has already paid, the
 * period the family changes because they paid late, the worker they switch away
 * from. The refusals stay in the engine and on the server, where they were
 * before this file existed.
 */
export interface RecordRequest {
  /** Which third-party payment the entry was about, so the panel opens with
   * its chip chosen. */
  kind: ThirdPartyKind;
  workerId: string;
  /** The first and last month the payment covers — a quarter, where the
   * national insurance sent it. Not the month it is filed under and not the day
   * it was paid: item 16 keeps the three apart. */
  from: YearMonth;
  to: YearMonth;
}

/** One value of a parameter that may legitimately arrive repeated. The first is
 * taken rather than the pair refused, as `pickerReturnOf` takes it. */
function one(asked: string | string[] | undefined): string | undefined {
  return Array.isArray(asked) ? asked[0] : asked;
}

/**
 * The request the address names, or `null` where it names none.
 *
 * `workers` is the household as the request already holds it, which is what
 * makes the worker check a real one: an id is honoured only where the account
 * still has that worker.
 */
export function recordRequestOf(
  searchParams: Record<string, string | string[] | undefined>,
  workers: readonly Pick<Worker, "id">[],
): RecordRequest | null {
  const kind = thirdPartyKinds.find(
    (candidate) => candidate === one(searchParams.record),
  );
  if (kind === undefined) return null;

  const workerId = one(searchParams.worker);
  if (workerId === undefined) return null;
  if (!workers.some((worker) => worker.id === workerId)) return null;

  const fromText = one(searchParams.from);
  const toText = one(searchParams.to);
  if (fromText === undefined || toText === undefined) return null;
  const from = parseYearMonth(fromText);
  const to = parseYearMonth(toText);
  if (from === null || to === null) return null;
  // Refused and never reordered, for the reason `coveredMonths` gives: which
  // way round the period was meant is not the application's to decide, and a
  // period silently flipped is one nobody checks.
  if (compareMonth(from, to) > 0) return null;

  return { kind, workerId, from, to };
}

/** The address an alert's button carries (specs.md item 27). Built here so the
 * link and the parser above cannot spell the four parameters differently. */
export function recordRequestHref(request: RecordRequest): string {
  const params = new URLSearchParams({
    record: request.kind,
    worker: request.workerId,
    from: yearMonthText(request.from),
    to: yearMonthText(request.to),
  });
  return `/payments?${params.toString()}`;
}

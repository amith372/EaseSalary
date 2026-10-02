"use server";

import { randomUUID } from "node:crypto";
import { answering, DONE, type ActionFault, type Done } from "@/lib/actionFault";
import { revalidatePath } from "next/cache";
import { getRepository, requireWorker } from "@/lib/store";
import {
  advanceLedger,
  reviewAdvance,
  reviewAdvanceEdit,
  reviewAdvanceSplit,
  whyRemovalIsRefused,
  withAdvanceSplitMovements,
  withUpdatedAdvance,
  withoutAdvance,
} from "@/lib/engine/advances";
import type {
  AdvanceDraft,
  AdvanceEditDraft,
  AdvanceRefusal,
  AdvanceSplitDraft,
} from "@/lib/engine/advances";
import {
  reviewOverride,
  withOverride,
  withoutOverride,
} from "@/lib/engine/overrides";
import type { OverrideDraft, OverrideRefusal } from "@/lib/engine/overrides";
import { recordOf } from "@/lib/engine/repository";
import type { MonthRecord, WorkerProfile } from "@/lib/engine/repository";
import {
  reviewTaxPercentage,
  taxFromPercentage,
} from "@/lib/engine/incomeTax";
import type { TaxCorrectionUnit } from "@/lib/engine/incomeTax";
import { lineKeys } from "@/lib/engine/lines";
import { monthInSeries } from "@/lib/householdSeries";
import {
  reviewThirdPartyPayment,
  thirdPartyLineKey,
  withoutThirdPartyPayment,
} from "@/lib/engine/thirdParty";
import type {
  ThirdPartyDraft,
  ThirdPartyRefusal,
} from "@/lib/engine/thirdParty";
import type {
  AdvanceKind,
  MonthSpan,
  ThirdPartyKind,
} from "@/lib/engine/types";
import { reviewUserLine, withoutOneOffUserLine } from "@/lib/engine/userLines";
import type { UserLineDraft, UserLineRefusal } from "@/lib/engine/userLines";
import { he } from "@/lib/i18n/he";
import { parseShekels } from "@/lib/money";
import {
  applyMark,
  partIsAllowed,
  touchesRange,
  type MarkIntent,
  type SkippedDay,
} from "@/lib/spans";
import { compareMonth, monthOf, orderDates, sameMonth } from "@/lib/dates";
import { isBeforeFirstMonth, openMonthIfMissing } from "@/lib/workerMonths";
import { readToday } from "@/lib/requestToday";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * Everything the month screen can change, and the only way it changes
 * anything.
 *
 * **The browser collects the gesture and the server decides what it means**
 * (`specs.md` Part 3). The calendar hands up a range and a kind; which days
 * inside that range may actually take the mark is an entitlement question — a
 * vacation span skips its rest days and a sick span keeps them (items 5 and 8) —
 * and it is answered here, against the worker's stored rest day, by the same
 * `spans.ts` the suite tests. A client that decided it for itself would be a
 * second rule to keep in step with the first, and the one the user could reach
 * by hand.
 *
 * Each action revalidates the route, so the page re-renders from the store and
 * the preview beside the calendar is the engine's answer to what was just saved
 * rather than a figure the browser guessed while waiting.
 */

/** What a sweep answers: the days inside it that could not take the mark, or
 * a fault. The days are not a refusal — the sweep was saved and these are what
 * it skipped (items 5, 8) — so they travel on the success and not beside a
 * reason. */
export type MarkRangeResult =
  | { ok: true; skipped: SkippedDay[] }
  | ActionFault;

export async function markRange(
  workerId: string,
  intent: MarkIntent,
): Promise<MarkRangeResult> {
  return answering(async () => {
    // **The part of a day, checked and not trusted.** Only one day of vacation
    // may be taken in part (specs.md item 7), and the picker offers no other
    // combination — so a half day of sickness can only arrive from a crafted
    // request, and it is refused the way an unknown worker id is rather than
    // stored as something the user never asked for.
    if (!partIsAllowed(intent)) {
      throw new Error(`A ${intent.kind} mark cannot be taken as part of a day`);
    }

    const repository = await getRepository();
    const profile = await requireWorker(workerId);
    // No calendar before the first month is drawn, so a mark there is a crafted
    // request and is refused like one (specs.md item 6).
    const range = orderDates(intent.from, intent.to);
    if (isBeforeFirstMonth(profile, monthOf(range.from))) {
      throw new Error(`A mark before the first month of ${workerId}`);
    }
    const existing = await repository.listSpans(workerId);

    // Their own rest day, read from the profile because this is a new mark and not
    // the recalculation of a month already confirmed — a month's stored terms are
    // what its *figures* are read against (Part 3), and those are the engine's.
    const { spans, skipped } = applyMark(intent, profile.restDay, existing);
    for (const span of spans) {
      await repository.saveSpan(workerId, span satisfies MonthSpan);
    }

    // **The month the user is looking at, and not the months the stored spans
    // reach.** A sweep is made on one calendar, so the month it is a fact about
    // is the one the range was swept in; a spell that merges with an existing one
    // across a boundary reaches a month the user did not open and need not open
    // it: the replay already values that month and hands it the spell (`series.ts`).
    if (spans.length > 0) {
      await openMonthIfMissing(repository, profile, monthOf(range.from));
    }

    // Every screen reads the same workers and months, so the whole tree is
    // revalidated: a list of routes kept by hand is a list that misses one.
    revalidatePath("/", "layout");
    // The days that could not take the mark and why, shown to the user rather
    // than absorbed silently (items 5, 8).
    return { ok: true, skipped };
  });
}

/**
 * Clearing takes a range the way marking does, and **a span is one thing**: a
 * range that touches a span clears the whole of it rather than punching a hole,
 * which for a spell of sickness would change what it pays by moving the day its
 * tiers are counted from (item 8).
 *
 * A holiday is not cleared by it. The date belongs to the year and not to the
 * month, and removing one is the yearly picker's (items 9, 10) — a sweep that
 * happened to cross one would otherwise delete a day the user never chose to
 * touch.
 */
export async function clearRange(
  workerId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<Done> {
  return answering(async () => {
    const repository = await getRepository();
    await requireWorker(workerId);
    const ordered = orderDates(from, to);

    for (const span of await repository.listSpans(workerId)) {
      if (span.kind === "holiday") continue;
      if (touchesRange(span, ordered.from, ordered.to)) {
        await repository.deleteSpan(workerId, span.id);
      }
    }

    revalidatePath("/", "layout");
    return DONE;
  });
}

/**
 * The one fact a month records about a holiday: whether they worked it (item 9).
 *
 * The span is saved again with the answer changed, which is all a holiday's
 * record is — the date is not touched, because it came from the year's chosen
 * list and moving it is the yearly picker's job (item 10).
 */
export async function setHolidayWorked(
  workerId: string,
  spanId: string,
  worked: boolean,
): Promise<Done> {
  return answering(async () => {
    const repository = await getRepository();
    await requireWorker(workerId);

    const span = (await repository.listSpans(workerId)).find(
      (candidate) => candidate.id === spanId,
    );
    // Not an error: a stale page can ask about a holiday the year no longer has,
    // and the answer to "did they work a day that is not a holiday" is nothing.
    // Done rather than a fault: the action answered, and what it answered is
    // that there was nothing to change.
    if (span === undefined || span.kind !== "holiday") return DONE;

    await repository.saveSpan(workerId, { ...span, worked });
    revalidatePath("/", "layout");
    return DONE;
  });
}

/**
 * The additional-payments group's actions (specs.md items 5, 17, 20).
 *
 * **They live in this file and the group they serve is on `/payments`**, which
 * is deliberate: what they change is a *month* — `incomeTaxAgorot`, `userLines`
 * and `advances` are all fields of `MonthFacts` — and they revalidate the route
 * that draws the consequences. Moving them beside the screen that calls them
 * would file them by which button presses them rather than by what they write.
 *
 * **Every one of them decides on the server**, for the reason the marking
 * actions already give: an action is reachable by a crafted request, and the
 * rule the browser applies while the user types has to be the same rule and not
 * a second one that agrees today. So the amount arrives as the user typed it
 * and `parseShekels` reads it here; the direction and the placement are checked
 * against their unions here; and the id a new line gets is minted here, because
 * an id is the store's to give and never the caller's (`repository.ts`).
 */

/** Why an action was refused, in the words the screen shows. `noMonth` is the
 * one the user cannot cause by typing: a month before the worker's first month,
 * or a month after the current one that nothing has opened yet. */
export type MonthActionRefusal =
  | UserLineRefusal
  | AdvanceRefusal
  | ThirdPartyRefusal
  | OverrideRefusal
  | "noMonth"
  | "entryUnknown"
  /** A percentage was typed against a month that has no ‏ברוטו‎ to take a
   * percentage of. It is refused rather than stored as zero, because zero is a
   * figure the user did not type. */
  | "noGross";

type MonthActionResult =
  | { ok: true }
  | { ok: false; reason: MonthActionRefusal }
  | ActionFault;

/**
 * The month a figure is being entered in, or `null`.
 *
 * A month nobody opened is opened first when the replay values it — from the
 * first month to the current one (Part 3) — because the screen shows it as an
 * ordinary month and a figure entered there has to land somewhere.
 */
async function monthToChange(
  workerId: string,
  profile: WorkerProfile,
  month: YearMonth,
) {
  if (compareMonth(month, monthOf(await readToday())) <= 0) {
    await openMonthIfMissing(await getRepository(), profile, month);
  }
  return (await getRepository()).getMonth(workerId, month);
}

/**
 * Read the month, change it, save it back.
 *
 * The spans are dropped on the way in and never on the way out: a month's spans
 * belong to the worker and are assembled by the repository (`MonthRecord` is
 * `MonthFacts` without them), so writing them back here would be writing a
 * second copy of a spell that must stay one thing.
 */
async function changeMonth(
  workerId: string,
  month: YearMonth,
  change: (record: MonthRecord) => MonthRecord,
): Promise<MonthActionResult> {
  const repository = await getRepository();
  const facts = await monthToChange(workerId, await requireWorker(workerId), month);
  if (facts === null) return { ok: false, reason: "noMonth" };

  await repository.saveMonth(workerId, change(recordOf(facts)));

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * The income tax corrected by hand (specs.md item 17).
 *
 * **It stores an override and not a figure of its own**: the engine works the
 * tax out from the month's gross, the brackets in force during it and the
 * worker's credit points, so a typed amount is an amount put over a figure the
 * application produced — exactly what an override is. It writes the same
 * `overrides` entry the generic control writes, so the row's badge, its stored
 * shape and its clearing are identical either way.
 *
 * **An empty field clears the override and does not mean zero.** There is a
 * worked-out figure underneath to go back to, so the two gestures mean opposite
 * things: an empty field says the application is right
 * after all, while a typed zero says this month withholds nothing and stores
 * that by hand for ever. `clearOverride`'s own docblock makes the same
 * distinction and this is the second place it bites.
 *
 * **It does not go through `setOverride`**, which validates a draft against the
 * engine's `overridable` — and the tax row answers `false` there on purpose, so
 * that the generic control does not offer a second way to write this same
 * amount. The reason lives beside the row in `month.ts`.
 *
 * The amount is stored positive and signed by the engine, so a tax can never be
 * entered in a direction that pays them.
 */
export async function setIncomeTax(
  workerId: string,
  month: YearMonth,
  amount: string,
  unit: TaxCorrectionUnit = "amount",
): Promise<MonthActionResult> {
  return answering(async () => {
    if (amount.trim() === "") {
      return clearOverride(workerId, month, lineKeys.incomeTax);
    }

    const agorot =
      unit === "percentage"
        ? await taxFromPercentageTyped(workerId, month, amount)
        : parseShekels(amount);
    if (agorot === null) return { ok: false, reason: "amount" };
    if (agorot === "noGross") return { ok: false, reason: "noGross" };

    return changeMonth(workerId, month, (record) =>
      withOverride(record, lineKeys.incomeTax, {
        agorot,
        label: he.sheet.lines.incomeTax,
      }),
    );
  });
}

/**
 * The month's hospital overtime, typed and never worked out (specs.md item 20).
 * An empty amount removes it; the note goes with the amount, so it is dropped
 * when the amount is.
 */
export async function setHospitalOvertime(
  workerId: string,
  month: YearMonth,
  amount: string,
  note: string,
): Promise<MonthActionResult> {
  return answering(async () => {
    if (amount.trim() === "") {
      return changeMonth(workerId, month, (record) => ({
        ...record,
        hospitalOvertime: undefined,
      }));
    }
    const agorot = parseShekels(amount);
    if (agorot === null || agorot <= 0) return { ok: false, reason: "amount" };
    const trimmed = note.trim();
    return changeMonth(workerId, month, (record) => ({
      ...record,
      hospitalOvertime: trimmed === "" ? { agorot } : { agorot, note: trimmed },
    }));
  });
}

/**
 * The month's own note (specs.md item 5). An empty note removes it, since a
 * blank note and no note mean the same thing.
 */
export async function setMonthNote(
  workerId: string,
  month: YearMonth,
  note: string,
): Promise<MonthActionResult> {
  return answering(async () => {
    const trimmed = note.trim();
    return changeMonth(workerId, month, (record) => ({
      ...record,
      note: trimmed === "" ? undefined : trimmed,
    }));
  });
}

/**
 * A percentage the user typed against one month, turned into the amount that is
 * actually stored.
 *
 * **The gross is read off the engine here and never taken from the browser.**
 * The figure the field previews beside itself is the same arithmetic, but a
 * percentage posted with a gross attached would let a stale screen — a month
 * whose sick spell moved in another tab — write an amount against a gross that
 * no longer exists. Part 3's rule is that the browser collects the gesture and
 * the server decides what it means, and "2.5% of this month" is a gesture whose
 * meaning is a month the server has to look at.
 *
 * **What is stored is the amount and never the percentage.** An override is an
 * amount put over a calculated figure; a percentage that stayed a percentage
 * would re-derive itself the next time anything about the month moved, which is
 * the one thing item 17 says an override must never do.
 *
 * A month with no gross has no percentage to take — the answer is `"noGross"`
 * rather than zero, because zero is a figure the user did not type and would be
 * stored by hand for ever.
 */
async function taxFromPercentageTyped(
  workerId: string,
  month: YearMonth,
  text: string,
): Promise<number | null | "noGross"> {
  const percentage = reviewTaxPercentage(text);
  if (percentage === null) return null;

  const inSeries = await linesOf(workerId, month);
  const gross = inSeries?.result.gross ?? null;
  if (gross === null || gross <= 0) return "noGross";

  return taxFromPercentage(percentage, gross);
}

/** A line of the user's own, added to this month alone (specs.md item 20). The
 * standing ones are terms of the employment and are set on the profile, whose
 * own actions are in `app/workers/actions.ts`. */
export async function addUserLine(
  workerId: string,
  month: YearMonth,
  draft: UserLineDraft,
): Promise<MonthActionResult> {
  return answering(async () => {
    const reviewed = reviewUserLine(draft, randomUUID());
    if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

    return changeMonth(workerId, month, (record) => ({
      ...record,
      userLines: [...record.userLines, reviewed.line],
    }));
  });
}

/**
 * A line removed, **and any amount the user typed over it removed with it**
 * (specs.md item 20). An override is addressed by the line's own key, so one
 * left behind is an amount waiting to reattach itself to a line that never
 * asked for it — and since it would then be the *stored* figure, the line it
 * landed on would show an amount nobody entered for it, marked as manual.
 */
export async function removeUserLine(
  workerId: string,
  month: YearMonth,
  lineId: string,
): Promise<MonthActionResult> {
  return answering(async () => {
    return changeMonth(workerId, month, (record) =>
      withoutOneOffUserLine(record, lineId),
    );
  });
}

/**
 * An advance given, or an instalment of one repaid (specs.md item 20).
 *
 * **The whole of the worker's history is read before the figure is accepted**,
 * because what is still owed is a fact about the employment and not about the
 * month being edited: an advance granted in February and repaid across March,
 * April and May is one debt, and the month on screen can see none of it. The
 * number a grant gets is minted from that same walk, so it is one past the
 * highest the worker carries and is never the caller's to choose.
 *
 * The two refusals that need the walk — more than is owed, and a repayment
 * before the advance was given — live here and not in `validateMonth`, for the
 * reason item 20 gives: a month the engine refuses stops the replay that
 * produces every later month's balances, so an over-repayment that reached
 * storage would close the screen it would have to be corrected on.
 */
export async function addAdvance(
  workerId: string,
  month: YearMonth,
  draft: AdvanceDraft,
): Promise<MonthActionResult> {
  return answering(async () => {
    const repository = await getRepository();
    const profile = await requireWorker(workerId);
    if ((await monthToChange(workerId, profile, month)) === null) {
      return { ok: false, reason: "noMonth" };
    }
    const months = await repository.listMonths(workerId);
    const facts = months.find((candidate) => sameMonth(candidate.month, month));
    if (facts === undefined) return { ok: false, reason: "noMonth" };

    const reviewed = reviewAdvance(draft, {
      ledger: advanceLedger(profile.openingPosition, months),
      monthAdvances: facts.advances,
      month,
    });
    if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

    return changeMonth(workerId, month, (record) => ({
      ...record,
      advances: [...record.advances, reviewed.advance],
    }));
  });
}

/**
 * A grant and the repayments it is split into, written in one go (specs.md item
 * 20).
 *
 * **What it writes is N ordinary repayments and no schedule.** Each instalment
 * is thereafter a movement the user could have typed one at a time — editable,
 * removable, overridable — and nothing remembers that they arrived together, so
 * correcting one rebalances none of the others. That is the whole reason this is
 * one action and not a new kind of record: the engine gains nothing, and no
 * second source of truth sits beside the replayed months (item 13).
 *
 * **All of it or none of it.** The span is reviewed whole before anything is
 * written, and the write is one `saveMonths` — one upsert, one transaction
 * (`supabase/repository.ts`) — so a month in the middle of the span cannot end
 * up holding a repayment of an advance that was never granted. A confirmed month
 * anywhere in the span refuses the lot, for the reason a holiday move is refused
 * the same way: a filed month is never rewritten by an action taken elsewhere.
 *
 * **The months of the span are opened first, including the ones ahead of
 * today.** A future month is opened by a gesture that records something in it,
 * exactly as marking a range ahead of time opens one (item 21) — and the
 * repayments of an advance given this month fall in the months after it by
 * definition.
 */
export async function splitAdvance(
  workerId: string,
  month: YearMonth,
  draft: AdvanceSplitDraft,
): Promise<MonthActionResult> {
  return answering(async () => {
    const repository = await getRepository();
    const profile = await requireWorker(workerId);
    if ((await monthToChange(workerId, profile, month)) === null) {
      return { ok: false, reason: "noMonth" };
    }
    const months = await repository.listMonths(workerId);
    const facts = months.find((candidate) => sameMonth(candidate.month, month));
    if (facts === undefined) return { ok: false, reason: "noMonth" };

    const reviewed = reviewAdvanceSplit(
      draft,
      {
        ledger: advanceLedger(profile.openingPosition, months),
        monthAdvances: facts.advances,
        month,
      },
      months
        .filter((candidate) => candidate.confirmedAt !== undefined)
        .map((candidate) => candidate.month),
    );
    if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

    // Every month of the span, read as it stands now. A month nobody had opened
    // is opened here — it is after the month the grant is in, so it is after
    // their first month and the wage carries into it, and the only way this
    // answers `null` is a month the worker cannot have at all.
    const records: MonthRecord[] = [];
    for (const repayment of reviewed.repayments) {
      await openMonthIfMissing(repository, profile, repayment.month);
      const stored = await repository.getMonth(workerId, repayment.month);
      if (stored === null) return { ok: false, reason: "noMonth" };
      // The grant goes in its own month, which is the span's first, and a
      // repayment in every month — written by the engine's own function, so the
      // months this produces are the months rule 12's agreement test holds the
      // sheet against.
      records.push(
        withAdvanceSplitMovements(
          recordOf(stored),
          month,
          reviewed.advance,
          repayment.agorot,
        ),
      );
    }

    await repository.saveMonths(workerId, records);

    revalidatePath("/", "layout");
    return { ok: true };
  });
}

/**
 * A movement removed, **and any amount the user typed over it removed with it**
 * (specs.md items 17, 20) — the same rule `removeUserLine` follows, and for the
 * same reason: an override left behind is an amount waiting to reattach itself
 * to a row that never asked for it.
 *
 * **It reads the whole history too, because removing a grant can be refused.**
 * A grant is what makes the debt, so taking February's away while March still
 * repays it would leave repayments of a debt that never existed — the negative
 * balance item 20 refuses from the other direction when it refuses
 * over-repaying. The repayments come off first, and only then the grant.
 */
export async function removeAdvance(
  workerId: string,
  month: YearMonth,
  advanceNumber: number,
  kind: AdvanceKind,
): Promise<MonthActionResult> {
  return answering(async () => {
    const repository = await getRepository();
    const profile = await requireWorker(workerId);
    const months = await repository.listMonths(workerId);
    const facts = months.find((candidate) => sameMonth(candidate.month, month));
    if (facts === undefined) return { ok: false, reason: "noMonth" };

    const ledger = advanceLedger(profile.openingPosition, months);
    const refused = whyRemovalIsRefused(
      ledger.find((standing) => standing.number === advanceNumber),
      facts.advances.find(
        (advance) => advance.number === advanceNumber && advance.kind === kind,
      ),
    );
    if (refused !== null) return { ok: false, reason: refused };

    return changeMonth(workerId, month, (record) =>
      withoutAdvance(record, advanceNumber, kind),
    );
  });
}

/**
 * A movement corrected in place (specs.md item 20).
 *
 * **What the month itself recorded is edited and never overridden**, which is
 * the division item 17 draws: the amount of an advance *is* what the user
 * typed, so an override on it would be a second amount standing in front of the
 * first with nothing on screen to say which is which. Removing it and recording
 * it again is not the same gesture either — a grant would be minted a new
 * number, and the number is what the closing block's row and the family's own
 * workbook call the advance.
 *
 * **It reads the whole history, for the reason `addAdvance` gives**: what is
 * still owed is a fact about the employment and not about the month on screen,
 * and a correction can break the ledger from either side — a grant made smaller
 * than what has been repaid, or a repayment made larger than the debt.
 */
export async function updateAdvance(
  workerId: string,
  month: YearMonth,
  advanceNumber: number,
  kind: AdvanceKind,
  draft: AdvanceEditDraft,
): Promise<MonthActionResult> {
  return answering(async () => {
    const repository = await getRepository();
    const profile = await requireWorker(workerId);
    const months = await repository.listMonths(workerId);
    const facts = months.find((candidate) => sameMonth(candidate.month, month));
    if (facts === undefined) return { ok: false, reason: "noMonth" };

    const movement = facts.advances.find(
      (advance) => advance.number === advanceNumber && advance.kind === kind,
    );
    const standing = advanceLedger(profile.openingPosition, months).find(
      (candidate) => candidate.number === advanceNumber,
    );
    // A page held open over a movement another tab has since removed. Refused
    // rather than recorded again, as `updateUserLine` refuses it: they are looking
    // at a form for something that is gone.
    if (movement === undefined || standing === undefined) {
      return { ok: false, reason: "entryUnknown" };
    }

    const reviewed = reviewAdvanceEdit(draft, movement, standing);
    if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

    return changeMonth(workerId, month, (record) =>
      withUpdatedAdvance(record, reviewed.advance),
    );
  });
}

/**
 * A payment to somebody other than the worker, recorded in the month it left
 * the account (specs.md item 16).
 *
 * **The month is read before the draft is accepted**, because the rule that
 * decides this one is a fact about the month and not about the draft: the sheet
 * holds one row per kind, so what makes a payment acceptable is which kinds the
 * month has already recorded. That is the shape `addAdvance` above already has,
 * and for the same reason — a rule that cannot be answered from the draft alone
 * is answered from the store first and the change made second, so that a
 * refused draft never reaches `saveMonth` at all.
 *
 * The screen additionally does not *offer* a kind the month already has, which
 * is why this refusal is reachable only from a stale page or a crafted request.
 * The offer is not the rule (Part 3).
 */
export async function addThirdPartyPayment(
  workerId: string,
  month: YearMonth,
  draft: ThirdPartyDraft,
): Promise<MonthActionResult> {
  return answering(async () => {
    const facts = await monthToChange(workerId, await requireWorker(workerId), month);
    if (facts === null) return { ok: false, reason: "noMonth" };

    const reviewed = reviewThirdPartyPayment(draft, facts.thirdPartyPayments);
    if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

    return changeMonth(workerId, month, (record) => ({
      ...record,
      thirdPartyPayments: [...record.thirdPartyPayments, reviewed.payment],
    }));
  });
}

/**
 * A payment removed, **and any amount the user typed over it removed with it**
 * (specs.md items 16, 17) — the same rule `removeUserLine` and `removeAdvance`
 * follow, and for the same reason: an override left behind is an amount waiting
 * to reattach itself to a row that never asked for it.
 *
 * The kind is the whole address, which is what one row per kind buys: there is
 * never a second payment of that kind to tell it apart from. Nothing refuses a
 * removal, either — unlike an advance, a payment to a third party is not the
 * thing some other row is counted against.
 */
export async function removeThirdPartyPayment(
  workerId: string,
  month: YearMonth,
  kind: ThirdPartyKind,
): Promise<MonthActionResult> {
  return answering(async () => {
    return changeMonth(workerId, month, (record) =>
      withoutThirdPartyPayment(record, kind),
    );
  });
}

/**
 * The lines the engine drew for one month of one worker (specs.md item 17).
 *
 * **An override is validated against the engine's own `overridable` and never
 * against a list of keys kept here.** Which rows are figures the application
 * worked out is known where each draft is made (`lines.ts`), so the question is
 * asked of the line rather than of its name — a whitelist in this file would
 * compile clean and quietly stop covering the next row the engine grows.
 *
 * The month comes from the household's replay, which is where the whole
 * history is walked and the clock is read once for the request. The worker is
 * still checked by name first: an action is reachable by a crafted request, and
 * an unknown id is a throw rather than a month that merely was not found.
 */
async function linesOf(workerId: string, month: YearMonth) {
  await requireWorker(workerId);
  return monthInSeries(workerId, month);
}

/**
 * An amount the application worked out, replaced by hand (specs.md item 17).
 *
 * **It is a magnitude and the row gives it its sign.** The figure travels as
 * the user typed it, `parseShekels` refuses a minus, and `toLine` signs what is
 * stored from the draft's own units — so an override typed over the sickness
 * deduction stays a deduction instead of turning into a payment while looking
 * like an ordinary correction.
 */
export async function setOverride(
  workerId: string,
  month: YearMonth,
  draft: OverrideDraft,
): Promise<MonthActionResult> {
  return answering(async () => {
    const entry = await linesOf(workerId, month);
    if (entry === null) return { ok: false, reason: "noMonth" };

    // **Both the columns and the closing block.** A standing line placed after
    // the month's total is a row of the closing block whose amount came from the
    // profile, so it is overridable too (item 17, `types.ts`) — and a call that
    // passed the columns alone would refuse the one override the block has.
    const reviewed = reviewOverride(draft, [
      ...entry.result.lines,
      ...entry.result.closing,
    ]);
    if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

    return changeMonth(workerId, month, (record) =>
      withOverride(record, reviewed.key, reviewed.override),
    );
  });
}

/**
 * An override cleared, and the row left derived again (specs.md item 17).
 *
 * **It is its own gesture and it asks nothing about the key**, which is the one
 * place this differs from setting one. Clearing and typing the calculated
 * figure back produce the same number and mean opposite things — one says the
 * application is right after all, the other stores that number by hand for
 * ever — and the override that most needs clearing is the one whose row the
 * month no longer draws, which a check against the drawn lines would refuse.
 */
export async function clearOverride(
  workerId: string,
  month: YearMonth,
  key: string,
): Promise<MonthActionResult> {
  return answering(async () => {
    return changeMonth(workerId, month, (record) => withoutOverride(record, key));
  });
}

/**
 * A line the user added, corrected in place (specs.md item 20).
 *
 * **All four of the things it records may change — the words, the amount, the
 * direction and the placement — and the id does not.** Removing it and adding
 * it again would lose the note and mint a new id, and the id is what the line's
 * own key is built from (item 17), so a reader looking for the line they
 * corrected would find one that had never existed before.
 *
 * Its amount is edited and never overridden, for the reason item 17 gives: what
 * is written on a one-off line is the figure itself, and nothing under it was
 * derived.
 */
export async function updateUserLine(
  workerId: string,
  month: YearMonth,
  lineId: string,
  draft: UserLineDraft,
): Promise<MonthActionResult> {
  return answering(async () => {
    // Reviewed with the id it already has, which is the whole of what makes this
    // an edit rather than a removal and an addition.
    const reviewed = reviewUserLine(draft, lineId);
    if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

    const repository = await getRepository();
    await requireWorker(workerId);
    const facts = await repository.getMonth(workerId, month);
    if (facts === null) return { ok: false, reason: "noMonth" };
    // A page held open over a line another tab has since removed. Refused rather
    // than added back: they are looking at a form for something that is gone.
    if (!facts.userLines.some((line) => line.id === lineId)) {
      return { ok: false, reason: "entryUnknown" };
    }

    return changeMonth(workerId, month, (record) => ({
      ...record,
      userLines: record.userLines.map((line) =>
        line.id === lineId ? reviewed.line : line,
      ),
    }));
  });
}

/**
 * A payment to a third party, corrected in place (specs.md item 16).
 *
 * **Every one of its four things may change, the kind included.** Correcting it
 * by removing it and recording it again is the same two refusals read twice and
 * loses the note in between, so the entry is reopened with what it holds.
 *
 * **The kind is checked against the month's *other* payments and not against
 * all of them**, or a payment whose kind did not change would be refused as a
 * second payment of its own kind. The sheet still holds one row per kind, so
 * changing it to one the month already records is refused exactly as recording
 * a second would be.
 *
 * **A changed kind takes any override addressed to the old row with it**, for
 * the reason item 16 gives for a removal: an override is addressed by the row's
 * own key, and one left behind is an amount waiting to reattach itself to a row
 * that never asked for it. No row of column H is overridable (item 17), so this
 * can only reach an amount stored before that division was drawn — which is
 * exactly the amount nobody would think to look for.
 */
export async function updateThirdPartyPayment(
  workerId: string,
  month: YearMonth,
  kind: ThirdPartyKind,
  draft: ThirdPartyDraft,
): Promise<MonthActionResult> {
  return answering(async () => {
    const repository = await getRepository();
    await requireWorker(workerId);

    const facts = await repository.getMonth(workerId, month);
    if (facts === null) return { ok: false, reason: "noMonth" };

    const others = facts.thirdPartyPayments.filter(
      (payment) => payment.kind !== kind,
    );
    if (others.length === facts.thirdPartyPayments.length) {
      return { ok: false, reason: "entryUnknown" };
    }

    const reviewed = reviewThirdPartyPayment(draft, others);
    if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

    return changeMonth(workerId, month, (record) => {
      const changed = {
        ...record,
        // Replaced where it stood, so the list does not reorder itself under a
        // user who only changed an amount.
        thirdPartyPayments: record.thirdPartyPayments.map((payment) =>
          payment.kind === kind ? reviewed.payment : payment,
        ),
      };
      return reviewed.payment.kind === kind
        ? changed
        : withoutOverride(changed, thirdPartyLineKey(kind));
    });
  });
}

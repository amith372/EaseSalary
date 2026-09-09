"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/dev/store";
import {
  advanceLedger,
  reviewAdvance,
  whyRemovalIsRefused,
  withoutAdvance,
} from "@/lib/engine/advances";
import type { AdvanceDraft, AdvanceRefusal } from "@/lib/engine/advances";
import {
  reviewOverride,
  withOverride,
  withoutOverride,
} from "@/lib/engine/overrides";
import type { OverrideDraft, OverrideRefusal } from "@/lib/engine/overrides";
import { openMonthRecord, recordOf, wageToCarry } from "@/lib/engine/repository";
import type { MonthRecord, WorkerProfile } from "@/lib/engine/repository";
import { calculateSeries } from "@/lib/engine/series";
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
import { parseShekels } from "@/lib/money";
import {
  applyMark,
  partIsAllowed,
  touchesRange,
  type MarkIntent,
  type SkippedDay,
} from "@/lib/spans";
import { monthOf, orderDates, sameMonth } from "@/lib/dates";
import { todayInIsrael } from "@/lib/today";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * The three things the month screen can change, and the only way it changes
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

/**
 * Both routes that read the month, revalidated together.
 *
 * **Every action revalidates both, whichever screen called it**, because the
 * two screens are one month seen from its two ends (specs.md item 5): a figure
 * is entered on `/payments` and what it comes to is drawn on `/month`, and a
 * page left holding the figures from before the change is the one failure the
 * split can produce. Which of the two the user is looking at is not this file's
 * to know, and an action that revalidated only its caller's route would leave
 * the other stale until something else happened to touch it.
 */
function revalidateMonth(): void {
  revalidatePath("/month");
  revalidatePath("/payments");
}

/** Asked to change a worker the store does not have. Actions are reachable by a
 * crafted request, so the id is checked rather than assumed — stage 3 adds the
 * household check beside this one. */
async function profileOf(workerId: string) {
  const profile = await (await getRepository()).getWorker(workerId);
  if (profile === null) throw new Error(`No worker with id ${workerId}`);
  return profile;
}

/**
 * The month a mark is being made in, opened if the store has no record of it
 * (specs.md item 21).
 *
 * **A month is created by the first mark on its calendar and by nothing else.**
 * Item 21 says a future month is filled in ahead of time *through the calendar*,
 * and that is the whole of the gesture: no button that says "start this month",
 * nothing for the user to know about months existing, and no month brought into
 * being by a page merely being looked at — a render that writes is a store that
 * grows every time somebody steps forward through the stepper. Everything on
 * `/payments` is offered only for a month that already has a record, so the
 * calendar is also the only place the question can arise.
 *
 * It returns whether a month is now there. `false` is a worker with no months at
 * all, which is the one case `wageToCarry` cannot answer: the marks are still
 * saved — they belong to the worker (Part 3) — and the month shows as empty
 * until she has a wage position to open one from.
 */
async function openMonthIfMissing(
  workerId: string,
  profile: WorkerProfile,
  month: YearMonth,
): Promise<boolean> {
  const repository = await getRepository();
  if ((await repository.getMonth(workerId, month)) !== null) return true;

  const wage = wageToCarry(await repository.listMonths(workerId), month);
  if (wage === null) return false;

  await repository.saveMonth(workerId, openMonthRecord(profile, month, wage));
  return true;
}

export async function markRange(
  workerId: string,
  intent: MarkIntent,
): Promise<{ skipped: SkippedDay[] }> {
  // **The part of a day, checked and not trusted.** Only one day of vacation
  // may be taken in part (specs.md item 7), and the picker offers no other
  // combination — so a half day of sickness can only arrive from a crafted
  // request, and it is refused the way an unknown worker id is rather than
  // stored as something the user never asked for.
  if (!partIsAllowed(intent)) {
    throw new Error(`A ${intent.kind} mark cannot be taken as part of a day`);
  }

  const repository = await getRepository();
  const profile = await profileOf(workerId);
  const existing = await repository.listSpans(workerId);

  // Her own rest day, read from the profile because this is a new mark and not
  // the recalculation of a month already confirmed — a month's stored terms are
  // what its *figures* are read against (Part 3), and those are the engine's.
  const { spans, skipped } = applyMark(intent, profile.restDay, existing);
  for (const span of spans) {
    await repository.saveSpan(workerId, span satisfies MonthSpan);
  }

  // **The month the user is looking at, and not the months the stored spans
  // reach.** A sweep is made on one calendar, so the month it is a fact about
  // is the one the range was swept in; a spell that merges with an existing one
  // across a boundary reaches a month the user did not open and must not create
  // it, because a month that never happened accrued nothing (`series.ts`).
  if (spans.length > 0) {
    await openMonthIfMissing(workerId, profile, monthOf(orderDates(intent.from, intent.to).from));
  }

  revalidateMonth();
  // The days that could not take the mark and why, shown to the user rather
  // than absorbed silently (items 5, 8).
  return { skipped };
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
): Promise<void> {
  const repository = await getRepository();
  await profileOf(workerId);
  const ordered = orderDates(from, to);

  for (const span of await repository.listSpans(workerId)) {
    if (span.kind === "holiday") continue;
    if (touchesRange(span, ordered.from, ordered.to)) {
      await repository.deleteSpan(workerId, span.id);
    }
  }

  revalidateMonth();
}

/**
 * The one fact a month records about a holiday: whether she worked it (item 9).
 *
 * The span is saved again with the answer changed, which is all a holiday's
 * record is — the date is not touched, because it came from the year's chosen
 * list and moving it is the yearly picker's job (item 10).
 */
export async function setHolidayWorked(
  workerId: string,
  spanId: string,
  worked: boolean,
): Promise<void> {
  const repository = await getRepository();
  await profileOf(workerId);

  const span = (await repository.listSpans(workerId)).find(
    (candidate) => candidate.id === spanId,
  );
  // Not an error: a stale page can ask about a holiday the year no longer has,
  // and the answer to "did she work a day that is not a holiday" is nothing.
  if (span === undefined || span.kind !== "holiday") return;

  await repository.saveSpan(workerId, { ...span, worked });
  revalidateMonth();
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
 * one the user cannot cause by typing: it is a page held open over a month the
 * store has no record of, which until the future-month step exists is any month
 * outside the seeded range. */
export type MonthActionRefusal =
  | UserLineRefusal
  | AdvanceRefusal
  | ThirdPartyRefusal
  | OverrideRefusal
  | "noMonth"
  | "entryUnknown";

export type MonthActionResult =
  | { ok: true }
  | { ok: false; reason: MonthActionRefusal };

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
  await profileOf(workerId);

  const facts = await repository.getMonth(workerId, month);
  if (facts === null) return { ok: false, reason: "noMonth" };

  await repository.saveMonth(workerId, change(recordOf(facts)));

  revalidateMonth();
  return { ok: true };
}

/**
 * The income tax the user is withholding this month (specs.md item 17).
 *
 * It is never calculated and never will be: this action is the whole of how the
 * figure gets in. **Zero is an ordinary answer here and not a refusal**, which
 * is where this differs from a line the user adds — zero is what every month
 * holds until she says otherwise, so setting it back is how a tax entered by
 * mistake is taken off. It is stored positive and signed by the engine, so a
 * tax can never be entered in a direction that pays her.
 */
export async function setIncomeTax(
  workerId: string,
  month: YearMonth,
  amount: string,
): Promise<MonthActionResult> {
  const agorot = parseShekels(amount);
  if (agorot === null) return { ok: false, reason: "amount" };

  return changeMonth(workerId, month, (record) => ({
    ...record,
    incomeTaxAgorot: agorot,
  }));
}

/** A line of the user's own, added to this month alone (specs.md item 20). The
 * standing ones are terms of the employment and are set on the profile, whose
 * own actions are in `app/workers/actions.ts`. */
export async function addUserLine(
  workerId: string,
  month: YearMonth,
  draft: UserLineDraft,
): Promise<MonthActionResult> {
  const reviewed = reviewUserLine(draft, randomUUID());
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  return changeMonth(workerId, month, (record) => ({
    ...record,
    userLines: [...record.userLines, reviewed.line],
  }));
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
  return changeMonth(workerId, month, (record) =>
    withoutOneOffUserLine(record, lineId),
  );
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
  const repository = await getRepository();
  const profile = await profileOf(workerId);
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
  const repository = await getRepository();
  const profile = await profileOf(workerId);
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
  const repository = await getRepository();
  await profileOf(workerId);

  const facts = await repository.getMonth(workerId, month);
  if (facts === null) return { ok: false, reason: "noMonth" };

  const reviewed = reviewThirdPartyPayment(draft, facts.thirdPartyPayments);
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  return changeMonth(workerId, month, (record) => ({
    ...record,
    thirdPartyPayments: [...record.thirdPartyPayments, reviewed.payment],
  }));
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
  return changeMonth(workerId, month, (record) =>
    withoutThirdPartyPayment(record, kind),
  );
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
 * It replays the worker's whole history for the same reason `/month` does:
 * balances are never stored, and a month calculated alone would open from
 * nothing (item 13). Reading the clock is safe here because this is an action
 * and not a render — what `CLAUDE.md` forbids is a clock read while a page is
 * being drawn, which is what makes the server and the browser disagree.
 */
async function linesOf(workerId: string, month: YearMonth) {
  const repository = await getRepository();
  const profile = await profileOf(workerId);
  const months = await repository.listMonths(workerId);
  const series = calculateSeries(months, profile, todayInIsrael());
  return series.find((entry) => sameMonth(entry.facts.month, month)) ?? null;
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
  return changeMonth(workerId, month, (record) => withoutOverride(record, key));
}

/**
 * A line the user added, corrected in place (specs.md item 20).
 *
 * **All four of the things it records may change — the words, the amount, the
 * direction and the placement — and the id does not.** Removing it and adding
 * it again would lose the note and mint a new id, and the id is what the line's
 * own key is built from (item 17), so a reader looking for the line she
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
  // Reviewed with the id it already has, which is the whole of what makes this
  // an edit rather than a removal and an addition.
  const reviewed = reviewUserLine(draft, lineId);
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  const repository = await getRepository();
  await profileOf(workerId);
  const facts = await repository.getMonth(workerId, month);
  if (facts === null) return { ok: false, reason: "noMonth" };
  // A page held open over a line another tab has since removed. Refused rather
  // than added back: she is looking at a form for something that is gone.
  if (!facts.userLines.some((line) => line.id === lineId)) {
    return { ok: false, reason: "entryUnknown" };
  }

  return changeMonth(workerId, month, (record) => ({
    ...record,
    userLines: record.userLines.map((line) =>
      line.id === lineId ? reviewed.line : line,
    ),
  }));
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
  const repository = await getRepository();
  await profileOf(workerId);

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
}

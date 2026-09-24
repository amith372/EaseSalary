"use server";

import { revalidatePath } from "next/cache";
import { getRepository, requireWorker } from "@/lib/store";
import { salaryFor } from "@/lib/engine/salary";
import {
  baseForMonth,
  blocksExport,
  recuperationToConfirm,
  reviewRecuperationRate,
  reviewReturnDate,
  reviewWageConfirmation,
  spellEndFromReturn,
} from "@/lib/engine/beforeExport";
import { recordOf } from "@/lib/engine/repository";
import type { SalaryRepository, WorkerProfile } from "@/lib/engine/repository";
import { taxToConfirm } from "@/lib/engine/taxConfirmation";
import {
  compareMonth,
  isIsoDate,
  monthOf as monthOfDate,
} from "@/lib/dates";
import { openMonthIfMissing } from "@/lib/workerMonths";
import { parseShekels } from "@/lib/money";
import { readNow, readToday } from "@/lib/requestToday";
import type { YearMonth } from "@/lib/types";

/**
 * The two things the pre-export screen can change (specs.md items 4, 15
 * and 18).
 *
 * **The browser collects the gesture and the server decides what it means**
 * (Part 3), which on this screen is more than a convention: confirming is the
 * moment a month stops moving with the profile, and what is written is settled
 * against the worker's own salary rather than against whatever the form
 * offered. A request crafted past the form meets exactly the same checks.
 *
 * **The questions themselves are never sent, and that is deliberate.** They are
 * not facts about the month and nothing stores them: item 18 says exporting
 * *begins* with them, so they are asked again before every export and answered
 * in the conversation. What reaches the server is the confirmations they lead
 * to — the two figures the application could not derive.
 *
 * **Only async functions are exported from a `"use server"` module**, so the
 * rules these actions are checked by live in `engine/beforeExport.ts`, where
 * the suite reaches them without a request.
 */

/** Why a gesture was refused. A refusal carries the reason it was refused
 * (specs.md item 25), and the sentence for each is in `he.ts`. */
export type BeforeExportRefusal = "amount" | "beforeTheSpell" | "blocked";

export type BeforeExportResult =
  | { ok: true }
  | { ok: false; reason: BeforeExportRefusal };

/** Asked about a worker or a month the store does not have. Actions are
 * reachable by a crafted request, so both are checked rather than assumed.
 *
 * A month nobody opened is opened here, as it stands in the replay: confirming
 * is the first fact recorded in it (`openMonthIfMissing`). Only a month that
 * has begun; a later one cannot be exported yet (item 21). */
async function monthOf(workerId: string, month: YearMonth) {
  const repository = await getRepository();
  const profile = await requireWorker(workerId, repository);
  if (compareMonth(month, monthOfDate(await readToday())) <= 0) {
    await openMonthIfMissing(repository, profile, month);
  }
  const facts = await repository.getMonth(workerId, month);
  if (facts === null) {
    throw new Error(`No month ${month.year}-${month.month} for ${workerId}`);
  }
  return { repository, profile, facts };
}

/**
 * The spell of sickness closed by the day the worker came back (specs.md items
 * 8 and 18).
 *
 * **The span is saved again with an end and never as a second span.** A spell
 * belongs to the worker, crosses month boundaries as one thing, and counts its
 * tiers from its own first day — so closing it writes a `to` onto the span that
 * is already there, which is what `SalaryRepository.saveSpan` describes.
 *
 * The end is the day *before* she returned. The arithmetic is in the engine and
 * not in the browser, so the one place it happens has a test on it.
 */
export async function closeSickSpell(
  workerId: string,
  spanId: string,
  returnedOn: string,
): Promise<BeforeExportResult> {
  const repository = await getRepository();
  const spans = await repository.listSpans(workerId);
  const spell = spans.find((span) => span.id === spanId);
  // A span that is already closed, or one this worker does not have, is a
  // request the form cannot make. Refused as a date that cannot be accepted
  // rather than thrown: the screen's job is to say the gesture did nothing.
  if (spell === undefined || spell.to !== null) {
    return { ok: false, reason: "beforeTheSpell" };
  }
  if (!isIsoDate(returnedOn)) {
    return { ok: false, reason: "beforeTheSpell" };
  }
  if (reviewReturnDate(spell.from, returnedOn) !== null) {
    return { ok: false, reason: "beforeTheSpell" };
  }

  await repository.saveSpan(workerId, {
    ...spell,
    to: spellEndFromReturn(returnedOn),
  });
  // Every screen reads the same workers and months, so the whole tree is
  // revalidated: a list of routes kept by hand is a list that misses one.
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * The income tax the month is confirmed with (specs.md item 17): what the
 * engine works out for it now, from the same replay the screen showed her.
 *
 * **The calculation is `taxConfirmation.ts`'s and not this action's**, because
 * the before-export screen puts the very same figure to the user before this
 * runs: two copies of it would agree today and drift the first time either was
 * corrected, and the family would confirm one number and file another
 * (`CLAUDE.md` rule 12).
 */
async function taxConfirmedFor(
  repository: SalaryRepository,
  profile: WorkerProfile,
  month: YearMonth,
): Promise<number> {
  const confirmed = taxToConfirm(
    await repository.listMonths(profile.id),
    profile,
    await readToday(),
    await repository.listRates(),
    await repository.listTaxBrackets(),
    month,
  );
  // A month outside the series cannot be reached from this action — the
  // confirmation reads it first — and a tax of nothing is the safe reading of
  // a month the engine will not value.
  return confirmed?.agorot ?? 0;
}

/** The figures the confirmation carries. Text, because they are what was typed
 * into fields; `parseShekels` is what turns them into agorot, and it is the
 * same reader every other amount in the application goes through. */
interface MonthConfirmation {
  /** The minimum wage the user confirmed — the offered figure unchanged, or the
   * one she typed instead (specs.md item 4). */
  minimumText: string;
  /** The date it took effect, always a first of month (item 4). */
  effectiveFrom: string;
  /** The recuperation day rate, in a month that owes recuperation and only
   * there (item 15). */
  recuperationRateText?: string;
}

/**
 * The month confirmed — what the export button does before it hands over the
 * file.
 *
 * **Three things are written, and they are written together.** The minimum wage
 * with the date it took effect, so the month stays valued at the rate in force
 * during it; the base monthly salary copied off the profile — or the minimum
 * where the profile sits below it (item 3) — which is the
 * moment Part 5 calls *confirmed* and the moment the month's figures stop
 * moving with the profile; and, where the month owes recuperation, the day rate
 * it was valued at (item 15). One gesture, because they are one answer: a month
 * half-confirmed is a month that would have to say which half.
 *
 * **The confirmed wage also enters the household's rates table**, dated, and
 * only where that date does not already hold it. A figure the user typed
 * because the fetch failed is then known the next time a month is confirmed
 * rather than typed again, and it is dated because an undated figure is what
 * that table exists to refuse (item 4). Confirming an offered figure writes
 * nothing, because the row is already there and rewriting it would replace the
 * address it was fetched from with this action's own source -- one primary key,
 * so the write is a replacement -- and that address is what `/settings` shows
 * and what item 4 requires every row to carry.
 *
 * **The blocks are re-checked here rather than trusted from the screen.** A
 * disabled button is a courtesy; item 18's rule is that a month *is not
 * exported* over an unanswered open spell, and the only place that can be true
 * is on the server.
 */
export async function confirmMonth(
  workerId: string,
  month: YearMonth,
  confirmation: MonthConfirmation,
): Promise<BeforeExportResult> {
  const minimumAgorot = parseShekels(confirmation.minimumText);
  if (minimumAgorot === null) return { ok: false, reason: "amount" };
  // Item 4: the stored date is the official תאריך תחולה, which is always a
  // first of month. Anything else is a value this form never offered, so it is
  // refused rather than stored as a row claiming an impossible date.
  const effectiveFrom = confirmation.effectiveFrom;
  if (!isIsoDate(effectiveFrom) || !effectiveFrom.endsWith("-01")) {
    return { ok: false, reason: "amount" };
  }

  const { repository, profile, facts } = await monthOf(workerId, month);

  if (blocksExport(facts, await readToday()).length > 0) {
    return { ok: false, reason: "blocked" };
  }

  if (reviewWageConfirmation(minimumAgorot) !== null) {
    return { ok: false, reason: "amount" };
  }

  const rates = await repository.listRates();
  const owed = recuperationToConfirm(facts, profile, rates);
  let recuperationDayRateAgorot = facts.recuperationDayRateAgorot;
  if (owed !== null) {
    const typed = parseShekels(confirmation.recuperationRateText ?? "");
    if (typed === null || reviewRecuperationRate(typed) !== null) {
      return { ok: false, reason: "amount" };
    }
    recuperationDayRateAgorot = typed;
  }

  // **The row is written only where the figure is new to that date.** Confirming
  // an offered figure changes nothing about it, so a table whose row already
  // holds it is left alone -- and with it the address the fetch recorded, which
  // the same primary key would otherwise replace with the sentence below. A
  // figure the user typed instead is hers and carries her as its source.
  const held = rates.find(
    (rate) => rate.key === "minimumWage" && rate.effectiveFrom === effectiveFrom,
  );
  if (held?.value !== minimumAgorot) {
    await repository.saveRate({
      key: "minimumWage",
      value: minimumAgorot,
      effectiveFrom,
      // Where the figure came from, which every row in that table carries. This
      // one came from the person exporting the month, which is a source as much
      // as an address is and is more honest than naming a page it may not have
      // been read from.
      source: "אושר על ידי המשתמש/ת",
    });
  }

  await repository.saveMonth(workerId, {
    ...recordOf(facts),
    incomeTaxAgorot: await taxConfirmedFor(repository, profile, month),
    // Part 5's *confirmed* event, which `דף המשכורת` prints. Read from the
    // clock here, in the action, and never in the engine or a render.
    confirmedAt: await readNow(),
    confirmedWage: {
      // Item 3: a salary may never sit below the minimum wage, so a profile
      // still holding last year's figure is raised to the wage in force rather
      // than writing a month that pays under its own confirmed minimum. The
      // screen says so before the user presses.
      baseAgorot: baseForMonth(salaryFor(profile, facts.month), minimumAgorot),
      minimumAgorot,
      effectiveFrom,
    },
    ...(recuperationDayRateAgorot === undefined
      ? {}
      : { recuperationDayRateAgorot }),
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

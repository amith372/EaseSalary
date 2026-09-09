"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/dev/store";
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
import { parseShekels } from "@/lib/money";
import { todayInIsrael } from "@/lib/today";
import type { IsoDate, YearMonth } from "@/lib/types";

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

function revalidateMonth(): void {
  // Confirming writes the month's wage, and every screen that draws a month
  // derives its figures from it.
  revalidatePath("/month");
  revalidatePath("/month/export");
  revalidatePath("/payments");
}

/** Asked about a worker or a month the store does not have. Actions are
 * reachable by a crafted request, so both are checked rather than assumed —
 * stage 3 adds the household check beside them. */
async function monthOf(workerId: string, month: YearMonth) {
  const repository = await getRepository();
  const profile = await repository.getWorker(workerId);
  if (profile === null) throw new Error(`No worker with id ${workerId}`);
  const facts = await repository.getMonth(workerId, month);
  if (facts === null) {
    throw new Error(`No month ${month.year}-${month.month} for ${workerId}`);
  }
  return { repository, profile, facts };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
  if (!ISO_DATE.test(returnedOn)) {
    return { ok: false, reason: "beforeTheSpell" };
  }
  const returned = returnedOn as IsoDate;
  if (reviewReturnDate(spell.from, returned) !== null) {
    return { ok: false, reason: "beforeTheSpell" };
  }

  await repository.saveSpan(workerId, {
    ...spell,
    to: spellEndFromReturn(returned),
  });
  revalidateMonth();
  return { ok: true };
}

/** The figures the confirmation carries. Text, because they are what was typed
 * into fields; `parseShekels` is what turns them into agorot, and it is the
 * same reader every other amount in the application goes through. */
export interface MonthConfirmation {
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
 * The month confirmed — what the export button does, and until stage 2 puts a
 * file behind it, the whole of what it does (settled with the user on
 * 2026-09-09).
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
 * **The confirmed wage also enters the household's rates table**, dated. A
 * figure the user typed because the fetch failed is then known the next time a
 * month is confirmed rather than typed again, and it is dated because an
 * undated figure is what that table exists to refuse (item 4).
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
  if (!/^\d{4}-\d{2}-01$/.test(confirmation.effectiveFrom)) {
    return { ok: false, reason: "amount" };
  }
  const effectiveFrom = confirmation.effectiveFrom as IsoDate;

  const { repository, profile, facts } = await monthOf(workerId, month);

  if (blocksExport(facts, todayInIsrael()).length > 0) {
    return { ok: false, reason: "blocked" };
  }

  if (reviewWageConfirmation(minimumAgorot) !== null) {
    return { ok: false, reason: "amount" };
  }

  const owed = recuperationToConfirm(
    facts,
    profile,
    await repository.listRates(),
  );
  let recuperationDayRateAgorot = facts.recuperationDayRateAgorot;
  if (owed !== null) {
    const typed = parseShekels(confirmation.recuperationRateText ?? "");
    if (typed === null || reviewRecuperationRate(typed) !== null) {
      return { ok: false, reason: "amount" };
    }
    recuperationDayRateAgorot = typed;
  }

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

  await repository.saveMonth(workerId, {
    ...recordOf(facts),
    confirmedWage: {
      // Item 3: a salary may never sit below the minimum wage, so a profile
      // still holding last year's figure is raised to the wage in force rather
      // than writing a month that pays under its own confirmed minimum. The
      // screen says so before the user presses.
      baseAgorot: baseForMonth(profile.baseMonthlySalaryAgorot, minimumAgorot),
      minimumAgorot,
      effectiveFrom,
    },
    ...(recuperationDayRateAgorot === undefined
      ? {}
      : { recuperationDayRateAgorot }),
  });

  revalidateMonth();
  return { ok: true };
}

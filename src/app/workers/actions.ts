"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/dev/store";
import { advanceLedger } from "@/lib/engine/advances";
import {
  isAllowedRestDay,
  monthsFollowingProfile,
  reviewDocuments,
  reviewOpeningAdvance,
  reviewOpeningDays,
  type DocumentsDraft,
  type OpeningAdvanceDraft,
  type OpeningDaysDraft,
  type OpeningRefusal,
} from "@/lib/engine/profile";
import type { WorkerProfile } from "@/lib/engine/repository";
import type { UserLine } from "@/lib/engine/types";
import { reviewUserLine, type UserLineDraft, type UserLineRefusal } from "@/lib/engine/userLines";
import type { RestDay } from "@/lib/dates";

/**
 * Everything the worker's profile can change, and the only way it changes it
 * (`build_plan.md` stage 4, step 9).
 *
 * **Four things, and each of them is something already built that was waiting
 * on this screen**: the weekly rest day, which step 7c generalised and could
 * not check; the standing lines, which are the one case that makes the
 * override/edit division reachable (item 20); the opening position, which
 * every balance in every month is replayed from (item 6); and the three
 * documents with their expiry dates (item 28).
 *
 * **The four identifying numbers are not here.** The passport, bank account,
 * employment permit and work visa *numbers* are encrypted at rest with a key
 * held outside the database (`CLAUDE.md`'s non-negotiables, items 22 and 28).
 * The columns and the sealing exist as of 2026-09-10; what does not yet exist
 * is a store to put them in, because the running application is still on the
 * in-memory one — and an action that took a number now would put a plaintext
 * identifier into it. They arrive with the Postgres repository, on the screen
 * these actions already serve.
 *
 * **The browser collects the gesture and the server decides what it means**
 * (Part 3), exactly as `month/actions.ts` does it: the amounts and the dates
 * travel as the user typed them and are read here, the rest day is checked
 * against the three the law allows rather than trusted from a chip, and the
 * number a new opening advance gets is minted here from the worker's own
 * ledger — an id is the store's to give and never the caller's.
 */

/**
 * Why a change to the profile was refused, in the words the screen shows. A
 * refusal carries the reason it was refused (item 25), so these are the keys of
 * sentences and never codes the user meets.
 */
export type ProfileActionRefusal =
  | OpeningRefusal
  | UserLineRefusal
  | "restDay"
  | "recuperationMonth"
  | "date"
  | "entryUnknown";

export type ProfileActionResult =
  | { ok: true }
  | { ok: false; reason: ProfileActionRefusal };

/**
 * Every route that reads a worker, revalidated together.
 *
 * **A change to the profile reaches four screens and not one**, which is what
 * makes this a list rather than a call to `revalidatePath` at each site: the
 * profile itself and the list beside it draw the terms, `/month` draws the
 * calendar and the figures that follow from them, and `/payments` draws the
 * debt the opening position opens and the standing lines it offers to
 * override. A page left holding the figures from before the change is the one
 * failure a change this wide can produce.
 */
function revalidateWorker(): void {
  revalidatePath("/workers", "layout");
  revalidatePath("/month");
  revalidatePath("/payments");
}

/** Asked to change a worker the store does not have. Actions are reachable by a
 * crafted request, so the id is checked rather than assumed — stage 3 adds the
 * household check beside this one, exactly as `month/actions.ts` says. */
async function profileOf(workerId: string): Promise<WorkerProfile> {
  const profile = await (await getRepository()).getWorker(workerId);
  if (profile === null) throw new Error(`No worker with id ${workerId}`);
  return profile;
}

/**
 * Save the worker, and carry the change into the months that follow her
 * profile (`specs.md` Part 5).
 *
 * **A term changed on the profile reaches every month that has not been
 * confirmed**, which is Part 5's own definition of a draft: confirming a month
 * is "the moment its figures stop moving with the profile". Nothing in the
 * application can confirm a month yet — the confirmation is item 4's and
 * arrives with the export — so today that is every month she has, and the
 * predicate that will exclude a confirmed one lives in
 * `monthsFollowingProfile` and nowhere else.
 *
 * **It writes the snapshot rather than reading the profile at calculation
 * time**, because Part 3's rule holds either way and only one of the two
 * survives confirmation: terms are read off the month, and what changes when a
 * month is confirmed is that the profile stops writing to it. An engine that
 * reached for the profile would have to learn the difference instead, in every
 * rule that counts a rest day.
 */
async function saveProfile(
  profile: WorkerProfile,
  termsChanged: boolean,
): Promise<ProfileActionResult> {
  const repository = await getRepository();
  await repository.saveWorker(profile);

  if (termsChanged) {
    const months = await repository.listMonths(profile.id);
    for (const record of monthsFollowingProfile(months, profile)) {
      await repository.saveMonth(profile.id, record);
    }
  }

  revalidateWorker();
  return { ok: true };
}

/**
 * The weekly rest day, which is a term of the employment and not a constant
 * (specs.md item 5).
 *
 * Friday, Saturday or Sunday and nothing else. The value is checked against
 * `restDayChoices` rather than trusted from the chip that sent it: item 5 says
 * the profile refuses any other day, and the type that makes a fourth day
 * unstorable cannot check a number arriving as request data.
 */
export async function setRestDay(
  workerId: string,
  restDay: RestDay,
): Promise<ProfileActionResult> {
  if (!isAllowedRestDay(restDay)) return { ok: false, reason: "restDay" };
  const profile = await profileOf(workerId);
  return saveProfile({ ...profile, restDay }, true);
}

/**
 * The month the recuperation payment falls in (specs.md item 15).
 *
 * **The family names the month and the application works out the days**, which
 * is the division item 15 draws: the entitlement follows from seniority and the
 * user never types it, while *when* it is paid is a fact about this employment
 * that nothing in the law settles — the article says the summer months are
 * customary and that any other month is allowed by the practice of the place.
 *
 * The value is checked here rather than trusted from the control that sent it,
 * for the reason `setRestDay` gives: an action is reachable by a crafted
 * request, and a month of 13 would sit on the profile unnoticed until the
 * recuperation month simply never arrived.
 */
export async function setRecuperationMonth(
  workerId: string,
  month: number,
): Promise<ProfileActionResult> {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, reason: "recuperationMonth" };
  }
  const profile = await profileOf(workerId);
  return saveProfile({ ...profile, recuperationMonth: month }, true);
}

/**
 * A line set once on the profile that appears in every month afterwards, at the
 * same amount, until the user changes it or stops it (specs.md item 20).
 *
 * **It is reviewed by the same `reviewUserLine` a one-off line is**, because it
 * is the same thing with a different lifetime: the three choices — which way it
 * moves, where it sits, what it says — are the line's and not the month's, and
 * two reviews would be two places for the placement rule to drift.
 *
 * The id is minted here for the reason every other id is: it is the store's to
 * give, and the line's explanation key is built from it — `standing.<id>` —
 * which is what keeps a standing line and a one-off line in separate spaces
 * even when they share an id (item 17).
 */
export async function addStandingLine(
  workerId: string,
  draft: UserLineDraft,
): Promise<ProfileActionResult> {
  const reviewed = reviewUserLine(draft, randomUUID());
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  const profile = await profileOf(workerId);
  return saveProfile(
    { ...profile, standingLines: [...profile.standingLines, reviewed.line] },
    true,
  );
}

/**
 * A standing line corrected in place, keeping its id (specs.md item 20).
 *
 * The id is what the line's override key is built from, so removing it and
 * adding it again would move every amount typed over it in every month onto a
 * line that had never existed — the same argument `updateUserLine` makes for a
 * one-off line, and it bites harder here because a standing line appears in
 * every month at once.
 */
export async function updateStandingLine(
  workerId: string,
  lineId: string,
  draft: UserLineDraft,
): Promise<ProfileActionResult> {
  const reviewed = reviewUserLine(draft, lineId);
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  const profile = await profileOf(workerId);
  if (!profile.standingLines.some((line: UserLine) => line.id === lineId)) {
    // A page held open over a line another tab has since stopped. Refused
    // rather than added back: she is looking at a form for something that is
    // gone.
    return { ok: false, reason: "entryUnknown" };
  }

  return saveProfile(
    {
      ...profile,
      standingLines: profile.standingLines.map((line: UserLine) =>
        line.id === lineId ? reviewed.line : line,
      ),
    },
    true,
  );
}

/**
 * A standing line stopped (specs.md item 20).
 *
 * **Stopping it in June leaves the earlier months exactly as they were**, and
 * that is not a promise this action keeps by itself — it is what the snapshot
 * keeps. A month that has been confirmed holds its own terms and this reaches
 * none of them; a month still following the profile stops carrying the line
 * because it stops being one of the profile's terms.
 *
 * No override is deleted here, and that is the difference from removing a
 * one-off line. A one-off line's key belongs to one month and dies with it; a
 * standing line's key is addressed in every month it ever appeared in, so
 * clearing them would reach into months this action must not touch. An override
 * left on a month the line no longer reaches is listed as an orphan on
 * `/payments`, which is where item 17 says a stored amount that cannot be seen
 * must not stay.
 */
export async function stopStandingLine(
  workerId: string,
  lineId: string,
): Promise<ProfileActionResult> {
  const profile = await profileOf(workerId);
  return saveProfile(
    {
      ...profile,
      standingLines: profile.standingLines.filter(
        (line: UserLine) => line.id !== lineId,
      ),
    },
    true,
  );
}

/**
 * The vacation and sick days the employment opened with (specs.md item 6).
 *
 * **It moves every month at once and is meant to.** Balances are never stored;
 * they are replayed from here (item 13), so a corrected opening position moves
 * every later month's balances for free — which is the same mechanism that
 * makes a corrected past month move them, and the reason the screen says so
 * beside the field rather than after the fact.
 *
 * It changes no month's terms, so nothing is re-snapshotted: the opening
 * position is a fact about the employment as a whole and is deliberately not
 * among the terms a month copies (`MonthTerms`) — correcting it is meant to
 * reach every month, which snapshotting it per month would prevent.
 */
export async function setOpeningDays(
  workerId: string,
  draft: OpeningDaysDraft,
): Promise<ProfileActionResult> {
  const profile = await profileOf(workerId);
  const reviewed = reviewOpeningDays(draft, profile.openingPosition.advances);
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  return saveProfile({ ...profile, openingPosition: reviewed.position }, false);
}

/**
 * An advance still being repaid when the application took the employment over,
 * and what has been repaid of it so far (specs.md item 6).
 *
 * **The number is minted from the whole ledger and not from the opening
 * position alone**: an advance granted in a month the application already
 * holds carries a number too, and an opening advance added afterwards must not
 * collide with it — the closing block addresses a movement by number and kind
 * (item 20), so two advances sharing a number would be two rows addressing one
 * override.
 */
export async function addOpeningAdvance(
  workerId: string,
  draft: OpeningAdvanceDraft,
): Promise<ProfileActionResult> {
  const repository = await getRepository();
  const profile = await profileOf(workerId);
  const ledger = advanceLedger(
    profile.openingPosition,
    await repository.listMonths(workerId),
  );
  const next =
    ledger.reduce((highest, standing) => Math.max(highest, standing.number), 0) + 1;

  const reviewed = reviewOpeningAdvance(draft, next);
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  return saveProfile(
    {
      ...profile,
      openingPosition: {
        ...profile.openingPosition,
        advances: [...profile.openingPosition.advances, reviewed.advance],
      },
    },
    false,
  );
}

/**
 * An opening advance removed (specs.md item 6).
 *
 * **It is refused while a month still repays it**, for the reason
 * `removeAdvance` gives about a grant: taking the debt away from under a
 * repayment leaves repayments of a debt that never existed, which is the
 * negative standing item 20 refuses from the other direction. The check is the
 * ledger's own figure — what has been repaid against this number across every
 * month, the opening position's own figure excluded.
 */
export async function removeOpeningAdvance(
  workerId: string,
  advanceNumber: number,
): Promise<ProfileActionResult> {
  const repository = await getRepository();
  const profile = await profileOf(workerId);
  const opening = profile.openingPosition.advances.find(
    (advance) => advance.number === advanceNumber,
  );
  if (opening === undefined) return { ok: false, reason: "entryUnknown" };

  const months = await repository.listMonths(workerId);
  const repaidInMonths = months
    .flatMap((facts) => facts.advances)
    .filter(
      (advance) =>
        advance.number === advanceNumber && advance.kind === "repaid",
    )
    .reduce((total, advance) => total + advance.agorot, 0);
  if (repaidInMonths > 0) return { ok: false, reason: "overRepaid" };

  return saveProfile(
    {
      ...profile,
      openingPosition: {
        ...profile.openingPosition,
        advances: profile.openingPosition.advances.filter(
          (advance) => advance.number !== advanceNumber,
        ),
      },
    },
    false,
  );
}

/**
 * The three documents' expiry dates (specs.md item 28).
 *
 * All three are saved together because they are one panel and one gesture, and
 * because two of them lapsing in the same week is the ordinary case a family
 * meets. **No number is taken and none is stored**: the numbers are encrypted
 * at rest and arrive in stage 3.
 *
 * Nothing is re-snapshotted — a document is not a term of a month, and a
 * passport renewed in June does not restate May.
 */
export async function setDocuments(
  workerId: string,
  draft: DocumentsDraft,
): Promise<ProfileActionResult> {
  const reviewed = reviewDocuments(draft);
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  const profile = await profileOf(workerId);
  return saveProfile({ ...profile, documents: reviewed.documents }, false);
}

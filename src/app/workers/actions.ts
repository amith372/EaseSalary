"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getRepository, requireWorker } from "@/lib/store";
import { advanceLedger, nextAdvanceNumber } from "@/lib/engine/advances";
import { rateInForce } from "@/lib/datedRates";
import type { DatedRate } from "@/lib/datedRates";
import { readToday } from "@/lib/requestToday";
import {
  saveIdentifyingNumbers,
  type IdentifyingNumbers,
} from "@/lib/identifyingNumbers";
import {
  isAllowedGender,
  isAllowedRestDay,
  reviewIncomeTax,
  monthsFollowingProfile,
  monthsReachedBySalaryChange,
  termsDiffer,
  parseRestEveSupplement,
  reviewDocuments,
  reviewOpeningAdvance,
  reviewEmployedSince,
  reviewNewWorker,
  reviewOpeningDays,
  type DocumentsDraft,
  type OpeningAdvanceDraft,
  type NewWorkerDraft,
  type NewWorkerRefusal,
  type OpeningDaysDraft,
  type OpeningRefusal,
} from "@/lib/engine/profile";
import type { SalaryRepository, WorkerProfile } from "@/lib/engine/repository";
import type { Gender } from "@/lib/engine/types";
import { reviewUserLine, type UserLineDraft, type UserLineRefusal } from "@/lib/engine/userLines";
import { isMonthNumber, monthOf, parseYearMonth } from "@/lib/dates";
import {
  reviewSalaryChange,
  withSalaryChange,
  type SalaryChangeRefusal,
} from "@/lib/engine/salary";
import type { RestDay } from "@/lib/dates";

/**
 * Everything the worker's profile can change, and the only way it changes it:
 * the terms of the employment, the standing lines, which are the one case that
 * makes the override/edit division reachable (item 20), the opening position,
 * which every balance in every month is replayed from (item 6), and the three
 * documents with their expiry dates (item 28).
 *
 * **The four identifying numbers go through `setIdentifyingNumber`** (items 22,
 * 28), never through `setDocuments`: the expiry dates are stored in the clear
 * because item 27's warnings have to query them, and the numbers are sealed
 * with a key held outside the database.
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
  | "gender"
  | "incomeTaxMode"
  | "incomeTaxRate"
  | "recuperationMonth"
  | "date"
  | "employedSinceRange"
  | "employedSinceAfterFirstMonth"
  | "entryUnknown"
  | SalaryChangeRefusal
  | "supplement"
  | "numberName";

export type ProfileActionResult =
  | { ok: true }
  | { ok: false; reason: ProfileActionRefusal };

/**
 * Save the worker, and carry the change into the months that follow her
 * profile (`specs.md` Part 5).
 *
 * **A term changed on the profile reaches every month that has not been
 * confirmed**, which is Part 5's own definition of a draft: confirming a month
 * is "the moment its figures stop moving with the profile". Today it reaches
 * every month she has, confirmed ones included — `monthsFollowingProfile` has
 * no predicate that excludes a confirmed month yet, and that is the one place
 * it would go.
 *
 * **It writes the snapshot rather than reading the profile at calculation
 * time**, because Part 3's rule holds either way and only one of the two
 * survives confirmation: terms are read off the month, and what changes when a
 * month is confirmed is that the profile stops writing to it. An engine that
 * reached for the profile would have to learn the difference instead, in every
 * rule that counts a rest day.
 *
 * **Whether the months are rewritten is read off `before` and `profile`**
 * (`termsDiffer`), never told by the caller: only a change to a term a month
 * copies reaches them.
 */
async function saveProfile(
  before: WorkerProfile,
  profile: WorkerProfile,
): Promise<ProfileActionResult> {
  const repository = await getRepository();
  await repository.saveWorker(profile);

  if (termsDiffer(before, profile)) {
    const months = await repository.listMonths(profile.id);
    for (const record of monthsFollowingProfile(months, profile)) {
      await repository.saveMonth(profile.id, record);
    }
  }

  // Every screen reads the same workers and months, so the whole tree is
  // revalidated: a list of routes kept by hand is a list that misses one.
  revalidatePath("/", "layout");
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
  const profile = await requireWorker(workerId);
  return saveProfile(profile, { ...profile, restDay });
}

/**
 * The weekly rest-eve supplement (specs.md item 14): an agreed term, changed or
 * stopped whenever the agreement is.
 *
 * **It is a term a month snapshots**, so it reaches the months that follow the
 * profile exactly as the rest day does, through `saveProfile`. Empty is zero —
 * the family has stopped paying it — and anything else that is not an amount is
 * refused (`parseRestEveSupplement`).
 */
export async function setRestEveSupplement(
  workerId: string,
  amountText: string,
): Promise<ProfileActionResult> {
  const agorot = parseRestEveSupplement(amountText);
  if (agorot === null) return { ok: false, reason: "supplement" };
  const profile = await requireWorker(workerId);
  return saveProfile(profile, { ...profile, restEveSupplementAgorot: agorot });
}

/**
 * When the employment began — the `הגדרות` artboard's "תחילת העסקה".
 *
 * **Everything that counts seniority reads it**: the vacation ladder (item 7),
 * the recuperation entitlement and its anniversary (item 15), and the share of
 * a year's nine holidays (item 10). None of them is stored — balances are
 * replayed (item 13) — so a corrected date moves every month by construction,
 * and nothing is re-snapshotted: it is a fact about the employment and not a
 * term a month copies (`WorkerTerms.employedSince`).
 *
 * The date is required and checked by building it and reading it back
 * (`reviewDate`), so 2026-02-30 is refused rather than rolled into March, and
 * it must fall between 2020 and a year from today, and not after the worker's
 * first month (item 6).
 */
export async function setEmployedSince(
  workerId: string,
  dateText: string,
): Promise<ProfileActionResult> {
  const profile = await requireWorker(workerId);
  const date = reviewEmployedSince(dateText, await readToday(), profile.firstMonth);
  if (date === "invalid") return { ok: false, reason: "date" };
  if (date === "range") return { ok: false, reason: "employedSinceRange" };
  if (date === "afterFirstMonth") {
    return { ok: false, reason: "employedSinceAfterFirstMonth" };
  }
  return saveProfile(profile, { ...profile, employedSince: date });
}

/**
 * The worker's gender (specs.md item 17).
 *
 * **It is on the profile because the income tax turns on it**, and on nothing
 * else the user would have to know: a legally employed foreign caregiver holds
 * 2.25 credit points and a woman holds half a point more, so this one answer
 * settles the credit and the family is never asked for a number of points. It
 * also settles the endings the sheet writes her role with, which is why item
 * 28's `עובד/ת` carries both.
 *
 * Checked against `genders` rather than trusted from the chip that sent it, for
 * the reason `setRestDay` gives: an action is reachable by a crafted request,
 * and a value outside the two would sit on the profile and quietly credit her
 * the smaller figure.
 */
export async function setGender(
  workerId: string,
  gender: Gender,
): Promise<ProfileActionResult> {
  if (!isAllowedGender(gender)) return { ok: false, reason: "gender" };
  const profile = await requireWorker(workerId);
  return saveProfile(profile, { ...profile, gender });
}

/**
 * How this worker's income tax is arrived at (specs.md item 17).
 *
 * **It is a term of the employment and lives on the profile**, so a family
 * whose caregiver's tax is settled elsewhere says so once instead of typing a
 * zero into every month for ever. It is snapshotted onto a month when the month
 * is confirmed, so changing it now leaves every month already filed exactly as
 * it was (Part 3).
 *
 * **A single month can still depart from it**, which is the other half of item
 * 17: the payments screen's own field puts an amount over whatever this
 * arrives at, and that is how a past month is corrected.
 *
 * The value is checked by `reviewIncomeTax` rather than trusted from the
 * control, for the reason `setRestDay` gives, and with more at stake: this one
 * carries a free number.
 */
export async function setIncomeTaxSetting(
  workerId: string,
  mode: string,
  percentageText: string,
): Promise<ProfileActionResult> {
  const reviewed = reviewIncomeTax(mode, percentageText);
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };
  const profile = await requireWorker(workerId);
  return saveProfile(profile, { ...profile, incomeTax: reviewed.setting });
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
  if (!isMonthNumber(month)) {
    return { ok: false, reason: "recuperationMonth" };
  }
  const profile = await requireWorker(workerId);
  return saveProfile(profile, { ...profile, recuperationMonth: month });
}

/**
 * Who the medical-insurance premium is paid through (specs.md item 16).
 *
 * **Free text, and trimmed rather than validated.** It is a name the family
 * writes the way their own workbook wrote it — an agency, an insurer and a
 * health fund in one phrase — and the application has no list to check it
 * against. Empty is allowed and means "not entered": it is the state of every
 * worker until someone types one, and the month that pays a premium without it
 * is caught before the export rather than here.
 */
export async function setInsurer(
  workerId: string,
  insurer: string,
): Promise<ProfileActionResult> {
  const profile = await requireWorker(workerId);
  return saveProfile(profile, { ...profile, insurer: insurer.trim() });
}

/**
 * A change of her base salary, from a month the family names (specs.md item 3).
 *
 * **The months before it keep the salary they were calculated with**, and the
 * months from it on carry the new one — a raise is agreed from some month and
 * is never a restatement of months already paid. The stored months it reaches
 * are rewritten here, each at the salary in force during it and floored at its
 * own confirmed minimum (`monthsReachedBySalaryChange`); a month the store has
 * not opened yet reads the change when it is opened (`wageToCarry`).
 *
 * **The amount and the month travel as typed and are read here**, for the reason
 * every action in this file gives: the floor is the minimum wage in force in the
 * month the change starts, read from the household's own dated table and never
 * trusted from the form.
 */
export async function setSalaryChange(
  workerId: string,
  amountText: string,
  fromText: string,
): Promise<ProfileActionResult> {
  const repository = await getRepository();
  const profile = await requireWorker(workerId);
  const from = parseYearMonth(fromText.trim());
  const rates = await repository.listRates();

  const reviewed = reviewSalaryChange(amountText, from, profile.employedSince, {
    atFrom:
      from === null ? null : (rateInForce(rates, "minimumWage", from)?.value ?? null),
    now: (await minimumWageNow(repository))?.value ?? null,
  });
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  const updated: WorkerProfile = {
    ...profile,
    salaryChanges: withSalaryChange(profile.salaryChanges, reviewed.change),
  };
  await repository.saveWorker(updated);

  const months = await repository.listMonths(workerId);
  for (const record of monthsReachedBySalaryChange(
    months,
    updated,
    reviewed.change.from,
  )) {
    await repository.saveMonth(workerId, record);
  }

  revalidatePath("/", "layout");
  return { ok: true };
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

  const profile = await requireWorker(workerId);
  return saveProfile(
    profile,
    { ...profile, standingLines: [...profile.standingLines, reviewed.line] },
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

  const profile = await requireWorker(workerId);
  if (!profile.standingLines.some((line) => line.id === lineId)) {
    // A page held open over a line another tab has since stopped. Refused
    // rather than added back: she is looking at a form for something that is
    // gone.
    return { ok: false, reason: "entryUnknown" };
  }

  return saveProfile(
    profile,
    {
      ...profile,
      standingLines: profile.standingLines.map((line) =>
        line.id === lineId ? reviewed.line : line,
      ),
    },
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
  const profile = await requireWorker(workerId);
  return saveProfile(
    profile,
    {
      ...profile,
      standingLines: profile.standingLines.filter(
        (line) => line.id !== lineId,
      ),
    },
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
  const profile = await requireWorker(workerId);
  const reviewed = reviewOpeningDays(draft, profile.openingPosition);
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  return saveProfile(profile, { ...profile, openingPosition: reviewed.position });
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
  const profile = await requireWorker(workerId);
  const ledger = advanceLedger(
    profile.openingPosition,
    await repository.listMonths(workerId),
  );
  const reviewed = reviewOpeningAdvance(draft, nextAdvanceNumber(ledger));
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  return saveProfile(
    profile,
    {
      ...profile,
      openingPosition: {
        ...profile.openingPosition,
        advances: [...profile.openingPosition.advances, reviewed.advance],
      },
    },
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
  const profile = await requireWorker(workerId);
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
    profile,
    {
      ...profile,
      openingPosition: {
        ...profile.openingPosition,
        advances: profile.openingPosition.advances.filter(
          (advance) => advance.number !== advanceNumber,
        ),
      },
    },
  );
}

/**
 * The three documents' expiry dates (specs.md item 28).
 *
 * All three are saved together because they are one panel and one gesture, and
 * because two of them lapsing in the same week is the ordinary case a family
 * meets. **No number is taken and none is stored**: the numbers are sealed at
 * rest and go through `setIdentifyingNumber`.
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

  const profile = await requireWorker(workerId);
  return saveProfile(profile, { ...profile, documents: reviewed.documents });
}

/**
 * Create the household's worker — the last step of `הוספת עובד`.
 *
 * **Nothing is written until here**, which is what the artboard's "לצאת בלי
 * לשמור" promises and what its fourth step's "שמרנו את הפרטים" reports. Three
 * steps collect and one step saves, so a family that closes the tab half-way
 * leaves no worker behind and no half-worker either.
 *
 * **The whole draft is reviewed again on the server**, not merely the parts the
 * wizard could not check. The browser runs `reviewNewWorker` while the user
 * types so a field can be marked as it is left, but a server action is reachable
 * by a crafted request (Part 3), so what the form offered is never the rule:
 * the rest day is checked against the three the law allows, the gender against
 * the two the credit points have a value for, and the salary against the
 * minimum wage in force.
 *
 * **The minimum wage is read from the household's own dated table**, at the
 * month the employment is being set up in, and never hardcoded
 * (`CLAUDE.md`'s non-negotiables). A household that has never fetched anything
 * still has the seeded rows, so there is always a figure; a month earlier than
 * every row would have none, and the salary is then refused as uncheckable
 * rather than accepted against nothing.
 *
 * **The id is minted here.** It is the store's to give and never the browser's
 * (`repository.ts`): an id that arrived in a request is an id that can name
 * somebody else's worker.
 *
 * **The passport number never touches the profile.** It is sealed above the
 * repository by `saveIdentifyingNumbers` and written as bytes, so the object
 * this function saves — the one every screen and the switcher pass around —
 * carries no identifier at all (items 22, 28).
 */
export async function createWorker(
  draft: NewWorkerDraft,
): Promise<
  { ok: true; workerId: string } | { ok: false; reason: NewWorkerRefusal }
> {
  const repository = await getRepository();

  const minimum = await minimumWageNow(repository);
  if (minimum === null) return { ok: false, reason: "belowMinimum" };

  const today = await readToday();
  const reviewed = reviewNewWorker(draft, minimum.value, today);
  if (!reviewed.ok) return { ok: false, reason: reviewed.reason };

  const workerId = randomUUID();
  await repository.saveWorker({ ...reviewed.profile, id: workerId });
  await saveIdentifyingNumbers(repository, workerId, {
    passport: draft.passportNumber,
  });

  revalidatePath("/", "layout");
  return { ok: true, workerId };
}

/**
 * The minimum wage the salary is checked against: the one in force **now**, and
 * not the one in force when the employment began.
 *
 * **The distinction is not academic and the other reading is a bug.** The floor
 * item 3 sets is a floor on the salary being agreed today — a family adding a
 * worker they have employed since 2019 is stating what they pay her now, not
 * what the law allowed then — and the seeded table begins in April 2025, so
 * checking against the start month would refuse every employment older than
 * the table with a sentence about the minimum wage. What a *month* was valued
 * at is a separate figure, stored on the month when it is confirmed
 * (`ConfirmedWage`), and it is never read from here.
 *
 * `null` is a table with no row yet in force, which the seeded rows make
 * unreachable in practice; a salary is then refused as uncheckable rather than
 * accepted against nothing.
 */
async function minimumWageNow(
  repository: SalaryRepository,
): Promise<DatedRate | null> {
  return rateInForce(
    await repository.listRates(),
    "minimumWage",
    monthOf(await readToday()),
  );
}

/** The four sealed numbers, by name (specs.md items 22 and 28). */
const identifyingNumberNames = [
  "passport",
  "bankAccount",
  "workVisa",
  "employmentPermit",
] as const satisfies readonly (keyof IdentifyingNumbers)[];

/**
 * One of the four identifying numbers: the passport, the bank account, the
 * work visa or the employment permit (specs.md items 22 and 28).
 *
 * **Not part of `setDocuments`**, which saves the three expiry dates. The dates
 * are stored in the clear because item 27's warnings have to query them; the
 * numbers are sealed with a key held outside the database. Putting both through
 * one action would make a plaintext date and a sealed identifier look like two
 * fields of one form, which is exactly the distinction that has to stay visible.
 *
 * **The name is checked against the four and not trusted**, for the reason
 * `setRestDay` gives: an action is reachable by a crafted request, and a key
 * outside the four would reach the repository as a column nobody wrote down.
 *
 * **The employment permit is the employer's** (item 28), so a household holds
 * one: the repository writes it to the household, and saving it beside either
 * worker sets it for both.
 */
export async function setIdentifyingNumber(
  workerId: string,
  name: string,
  value: string,
): Promise<ProfileActionResult> {
  const known = identifyingNumberNames.find((one) => one === name);
  if (known === undefined) return { ok: false, reason: "numberName" };

  const repository = await getRepository();
  // Checked rather than assumed: a number written against an id nobody checked
  // is a number written into somebody else's worker.
  await requireWorker(workerId);

  await saveIdentifyingNumbers(repository, workerId, { [known]: value });
  revalidatePath("/", "layout");
  return { ok: true };
}

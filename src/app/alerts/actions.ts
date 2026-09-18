"use server";

import { revalidatePath } from "next/cache";
import type { ActionEntry } from "@/lib/engine/actionList";
import {
  deferralOf,
  dismissalOf,
  markedHandledOf,
  warningKinds,
  type WarningKind,
} from "@/lib/engine/alerts";
import { getRepository } from "@/lib/store";
import { readToday } from "@/lib/requestToday";

/**
 * "Not now" on a warning, or "mark as handled" on a month not yet exported
 * (specs.md item 27) — whichever the entry offers. The entry comes back as the
 * fingerprint the page was drawn from; a blockage is refused, because it cannot
 * be put off, and so is a worker the household does not hold.
 */
export async function dismiss(workerId: string, fingerprint: string): Promise<void> {
  let entry: ActionEntry;
  try {
    entry = JSON.parse(fingerprint) as ActionEntry;
  } catch {
    return;
  }
  const how = entry === null || typeof entry !== "object" ? null : dismissalOf(entry);
  if (how === null) return;
  const repository = await getRepository();
  if ((await repository.getWorker(workerId)) === null) return;
  await repository.deferWarning(
    how === "markHandled"
      ? markedHandledOf(workerId, entry)
      : deferralOf(workerId, entry, await readToday()),
  );
  revalidatePath("/alerts");
}

/** The warning kinds switched off from the page's pop-up (specs.md item 27).
 * Anything that is not a warning kind is dropped: a blockage has no switch. */
export async function saveReminders(kinds: WarningKind[]): Promise<void> {
  const known = warningKinds.filter((kind) => kinds.includes(kind));
  await (await getRepository()).saveSwitchedOffWarnings(known);
  revalidatePath("/alerts");
}

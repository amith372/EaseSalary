"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { householdIdOf } from "@/lib/store";
import { sendInvitationMail, type InvitationMail } from "@/lib/supabase/admin";
import { supabaseOnServer } from "@/lib/supabase/server";

/**
 * `להתנתק` — the `הגדרות` artboard's account section.
 *
 * **On the server and not in the browser**, because the session lives in
 * cookies the proxy reads (`supabase/client.ts`): signing out here clears them
 * in the same response that sends her to `/sign-in`, so no request can arrive
 * in between still carrying the session the user just ended.
 */
export async function signOut(): Promise<void> {
  const supabase = await supabaseOnServer();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export type InvitationResult =
  | { ok: true; mail: InvitationMail }
  | { ok: false; reason: "email" | "failed" };

/**
 * Invite a second person into the household (specs.md item 11; by email,
 * decided with the user on 2026-09-13).
 *
 * **The row comes first and the mail second.** The invitation is inserted by the
 * member's own session, so the policies decide whether they may invite into
 * this household at all; only then is Supabase Auth asked to send mail. The row
 * is what is accepted, so a mail that failed or was never sent — an address that
 * already has an account gets none — still leaves an invitation waiting for the
 * next sign-in, and the screen says which of the three happened.
 *
 * Inviting an address already invited is sending again: the one-pending index
 * refuses a second row, and that refusal is read as "already there" rather than
 * as a failure.
 */
export async function inviteToHousehold(
  emailText: string,
): Promise<InvitationResult> {
  const email = emailText.trim();
  // The shape Auth will accept, checked before a row is written for it. The
  // real check is the mail arriving and the address being confirmed.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: "email" };
  }

  const supabase = await supabaseOnServer();
  const householdId = await householdIdOf(supabase);

  const { error } = await supabase
    .from("household_invitations")
    .insert({ household_id: householdId, email });
  // 23505 is a unique violation: this address is already invited here.
  if (error !== null && error.code !== "23505") {
    return { ok: false, reason: "failed" };
  }

  const origin = (await headers()).get("origin") ?? "";
  const mail = await sendInvitationMail(email, origin);

  revalidatePath("/settings");
  return { ok: true, mail };
}

/** A pending invitation withdrawn. The policy refuses one already accepted, and
 * one from another household is invisible to the delete. */
export async function withdrawInvitation(invitationId: string): Promise<void> {
  const supabase = await supabaseOnServer();
  await supabase.from("household_invitations").delete().eq("id", invitationId);
  revalidatePath("/settings");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { householdIdOf } from "@/lib/store";
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
  | { ok: true; email: string; token: string }
  | { ok: false; reason: "email" | "failed" };

/**
 * Invite a second person into the household (specs.md item 11).
 *
 * **Nothing is sent and no account is made** (decided with the user on
 * 2026-09-13). The invitation is a row, and the member passes the link on
 * themselves; the person invited opens an account of their own with the invited
 * address — or signs in, if they already have one — and the row is accepted
 * then, through the token only the link carries. Supabase's own invitation mail was tried first and dropped: it created
 * the account itself, with a password nobody chose, and refused to send
 * anything to an address that already had one.
 *
 * The row is inserted by the member's own session, so the policies decide
 * whether they may invite into this household at all. Inviting an address
 * already invited is not a failure: the one-pending index refuses a second row,
 * and the same link still works.
 */
export async function inviteToHousehold(
  emailText: string,
): Promise<InvitationResult> {
  const email = emailText.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: "email" };
  }

  const supabase = await supabaseOnServer();
  const householdId = await householdIdOf(supabase);

  const inserted = await supabase
    .from("household_invitations")
    .insert({ household_id: householdId, email })
    .select("token")
    .single();

  let token = inserted.data?.token as string | undefined;
  // 23505 is a unique violation: this address is already invited here, so the
  // link is the one already pending. Matched as typed, case aside; a different
  // spelling of the same address is refused rather than guessed at.
  if (inserted.error?.code === "23505") {
    const { data: pending } = await supabase
      .from("household_invitations")
      .select("token")
      .eq("household_id", householdId)
      .ilike("email", email.replace(/[\\%_]/g, "\\$&"))
      .is("accepted_at", null)
      .limit(1)
      .maybeSingle();
    token = pending?.token as string | undefined;
  }
  if (token === undefined) return { ok: false, reason: "failed" };

  revalidatePath("/settings");
  return { ok: true, email, token };
}

/** A pending invitation withdrawn. The policy refuses one already accepted, and
 * one from another household is invisible to the delete. */
export async function withdrawInvitation(invitationId: string): Promise<void> {
  const supabase = await supabaseOnServer();
  await supabase.from("household_invitations").delete().eq("id", invitationId);
  revalidatePath("/settings");
}

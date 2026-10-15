"use server";

import { revalidatePath } from "next/cache";
import { answering, DONE, type ActionFault, type Done } from "@/lib/actionFault";
import { redirect } from "next/navigation";
import { getRepository, householdIdOf } from "@/lib/store";
import type { ProfileActionResult } from "@/app/workers/actions";
import { supabaseOnServer } from "@/lib/supabase/server";

/**
 * `להתנתק` — the `הגדרות` artboard's account section.
 *
 * **On the server and not in the browser**, because the session lives in
 * cookies the proxy reads (`supabase/client.ts`): signing out here clears them
 * in the same response that sends them to `/sign-in`, so no request can arrive
 * in between still carrying the session the user just ended.
 */
export async function signOut(): Promise<void> {
  const supabase = await supabaseOnServer();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

/**
 * Which wage the national-insurance estimate is reckoned on, for the whole
 * household (specs.md item 19).
 *
 * **It takes no worker and could not take one.** The base is the household's,
 * not a term of one employment: one family files one return, and a setting per
 * worker would leave two workers of a household reckoned two different ways
 * with no answer to which the return followed.
 *
 * **Nothing is recalculated and nothing is written to a month.** No month
 * stores the estimate — balances and this figure alike are replayed from the
 * facts (item 13) — so the whole of the change is this one flag, and the months
 * already exported move with the months ahead. That is why the revalidation is
 * the layout's: the figure is drawn on the payslip, in the panel's own answer,
 * on the pre-export screen and in the exported sheet, and every one of them
 * reads the replay.
 */
export async function setNationalInsuranceBase(
  onWhatWasPaid: boolean,
): Promise<ProfileActionResult> {
  return answering(async () => {
    await (await getRepository()).saveNationalInsuranceOnWhatWasPaid(
      onWhatWasPaid,
    );
    revalidatePath("/", "layout");
    return DONE;
  });
}

export type InvitationResult =
  | { ok: true; email: string; token: string }
  | { ok: false; reason: "email" | "failed" }
  | ActionFault;

/**
 * Invite a second person into the household (specs.md item 11).
 *
 * **Nothing is sent and no account is made**. The invitation is a row, and the
 * member passes the link on themselves; the person invited opens an account of
 * their own with the invited address — or signs in, if they already have one —
 * and the row is accepted then, through the token only the link carries.
 * Supabase's own invitation mail is not used: it creates the account itself,
 * with a password nobody chose, and refuses to send anything to an address that
 * already has one.
 *
 * The row is inserted by the member's own session, so the policies decide
 * whether they may invite into this household at all. Inviting an address
 * already invited is not a failure: the one-pending index refuses a second row,
 * and the same link still works.
 */
export async function inviteToHousehold(
  emailText: string,
): Promise<InvitationResult> {
  return answering(async () => {
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
  });
}

/** A pending invitation withdrawn. The policy refuses one already accepted, and
 * one from another household is invisible to the delete — so there is no reason
 * to give either way and `Done` is the whole answer. */
export async function withdrawInvitation(invitationId: string): Promise<Done> {
  return answering(async () => {
    const supabase = await supabaseOnServer();
    await supabase.from("household_invitations").delete().eq("id", invitationId);
    revalidatePath("/settings");
    return DONE;
  });
}

/** A share taken back by the member who sent its invitation (specs.md item 11).
 * The database decides whether this caller may, and answers nothing either way. */
export async function removeShare(invitationId: string): Promise<Done> {
  return answering(async () => {
    const supabase = await supabaseOnServer();
    await supabase.rpc("remove_household_share", { invitation_id: invitationId });
    revalidatePath("/settings");
    return DONE;
  });
}

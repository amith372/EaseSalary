"use server";

import { cookies } from "next/headers";
import { INVITATION_COOKIE } from "@/lib/invitationCookie";
import { acceptInvitationFromCookie } from "@/lib/store";
import { supabaseOnServer } from "@/lib/supabase/server";

/**
 * Accept the invitation whose link brought this person here, if one did
 * (specs.md item 11), and spend the cookie that carried its token.
 *
 * **On the server**, because the token is in an `httpOnly` cookie the browser
 * cannot read — which is what stops a page from accepting on anyone's behalf.
 */
export async function acceptInvitation(): Promise<void> {
  const supabase = await supabaseOnServer();
  await acceptInvitationFromCookie(supabase);
  (await cookies()).delete(INVITATION_COOKIE);
}

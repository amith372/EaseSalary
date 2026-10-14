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
 *
 * **It touches no cookie when no link brought them here**, and that is the
 * point rather than a saved roundtrip. Setting or deleting one in a server
 * function makes Next re-render the current route in the same response
 * (`next/headers`), the root layout wraps `/sign-in` too and reads the
 * household there, and a first sign-in calls this in the one moment when there
 * is a session and `create_household` has not returned — so a write here takes
 * the root layout down with `NoHouseholdError` and draws `global-error.tsx`
 * over an account that was in fact created. The error itself is left to raise:
 * a household nobody is a member of is a fault and `store.ts` says why. What is
 * kept closed here is the window in which it is reachable, and
 * `e2e/first-sign-in.spec.ts` fails on the thrown error if it opens again.
 */
export async function acceptInvitation(): Promise<void> {
  const jar = await cookies();
  if (jar.get(INVITATION_COOKIE) === undefined) return;

  const supabase = await supabaseOnServer();
  await acceptInvitationFromCookie(supabase);
  jar.delete(INVITATION_COOKIE);
}

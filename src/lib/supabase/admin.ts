import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * The one client that holds the service-role key, and the one thing it does:
 * ask Supabase Auth to send a household invitation (specs.md item 11).
 *
 * **The key bypasses row-level security**, so nothing is read or written through
 * this client — the invitation row is inserted by the member's own session,
 * under the policies that check they belong to the household. Sending mail is
 * an Auth admin call and has no user-level equivalent, which is the whole
 * reason this file exists.
 *
 * It is imported only by a server action. The key has no `NEXT_PUBLIC_` prefix,
 * so a browser bundle that reached this file would read `undefined` and throw
 * here rather than carry the key.
 */
function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (typeof window !== "undefined" || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be set on the server; see .env.example");
  }
  const { url } = supabaseEnv();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** How sending an invitation ended. */
export type InvitationMail =
  /** Supabase accepted the mail for delivery. */
  | "sent"
  /** The address already has an account, which Auth sends no invitation to. */
  | "existingAccount"
  /** Anything else — most often the project's mail rate limit. */
  | "failed";

/**
 * Send the invitation mail. The link in it signs the person in and returns them
 * to `redirectTo`, where the sign-in screen accepts the invitation.
 */
export async function sendInvitationMail(
  email: string,
  redirectTo: string,
): Promise<InvitationMail> {
  const { error } = await adminClient().auth.admin.inviteUserByEmail(email, {
    redirectTo,
    // Read by the sign-in screen: a person who arrived by invitation has no
    // password yet, and is asked for one before anything else.
    data: { invited: true },
  });
  if (error === null) return "sent";
  if (error.code === "email_exists" || /already been registered/i.test(error.message)) {
    return "existingAccount";
  }
  return "failed";
}

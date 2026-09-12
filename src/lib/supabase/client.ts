import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * The client the sign-in screen signs in with.
 *
 * It writes the session as cookies rather than to local storage, which is what
 * lets the proxy and every server component see the same session the browser
 * has. That is the whole reason `@supabase/ssr` is here rather than
 * `supabase-js` on its own.
 */
export function supabaseInBrowser() {
  const { url, publishableKey } = supabaseEnv();
  return createBrowserClient(url, publishableKey);
}

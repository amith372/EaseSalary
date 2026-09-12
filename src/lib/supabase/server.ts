import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * The client a server component or a route handler reads through.
 *
 * A new one per request, never a module-level singleton: it carries one
 * person's session, and one shared between requests would carry it into
 * somebody else's.
 *
 * Writing a cookie from a server component throws, and is caught. The proxy
 * refreshes the session on every request, so the write that matters has already
 * happened by the time a page renders; what is swallowed here is the duplicate.
 */
export async function supabaseOnServer() {
  const { url, publishableKey } = supabaseEnv();
  const store = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // A server component may not set cookies. See above.
        }
      },
    },
  });
}

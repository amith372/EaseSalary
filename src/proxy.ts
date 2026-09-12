import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * **Everything redirects to `/sign-in` when there is no session**, which is what
 * makes that the first screen the application has (build_plan.md stage 3, the
 * sign-in step).
 *
 * It is `proxy.ts` and not `middleware.ts`: Next 16 renamed the convention, and
 * a file under the old name is silently never run.
 *
 * **The session is refreshed here and nowhere else.** A server component cannot
 * write a cookie, so a token that expires while the tab is open would be
 * refreshed by the browser and never by the server, and the two would disagree
 * on who is signed in until the next full load. Asking for the user on every
 * request is what writes the refreshed pair back.
 *
 * `getUser` and not `getSession`: the session is read out of a cookie the
 * browser holds and could therefore have been written by anything, while
 * `getUser` asks the Auth server whether the token is real.
 */
export async function proxy(request: NextRequest) {
  const { url, publishableKey } = supabaseEnv();

  // The response the refreshed cookies are written onto. It carries the
  // request's own headers so that a rewrite downstream still sees them.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // A response that sets auth cookies must not be cached by a CDN, or one
        // person's session token is served to the next person through it.
        for (const [key, headerValue] of Object.entries(headers)) {
          response.headers.set(key, headerValue);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname !== "/sign-in") {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/sign-in";
    // **The query is carried across rather than dropped.** The confirmation
    // link lands on the site URL's own origin — GoTrue redirects nowhere else —
    // carrying the code that becomes the session, and at that moment there is
    // no session yet, so this is the redirect it meets. Dropping the query here
    // would turn every confirmed address into a sign-in screen that had just
    // thrown away the thing it needed.
    return NextResponse.redirect(signIn);
  }

  // Somebody signed in has no reason to be here, and the screen draws no nav to
  // leave by: it is the one route outside the shell.
  if (user && request.nextUrl.pathname === "/sign-in") {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  // Everything but the assets. Without the exclusions the redirect above would
  // apply to the stylesheet and the fonts as well, and a signed-out sign-in
  // screen would be drawn unstyled.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:png|jpg|svg|ico|woff2?)$).*)"],
};

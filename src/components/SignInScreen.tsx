"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { he } from "@/lib/i18n/he";
import { supabaseInBrowser } from "@/lib/supabase/client";

/**
 * The first screen the application has (build_plan.md stage 3, the sign-in
 * step).
 *
 * **It draws no nav and sits outside the shell**: a person who can see the bar
 * is already signed in, so there is nothing above this screen to navigate with.
 *
 * **It has no artboard, and that is a decision rather than an omission**,
 * settled with the user on 2026-09-11. One wordmark, two fields and a button,
 * built from the tokens in `globals.css` — the same palette, type scale and
 * controls every other screen uses.
 *
 * **The duplicate address is refused by the database and not here.** Signing up
 * with a `+` suffix beside an address that already has an account fails on the
 * unique index over the normalised form, and this screen only turns that
 * failure into a sentence. The same division `reviewWageConfirmation` draws: a
 * request crafted past this form meets the identical refusal, because nothing
 * about the rule lives in the form.
 */
export function SignInScreen() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseInBrowser(), []);

  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  /** Set once a person who arrived by invitation is signed in and still has no
   * password: the screen asks for one before sending them on (item 11). */
  const [choosingPassword, setChoosingPassword] = useState(false);

  /**
   * **One place decides what happens once somebody is signed in**, and it is
   * this, not the submit handler. A session arrives two ways — the form below,
   * and the confirmation link, which lands back here carrying a code the client
   * exchanges on load — and a screen that acted only on the form would leave
   * whoever followed the link sitting on the sign-in page already signed in.
   */
  useEffect(() => {
    /**
     * The household is created on the first sign-in and never mentioned. It
     * goes through `public.create_household()`, which migration 4 made the only
     * way in: a household and its first member are one call, so one can never
     * exist that nobody is able to read.
     */
    async function ensureHousehold() {
      // **Invitations first** (specs.md item 11). A person invited into a
      // household joins it here, before the check below — otherwise their first
      // sign-in would create an empty household of their own and every screen
      // would show that one instead. The function accepts only invitations
      // addressed to the caller's own confirmed address.
      await supabase.rpc("accept_household_invitations");

      const { data: memberships } = await supabase
        .from("household_members")
        .select("household_id")
        .limit(1);

      if (memberships && memberships.length > 0) return;
      await supabase.rpc("create_household");
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return;
      if (!session) return;

      void (async () => {
        await ensureHousehold();
        const metadata = session.user.user_metadata ?? {};
        if (metadata.invited === true && metadata.password_set !== true) {
          setChoosingPassword(true);
          return;
        }
        router.replace("/");
      })();
    });

    // **An invitation link carries its session in the fragment**, not as the
    // `?code=` a confirmation link carries: the admin API that sends it has no
    // PKCE verifier to pair with a code. This client exchanges codes and nothing
    // else, so the two tokens are handed to it here; Supabase checks them on
    // the next request like any other session.
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get("access_token");
    const refreshToken = fragment.get("refresh_token");
    if (accessToken && refreshToken) {
      window.history.replaceState(null, "", window.location.pathname);
      void supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }

    return () => data.subscription.unsubscribe();
  }, [router, supabase]);

  /** The invited person's first password, and then on into the household. */
  async function choosePassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError(he.signIn.passwordHint);
      return;
    }
    setWorking(true);
    try {
      const { error: failure } = await supabase.auth.updateUser({
        password,
        data: { password_set: true },
      });
      if (failure) {
        setError(he.signIn.errors.unknown);
        return;
      }
      router.replace("/");
    } finally {
      setWorking(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError(he.signIn.errors.missingFields);
      return;
    }

    setWorking(true);
    try {
      if (mode === "signIn") {
        const { error: failure } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        // The redirect on success is the listener's, not this branch's.
        if (failure) setError(messageFor(failure.message, "signIn"));
        return;
      }

      const { data, error: failure } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // **The bare origin and not `/sign-in`**, which is the address that
        // actually handles the code. GoTrue refuses to redirect anywhere but
        // its configured site URL and the allow-list beside it, and the site
        // URL is an origin with no path — so a link to `/sign-in` would be
        // answered with `redirect_to` refused rather than with a session. The
        // proxy carries the code across: an unauthenticated request to `/`
        // lands on `/sign-in` with the query intact, the client there exchanges
        // it, and the listener above creates the household and moves on.
        options: { emailRedirectTo: window.location.origin },
      });

      if (failure) {
        setError(messageFor(failure.message, "signUp"));
        return;
      }

      /**
       * **A second sign-up at an address that already has an account comes back
       * as a success, and this is the one signal that it was not one.** With
       * confirmation turned on, Supabase answers an existing address with an
       * obfuscated user carrying **no identities** rather than with an error —
       * deliberately, so that the form cannot be used to ask who has an account
       * here. Taken at face value it tells the person their mail is on the way
       * when nothing was created, which is what the user met on 2026-09-12.
       *
       * It is read as "already taken" rather than left obfuscated because this
       * is a household's own application and not a public directory, and
       * because the alternative is a screen that lies. The sub-address form of
       * the same mistake is refused by the database instead, where it belongs:
       * that one creates a row and meets the unique index.
       */
      if (data.user && data.user.identities?.length === 0) {
        setError(he.signIn.errors.addressTaken);
        return;
      }

      // An address nobody can read does not become an account: Supabase is
      // configured to confirm, so there is no session yet and the person goes
      // to their mail.
      if (!data.session) setNotice(he.signIn.checkYourMail);
    } finally {
      setWorking(false);
    }
  }

  const title = choosingPassword
    ? he.signIn.choosePasswordTitle
    : mode === "signIn"
      ? he.signIn.signInTitle
      : he.signIn.signUpTitle;

  return (
    <main className="flex min-h-screen items-center justify-center bg-ground px-4 py-10">
      <div className="w-full max-w-92">
        <div className="flex items-center justify-center gap-2.25 text-ink">
          <span
            translate="no"
            className="text-[22px] font-bold tracking-[-0.02em]"
          >
            {he.app.name}
          </span>
          <span
            aria-hidden="true"
            className="size-5 flex-none rounded-mark bg-clay"
          />
        </div>

        <p dir="auto" className="mt-2.5 text-center text-[15px] text-ink-mute">
          {he.signIn.lead}
        </p>

        <Card radius="md" className="mt-6 px-6 py-6">
          <h1 dir="auto" className="text-[19px] font-semibold text-ink">
            {title}
          </h1>

          {choosingPassword ? (
            <p dir="auto" className="mt-2 text-[14px] text-ink-mute">
              {he.signIn.choosePasswordLead}
            </p>
          ) : null}

          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={choosingPassword ? choosePassword : submit}
          >
            {choosingPassword ? null : (
              <label className="flex flex-col gap-1.5">
                <span dir="auto" className="text-[14px] text-ink-warm">
                  {he.signIn.email}
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  dir="ltr"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={`${inputClass} text-start`}
                  data-field="email"
                />
              </label>
            )}

            <label className="flex flex-col gap-1.5">
              <span dir="auto" className="text-[14px] text-ink-warm">
                {he.signIn.password}
              </span>
              <input
                type="password"
                autoComplete={
                  mode === "signIn" && !choosingPassword
                    ? "current-password"
                    : "new-password"
                }
                dir="ltr"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`${inputClass} text-start`}
                data-field="password"
              />
              {mode === "signUp" || choosingPassword ? (
                <span dir="auto" className="text-[13px] text-ink-quiet">
                  {he.signIn.passwordHint}
                </span>
              ) : null}
            </label>

            {error ? (
              <p
                dir="auto"
                role="alert"
                data-role="sign-in-error"
                className="rounded-card-sm bg-chip px-3 py-2 text-[14px] text-clay-deep"
              >
                {error}
              </p>
            ) : null}

            {notice ? (
              <p
                dir="auto"
                role="status"
                data-role="sign-in-notice"
                className="rounded-card-sm bg-sage-soft px-3 py-2 text-[14px] text-sage-ink"
              >
                {notice}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={working}
              className="mt-1 rounded-card-sm bg-forest px-6 py-2.75 text-[16px] font-semibold text-surface transition-colors hover:bg-forest-deep disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span dir="auto">
                {working
                  ? he.signIn.working
                  : choosingPassword
                    ? he.signIn.choosePasswordSubmit
                    : mode === "signIn"
                      ? he.signIn.submitSignIn
                      : he.signIn.submitSignUp}
              </span>
            </button>
          </form>
        </Card>

        {choosingPassword ? null : (
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signIn" ? "signUp" : "signIn");
              setError(null);
              setNotice(null);
            }}
            className="mt-4 w-full text-center text-[14px] text-forest transition-colors hover:text-forest-deep"
          >
            <span dir="auto">
              {mode === "signIn" ? he.signIn.toSignUp : he.signIn.toSignIn}
            </span>
          </button>
        )}
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-card-sm border border-line bg-surface px-3 py-2 text-[15px] text-ink transition-colors placeholder:text-ink-quiet hover:border-line-hover focus-visible:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest";

/**
 * Supabase answers in English, and the screen speaks Hebrew. The three cases
 * worth telling apart are told apart; everything else is one sentence, because
 * a person cannot act on the difference between the rest.
 *
 * A wrong password and an unknown address give the same answer on purpose —
 * telling them apart turns the form into a way of asking who has an account
 * here.
 */
function messageFor(message: string, mode: "signIn" | "signUp"): string {
  const lower = message.toLowerCase();

  if (lower.includes("not confirmed")) return he.signIn.errors.unconfirmed;
  if (mode === "signIn") return he.signIn.errors.badCredentials;

  // What the unique index over the normalised address raises comes back from
  // GoTrue as a database error rather than as a named one, so both shapes are
  // read as the same refusal: Supabase's own duplicate check, and ours.
  if (
    lower.includes("already registered") ||
    lower.includes("already been registered") ||
    lower.includes("database error")
  ) {
    return he.signIn.errors.addressTaken;
  }

  return he.signIn.errors.unknown;
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { acceptInvitation } from "@/app/sign-in/actions";
import { Card } from "@/components/Card";
import { LogoMark } from "@/components/icons";
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
export function SignInScreen({
  invitedEmail,
}: {
  /** The address an invitation link names (item 11). The person opens their
   * own account with it — nothing was created for them — so the form starts on
   * sign-up with the address filled in. */
  invitedEmail?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseInBrowser(), []);

  const [mode, setMode] = useState<"signIn" | "signUp">(
    invitedEmail ? "signUp" : "signIn",
  );
  const [email, setEmail] = useState(invitedEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    invitedEmail ? he.signIn.invited : null,
  );
  const [working, setWorking] = useState(false);

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
      // **Invitations first** (specs.md item 11). A person who opened an
      // invitation link joins that household here, before the check below —
      // otherwise their first sign-in would create an empty household of their
      // own and every screen would show that one instead. Only the link's token
      // accepts, and only for the address it was sent to; signing in without
      // the link joins nothing.
      await acceptInvitation();

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
        router.replace("/");
      })();
    });

    return () => data.subscription.unsubscribe();
  }, [router, supabase]);

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

  const title =
    mode === "signIn" ? he.signIn.signInTitle : he.signIn.signUpTitle;

  return (
    <main className="flex min-h-screen items-center justify-center bg-ground px-4 py-10">
      <div className="w-full max-w-92">
        {/* The wordmark as the top bar draws it, which is the mark this
            screen is the first to show. */}
        <div className="flex items-center justify-center gap-2.25 text-ink">
          <LogoMark className="size-8" />
          <span
            translate="no"
            className="text-[22px] font-bold tracking-[-0.02em]"
          >
            {he.app.name}
          </span>
        </div>

        <p dir="auto" className="mt-2.5 text-center text-[15px] text-ink-mute">
          {he.signIn.lead}
        </p>

        <Card radius="md" className="mt-6 px-6 py-6">
          <h1 dir="auto" className="text-[19px] font-semibold text-ink">
            {title}
          </h1>

          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={submit}
          >
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

            <label className="flex flex-col gap-1.5">
              <span dir="auto" className="text-[14px] text-ink-warm">
                {he.signIn.password}
              </span>
              <input
                type="password"
                autoComplete={
                  mode === "signIn" ? "current-password" : "new-password"
                }
                dir="ltr"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`${inputClass} text-start`}
                data-field="password"
              />
              {mode === "signUp" ? (
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
              className="mt-1 rounded-card-sm bg-forest px-6 py-2.75 text-[16px] font-semibold text-surface transition-colors hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span dir="auto">
                {working
                  ? he.signIn.working
                  : mode === "signIn"
                    ? he.signIn.submitSignIn
                    : he.signIn.submitSignUp}
              </span>
            </button>
          </form>
        </Card>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signIn" ? "signUp" : "signIn");
            setError(null);
            setNotice(null);
          }}
          className="mt-4 w-full rounded-card-sm py-2 text-center text-[14px] text-forest transition-colors hover:text-forest-deep hover:underline hover:underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest"
        >
          <span dir="auto">
            {mode === "signIn" ? he.signIn.toSignUp : he.signIn.toSignIn}
          </span>
        </button>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-card-sm border border-line-field bg-surface px-3 py-2 text-[15px] text-ink transition-colors placeholder:text-ink-quiet hover:border-ink-quiet focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest";

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

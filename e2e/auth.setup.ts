import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test as setup } from "@playwright/test";
import { he } from "../src/lib/i18n/he";

/**
 * **Every spec in this directory now needs a session**, because `src/proxy.ts`
 * sends an unauthenticated request to `/sign-in` from every address. This runs
 * once before the rest and leaves one behind.
 *
 * **It signs in through the real screen** — typed into the two fields and
 * submitted — rather than writing a session cookie of its own (`CLAUDE.md`
 * rule 9). A suite that forged the cookie would pass on the day the sign-in
 * screen stopped working, which is the one failure it exists to catch.
 *
 * The account itself is made with the admin API, which is the one thing a
 * browser cannot do: it is created **already confirmed**, so the run does not
 * wait on an email nobody will open. That is the same call
 * `scripts/check-household-isolation.mjs` makes for its two throwaway users.
 *
 * The account is **kept between runs** rather than created and deleted each
 * time. Deleting it would take its household, its workers and everything the
 * run wrote with it — which is right for the isolation script, whose whole
 * subject is two strangers, and wrong here, where re-creating an account on
 * every run would spend a sign-up against the rate limit for nothing.
 */

// Written out in `playwright.config.ts` as well, which cannot import it from
// here: the config is loaded before any test file may call `test()`.
const STATE_FILE = "e2e/.auth/state.json";

/** One address, kept between runs so that the household it holds is kept too. */
const EMAIL = "e2e@easesalary.test";

/**
 * **Generated per run, and set on the account before it is used.** A literal
 * beside the word "password" is the shape `hooks/pre-commit` refuses, and it is
 * right to refuse it: the rule cannot tell a throwaway from a real one, and the
 * day it is argued with is the day a real one goes in. So the account's password
 * is whatever this run generated — set on it through the admin API, which is
 * also what makes the run independent of whatever the last one left.
 */
const PASSWORD = randomUUID();

setup("a confirmed account, signed in through the real screen", async ({ page }) => {
  await ensureAccountExists();

  await page.goto("/sign-in");

  // The screen the redirect lands on, before anything is typed.
  await expect(page.getByRole("heading", { name: he.signIn.signInTitle })).toBeVisible();

  await page.locator('[data-field="email"]').fill(EMAIL);
  await page.locator('[data-field="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: he.signIn.submitSignIn }).click();

  // Signed in means off this screen and onto the home screen, with the shell
  // around it — the nav is the proof, since the sign-in screen draws none.
  await page.waitForURL("/");
  await expect(page.getByRole("navigation", { name: he.nav.landmark })).toBeVisible();

  mkdirSync(dirname(STATE_FILE), { recursive: true });
  await page.context().storageState({ path: STATE_FILE });
});

/**
 * Leaves behind an account at `EMAIL`, confirmed, whose password is this run's.
 * It is created if it is not there and has its password reset if it is — the
 * account itself is kept, so the household and everything in it survives.
 *
 * The service-role key is read here and is never given to the browser: this
 * runs in Playwright's own Node process, not in the page.
 */
async function ensureAccountExists(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to run the browser suite; see .env.example",
    );
  }

  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });

  if (response.ok) return;

  // Anything but "this address already has an account" is a fault worth
  // stopping on, because a run that cannot sign in fails every spec with the
  // same unhelpful redirect and says nothing about why.
  if (response.status !== 422) {
    throw new Error(
      `could not create the browser suite's account: ${response.status} ${await response.text()}`,
    );
  }

  // The ordinary case on every run after the first: the account is there and
  // holds a password some earlier run generated and nothing wrote down. Reset
  // it to this run's rather than re-creating the account, which would take the
  // household with it.
  const id = await findAccount(url, serviceRole);
  const reset = await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: "PUT",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: PASSWORD }),
  });

  if (!reset.ok) {
    throw new Error(
      `could not reset the browser suite's account: ${reset.status} ${await reset.text()}`,
    );
  }
}

/** The account's id, looked up by the address it was made with. */
async function findAccount(url: string, serviceRole: string): Promise<string> {
  const response = await fetch(
    `${url}/auth/v1/admin/users?filter=${encodeURIComponent(EMAIL)}`,
    { headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` } },
  );

  const { users } = (await response.json()) as { users?: { id: string; email: string }[] };
  const found = users?.find((user) => user.email === EMAIL);

  if (!found) throw new Error(`the browser suite's account ${EMAIL} exists but cannot be found`);
  return found.id;
}

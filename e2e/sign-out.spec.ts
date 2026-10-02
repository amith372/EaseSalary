import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { he } from "../src/lib/i18n/he";
import { TODAY, useToday } from "./household";

/**
 * The way out of the account, from the state that had none (specs.md item 11: a
 * signed-in person can leave their account from any screen, including a household
 * with no worker in it).
 *
 * `AppShell` draws `EmptyHousehold` in place of every screen's content until the
 * household has a worker, `/settings` among them — so the one control that ended
 * a session was the one control a new account could not reach. The bar carries it
 * now, and this is what says the bar's control ends the session rather than
 * merely clearing the screen.
 *
 * **It owns its account, and shares nothing with the rest of the run.**
 * `signOut` revokes the refresh token for the whole account: pressed against the
 * session `auth.setup.ts` leaves behind, it would sign the rest of the suite out.
 * `invitation.spec.ts` says the same of its own two accounts and for the same
 * reason.
 *
 * **It sets no `household` cookie either**, which is the other half of why it is
 * safe, and what makes the state real rather than seeded: the household is this
 * account's own in Postgres, read under its own row-level security, and it is
 * empty because nothing has put a worker in it.
 *
 * **The household is made here and not by signing in**, the way
 * `invitation.spec.ts` makes its own. `SignInScreen` does create one on a first
 * sign-in, but reaching the state that way raced, measured 2026-10-01:
 * `acceptInvitation()` writes a cookie, which refreshes the route the browser is
 * still on, which the proxy sends to `/` — and `/` renders before
 * `create_household` has returned, so the first screen a brand-new account ever
 * saw was the error boundary. That is a defect of its own and not this test's
 * subject, so the state is reached without it.
 *
 * Scenario: a confirmed account whose household holds no worker signs in, finds
 * the add-a-worker card on the home screen and on `/settings`, and leaves from
 * the bar.
 *
 * Expected: `/settings` offers no account section to leave from, the bar's
 * control does, and `/settings` afterwards is the sign-in screen.
 *
 * **What it would catch**: a sign-out that clears the screen without ending the
 * session, which leaves the next person at that browser signed in; and a bar that
 * draws the control only once a worker exists, which is the defect this closes —
 * a family who opened an account and stopped there could not sign out, and a
 * second person could not sign in on the same machine.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A sign-in against the live project, and an account made and deleted around it,
// outlast the default thirty seconds.
test.describe.configure({ timeout: 60_000 });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Generated per run; a literal beside the word "password" is what
 * `hooks/pre-commit` refuses, and it is right to refuse it. */
const password = randomUUID();
const email = `e2e-signout-${Date.now().toString(36)}@easesalary.test`;

/** The one call a browser cannot make: an account that is confirmed already, so
 * the run does not wait on a mail nobody will open. The service-role key is read
 * in Playwright's own Node process and never reaches the page. */
async function admin(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${url}/auth/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
    },
  });
}

let userId = "";

test.beforeAll(async () => {
  if (!url || !publishable || !serviceRole) {
    throw new Error("the Supabase env vars must be set; see .env.example");
  }

  const created = await admin("admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!created.ok) throw new Error(`could not create ${email}: ${created.status}`);
  userId = (await created.json()).id;

  // A household of their own, through the one call that makes one, under their
  // own token so that they are its member. **Nothing puts a worker in it.** That
  // is the subject.
  const token = (
    await (
      await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: publishable, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
    ).json()
  ).access_token as string;

  const household = await fetch(`${url}/rest/v1/rpc/create_household`, {
    method: "POST",
    headers: {
      apikey: publishable,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!household.ok) {
    throw new Error(`could not make a household: ${await household.text()}`);
  }
});

test.afterAll(async () => {
  // Deleting the account takes its household and its membership with it.
  if (userId) await admin(`admin/users/${userId}`, { method: "DELETE" });
});

test("a household with no worker in it can still leave the account, from the bar", async ({
  page,
}) => {
  await useToday(page, TODAY);

  await page.goto("/sign-in");
  await page.locator('[data-field="email"]').fill(email);
  await page.locator('[data-field="password"]').fill(password);
  await page.getByRole("button", { name: he.signIn.submitSignIn }).click();
  await page.waitForURL("/");

  // The state the control was added for: the add-a-worker card in place of the
  // screen, with the bar still around it.
  await expect(page.locator('[data-role="empty-household"]')).toBeVisible();
  await expect(page.getByRole("navigation", { name: he.nav.landmark })).toBeVisible();

  // And the defect itself, asserted rather than described: `/settings` is the
  // same card, so the account section — and the sign-out that lived in it — is
  // not on the screen at all. If the empty branch is ever narrowed, this fails
  // and says that the test has stopped covering anything.
  await page.goto("/settings");
  await expect(page.locator('[data-role="empty-household"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: he.settings.account.title })).toHaveCount(0);

  await page.screenshot({ path: "test-results/sign-out-empty-household.png" });

  await page.locator('[data-role="sign-out"]').click();
  await page.waitForURL(/\/sign-in/);

  // Signed out for real: the session is gone, so a protected address is the
  // sign-in screen again and not the app.
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole("heading", { name: he.signIn.signInTitle })).toBeVisible();
});

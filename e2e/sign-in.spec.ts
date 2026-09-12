import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { he } from "../src/lib/i18n/he";

/**
 * The sign-in step's own "done when" (build_plan.md stage 3), asked through the
 * browser:
 *
 *   an unauthenticated request to any screen lands on `/sign-in`, a confirmed
 *   address reaches the home screen with a household of its own, and a second
 *   sign-up at the same address wearing a `+` suffix is refused by the database.
 *
 * The middle one is `auth.setup.ts`: it signs in through these two fields and
 * every other spec in this directory runs on what it leaves behind, so a broken
 * sign-in screen fails the whole suite rather than one assertion. The first is
 * here.
 *
 * **The last is not, and cannot be.** Signing up sends a confirmation mail, and
 * Supabase's own mail service delivers only to the project's team and only
 * twice an hour — so a browser spec that signed up would fail on the mail
 * rather than on the rule it means to check, and would leave an unusable
 * account behind on every run. The sub-address refusal is asked of the live
 * database instead, by `scripts/check-one-address-one-account.mjs`, which is
 * where this repo already puts a check that needs the network (specs.md
 * Part 4).
 *
 * **Signed out on purpose.** These run with an empty storage state, which is
 * the state the setup project's session would otherwise hide.
 */
test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  /** The address is the run's own, so a re-run never meets the account the
   * last one made. */
  const address = (tag: string) => `e2e-${tag}-${Date.now()}@easesalary.test`;

  /** Generated per run. The account it belongs to is made and deleted inside one
   * test, so the value means nothing — and a literal beside the word "password"
   * is the shape `hooks/pre-commit` refuses, which it is right to do: the rule
   * cannot tell a throwaway from a real one. */
  const password = randomUUID();

  test("every screen redirects to the sign-in screen", async ({ page }) => {
    // Four addresses from four different stages, so this catches a route added
    // later that answered before the proxy rather than behind it.
    for (const address of ["/", "/month", "/workers", "/reports"]) {
      await page.goto(address);
      await expect(page).toHaveURL(/\/sign-in$/);
      await expect(page.getByRole("heading", { name: he.signIn.signInTitle })).toBeVisible();
    }

    // And the shell is not around it: a person who can see the nav is already
    // signed in, so five tabs here would be five links back to this screen.
    await expect(page.getByRole("navigation", { name: he.nav.landmark })).toHaveCount(0);
  });

  test("a wrong password is refused in Hebrew, and says nothing about who has an account", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.locator('[data-field="email"]').fill(address("wrong-password"));
    await page.locator('[data-field="password"]').fill("not-the-password");
    await page.getByRole("button", { name: he.signIn.submitSignIn }).click();

    const failure = page.locator('[data-role="sign-in-error"]');
    await expect(failure).toHaveText(he.signIn.errors.badCredentials);

    // Still here. A refusal that navigated would be a refusal nobody read.
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("a second sign-up at an address that already has an account is not told mail is coming", async ({
    page,
  }) => {
    // **Supabase answers an existing address with a success**, deliberately: an
    // obfuscated user with no identities, so that the form cannot be used to
    // ask who has an account here. Taken at face value the screen said the mail
    // was on its way when nothing had been created, which is what the user met
    // on 2026-09-12. This is the assertion that would catch it coming back.
    //
    // The account is made through the admin API and **already confirmed**, so
    // no mail is sent and nothing here waits on one.
    const taken = address("already-taken");
    const id = await createConfirmedAccount(taken, password);

    await page.goto("/sign-in");
    await page.getByRole("button", { name: he.signIn.toSignUp }).click();
    await page.locator('[data-field="email"]').fill(taken);
    await page.locator('[data-field="password"]').fill(password);
    await page.getByRole("button", { name: he.signIn.submitSignUp }).click();

    await expect(page.locator('[data-role="sign-in-error"]')).toHaveText(
      he.signIn.errors.addressTaken,
    );
    // The half that actually broke: the reassuring sentence must not be there.
    await expect(page.locator('[data-role="sign-in-notice"]')).toHaveCount(0);

    // Deleted rather than left behind: this address is the whole subject of the
    // test, and a run that kept it would leave one dead account per run in a
    // real project.
    await deleteAccount(id);
  });

});

/**
 * Signed in, which is how the rest of the directory runs.
 */
test("a signed-in person is not shown the sign-in screen again", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("navigation", { name: he.nav.landmark })).toBeVisible();
});

/**
 * An account that exists and is confirmed, made the one way a browser cannot:
 * the admin API, which skips the mail. The service-role key is read in
 * Playwright's own Node process and never reaches the page.
 */
async function createConfirmedAccount(email: string, password: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");

  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });

  if (!response.ok) throw new Error(`could not create ${email}: ${response.status}`);
  return (await response.json()).id as string;
}

/** Takes the account and, by cascade, everything the sign-up left behind. */
async function deleteAccount(id: string): Promise<void> {
  await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`,
    },
  });
}

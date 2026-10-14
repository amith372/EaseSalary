import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { he } from "../src/lib/i18n/he";
import { TODAY, useToday } from "./household";

/**
 * The first screen a family ever reaches, driven as a family reaches it: a
 * confirmed account that is a member of no household signs in, and
 * `SignInScreen` makes one on the way through (specs.md item 11).
 *
 * **It is the one state no other spec can be in.** Every browser spec but this
 * one opens a seeded in-memory store, and the session the suite shares has had
 * a household since the day `auth.setup.ts` made it — so the moment between a
 * session existing and `create_household` returning is reached here and nowhere
 * else. `sign-out.spec.ts` needs the same account and makes its household
 * directly, because the empty bar and not the sign-in is its subject.
 *
 * **Against the live project**, like the two specs beside it: the account is
 * made confirmed through the admin API, which is the one call a browser cannot
 * make, and deleted at the end with the household the screen made for it.
 *
 * Scenario: an account with no household row signs in through the real form.
 *
 * Expected: `/` draws the one card of item 32 over the empty household, and
 * `he.fault` is on no screen along the way.
 *
 * **The uncaught errors are asserted and not only the screen**, which is the
 * whole of why this test is not a demonstration. The root layout reads the
 * household on every request, `/sign-in` included, and raises rather than
 * drawing an empty bar when there is none (`store.ts`) — so anything that
 * re-renders a route inside the window between the session and
 * `create_household` takes the root layout down. The screen recovers, because
 * the sign-in's own `window.location.assign("/")` follows and by then the
 * household is there; what is left of it is `Signed in, but a member of no
 * household` thrown in the page, and on a slower machine the family sees
 * `global-error.tsx` instead of this card.
 *
 * **What it would catch**: a first sign-in that makes no household, one whose
 * first screen is the fault screen, and the re-render above — a server function
 * that writes a cookie here, which Next answers with a re-render of the current
 * route in the same response (`next/headers`), fails this on the thrown error
 * while leaving every visible assertion passing.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A sign-in against the live project, and an account made and deleted around
// it, outlast the default thirty seconds.
test.describe.configure({ timeout: 60_000 });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Generated per run; a literal beside the word "password" is what
 * `hooks/pre-commit` refuses, and it is right to refuse it. */
const password = randomUUID();
const email = `e2e-first-sign-in-${Date.now().toString(36)}@easesalary.test`;

/** The service-role key is read in Playwright's own Node process and never
 * reaches the page. */
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
  if (!url || !serviceRole) {
    throw new Error("the Supabase env vars must be set; see .env.example");
  }

  const created = await admin("admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!created.ok) throw new Error(`could not create ${email}: ${created.status}`);
  userId = (await created.json()).id;

  // **Nothing makes a household.** That is the subject: the screen makes it.
});

test.afterAll(async () => {
  // Deleting the account takes its household and its membership with it.
  if (userId) await admin(`admin/users/${userId}`, { method: "DELETE" });
});

test("a brand-new account signs in and meets the card, not the fault screen", async ({
  page,
}) => {
  await useToday(page, TODAY);

  // Uncaught exceptions only, and not the console: a render that threw reaches
  // the page as one, and nothing else in this flow is allowed to.
  const thrown: string[] = [];
  page.on("pageerror", (error) => thrown.push(error.message));

  await page.goto("/sign-in");
  await page.locator('[data-field="email"]').fill(email);
  await page.locator('[data-field="password"]').fill(password);
  await page.getByRole("button", { name: he.signIn.submitSignIn }).click();

  // The home screen, reached by the screen's own navigation and not by a
  // reload: a fault that a reload clears is still a fault this family met.
  await page.waitForURL("/");

  // The card item 32 owes them, which is also the proof that the household was
  // made — it is read off a column of the household row the sign-in created.
  await expect(page.locator('[data-role="tutorial"]')).toBeVisible();
  await expect(page.getByText(he.fault)).toHaveCount(0);
  await page.screenshot({ path: "test-results/first-sign-in-card.png" });

  // And the account works: past the card is the household with no worker in it,
  // offering the one step a new family has.
  await page.locator('[data-role="tutorial-skip"]').click();
  await expect(page.locator('[data-role="tutorial"]')).toBeHidden();
  await expect(page.locator('[data-role="empty-household"]')).toBeVisible();
  await expect(page.getByText(he.fault)).toHaveCount(0);

  // Nothing threw on the way, the card above being the screen that survived.
  expect(thrown).toEqual([]);
});

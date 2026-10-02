import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { he } from "../src/lib/i18n/he";

/**
 * Sharing a household by invitation (specs.md item 11), through the real
 * screens and against the live database.
 *
 * **Nothing creates the invited person's account** (the user, 2026-09-13). The
 * member makes an invitation and copies a link; the person invited opens the
 * link and signs up — or, as here, signs in, because they already have an
 * account with a worker of their own. That is the case the user met: Supabase's
 * own invitation mail refused to reach an existing account, and made an account
 * nobody knew the password of for a new one.
 *
 * **Signing up is not driven here**, for the reason `sign-in.spec.ts` gives:
 * it sends a confirmation mail Supabase delivers only to the project's team.
 * The link's own screen is asserted instead — the sign-up form, with the
 * address in it — and the acceptance is driven by the existing account.
 *
 * Both accounts are made confirmed through the admin API, the one thing a
 * browser cannot do, and deleted at the end with their households.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// Two accounts signing in and out against the live project outlast the default
// thirty seconds.
test.describe.configure({ timeout: 120_000 });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Generated per run; a literal beside the word "password" is what
 * `hooks/pre-commit` refuses. */
const password = randomUUID();
const stamp = Date.now().toString(36);

interface Person {
  email: string;
  firstName: string;
  userId?: string;
}

const inviter: Person = { email: `e2e-inviter-${stamp}@easesalary.test`, firstName: "מריה" };
const invitee: Person = { email: `e2e-invitee-${stamp}@easesalary.test`, firstName: "ג׳וי" };

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

/** A confirmed account holding a household and one worker, made the way
 * `scripts/check-household-isolation.mjs` makes its strangers. */
async function anAccountWithAWorker(person: Person): Promise<void> {
  const created = await admin("admin/users", {
    method: "POST",
    body: JSON.stringify({ email: person.email, password, email_confirm: true }),
  });
  if (!created.ok) throw new Error(`could not create ${person.email}: ${created.status}`);
  person.userId = (await created.json()).id;

  const token = (
    await (
      await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: publishable, "Content-Type": "application/json" },
        body: JSON.stringify({ email: person.email, password }),
      })
    ).json()
  ).access_token as string;

  const rest = (path: string, body: unknown) =>
    fetch(`${url}/rest/v1/${path}`, {
      method: "POST",
      headers: {
        apikey: publishable,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

  const householdId = await (await rest("rpc/create_household", {})).json();
  const worker = await rest("workers", {
    household_id: householdId,
    name: `${person.firstName} טסט`,
    first_name: person.firstName,
    gender: "female",
    employed_since: "2025-01-01",
    // The first month the seeded rates table can value (specs.md item 6);
    // their opening position is not what this test is about.
    first_month: "2025-04-01",
    base_monthly_salary_agorot: 609590,
    recuperation_month: 7,
    country: "PH",
  });
  if (!worker.ok) throw new Error(`could not create a worker: ${await worker.text()}`);
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/sign-in");
  await page.locator('[data-field="email"]').fill(email);
  await page.locator('[data-field="password"]').fill(password);
  await page.getByRole("button", { name: he.signIn.submitSignIn }).click();
  await page.waitForURL("/");
}

test.beforeAll(async () => {
  if (!url || !publishable || !serviceRole) {
    throw new Error("the Supabase env vars must be set; see .env.example");
  }
  await anAccountWithAWorker(inviter);
  await anAccountWithAWorker(invitee);
});

test.afterAll(async () => {
  for (const person of [inviter, invitee]) {
    if (person.userId) await admin(`admin/users/${person.userId}`, { method: "DELETE" });
  }
});

test("an existing account joins through a copied link, and the invitation then reads accepted", async ({
  browser,
}) => {
  const words = he.settings.account.share;

  // The invited person is already signed in to their own account before the
  // invitation exists, which is the case the sign-in screen never sees: the
  // proxy sends a signed-in person past it, so acceptance has to happen on the
  // server, on whatever they open next.
  const inviteeContext = await browser.newContext();
  const inviteePage = await inviteeContext.newPage();
  await signIn(inviteePage, invitee.email);

  // --- The member makes the invitation ------------------------------------
  const inviterContext = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const inviterPage = await inviterContext.newPage();
  await signIn(inviterPage, inviter.email);
  await inviterPage.goto("/settings");

  const share = inviterPage.locator("[data-share]");
  await share.locator('input[type="email"]').fill(invitee.email);
  await share.getByRole("button", { name: words.send }).click();

  await expect(share.getByText(words.copied)).toBeVisible();
  const pending = share.locator('[data-invitation="pending"]');
  await expect(pending).toContainText(invitee.email);
  await expect(pending).toContainText(words.pending);

  // What was copied is the message with the link in it, naming the address and
  // carrying the token that alone accepts it.
  const copied = await inviterPage.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(invitee.email);
  const copiedLink = new URL(copied.match(/https?:\/\/\S+/)?.[0] ?? "");
  expect(copiedLink.pathname).toBe("/sign-in");
  expect(copiedLink.searchParams.get("invite")).toBe(invitee.email);
  expect(copiedLink.searchParams.get("token")).toMatch(/^[0-9a-f-]{36}$/);
  const link = `${copiedLink.pathname}${copiedLink.search}`;

  // --- Signed in, but the link not yet opened: nothing is joined -----------
  // Signing in is not accepting. Otherwise any member could invite a stranger's
  // address and the stranger's next page would put them in that household.
  await inviteePage.goto("/workers");
  await expect(inviteePage.getByText(he.workers.toProfile(invitee.firstName))).toBeVisible();
  await expect(inviteePage.getByText(he.workers.toProfile(inviter.firstName))).toHaveCount(0);

  // --- Someone new opens it -------------------------------------------------
  // The sign-up form, already holding the address, and saying why.
  const strangerContext = await browser.newContext();
  const strangerPage = await strangerContext.newPage();
  await strangerPage.goto(link);
  await expect(strangerPage.getByRole("heading", { name: he.signIn.signUpTitle })).toBeVisible();
  await expect(strangerPage.locator('[data-field="email"]')).toHaveValue(invitee.email);
  await expect(strangerPage.getByText(he.signIn.invited)).toBeVisible();
  await strangerContext.close();

  // --- The invited person, already signed in, opens it ----------------------
  await inviteePage.goto(link);
  await inviteePage.waitForURL("/");

  // Both workers are theirs to work on now, and the shared one is not counted
  // against their own limit: there is still room for a second of their own.
  await inviteePage.goto("/workers");
  await expect(inviteePage.getByText(he.workers.toProfile(invitee.firstName))).toBeVisible();
  await expect(inviteePage.getByText(he.workers.toProfile(inviter.firstName))).toBeVisible();
  await expect(inviteePage.locator('[data-role="add-worker-link"]')).toBeVisible();
  await inviteePage.screenshot({ path: "test-results/invitation-invitee-workers.png" });

  // --- The member sees it accepted -----------------------------------------
  await inviterPage.reload();
  const accepted = inviterPage.locator('[data-share] [data-invitation="accepted"]');
  await expect(accepted).toContainText(invitee.email);
  await expect(accepted).toContainText(words.accepted);
  await expect(inviterPage.locator('[data-share] [data-invitation="pending"]')).toHaveCount(0);
  await inviterPage.locator("[data-share]").screenshot({
    path: "test-results/invitation-accepted.png",
  });

  // --- The share now shows on the worker's own card ------------------------
  // **The chip names an address and never a name** (the user, 2026-09-18): the
  // account holds the address the invitation was sent to and nothing else about
  // the person. What this would catch is a chip drawn from the household rather
  // than from an *accepted* invitation, which would announce a share to someone
  // who never joined.
  await inviterPage.goto("/workers");
  const shared = inviterPage.locator('[data-row="worker-shared"]');
  await expect(shared).toHaveText(he.workers.sharedWith([invitee.email]));

  // And the other way round it says nothing: the policy shows a joined member
  // the invitations addressed to them, never the address of the family that
  // invited them, so there is no honest sentence to draw there.
  await inviteePage.goto("/workers");
  await expect(inviteePage.locator('[data-row="worker-shared"]')).toHaveCount(0);
  // Back to the screen the share is managed on, which the removal below acts
  // through.
  await inviterPage.goto("/settings");

  // --- The invited person sees no way to remove anyone ---------------------
  await inviteePage.goto("/settings");
  await expect(inviteePage.getByRole("button", { name: words.remove })).toHaveCount(0);

  // --- The member who invited removes the share ------------------------------
  await accepted.getByRole("button", { name: words.remove }).click();
  await expect(inviterPage.locator('[data-share] [data-invitation]')).toHaveCount(0);

  // The removed person keeps their own worker and loses the shared one; the
  // member keeps theirs.
  await inviteePage.goto("/workers");
  await expect(inviteePage.getByText(he.workers.toProfile(invitee.firstName))).toBeVisible();
  await expect(inviteePage.getByText(he.workers.toProfile(inviter.firstName))).toHaveCount(0);
  await inviterPage.goto("/workers");
  await expect(inviterPage.getByText(he.workers.toProfile(inviter.firstName))).toBeVisible();
  // The chip goes with the share: a card still naming a person who was removed
  // is the application reporting an access that no longer exists.
  await expect(inviterPage.locator('[data-row="worker-shared"]')).toHaveCount(0);
  await inviteePage.screenshot({ path: "test-results/invitation-removed-invitee-workers.png" });

  await inviterContext.close();
  await inviteeContext.close();
});

/**
 * The two gestures that undo the ones above: an invitation taken back before
 * anybody opens it, and the way out of the account.
 *
 * **They run here and not in `settings.spec.ts`** for one reason each. A
 * withdrawal needs a *pending* invitation, which needs a real second address
 * and the live policies — the dev household has neither. And `signOut` revokes
 * the refresh token for the whole account: run against the session
 * `auth.setup.ts` leaves behind, it would sign the rest of the run out. The
 * accounts here are made for this file and deleted after it, so both are safe
 * only in this one.
 *
 * Scenario: the inviter invites a third address, sees it pending, and withdraws
 * it. Then they sign out.
 *
 * Expected: the pending row goes, the link that was copied no longer joins
 * anybody, and after signing out `/settings` is the sign-in screen again.
 *
 * **What it would catch**: a withdrawal that removes the row from the screen
 * and leaves it live, which is the whole failure — a family who withdrew an
 * invitation would have no way of knowing the link still worked; and a sign-out
 * that clears the screen without ending the session, which leaves the next
 * person at that browser signed in.
 */
test("an invitation is withdrawn before it is opened, and the member signs out", async ({
  browser,
}) => {
  const words = he.settings.account.share;
  const third = `e2e-withdrawn-${stamp}@easesalary.test`;

  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  await signIn(page, inviter.email);
  await page.goto("/settings");

  const share = page.locator("[data-share]");
  await share.locator('input[type="email"]').fill(third);
  await share.getByRole("button", { name: words.send }).click();

  const pending = share.locator('[data-invitation="pending"]');
  await expect(pending).toContainText(third);

  // The link as it stood, kept so the withdrawal can be checked against the
  // thing it is supposed to invalidate rather than against the screen alone.
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const live = new URL(copied.match(/https?:\/\/\S+/)?.[0] ?? "");
  const link = `${live.pathname}${live.search}`;

  await pending.getByRole("button", { name: words.withdraw }).click();
  await expect(share.locator('[data-invitation="pending"]')).toHaveCount(0);
  await page.screenshot({ path: "test-results/invitation-withdrawn.png" });

  // **The link is dead, and that is the half the screen cannot show.** The
  // invitee already has an account, so opening it while signed in as them is
  // what would have joined the household had the row survived.
  const inviteeContext = await browser.newContext();
  const inviteePage = await inviteeContext.newPage();
  await signIn(inviteePage, invitee.email);
  await inviteePage.goto(link);
  await inviteePage.goto("/workers");
  await expect(
    inviteePage.getByText(he.workers.toProfile(inviter.firstName)),
  ).toHaveCount(0);
  await inviteeContext.close();

  // --- And the way out ------------------------------------------------------
  // The screen's own control, not the bar's: both read the one string, so the
  // role alone matches twice and `<main>` is what separates them.
  await page.goto("/settings");
  await page
    .locator("main")
    .getByRole("button", { name: he.settings.account.signOut })
    .click();
  await page.waitForURL(/\/sign-in/);

  // Signed out for real: the session is gone, so the screens behind it are the
  // sign-in screen again and not a cached page.
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(
    page.getByRole("heading", { name: he.signIn.signInTitle }),
  ).toBeVisible();

  await context.close();
});

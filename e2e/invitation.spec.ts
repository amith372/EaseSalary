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

  await inviterContext.close();
  await inviteeContext.close();
});

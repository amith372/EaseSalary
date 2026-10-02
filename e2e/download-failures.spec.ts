import { expect, test, type Page } from "@playwright/test";
import { monthLabel } from "../src/lib/dateLabels";
import { he } from "../src/lib/i18n/he";
import { useHousehold } from "./household";

/**
 * Every way the two download addresses can fail, and where each sends the
 * browser instead.
 *
 * **The defect this exists to catch.** Both addresses hand back a workbook, so
 * neither can draw a screen — and until this step each answered a failure with
 * a body of English text: `No such worker`, `No such month`, `The month has
 * not been confirmed`, `A year is required`. The browser renders that as a bare
 * page in a language the family does not read, with no bar, no link and no way
 * on from it. Nothing in the suite noticed, because the old test asserted the
 * *status code* and a status code is not something anybody sees.
 *
 * **So each case is asked three things**: that it answers 303, that the body is
 * empty, and that the address it names is a screen. The second is the one that
 * cannot be satisfied by a wrong fix — a route that kept its sentence and added
 * a redirect would pass the other two.
 *
 * **Addressed directly and not through a link**, which is the point: the
 * screens build these addresses themselves and withhold the link where the
 * month cannot be filed, so every case below arrives from a bookmark, a stale
 * tab or a crafted request. That is exactly the traffic the old English page
 * was written for.
 */

const MONTH_FILE = "/month/export/file";
const REPORT_FILE = "/reports/file";

/** The worker the suite works on — the second, who carries the ordinary terms
 * (`household.ts`). The ids are the seed's own. */
const TEST_WORKER = "worker-2";

/**
 * Where an address sends the browser, and what it says on the way.
 *
 * `maxRedirects: 0` is the whole point: followed, a 303 is invisible and the
 * test would be reading the screen it landed on rather than the answer under
 * test.
 */
async function sentTo(
  page: Page,
  address: string,
): Promise<{ status: number; to: string; body: string }> {
  const response = await page.request.get(address, { maxRedirects: 0 });
  const location = response.headers()["location"] ?? "";
  const url = location === "" ? null : new URL(location, "http://localhost:3000");
  return {
    status: response.status(),
    to: url === null ? "" : `${url.pathname}${url.search}`,
    body: await response.text(),
  };
}

/** One failing address: 303, nothing in the body, and the screen it names. */
async function expectSentTo(
  page: Page,
  address: string,
  screen: string,
): Promise<void> {
  const answer = await sentTo(page, address);
  expect(answer.status, address).toBe(303);
  expect(answer.to, address).toBe(screen);
  // **The assertion a redirect alone would not satisfy.** A route that kept its
  // English sentence and redirected as well would still be shipping the
  // sentence; nothing renders it, but nothing has removed it either, and the
  // next hand to touch the file would read it as the wording in force.
  expect(answer.body, address).toBe("");
}

test.describe("the month's file, where there is no file to hand back", () => {
  test("sends every failing address to a screen, with no body", async ({
    page,
  }) => {
    await useHousehold(page, "download-failures", "month");

    // Neither half given, then each half alone: the address is built by the
    // screens, so any of these was typed or is stale.
    await expectSentTo(page, MONTH_FILE, "/");
    await expectSentTo(page, `${MONTH_FILE}?worker=${TEST_WORKER}`, "/");
    await expectSentTo(page, `${MONTH_FILE}?month=2026-08`, "/");

    // **An id that is nobody, answered exactly as an id that is somebody
    // else's.** `workerInSeries` returns null for both, and two different
    // answers would tell the reader which of the two they had typed.
    await expectSentTo(page, `${MONTH_FILE}?worker=nobody&month=2026-08`, "/");

    // A month outside their replay — before their first month. There is no month
    // screen for it, so it is the opening screen.
    await expectSentTo(
      page,
      `${MONTH_FILE}?worker=${TEST_WORKER}&month=1999-01`,
      "/",
    );

    // **A month nobody confirmed goes where the confirmation is**, and carries
    // its month, so the user arrives at the month they asked for rather than at
    // whichever one the screen would have chosen. August 2026 is unconfirmed in
    // the demo seed, which is why `/reports` offers it a confirm link and no
    // file link.
    await expectSentTo(
      page,
      `${MONTH_FILE}?worker=${TEST_WORKER}&month=2026-08`,
      "/month/export?month=2026-08",
    );
  });

  /**
   * Item 18's gate, asked at the address rather than at the button: a disabled
   * button is a courtesy, and a month is not exported over an unanswered
   * question however the request arrives.
   */
  test("an open spell of sickness sends the month to the question that closes it", async ({
    page,
  }) => {
    await useHousehold(page, "openSpell", "download-failures");

    await expectSentTo(
      page,
      `${MONTH_FILE}?worker=${TEST_WORKER}&month=2026-09`,
      "/month/export?month=2026-09",
    );
  });

  /** A month the engine refused has no figures to file, and this address can
   * word no refusal — the opening screen draws the card (item 25). */
  test("a refused month goes to the screen that draws the card", async ({
    page,
  }) => {
    await useHousehold(page, "refused", "download-failures");

    await expectSentTo(
      page,
      `${MONTH_FILE}?worker=${TEST_WORKER}&month=2026-08`,
      "/",
    );
  });
});

test.describe("the four reports, where there is no file to hand back", () => {
  test("sends every failing address to a screen, with no body", async ({
    page,
  }) => {
    await useHousehold(page, "download-failures", "reports");

    await expectSentTo(page, REPORT_FILE, "/");
    await expectSentTo(page, `${REPORT_FILE}?worker=${TEST_WORKER}`, "/");
    // A report name the screen never offers.
    await expectSentTo(
      page,
      `${REPORT_FILE}?worker=${TEST_WORKER}&report=whatever`,
      "/",
    );
    // The two yearly reports need a year, and only they check for one.
    await expectSentTo(
      page,
      `${REPORT_FILE}?worker=${TEST_WORKER}&report=balances`,
      "/",
    );
    await expectSentTo(page, `${REPORT_FILE}?worker=nobody&report=recuperation`, "/");
  });

  test("a refused replay has nothing to report on, and says so on the screen", async ({
    page,
  }) => {
    await useHousehold(page, "refused", "download-failures-reports");

    await expectSentTo(
      page,
      `${REPORT_FILE}?worker=${TEST_WORKER}&report=recuperation`,
      "/",
    );
  });
});

/**
 * The redirect followed, which is the half a status code cannot show: what the
 * family actually ends up looking at.
 */
test.describe("what the browser lands on", () => {
  /** Every English sentence these two addresses must never answer with. None may
   * appear on a screen, and none may be left anywhere in what is served. */
  const THE_OLD_ENGLISH = [
    "No such worker",
    "No such month",
    "A worker and a month are required",
    "The month has an unanswered question",
    "The month has not been confirmed",
    "A worker and a report are required",
    "A year is required",
  ];

  test("an unconfirmed month lands on the confirmation, in Hebrew", async ({
    page,
  }) => {
    await useHousehold(page, "download-failures", "landing-month");

    await page.goto(`${MONTH_FILE}?worker=${TEST_WORKER}&month=2026-08`);

    // The before-export screen, reached and drawn — not a bare page. Its
    // eyebrow names it, and the heading below names the month that was asked
    // for, which is what carrying the month across the redirect is for.
    await expect(page).toHaveURL(/\/month\/export\?month=2026-08$/);
    await expect(page.getByText(he.beforeExport.eyebrow)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      monthLabel({ year: 2026, month: 8 }),
    );

    const body = page.locator("body");
    for (const sentence of THE_OLD_ENGLISH) {
      await expect(body, sentence).not.toContainText(sentence);
    }
  });

  test("an unknown worker lands on the opening screen, in Hebrew", async ({
    page,
  }) => {
    await useHousehold(page, "download-failures", "landing-unknown");

    await page.goto(`${MONTH_FILE}?worker=nobody&month=2026-08`);

    await expect(page).toHaveURL(/\/$/);
    // A working screen and not a 404 either: the calendar is drawn.
    await expect(page.locator("[data-date]").first()).toBeVisible();

    const body = page.locator("body");
    for (const sentence of THE_OLD_ENGLISH) {
      await expect(body, sentence).not.toContainText(sentence);
    }
  });

  /**
   * **The worker travels with the redirect**, which is what makes the landing
   * screen the right one. Every screen is scoped by the switcher's cookie
   * (`WorkerScope`), so a download asked for the second worker while the cookie
   * names the first would land on a screen about the wrong person — a failure
   * that looks entirely ordinary, because the screen it lands on is real.
   */
  test("the screen it lands on is about the worker the download was for", async ({
    page,
  }) => {
    await useHousehold(page, "download-failures", "carries-the-worker");

    // The switcher starts on the first worker, so without the cookie this lands
    // on that worker.
    await page.goto("/");
    await expect(page.locator("[data-date]").first()).toBeVisible();

    await page.goto(`${MONTH_FILE}?worker=${TEST_WORKER}&month=2026-08`);

    await expect(
      page.getByRole("group", { name: he.header.workerSwitcher.showing }),
    ).toContainText("[שם העובד/ת השני/ה]");
  });
});

import { expect, test, type Page } from "@playwright/test";
import { settled, useHousehold, useToday } from "./household";
import { he } from "../src/lib/i18n/he";

/**
 * Confirming months from the worker's own list, without an export — `specs.md`
 * item 18's last paragraph.
 *
 * **It is a browser spec because the rule is already a unit test and the wiring
 * is not.** `src/lib/engine/bulkConfirm.test.ts` holds which months may be
 * confirmed and at what figures; what no unit test can show is that ticking
 * rows on this screen confirms *those* months, leaves every other month alone,
 * and does not move a figure on the way through — three screens, an action and
 * a store, which is where it breaks.
 *
 * **What this would catch**, and each has a way of looking entirely plausible:
 * a confirmation that re-values the month it files, because the base salary is
 * snapshotted as it is written and a profile that has moved since would be
 * copied onto a month the family already paid; a run that confirms the whole
 * list rather than the ticks, which reads as success on a screen where every
 * badge was going to change anyway; and a month whose tick is drawn although
 * the server would refuse it, which offers a gesture that silently does
 * nothing.
 *
 * **One thing is asserted here and finished elsewhere, deliberately.** A run
 * crossing a rate change is confirmed at each month's own wage (item 4), and
 * no screen in the application displays a month's *stored* confirmed wage — so
 * what this spec can show is the two figures the screen states before the
 * press, which `bulkConfirmFigures` produces and the action writes. That the
 * written figure is that one is `bulkConfirm.test.ts`'s, which holds it against
 * what the export screen offers for the same month.
 *
 * The worker is named and never taken as whichever comes first
 * (`build_plan.md`): `worker-2` carries the ordinary terms.
 */

const WORKER = "worker-2";

/** Their page. The address names the worker, so no switcher step is needed. */
const THEIR_PAGE = `/workers/${WORKER}`;

function row(page: Page, month: string) {
  return page.locator(`[data-month="${month}"]`);
}

function badge(page: Page, month: string) {
  return row(page, month).locator("[data-state]");
}

function tick(page: Page, month: string) {
  return row(page, month).locator("input[data-confirmable]");
}

/** The month's net in agorot, as `MoneyValue` names it for the suite. Read
 * before and after, because a confirmation that moved a filed month's figure
 * would be the worst of the failures here — and the attribute is the figure
 * itself rather than the digits drawn from it. */
async function netOf(page: Page, month: string): Promise<string | null> {
  return row(page, month).locator("[data-money]").first().getAttribute("data-money");
}

test.describe("confirming months from the list", () => {
  test("confirms every month ticked, and only those, without moving a figure", async ({
    page,
  }) => {
    await useHousehold(page, "confirm", "ticked");
    await page.goto(THEIR_PAGE);

    // The demo household files nothing, so every ended month of 2026 is a
    // finished draft — which is the state this whole gesture exists for.
    //
    // **January 2026 is deliberately not among them.** It is the one seeded
    // month carrying a stored `incomeTaxAgorot` of zero — a family that went
    // through the pre-export conversation and settled that month at nothing
    // (`seed.ts`) — and confirming works the tax out afresh (item 17), so its
    // net legitimately drops by ₪297.22. Asserting "no figure moved" on that
    // month would be asserting the opposite of what item 17 says.
    const ticked = ["2026-03", "2026-05", "2026-07"];
    const untouched = ["2026-04", "2026-06"];
    for (const month of [...ticked, ...untouched]) {
      await expect(badge(page, month)).toHaveAttribute("data-state", "draft");
    }

    const before = Object.fromEntries(
      await Promise.all(
        ticked.map(async (month) => [month, await netOf(page, month)] as const),
      ),
    );

    for (const month of ticked) await tick(page, month).check();
    await page.locator("[data-confirm-months]").click();
    await settled(page);

    // **The result and not the press.** Each ticked month has moved to Part 5's
    // *confirmed*, each untouched month is still a draft, and no figure moved.
    for (const month of ticked) {
      await expect(badge(page, month)).toHaveAttribute("data-state", "confirmed");
      expect(await netOf(page, month)).toBe(before[month]);
    }
    for (const month of untouched) {
      await expect(badge(page, month)).toHaveAttribute("data-state", "draft");
    }
  });

  test("states both wages before confirming a run that crosses a rate change", async ({
    page,
  }) => {
    await useHousehold(page, "confirm", "rates");
    await page.goto(THEIR_PAGE);

    // The minimum wage steps on 1.4.2026 (`SEEDED_RATES`), so these two months
    // are valued at two different figures and a run holding both must say so.
    await tick(page, "2026-02").check();
    await tick(page, "2026-08").check();

    const lines = page.locator("[data-confirm-rate]");
    await expect(lines).toHaveCount(2);
    await expect(page.locator('[data-confirm-rate="2025-04-01"]')).toBeVisible();
    await expect(page.locator('[data-confirm-rate="2026-04-01"]')).toBeVisible();

    // One ticked month only would state one wage: without this the count above
    // would pass for a screen that listed every rate the table holds.
    await tick(page, "2026-08").uncheck();
    await expect(lines).toHaveCount(1);
    await expect(page.locator('[data-confirm-rate="2025-04-01"]')).toBeVisible();

    await tick(page, "2026-08").check();
    await page.locator("[data-confirm-months]").click();
    await settled(page);

    for (const month of ["2026-02", "2026-08"]) {
      await expect(badge(page, month)).toHaveAttribute("data-state", "confirmed");
    }
  });

  test("a month that cannot be confirmed has no tick and says why", async ({
    page,
  }) => {
    await useHousehold(page, "confirm", "running");
    await page.goto(THEIR_PAGE);

    // September 2026 is the month `TODAY` sits in, so it has not ended (item
    // 21) and a tick down a list is not the warned export the screen offers.
    await expect(tick(page, "2026-09")).toHaveCount(0);
    await expect(row(page, "2026-09").locator("[data-cannot-confirm]")).toHaveText(
      he.workers.profile.months.confirm.cannot.notEnded,
    );
    // And a month that *can* be is drawn with one, so the assertion above is
    // not passing on a screen that draws no ticks at all.
    await expect(tick(page, "2026-08")).toHaveCount(1);
  });

  test("a spell of sickness with no end stops that month being confirmed", async ({
    page,
  }) => {
    await useHousehold(page, "openSpell", "spell");
    // The seeded spell opens on 14.9.2026 and is never closed, so September has
    // to have *ended* for the spell to be the reason rather than the date.
    await useToday(page, "2026-10-06");
    await page.goto(THEIR_PAGE);

    await expect(tick(page, "2026-09")).toHaveCount(0);
    await expect(
      row(page, "2026-09").locator('[data-cannot-confirm="openSickSpell"]'),
    ).toBeVisible();
  });
});

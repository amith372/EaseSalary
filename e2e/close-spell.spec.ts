import { expect, test, type Page } from "@playwright/test";
import { switchToTestWorker, TODAY } from "./household";
import { monthOf } from "../src/lib/dates";
import { fullDayLabel } from "../src/lib/dateLabels";
import { he } from "../src/lib/i18n/he";
import { formatDays } from "../src/lib/money";

/**
 * Closing a spell of sickness nobody closed — the one way out of a month the
 * export refuses (`specs.md` items 8 and 18).
 *
 * **Why this needs a seed, and why that is not a shortcut.** Item 8 says there
 * is no gesture for *opening* a spell and there is deliberately none: continuity
 * is inferred from the days marked, so `applyMark` always closes what it writes
 * and `src/lib/spans.test.ts` pins that. But the open shape is live everywhere
 * else — the column is nullable, `openSickSpellOf` looks for one, a month clips
 * it at its own last day, and the export refuses to run over it. A household can
 * therefore arrive in this state the way a refused one can, and the panel below
 * is the only exit. Until this file existed nothing had ever opened it.
 *
 * `openSpellSeed` is that fixture (`src/lib/dev/seed.ts`), built the way
 * `refusedSeed` is and for the same stated reason.
 *
 * **Every expected figure is arithmetic on the dates, and the clock is pinned.**
 * The spell begins on Monday 14 September 2026 and the suite's today is Friday
 * the 18th (`household.ts`). September 2026's Saturdays are the 5th, 12th, 19th
 * and 26th, so neither range below holds a rest day and both are plain counts of
 * calendar days. Two separate rules decide them:
 *
 * - **Open, the current month's preview clips the spell at today** (item 8:
 *   only the current month's preview clips at a `today`, a finished month clips
 *   at its own last day). 14 to 18 inclusive is **5** days.
 * - **Closed, the question asks the day she came *back*, and the spell ends the
 *   day before** (`spellEndFromReturn`: the returning is the event the family
 *   witnessed). A return on Thursday the 17th therefore means she was ill on the
 *   14th, 15th and 16th — **3** days, not four.
 *
 * So closing it gives **two** days back. Both counts are asserted, and not only
 * their difference: each pins a rule that the other would hide. An
 * implementation that read the return date as the last day she was ill would
 * still move the balance — by one day instead of two — and would charge the
 * worker a sick day she never took. That is the whole reason the figures are
 * written out here rather than compared to each other.
 */

/** As `openSpellSeed` writes it. */
const SPELL_FROM = "2026-09-14";
/** The day she actually came back: a Thursday, before the pinned today. */
const RETURNED_ON = "2026-09-17";
/** A day before the spell began, which the close refuses. */
const BEFORE_THE_SPELL = "2026-09-10";
/** 14 to 18 inclusive: the open spell clipped at the pinned today. */
const DAYS_WHILE_OPEN = 5;
/** 14 to 16 inclusive: a return on the 17th ends the spell on the 16th. */
const DAYS_ONCE_CLOSED = 3;

const RUN = Date.now().toString(36);

/** The `openspell` seed, in a store of this test's own. One word and no hyphen
 * before the first `-`: `seedOf` reads the name up to it (`src/lib/store.ts`). */
async function useHousehold(page: Page, label: string): Promise<void> {
  await page.context().addCookies([
    {
      name: "household",
      value: `openspell-e2e-${RUN}-${label}`,
      url: "http://localhost:3000",
    },
  ]);
}

async function settled(page: Page): Promise<void> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** The month the suite runs in, as `YYYY-MM` — the month the spell is open in. */
function thisMonth(): string {
  const { year, month } = monthOf(TODAY);
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * The closing sick balance on the payslip, in days.
 *
 * `data-closing` carries the number the row was drawn from, so the difference
 * closing the spell makes is arithmetic rather than a match on Hebrew-locale
 * digits.
 */
async function sickRow(page: Page) {
  await page.goto(`/month/payslip?month=${thisMonth()}`);
  await switchToTestWorker(page);
  return page.locator('[data-after="sick"]').first();
}

/** The closing sick balance, in days. */
async function sickBalance(page: Page): Promise<number> {
  const value = await (await sickRow(page)).getAttribute("data-closing");
  expect(value).not.toBeNull();
  return Number(value);
}

/** The days the month drew from the balance, which the row states beside it —
 * criterion 2's "the days used beside the balance", and the figure that says
 * *why* the balance is what it is. */
async function daysUsed(page: Page, days: number): Promise<void> {
  await expect(await sickRow(page)).toContainText(
    `${he.sheet.reporting.daysUsed}: ${formatDays(days)}`,
  );
}

test.describe("a spell of sickness nobody closed (specs.md items 8, 18)", () => {
  /**
   * Scenario: the test worker's spell is open from Monday 14 September 2026 and
   * today is Friday the 18th. The export is opened on September.
   *
   * Expected: the export is blocked and names the day the spell began; a return
   * date before that day is refused; the real return date closes it, the block
   * goes, the export is offered, and one day comes back to the sick balance —
   * because the preview had been counting the 18th as sick and it was not.
   *
   * **What it would catch, in the order it matters.** The block dropped, which
   * files a month counting sick days for a worker who was already back — item
   * 18's stated reason for the block existing. The close wired to the wrong
   * span, which leaves the block standing after a correct answer, and with it a
   * month that can never be exported: the panel is reached *from* the export the
   * spell blocks, so a broken close is a dead end and not an inconvenience. A
   * return date before the spell accepted, which stores a spell running
   * backwards. And the close landing without the balance following, which is the
   * quiet one — the screen would say the right thing and the days would stay
   * spent.
   */
  test("blocks the export, refuses a return before it began, and closes", async ({
    page,
  }) => {
    await useHousehold(page, "close");

    // Before: the preview clips the open spell at today, so the 18th is being
    // counted as a day of sickness — five days for a spell she may already have
    // come back from, which is item 18's stated reason for blocking the export.
    await daysUsed(page, DAYS_WHILE_OPEN);
    const spentWhileOpen = await sickBalance(page);

    await page.goto("/month/export");
    await switchToTestWorker(page);
    // **Forward one month, to the one the spell is in.** The export opens on the
    // latest month that has *ended* — August — and an open spell overlaps every
    // month from the one it began in onward, so August is not one of them
    // (specs.md Part 3). September is the month still running, which is exactly
    // where a family meets a spell nobody has closed yet.
    await page.getByRole("button", { name: he.calendar.nextMonth }).click();
    await expect(page.locator("h1")).toContainText(he.calendar.monthNames[8]);

    // **The block, named by the day the spell began** — the fact the family has,
    // and the one that says which spell is meant.
    const block = page.locator('[data-block="openSickSpell"]');
    await expect(block).toBeVisible();
    await expect(block).toContainText(he.beforeExport.openSpell.title);
    await expect(block).toContainText(fullDayLabel(SPELL_FROM));

    // And the export is not offered behind it.
    await expect(page.locator("[data-finish]")).toBeDisabled();
    // Nor is the close, while there is no date to close it on.
    await expect(page.locator("[data-close-spell]")).toBeDisabled();
    await page.screenshot({
      path: "test-results/close-spell-blocks-export.png",
      fullPage: true,
    });

    // **A return before the spell began is refused.** A spell that ran backwards
    // would price its tiers from a day it had not reached.
    await page.locator("[data-return-input]").fill(BEFORE_THE_SPELL);
    await page.locator("[data-close-spell]").click();
    await settled(page);
    await expect(block).toContainText(
      he.beforeExport.openSpell.refused.beforeTheSpell,
    );
    // Still open, so the refusal refused rather than merely complained.
    await expect(block).toBeVisible();
    await expect(page.locator("[data-finish]")).toBeDisabled();

    // **The day she actually came back closes it.**
    await page.locator("[data-return-input]").fill(RETURNED_ON);
    await page.locator("[data-close-spell]").click();
    await settled(page);

    await expect(page.locator('[data-block="openSickSpell"]')).toHaveCount(0);
    await page.screenshot({
      path: "test-results/close-spell-closed.png",
      fullPage: true,
    });

    // **And the export becomes reachable once the month's own questions are
    // answered.** Two gates and not one: item 18 asks the questions of every
    // month, and the spell is a *block* on top of them. Answering them here is
    // what proves the spell was the only thing left in the way — asserting the
    // button straight after the close would have failed on the questions and
    // said the close had not worked.
    const questions = page.locator("[data-question]");
    const count = await questions.count();
    for (let index = 0; index < count; index += 1) {
      await questions
        .nth(index)
        .getByRole("button", { name: he.beforeExport.questions.no, exact: true })
        .click();
    }
    await expect(page.locator("[data-finish]")).toBeEnabled();

    // **And two days came back.** She was ill on the 14th, 15th and 16th: the
    // 17th is the day she returned and the 18th was never hers at all. The count
    // is asserted as well as the balance, because it is the count that says the
    // return date was read as a return and not as the last day of the illness.
    await daysUsed(page, DAYS_ONCE_CLOSED);
    expect(await sickBalance(page)).toBe(
      spentWhileOpen + (DAYS_WHILE_OPEN - DAYS_ONCE_CLOSED),
    );
  });

  /**
   * The same spell, read on the opening screen rather than on the export.
   *
   * Item 8 draws the distinction in so many words: an open spell is a **warning
   * and not a blockage** on the opening screen, because the figure computes and
   * may simply be stale, while the export refuses outright. Two screens, two
   * different answers to one state.
   *
   * **What it would catch**: the export's block copied onto the opening screen,
   * which would leave a family unable to see the month they have to correct the
   * spell from — the calendar is on that screen and nowhere else.
   */
  test("is a warning on the opening screen and not a blockage", async ({
    page,
  }) => {
    await useHousehold(page, "warning");
    await page.goto("/");
    await switchToTestWorker(page);

    // The month is drawn, with its calendar: not a card in place of it.
    await expect(page.locator(`[data-date="${SPELL_FROM}"]`)).toBeVisible();
    await expect(page.locator('[data-role="refusal"]')).toHaveCount(0);
    await page.screenshot({
      path: "test-results/close-spell-home-warning.png",
      fullPage: true,
    });
  });
});

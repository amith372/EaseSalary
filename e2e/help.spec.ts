import { expect, test, type Page } from "@playwright/test";
import { useHousehold } from "./household";
import { he } from "../src/lib/i18n/he";
import { HELP_SCREENS } from "../src/lib/help/screens";
import { HELP_TOPICS } from "../src/lib/help/topics";

/**
 * `עזרה`, through the browser (specs.md item 24).
 *
 * **What only a browser can check here.** `match.test.ts` already proves that a
 * typed question reaches the right topic, to the point of asserting which one
 * wins against the committed Kol Zchut page and against an empty corpus. None
 * of that says the answer was drawn, that the button beside it leads where the
 * answer says, or that the list narrowed on the screen — and an answer card
 * whose link is built from the wrong half of a topic is a screen that reads
 * perfectly and sends the family to the wrong place.
 *
 * **It is account-blind, so it needs no worker and no month.** Every other spec
 * here steps onto the test worker before it asserts a figure; this one must not,
 * and one of the tests below is that it does not have to.
 *
 * **Hebrew comes from `he.ts` and is never typed here**, except the queries — a
 * query is what a *user* types, so one quoted from `he.ts` would be the matcher
 * fed its own corpus and would prove nothing (`CLAUDE.md` rule 11).
 */

/** A question a family would type, and where it has to land. Each is the
 * wording of no topic, and each was written before the screen was. */
const ASKED = [
  { query: "שבוע שלם היא היתה במחלה", topic: "markSick", screen: "/" },
  { query: "העובדת לקחה מקדמה על חשבון המשכורת", topic: "addAdvance", screen: "/payments" },
  {
    query: "הביטוח הרפואי מנוכה מהשכר שלה?",
    topic: "deductMedicalInsurance",
    screen: "/settings",
  },
] as const;

/**
 * Waits for a press to land on its screen.
 *
 * **It is `waitForURL` and not `toHaveURL`, and the timeout is deliberate.**
 * The default five seconds is an assertion budget, not a navigation budget: a
 * `next dev` server compiles the route on the first visit, and this one was
 * measured at 5.1s for `/` → `/help` and 12.5s for the first load of `/`. At
 * the default the test failed on a navigation that was working — which is the
 * worst kind of red, because it sends the next reader looking for a broken link.
 * What is asserted is unchanged: the press must reach that address.
 */
async function arrivesAt(page: Page, address: RegExp): Promise<void> {
  await page.waitForURL(address, { timeout: 30_000 });
}

async function ask(page: Page, query: string): Promise<void> {
  await page.locator('[data-field="help-query"]').fill(query);
  await page.locator('[data-role="help-submit"]').click();
}

test.describe("the help screen", () => {
  test.beforeEach(async ({ page }) => {
    await useHousehold(page, "help", "ask");
  });

  test("answers a typed question with a screen, a gesture and the way there", async ({
    page,
  }) => {
    await page.goto("/help");

    for (const asked of ASKED) {
      await ask(page, asked.query);
      const answer = page.locator('[data-role="help-answer"]');
      // By the topic's id and not by the Hebrew beside it: the handle is what
      // the row *is* (`CLAUDE.md` rule 10).
      await expect(answer).toHaveAttribute("data-topic", asked.topic);
      // The destination, which is the half no unit test can see: the card names
      // a screen in words and the button carries an address, and a card that
      // said one thing while the button did another would look entirely right.
      await expect(page.locator('[data-role="help-go"]')).toHaveAttribute(
        "href",
        asked.screen,
      );
      // It points at the rule and never restates it (item 24).
      await expect(page.locator('[data-role="help-rule"]')).toBeVisible();
    }
  });

  test("takes the user to the screen the answer named", async ({ page }) => {
    // The one assertion that the address in the card is an address the
    // application actually has. A help answer that 404s is worse than no answer.
    await page.goto("/help");
    await ask(page, ASKED[2].query);
    await page.locator('[data-role="help-go"]').click();
    await arrivesAt(page, /\/settings$/);
    // And the sentence help refused to write is there instead, beside the
    // field it is about (items 16 and 24).
    await expect(page.locator('[data-role="insurer-deduction"]')).toContainText(
      he.workers.profile.terms.insurer.deduction,
    );
  });

  test("narrows the closed list as the question is typed, and puts it back", async ({
    page,
  }) => {
    await page.goto("/help");
    const rows = page.locator('[data-row^="topic-"]');
    await expect(rows).toHaveCount(HELP_TOPICS.length);

    // Narrowing is the whole reason the list is on screen: it makes the
    // matcher's reach visible instead of discovered by failure.
    //
    // **Which of the two vacation questions leads is not asserted.** They score
    // the same on the word they share, so the order is the registry's tie-break
    // and an assertion on it would be a test of an array's order wearing the
    // clothes of a test of matching. That both survive is the real claim.
    await page.locator('[data-field="help-query"]').fill("חופשה");
    await expect(page.locator('[data-row="topic-vacationLeft"]')).toBeVisible();
    await expect(page.locator('[data-row="topic-markVacation"]')).toBeVisible();
    const narrowed = await rows.count();
    expect(narrowed).toBeGreaterThan(0);
    expect(narrowed).toBeLessThan(HELP_TOPICS.length);

    await page.locator('[data-role="help-clear"]').click();
    await expect(rows).toHaveCount(HELP_TOPICS.length);
  });

  test("still offers every screen when the question reaches nothing", async ({ page }) => {
    await page.goto("/help");
    await ask(page, "גידול עגבניות בחממה");

    await expect(page.locator('[data-role="help-no-match"]')).toBeVisible();
    await expect(page.locator('[data-role="help-answer"]')).toHaveCount(0);
    // The point of the state: the screen list is the whole application, so a
    // question that matched nothing has still been given somewhere to go.
    await expect(page.locator('[data-row^="screen-"]')).toHaveCount(HELP_SCREENS.length);
  });

  test("names no worker and draws no figure", async ({ page }) => {
    // Account-blind (item 24). This spec never stepped onto a worker, and the
    // screen has to be complete anyway — which is also what keeps it correct for
    // an account whose months are refused and for one with no worker in it yet.
    await page.goto("/help");
    const main = page.locator("main");
    await expect(main).not.toContainText("₪");
    await expect(main.locator('[translate="no"]')).toHaveCount(0);
    await expect(page.locator('[data-row^="screen-"]')).toHaveCount(HELP_SCREENS.length);
  });
});

test.describe("the way in to it", () => {
  test.beforeEach(async ({ page }) => {
    await useHousehold(page, "help", "launcher");
  });

  test("floats in the bottom corner of every screen, and opens the screen", async ({
    page,
  }) => {
    await page.goto("/");
    const launcher = page.locator('[data-role="help-launcher"]');
    await expect(launcher).toBeVisible();

    // **Bottom right, which is what the user asked for, and under `dir="rtl"`
    // is the inline start.** It is measured rather than looked at: the class is
    // `start-*`, and a `right-*` written by hand would put it in the other
    // corner on this document while reading as the obviously correct property.
    const box = await launcher.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (box === null || viewport === null) return;
    expect(box.x + box.width).toBeGreaterThan(viewport.width * 0.75);
    expect(box.y + box.height).toBeGreaterThan(viewport.height * 0.75);

    // It carries a word and is never a bare glyph: a "?" already means
    // "explain this figure" (item 24), and an icon alone cannot be translated.
    await expect(launcher).toContainText(he.help.ask.launcher);

    await launcher.click();
    await arrivesAt(page, /\/help$/);
    // And it stands down on the screen it opens.
    await expect(page.locator('[data-role="help-launcher"]')).toHaveCount(0);
  });

  test("leaves the top bar its five tabs and nothing else", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: he.nav.landmark });
    await expect(nav.getByRole("link")).toHaveCount(5);
    // Never a "?" in the bar, which is the whole reason the entry is worded.
    await expect(nav.getByRole("link", { name: "?", exact: true })).toHaveCount(0);
  });
});

test.describe("read through Chrome's translation", () => {
  test("survives the round trip with its layout intact", async ({ page }) => {
    await useHousehold(page, "help", "translate");
    await page.goto("/help");
    await ask(page, ASKED[0].query);

    // **What this catches is a crash, not a wording.** Chrome swaps text nodes
    // in place, and React throws `NotFoundError` on `removeChild` wherever a
    // bare string sits as a sibling of other nodes (`CLAUDE.md`). The real
    // engine cannot be driven from here, so the swap is performed on the text
    // nodes themselves, which is the part that breaks React.
    const thrown: string[] = [];
    page.on("pageerror", (error) => thrown.push(error.message));

    const swapped = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.querySelector("main") ?? document.body,
        NodeFilter.SHOW_TEXT,
      );
      const nodes: Text[] = [];
      let node = walker.nextNode();
      while (node !== null) {
        if ((node.textContent ?? "").trim() !== "") nodes.push(node as Text);
        node = walker.nextNode();
      }
      for (const text of nodes) {
        text.replaceWith(document.createTextNode("translated"));
      }
      return nodes.length;
    });
    expect(swapped).toBeGreaterThan(0);

    // React then re-renders over the swapped tree: the list narrows again.
    await page.locator('[data-field="help-query"]').fill("חופשה");
    await expect(page.locator('[data-row^="topic-"]').first()).toBeVisible();
    expect(thrown, thrown.join("\n")).toEqual([]);

    // And the page still does not scroll sideways, which is how a mixed-script
    // run that escaped its container announces itself on an rtl page.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("puts no meaningful text inside an image", async ({ page }) => {
    await useHousehold(page, "help", "glyphs");
    await page.goto("/help");
    // Every glyph on the screen is decorative and has a real label beside it,
    // so none of them may carry a name of its own for a reader to depend on.
    const titled = page.locator("main svg:not([aria-hidden='true'])");
    await expect(titled).toHaveCount(0);
  });
});

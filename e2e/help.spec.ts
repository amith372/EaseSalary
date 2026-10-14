import { expect, test, type Page } from "@playwright/test";
import {
  FIRST_WORKER_NAME,
  openPaymentSections,
  switchToTestWorker,
  useHousehold,
} from "./household";
import { SATURDAY } from "../src/lib/dates";
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
 * **It needs no worker and no month, and one of the tests below is that it does
 * not.** Item 24 lets an *answer* name a worker and draw a figure, because it
 * answers what this household owes and when; the closed list, the opening line
 * and the screen list carry neither, which is what keeps the screen complete for
 * an account whose months are refused and for one with no worker in it yet. So
 * this spec never steps onto the test worker, where every other spec here does
 * before it asserts a figure.
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

/**
 * Opens the panel and waits until the card is actually up.
 *
 * **The press is retried rather than made once.** The launcher is server-drawn
 * and takes presses only once React has hydrated, which on a `next dev` server
 * compiling the route can be a second or two after the button is on the screen
 * — a single click lands on nothing and the test then fails on the field inside
 * a card that was never opened, which reads as a broken panel.
 */
async function openPanel(page: Page) {
  const panel = page.locator('[data-role="help-panel"]');
  await expect(async () => {
    await page.locator('[data-role="help-launcher"]').click();
    await expect(panel).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  return panel;
}

test.describe("the help screen", () => {
  test.beforeEach(async ({ page }) => {
    await useHousehold(page, "help", "ask");
  });

  test("answers a typed question with a screen, a gesture and the way there", async ({
    page,
  }) => {
    await page.goto("/help");

    for (const [index, asked] of ASKED.entries()) {
      await ask(page, asked.query);
      // **The turn this question made, found by when it was asked.** Every
      // earlier turn is still on the screen — the thread keeps them — so a bare
      // `[data-role="help-answer"]` is every answer the conversation holds.
      const turn = page.locator(`[data-row="turn-${index + 1}"]`);
      // The question is drawn above the answer it got, which is what makes the
      // thread readable at all: an answer card alone says which screen settles
      // something without saying what was asked.
      await expect(turn.locator('[data-role="help-asked"]')).toHaveText(asked.query);
      // By the topic's id and not by the Hebrew beside it: the handle is what
      // the row *is* (`CLAUDE.md` rule 10).
      await expect(turn.locator('[data-role="help-answer"]')).toHaveAttribute(
        "data-topic",
        asked.topic,
      );
      // The destination, which is the half no unit test can see: the card names
      // a screen in words and the button carries an address, and a card that
      // said one thing while the button did another would look entirely right.
      await expect(turn.locator('[data-role="help-go"]')).toHaveAttribute(
        "href",
        asked.screen,
      );
      // It points at the rule and never restates it (item 24).
      await expect(turn.locator('[data-role="help-rule"]')).toBeVisible();
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
    // The lists live on the panel's other side (the user, 2026-10-10); the box
    // at the foot is the same one, and typing in it narrows them while they
    // are open (item 24).
    await page.locator('[data-tab="faq"]').click();
    const rows = page.locator('[data-row^="topic-"]');
    await expect(rows).toHaveCount(HELP_TOPICS.length);
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
    // question that matched nothing has still been given somewhere to go — and
    // now that the list is on the panel's other side, the card has to carry the
    // way there (item 24).
    await page.locator('[data-role="help-to-screens"]').click();
    await expect(page.locator('[data-row^="screen-"]')).toHaveCount(HELP_SCREENS.length);
  });

  /**
   * **A question asked from the list is answered in the thread**, which is on
   * the panel's other side — so the press has to take them there, or it reads
   * as a press that did nothing at all.
   *
   * Scenario: `/help`, `שאלות נפוצות` open, the last question in the list
   * pressed — the one furthest down, and so the one whose answer lands
   * furthest out of sight.
   *
   * **The result is asserted and not the gesture**: the answer is in the
   * viewport afterwards, measured off its own box against the window.
   *
   * What it would catch: a press that answered on a side the user cannot see,
   * and a thread that did not scroll to the turn it just added.
   */
  test("takes a question pressed in the list to its answer in the thread", async ({
    page,
  }) => {
    await page.goto("/help");
    await page.locator('[data-tab="faq"]').click();

    const last = HELP_TOPICS[HELP_TOPICS.length - 1];
    if (last === undefined) throw new Error("no topics");
    await page.locator(`[data-row="topic-${last.id}"]`).click();

    const answer = page.locator('[data-role="help-answer"]');
    await expect(answer).toHaveAttribute("data-topic", last.id);

    // Settled, so the smooth scroll is read after it has finished rather than
    // while it is running.
    await expect
      .poll(
        async () => {
          const box = await answer.boundingBox();
          const height = page.viewportSize()?.height ?? 0;
          if (box === null || height === 0) return false;
          return box.y >= 0 && box.y < height;
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test("what it offers names no worker and draws no figure", async ({ page }) => {
    // The half of item 24 that an answering assistant keeps: an answer may name
    // the worker it is about and draw the figure it was asked for, and what the
    // screen *offers* may not. A list that drew this household's next payment
    // would be a list that is wrong for an account whose months are refused and
    // for one with no worker in it yet — and this spec never stepped onto a
    // worker, so the questions above were answered without one.
    await page.goto("/help");
    await expect(page.getByText(he.help.lead)).toBeVisible();
    await page.locator('[data-tab="faq"]').click();
    await expect(page.locator('[data-row^="screen-"]')).toHaveCount(HELP_SCREENS.length);
    const offered = page.locator('[data-row^="topic-"], [data-row^="screen-"]');
    await expect(offered).toHaveCount(HELP_TOPICS.length + HELP_SCREENS.length);
    for (const row of await offered.all()) {
      await expect(row).not.toContainText("₪");
      await expect(row.locator('[translate="no"]')).toHaveCount(0);
    }
  });
});

test.describe("the way in to it", () => {
  test.beforeEach(async ({ page }) => {
    await useHousehold(page, "help", "launcher");
  });

  test("floats in the bottom corner of every screen, and opens a card over it", async ({
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

    // **The press opens a card and does not navigate**, which is the whole of
    // what changed (the user, 2026-10-07): the assistant is asked while the
    // user is in the middle of something, and a screen of its own takes them
    // away from the thing they were asking about. The address is asserted
    // after the card is up, because a navigation that did happen would leave
    // the panel's own markup on a screen that no longer carries the launcher.
    await launcher.click();
    const panel = page.locator('[data-role="help-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-field="help-query"]')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    // The way out is where the way in was, under the card.
    await panel.locator('[data-role="help-close"]').click();
    await expect(panel).toBeHidden();
    await expect(page).toHaveURL(/\/$/);

    // Esc closes it too, which is what `<dialog>` is used for rather than
    // rebuilt: a card over the screen that only one control can dismiss is a
    // card a keyboard is stuck behind.
    await launcher.click();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  });

  test("opens over whichever screen the user is on, and answers there", async ({
    page,
  }) => {
    // Three screens rather than one: the launcher is drawn by the shell, and a
    // panel that opened on the home screen alone would still pass a test that
    // only pressed it there.
    for (const address of ["/payments", "/reports", "/settings"]) {
      await page.goto(address);
      const panel = await openPanel(page);
      // It answers from inside the panel, with the corpus it fetched on
      // opening or without it — the registry alone is enough (`match.ts`).
      await panel.locator('[data-field="help-query"]').fill(ASKED[0].query);
      await panel.locator('[data-role="help-submit"]').click();
      await expect(panel.locator('[data-role="help-answer"]')).toHaveAttribute(
        "data-topic",
        ASKED[0].topic,
      );
      await expect(page).toHaveURL(new RegExp(`${address}$`));
      await page.keyboard.press("Escape");
    }
  });

  /**
   * **It is a conversation and not one answer at a time** (specs.md item 24: the
   * exchange lasts the session and is stored nowhere).
   *
   * Scenario: the panel opened on `/`, two of the three questions above asked
   * one after the other — the first about a week of sickness, the second about
   * an advance — then the card closed and reopened, then the page reloaded.
   *
   * Expected: two turns, each carrying the question that produced it and the
   * answer it reached; the newest drawn first, directly under the box; both
   * still there after the card is closed and opened again; none of them there
   * after a reload.
   *
   * What it would catch: the second answer replacing the first, which is what
   * the screen did before the thread existed and is the reason a family had to
   * ask the same question twice. It would equally catch a thread emptied by
   * closing the card — the exchange lasts the session, not the opening — and a
   * thread that survived a reload, which would mean it is being stored.
   */
  test("keeps every turn of the conversation, and loses them on a reload", async ({
    page,
  }) => {
    await page.goto("/");
    const panel = await openPanel(page);
    const turns = panel.locator('[data-row^="turn-"]');

    for (const asked of [ASKED[0], ASKED[1]]) {
      await panel.locator('[data-field="help-query"]').fill(asked.query);
      await panel.locator('[data-role="help-submit"]').click();
      await expect(panel.locator('[data-role="help-asked"]').last()).toHaveText(
        asked.query,
      );
    }

    await expect(turns).toHaveCount(2);
    for (const [index, asked] of [ASKED[0], ASKED[1]].entries()) {
      const turn = panel.locator(`[data-row="turn-${index + 1}"]`);
      await expect(turn.locator('[data-role="help-asked"]')).toHaveText(asked.query);
      await expect(turn.locator('[data-role="help-answer"]')).toHaveAttribute(
        "data-topic",
        asked.topic,
      );
    }
    // The thread reads downwards and the newest turn sits directly above the
    // box, as a messaging app draws it (`DESIGN.md`).
    await expect(turns.first()).toHaveAttribute("data-row", "turn-1");
    await expect(turns.last()).toHaveAttribute("data-row", "turn-2");
    // And the box is empty, because sending it put the question in the thread.
    await expect(panel.locator('[data-field="help-query"]')).toHaveValue("");

    // Closing the card does not end the conversation: it is the session that
    // bounds it, so a user who shut the card to look at the screen behind it
    // has not thrown away what they were told.
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await openPanel(page);
    await expect(turns).toHaveCount(2);

    // And it is stored nowhere, which is the other half of the same sentence.
    await page.reload();
    await openPanel(page);
    await expect(panel.locator('[data-field="help-query"]')).toBeVisible();
    await expect(turns).toHaveCount(0);
  });

  test("stands down on the screen it is the panel for", async ({ page }) => {
    // `/help` survives as the address an answer can be linked to (the user,
    // 2026-10-10), and draws the same conversation — so a control opening a
    // card over it would offer the user what they are already reading.
    await page.goto("/help");
    await expect(page.locator('[data-field="help-query"]')).toBeVisible();
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
    await page.locator('[data-tab="faq"]').click();
    // **Hydrated before anything is swapped.** React reconciles the server's
    // markup against the browser's on hydration, so text nodes replaced before
    // it has run are a hydration mismatch — a fault of this test and not of the
    // screen. Narrowing the list is the cheapest proof that the component is
    // live.
    await page.locator('[data-field="help-query"]').fill("חופשה");
    await expect(page.locator('[data-row^="topic-"]').first()).toBeVisible();

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

    // React then re-renders over the swapped tree. The closed list is where
    // that shows: it narrows on the keystroke.
    await page.locator('[data-field="help-query"]').fill("חופשה");
    await expect(page.locator('[data-row^="topic-"]').first()).toBeVisible();
    // And a turn drawn over the swapped tree, which is the other half of the
    // re-render: asking takes them to the thread on the other side.
    await ask(page, ASKED[0].query);
    await expect(page.locator('[data-row="turn-1"]')).toBeVisible();
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

/**
 * The half of item 24 that answers rather than points: a question about what
 * this household owes and when, answered out of its own months.
 *
 * **No figure is written down here** (`CLAUDE.md` rule 11). Each test reads
 * what the panel said and holds it against the screen that figure belongs to,
 * which is the one claim no unit test can make: the two are one engine result
 * drawn twice (rule 12), and a panel that worked a figure out for itself would
 * pass every test either screen has of its own.
 */
test.describe("what the account itself answers", () => {
  test.beforeEach(async ({ page }) => {
    await useHousehold(page, "help", "answers");
  });

  /** The text of the first isolate inside a row — the figure, month or date a
   * sentence carries, which is drawn in its own `<bdi>` (`docs/agents/rtl.md`)
   * and so can be read without the Hebrew around it. */
  async function valueIn(page: Page, row: string): Promise<string> {
    const value = page.locator(`${row} bdi`).first();
    await expect(value).toBeVisible();
    const text = (await value.textContent())?.trim() ?? "";
    expect(text, row).not.toBe("");
    return text;
  }

  /**
   * The user's own question of 2026-10-07: "when is the next time ill need to
   * pay ביטוח לאומי", asked here in the Hebrew they would type.
   *
   * Scenario: the demo household on 18 September 2026, where one quarter has
   * ended with no payment recorded against it.
   *
   * Expected: the panel names that quarter, says what each of its months put
   * aside and that the figure is an estimate — and the opening screen's own
   * card for the same quarter names the same months.
   *
   * What it would catch: a panel that worked the quarter out for itself, which
   * is the failure that leaves two screens each looking right while telling a
   * family two different things about one payment (rule 12).
   */
  test("names the quarter the alerts name", async ({ page }) => {
    await page.goto("/help");
    await ask(page, "כמה ביטוח לאומי לשלם החודש");
    const answer = page.locator('[data-role="help-account-answer"]');
    await expect(answer).toHaveAttribute("data-answer", "nationalInsuranceDue");

    const quarter = await valueIn(page, '[data-row^="answer-quarter-"]');
    // Each month of it carries its own accrual, and the answer says in words
    // that it is an estimate: the sum actually billed has differed (item 19).
    await expect(answer.locator('[data-row^="answer-accrued-"]').first()).toContainText(
      "₪",
    );
    await expect(answer).toContainText(
      he.help.answers.nationalInsuranceDue.estimateNote,
    );

    await page.goto("/alerts");
    await expect(
      page.locator('[data-role="alert"]').filter({ hasText: quarter }),
    ).not.toHaveCount(0);
  });

  /**
   * "when is the next time ill need to pay אגרת ויזה", the user's fourth
   * question.
   *
   * Scenario: the same household. The fee is dated off the worker's own
   * work-visa expiry (item 28), and the payments screen lists it under
   * `לקראת החודשים הבאים`.
   *
   * Expected: the month the panel names is a month that list also names.
   *
   * What it would catch: a fee dated off anything else — a year from the last
   * payment, or from today — which reads as an ordinary answer and would send
   * a family to the office in the wrong month.
   */
  test("dates the visa fee as the payments screen does", async ({ page }) => {
    await page.goto("/help");
    await ask(page, "מתי משלמים אגרה להארכת ויזה");
    await expect(page.locator('[data-role="help-account-answer"]')).toHaveAttribute(
      "data-answer",
      "visaFeeDue",
    );
    const month = await valueIn(page, '[data-row="answer-fee-due"]');

    await page.goto("/payments");
    // One row per thing falling due, so it is the row carrying that month that
    // has to exist rather than the list as a whole.
    await expect(
      page.locator('[data-role="upcoming"]').filter({ hasText: month }),
    ).not.toHaveCount(0);
  });

  /**
   * "what payments am i required to pay", the first of the four.
   *
   * Scenario: the same household, asked from `/help`. The question names
   * neither worker, so both are answered (the user, 2026-10-10).
   *
   * Expected: the month's own lines, a total that is the figure the opening
   * screen draws for the worker it opens on, and the sentence saying what the
   * list leaves out.
   *
   * What it would catch: a total assembled in the panel rather than read off
   * the engine (rule 12), and a list that folded the third-party column into
   * the worker's own salary (item 16).
   */
  test("lists the month's lines and totals them as the month screen does", async ({
    page,
  }) => {
    await page.goto("/help");
    await ask(page, "כמה המשכורת של החודש הזה");
    const answer = page.locator('[data-role="help-account-answer"]');
    await expect(answer).toHaveAttribute("data-answer", "owedThisMonth");
    // Both workers, because the question named neither.
    await expect(answer.locator('[data-row^="answer-worker-"]')).toHaveCount(2);
    expect(await answer.locator('[data-row^="answer-line-"]').count()).toBeGreaterThan(0);
    await expect(answer).toContainText(he.help.answers.owedThisMonth.excludes);
    const total = await valueIn(page, '[data-row="answer-total"]');

    // The opening screen opens on the first worker, which is the first the
    // answer is given for.
    await page.goto("/");
    await expect(page.locator('[data-row="net"]')).toContainText(total);
  });

  /**
   * **A question that names a worker is answered for that worker alone** (item
   * 24, the user's decision of 2026-10-10).
   *
   * What it would catch: a panel that answered for whichever worker the
   * switcher happens to be on — the wrong worker exactly when the family asked
   * about the other one — and a name that reached nothing, which would answer
   * for both and bury what was asked.
   */
  test("answers for the worker the question named", async ({ page }) => {
    await page.goto("/help");
    await ask(page, "מתי משלמים אגרה להארכת ויזה להאנה");
    const answer = page.locator('[data-role="help-account-answer"]');
    await expect(answer).toHaveAttribute("data-answer", "visaFeeDue");
    await expect(answer.locator('[data-row^="answer-worker-"]')).toHaveCount(1);
    await expect(answer).toContainText(FIRST_WORKER_NAME.split(" ")[0] ?? "");
  });

  /**
   * "what payments to 3rd things do i need to pay?", the second of the user's
   * four questions of 2026-10-07.
   *
   * Scenario: the demo household on 18 September 2026. Both workers' employment
   * permits run out on 30 November 2026 — beyond the sixty-day warning and
   * inside the twelve months ahead — so the licence fee is still ahead and
   * `לקראת החודשים הבאים` lists it; a quarter has ended with no payment against
   * it, so `/alerts` carries it; and no placement fee has ever been recorded for
   * either worker.
   *
   * Expected: one row per thing still owed, each naming its own month or quarter
   * — the permit's two fees both name the month the payments screen gives them,
   * and the unpaid quarter is a quarter the opening screen's alerts also name.
   * The answer says which list it is giving, and names no kind at the foot,
   * because there is no longer a kind it cannot date.
   *
   * What it would catch: the whole closed list of seven drawn as though a family
   * owed all of them at once, which is what the answer must not be (the user,
   * 2026-10-11); and a month or a quarter the panel worked out for itself, which
   * is two screens telling a family two different things about one payment
   * (rule 12). The permit's two fees are the pair this reaches that no other
   * browser test does: they share a date, so one of them answering with the
   * other's month would look right on either screen read alone.
   */
  test("lists what is still owed, in the months the screens give", async ({ page }) => {
    await page.goto("/help");
    await ask(page, "אילו תשלומים לגורמים שלישיים אני חייב");
    const answer = page.locator('[data-role="help-account-answer"]');
    await expect(answer).toHaveAttribute("data-answer", "thirdPartyDue");
    // Both workers, because the question named neither.
    await expect(answer.locator('[data-row^="answer-worker-"]')).toHaveCount(2);

    // Not the catalogue: a kind with nothing outstanding has no row at all.
    const owed = answer.locator('[data-row^="answer-owed-"]');
    expect(await owed.count()).toBeGreaterThan(0);
    await expect(
      answer.locator('[data-row="answer-owed-medicalInsurance"]'),
    ).toHaveCount(0);

    // The placement fee has never been recorded for either worker, and is the
    // one reason no other screen says.
    await expect(
      answer.locator('[data-row="answer-owed-placementFee"]').first(),
    ).toContainText(he.help.answers.thirdPartyDue.neverRecorded);

    // The quarter's figure is an accrual and is said to be one, as it is
    // wherever else it is drawn (item 19).
    await expect(
      answer.locator('[data-row="answer-owed-estimate"]').first(),
    ).toContainText(he.help.answers.nationalInsuranceDue.estimateNote);

    // What the list is. Nothing is named at the foot of it: every kind this
    // answer can owe now falls on a date the application works out, so item
    // 24's rule is satisfied rather than exercised.
    await expect(answer).toContainText(he.help.answers.thirdPartyDue.excludes);
    await expect(answer.locator('[data-row="answer-undated"]')).toHaveCount(0);

    const feeMonth = await valueIn(
      page,
      '[data-row="answer-owed-licenceFee"] [data-role="owed-why"]',
    );
    // The permit's request fee reads the permit's own expiry too, so it answers
    // with the same month as the licence fee beside it.
    const requestMonth = await valueIn(
      page,
      '[data-row="answer-owed-workerVisa"] [data-role="owed-why"]',
    );
    expect(requestMonth).toBe(feeMonth);
    const quarter = await valueIn(
      page,
      '[data-row^="answer-owed-nationalInsurance-"] [data-role="owed-why"]',
    );

    await page.goto("/payments");
    // Two rows carry that month — the permit's two fees — and both are the
    // panel's own answer rather than a figure it worked out for itself.
    await expect(
      page.locator('[data-role="upcoming"]').filter({ hasText: feeMonth }),
    ).toHaveCount(2);

    await page.goto("/alerts");
    await expect(
      page.locator('[data-role="alert"]').filter({ hasText: quarter }),
    ).not.toHaveCount(0);
  });
});

/**
 * A sentence that tells the application to do something, rather than asking it
 * anything (specs.md item 24).
 *
 * **What only a browser can check here.** `gesture.test.ts` proves which days
 * a sentence comes to against a fixture; none of that says the proposal was
 * drawn, that the press reached the calendar, or — the one that matters — that
 * nothing reached it *before* the press.
 */
test.describe("a sentence that marks the calendar", () => {
  test.beforeEach(async ({ page }) => {
    await useHousehold(page, "help", "staging");
  });

  /** The three days the sentences below name: Monday to Wednesday of the week
   * after the suite's own day, clear of the test worker's seeded marks and of
   * the Saturday that is their weekly rest. */
  const MARKED = ["2026-09-21", "2026-09-22", "2026-09-23"];

  /**
   * Scenario: the demo household on 18 September 2026, which holds two
   * workers, and a sentence naming neither of them —
   * `סמן חופשה מ-21.9 עד 23.9`.
   *
   * Expected: the panel asks whose calendar it is; once told, it proposes
   * exactly the three days; the calendar is untouched until the press; and
   * after it those three days carry the vacation mark and no other day of the
   * month has changed.
   *
   * What it would catch: a sentence that marked on being typed, which is the
   * failure the whole shape exists to prevent — and a proposal that wrote to
   * the first worker because the sentence named no one, which is a day the
   * family would have to find on a calendar they were not looking at.
   */
  test("proposes the days, and marks none of them until the press", async ({
    page,
  }) => {
    await page.goto("/help");
    await ask(page, "סמן חופשה מ-21.9 עד 23.9");

    // Two workers and a sentence naming neither: whose calendar it is, is the
    // one thing the application does not hold (item 24).
    const staged = page.locator('[data-role="help-staged"]');
    await expect(staged).toHaveAttribute("data-state", "choose");
    await staged.locator('[data-row^="staged-worker-"]').nth(1).click();

    await expect(staged).toHaveAttribute("data-state", "ready");
    for (const date of MARKED) {
      await expect(staged.locator(`[data-row="staged-day-${date}"]`)).toBeVisible();
    }

    /**
     * The calendar is read in a second tab of the same session, so the thread
     * is still standing when the press is made.
     *
     * **It is not a convenience.** The exchange is this component's own state
     * and a reload empties it (item 24), so a test that navigated away to look
     * at the calendar would be testing the proposal's survival of a reload —
     * which item 24 says it does not survive — instead of what the press does.
     */
    const calendar = await page.context().newPage();
    const marks = he.calendar.marks(SATURDAY);
    async function vacationDays(): Promise<string[]> {
      await calendar.goto("/");
      await switchToTestWorker(calendar);
      const marked: string[] = [];
      for (const date of [...MARKED, "2026-09-20"]) {
        const label =
          (await calendar.locator(`[data-date="${date}"]`).getAttribute("aria-label")) ?? "";
        if (label.includes(marks.vacation)) marked.push(date);
      }
      return marked;
    }

    // **Nothing yet**, which is the assertion this test exists for: the
    // proposal is on the screen and the calendar has not changed.
    expect(await vacationDays()).toEqual([]);

    await staged.locator('[data-role="staged-mark"]').click();
    await expect(staged.locator('[data-role="staged-done"]')).toBeVisible();

    // Exactly the three, and the day before the range is the control: a sweep
    // that marked the whole week would read as a pass on the three above.
    expect(await vacationDays()).toEqual(MARKED);
    await calendar.close();
  });

  /**
   * Scenario: the same two-worker household, and a sentence that names one of
   * them — `סמן חופשה להאנה מ-21.9 עד 23.9`.
   *
   * Expected: nothing is asked. The proposal is drawn for Hanna straight away,
   * and it says whose it is.
   *
   * What it would catch: a panel that asked whose calendar it was although the
   * sentence said — and, worse, the same question answered for *both* workers
   * the way a question about what is owed is, which for a marking would be
   * days written onto a calendar nobody mentioned.
   */
  test("marks for the worker the sentence named, without asking", async ({
    page,
  }) => {
    await page.goto("/help");
    await ask(page, "סמן חופשה להאנה מ-21.9 עד 23.9");

    const staged = page.locator('[data-role="help-staged"]');
    await expect(staged).toHaveAttribute("data-state", "ready");
    await expect(staged.locator('[data-role="staged-whose"]')).toHaveCount(0);
    await expect(staged).toContainText(FIRST_WORKER_NAME.split(" ")[0]);

    // And it is their calendar that changes, not the other worker's.
    await staged.locator('[data-role="staged-mark"]').click();
    await expect(staged.locator('[data-role="staged-done"]')).toBeVisible();

    await page.goto("/");
    const marks = he.calendar.marks(SATURDAY);
    for (const date of MARKED) {
      await expect(page.locator(`[data-date="${date}"]`)).toHaveAttribute(
        "aria-label",
        new RegExp(marks.vacation),
      );
    }
    await switchToTestWorker(page);
    for (const date of MARKED) {
      await expect(page.locator(`[data-date="${date}"]`)).not.toHaveAttribute(
        "aria-label",
        new RegExp(marks.vacation),
      );
    }
  });

  /**
   * Scenario: the same household, and a sentence whose range holds no day the
   * mark can take — `סמן יום מנוחה מ-21.9 עד 23.9`, where the test worker
   * rests on Saturday and the range is Monday to Wednesday.
   *
   * Expected: the card says there is nothing to mark, gives the calendar's own
   * reason for each day, and offers no press at all.
   *
   * What it would catch: a proposal that offered a press which would mark
   * nothing — the control that is drawn, pressed and does nothing, which reads
   * to a family as the application having failed.
   */
  test("offers no press where no day of the range can take the mark", async ({
    page,
  }) => {
    await page.goto("/help");
    await ask(page, "סמן יום מנוחה מ-21.9 עד 23.9");

    const staged = page.locator('[data-role="help-staged"]');
    await staged.locator('[data-row^="staged-worker-"]').nth(1).click();
    await expect(staged).toHaveAttribute("data-state", "ready");

    await expect(staged.locator('[data-role="staged-nothing"]')).toBeVisible();
    await expect(staged.locator('[data-role="staged-mark"]')).toHaveCount(0);
    // The reason is the calendar's own, said in the calendar's own words.
    await expect(staged.locator('[data-role="staged-refused"]')).toContainText(
      he.calendar.skipped(SATURDAY).notRestDay,
    );
  });

  /**
   * Scenario: a sentence naming days before the worker's first month —
   * `סמן חופשה מ-1.12.2025 עד 3.12.2025`, where the test worker's first month
   * is January 2026.
   *
   * Expected: the card says which month is their first and offers no press.
   *
   * What it would catch: a sentence reaching a month item 6 says cannot be
   * opened or viewed — days the family could then never see or correct,
   * because no screen draws that month.
   */
  test("refuses a range before the worker's first month", async ({ page }) => {
    await page.goto("/help");
    await ask(page, "סמן חופשה מ-1.12.2025 עד 3.12.2025");

    const staged = page.locator('[data-role="help-staged"]');
    await staged.locator('[data-row^="staged-worker-"]').nth(1).click();
    await expect(staged).toHaveAttribute("data-state", "tooEarly");
    await expect(staged.locator('[data-role="staged-too-early"]')).toBeVisible();
    await expect(staged.locator('[data-role="staged-mark"]')).toHaveCount(0);
  });

  /**
   * Scenario: `סמן מחלה מ-1.1 עד 31.12` — a year of sickness in one sentence,
   * which no sweep on a calendar can draw.
   *
   * Expected: it is not read as an instruction at all. The panel navigates,
   * which leaves the calendar as the way to do it.
   *
   * What it would catch: a sentence reaching further than the gesture it
   * stands for — item 24 says the press does what the calendar's own gesture
   * does and nothing more, and a drag lives inside one month's grid.
   */
  test("does not read a year-long range as an instruction", async ({ page }) => {
    await page.goto("/help");
    await ask(page, "סמן מחלה מ-1.1 עד 31.12");

    await expect(page.locator('[data-role="help-staged"]')).toHaveCount(0);
    await expect(page.locator('[data-role="help-answer"]')).toBeVisible();
  });

  /**
   * Scenario: an account with no worker in it yet, and a marking sentence.
   *
   * Expected: it navigates. There is no calendar to mark, so the sentence is
   * answered as the question it then is.
   *
   * What it would catch: a card asking whose calendar it is with no name to
   * offer — a dead end on the one account item 24 says must still reach every
   * screen the application has.
   */
  test("answers a marking sentence as a question where there is no worker", async ({
    page,
  }) => {
    await useHousehold(page, "empty", "staging");
    // With no worker there is no `/help` screen to open — every route draws the
    // add-worker card instead (`AppShell`) — and the panel is how the help is
    // reached, which is the state this test is about.
    await page.goto("/");
    const panel = await openPanel(page);
    await panel.locator('[data-field="help-query"]').fill("סמן חופשה מ-21.9 עד 23.9");
    await panel.locator('[data-role="help-submit"]').click();

    await expect(panel.locator('[data-role="help-staged"]')).toHaveCount(0);
    await expect(panel.locator('[data-role="help-answer"]')).toBeVisible();
  });

  /**
   * Scenario: `איך מסמנים חופשה?` — every word of an instruction, and a
   * question.
   *
   * Expected: the panel navigates, as it always did.
   *
   * What it would catch: a grammar wide enough to swallow the questions the
   * screen was built to answer, which would turn "how do I mark a vacation"
   * into a proposal to mark one.
   */
  test("reads a question about marking as a question", async ({ page }) => {
    await page.goto("/help");
    await ask(page, "איך מסמנים חופשה?");

    await expect(page.locator('[data-role="help-staged"]')).toHaveCount(0);
    await expect(page.locator('[data-role="help-answer"]')).toBeVisible();
  });
});

/**
 * The third shape of answer: how something is done, said as the presses it
 * takes (specs.md item 24).
 *
 * **Two halves, and the second is the one that cannot go stale quietly.** The
 * first is that the steps are drawn, in order, for a question typed in a
 * family's own words. The second is that every control a step names is a
 * control on the screen the steps name — so a button renamed on `/payments`
 * fails here instead of leaving help telling a family to press a word that is
 * no longer on any screen. `steps.test.ts` holds the other end of that join: a
 * step may quote a control's own string and may never retype it.
 */
test.describe("the presses an answer lists", () => {
  /** A question in a family's words, the topic it must reach, and the labels
   * its steps must name in that order. Every label is read off the control's
   * own key (`CLAUDE.md` rule 11). */
  const HOW = [
    {
      query: "היא לקחה חצי יום חופש ביום רביעי, איך רושמים את זה",
      topic: "markHalfVacation",
      labels: [
        he.calendar.picker.more.withPart,
        he.calendar.picker.part.half,
        he.calendar.marks(SATURDAY).vacation,
      ],
    },
    {
      query: "שילמנו את הביטוח הלאומי של הרבעון, איך רושמים את זה",
      topic: "recordNationalInsurance",
      labels: [
        he.sheet.thirdParty.nationalInsurance,
        he.month.actions.thirdParty.amount,
        he.month.actions.thirdParty.submit,
      ],
    },
  ] as const;

  test.beforeEach(async ({ page }) => {
    await useHousehold(page, "help", "steps");
  });

  /**
   * Scenario: each question above, typed into `עוזר דיגיטלי` on `/help`.
   *
   * Expected: the turn's answer carries numbered steps, counted from one, and
   * the labels appear in the order the gesture takes them — the half before the
   * kind, because the kind chip is what commits the mark.
   *
   * What it would catch: steps drawn out of order, which is a gesture that
   * fails at its last press; a card that drew the one-line answer and dropped
   * the steps; and a question of this kind reaching the topic beside it.
   */
  test("draws the presses in order, under the line that summarises them", async ({
    page,
  }) => {
    await page.goto("/help");

    for (const [index, asked] of HOW.entries()) {
      await ask(page, asked.query);
      const answer = page.locator(
        `[data-row="turn-${index + 1}"] [data-role="help-answer"]`,
      );
      await expect(answer).toHaveAttribute("data-topic", asked.topic);

      const steps = answer.locator("[data-step]");
      const drawn = await steps.count();
      expect(drawn, asked.topic).toBeGreaterThan(1);
      // Numbered from one, in the order they are drawn: handles that did not
      // follow the order on the screen would make every assertion below true
      // of the wrong row.
      for (let at = 0; at < drawn; at += 1) {
        await expect(steps.nth(at)).toHaveAttribute("data-step", String(at + 1));
      }

      // **The quoted labels and not the prose around them.** Each control a
      // step names is drawn in its own isolate, so this reads exactly what the
      // steps quote, in the order they quote it — searching the sentences
      // instead would find the words of a control inside the step above it.
      const quoted = await answer.locator("[data-step] bdi").allInnerTexts();
      let reached = -1;
      for (const label of asked.labels) {
        const at = quoted.indexOf(label, reached + 1);
        expect(at, `${asked.topic}: ${label}`).toBeGreaterThan(reached);
        reached = at;
      }
    }
  });

  /**
   * Scenario: the month screen, one day pressed open, and the fold the half day
   * sits behind.
   *
   * Expected: every label the half-day steps name is a control on that screen,
   * under that accessible name.
   *
   * What it would catch: a control renamed while the step kept the old word —
   * the one failure a step list makes silently, because nothing about the help
   * looks wrong afterwards.
   */
  test("names, for the half day, controls the month screen really has", async ({
    page,
  }) => {
    await page.goto("/");
    await switchToTestWorker(page);
    // Two presses on one day: a selection of a single day, which is the only
    // shape the half is offered on.
    await page.locator('[data-date="2026-09-10"]').click();
    await page.locator('[data-date="2026-09-10"]').click();

    await expect(page.getByText(he.calendar.picker.title)).toBeVisible();
    await page
      .getByRole("button", { name: he.calendar.picker.more.withPart, exact: true })
      .click();
    await expect(page.getByText(he.calendar.picker.part.label)).toBeVisible();
    await expect(
      page.getByRole("button", { name: he.calendar.picker.part.half, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: he.calendar.marks(SATURDAY).vacation,
        exact: true,
      }),
    ).toBeVisible();
  });

  /**
   * Scenario: `/payments`, every section open, with the three panels the step
   * lists name opened in turn.
   *
   * Expected: each label quoted by `recordNationalInsurance`, `addAdvance` and
   * `addPayment` is a control there.
   *
   * What it would catch: the same rename as above, on the screen carrying three
   * of the four step lists.
   */
  test("names, on the payments screen, controls that screen really has", async ({
    page,
  }) => {
    await page.goto("/payments");
    await switchToTestWorker(page);
    await openPaymentSections(page);

    // The national insurance: the section's own way in, and the panel's fields.
    // The alert's button carries the same wording by design (`he.ts`).
    const words = he.month.actions.thirdParty;
    const thirdParty = page.locator('[data-group="thirdParty"]');
    await thirdParty.getByRole("button", { name: words.add, exact: true }).click();
    await expect(thirdParty.getByText(words.kind)).toBeVisible();
    await expect(
      thirdParty.getByRole("button", {
        name: he.sheet.thirdParty.nationalInsurance,
        exact: true,
      }),
    ).toBeVisible();
    await expect(thirdParty.getByLabel(words.amount)).toBeVisible();
    await expect(thirdParty.getByText(words.period)).toBeVisible();
    await expect(thirdParty.getByLabel(words.paidOn)).toBeVisible();
    await expect(
      thirdParty.getByRole("button", { name: words.submit, exact: true }),
    ).toBeVisible();

    // The advance, given and repaid: two gestures and so two buttons.
    const advance = he.month.actions.advances;
    const advances = page.locator('[data-group="advances"]');
    await advances.getByRole("button", { name: advance.grant, exact: true }).click();
    await expect(advances.getByLabel(advance.amount)).toBeVisible();
    await expect(advances.getByLabel(advance.givenOn)).toBeVisible();
    await expect(
      advances.getByRole("button", { name: advance.submitGrant, exact: true }),
    ).toBeVisible();

    // The one-off line.
    const line = he.month.actions.lines;
    const lines = page.locator('[data-group="userLines"]');
    await lines.getByRole("button", { name: line.add, exact: true }).click();
    await expect(lines.getByLabel(line.label)).toBeVisible();
    await expect(lines.getByLabel(line.amount)).toBeVisible();
    await expect(
      lines.getByRole("button", { name: line.direction.addition, exact: true }),
    ).toBeVisible();
    await expect(
      lines.getByRole("button", { name: line.direction.deduction, exact: true }),
    ).toBeVisible();
    await expect(
      lines.getByRole("button", { name: line.submit, exact: true }),
    ).toBeVisible();
  });
});

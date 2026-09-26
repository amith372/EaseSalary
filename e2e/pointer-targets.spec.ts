import { expect, test, type Page } from "@playwright/test";
import {
  useHousehold,
  switchToTestWorker,
  openSettingsGroups,
} from "./household";

/**
 * Every control a finger has to hit is at least 24×24 (WCAG 2.2 AA, 2.5.8).
 *
 * **The size is hit-tested and not read off the box.** A fixed-size control
 * takes its hit area from a pseudo-element — the `?` disclosure, the month
 * stepper and the holiday tick all draw smaller than they answer — so a rule
 * measured from `getBoundingClientRect` would fail three controls that are
 * correct and pass none that is wrong. The probe presses outward from the
 * centre with `elementFromPoint` until the point stops resolving to the
 * control, which is the area that actually answers a press.
 *
 * **A link inside a sentence is left out**, which is WCAG's own inline
 * exception: padding it out would overlap the lines above and below it, and
 * the sentence around it is not a target.
 *
 * **The exception asks where the link is laid out and not only what is beside
 * it** (run 8's R8.7). "Its parent holds more text" alone excused every action
 * that merely sits next to a label — the blocker strip's own action and the
 * `כל זכות` link among them, which are the controls this sweep was written
 * for — because in this repository every string is wrapped in an element of
 * its own (`CLAUDE.md`), so a standalone action and an inline link look alike
 * from the anchor. What tells them apart is the flow: a link inside a sentence
 * shares a line box with the words around it, while an action beside a label
 * sits in a flex or grid row, and only the first is exempt.
 *
 * What it catches: a bare text action added without the padding idiom
 * `DESIGN.md` records — the state of the blocker strip, both `כל זכות` links,
 * the two account actions and the holiday tick until 2026-09-24.
 */

const SCREENS = ["/", "/alerts", "/settings", "/settings/holidays"] as const;
const WIDTHS = [390, 768, 1024, 1279, 1440] as const;

interface Target {
  route: string;
  width: number;
  text: string;
  w: number;
  h: number;
}

async function tooSmall(page: Page): Promise<Omit<Target, "route" | "width">[]> {
  return page.evaluate(() => {
    const SELECTOR = "a[href], button, [role='checkbox'], [role='button']";
    const out: { text: string; w: number; h: number }[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(SELECTOR))) {
      let box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;

      // WCAG's inline exception: a link in a run of text, where the sentence
      // around it is not a target and an enlarged area would overlap the lines
      // above and below.
      const parent = el.parentElement;
      const own = (el.textContent ?? "").trim();
      const around = (parent?.textContent ?? "").trim();
      const flow = parent === null ? "" : getComputedStyle(parent).display;
      const inSentence = !flow.includes("flex") && !flow.includes("grid");
      if (el.tagName === "A" && inSentence && around.length > own.length) continue;

      // `elementFromPoint` returns null outside the viewport, so a control near
      // an edge would measure short. Bring it to the middle first.
      if (
        box.top < 60 ||
        box.bottom > innerHeight - 60 ||
        box.left < 60 ||
        box.right > innerWidth - 60
      ) {
        el.scrollIntoView({ block: "center", inline: "center" });
        box = el.getBoundingClientRect();
      }
      if (box.top < 60 || box.bottom > innerHeight - 60) continue;

      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const hits = (x: number, y: number) => {
        const at = document.elementFromPoint(x, y);
        return at !== null && (el.contains(at) || el === at.closest(SELECTOR));
      };
      if (!hits(cx, cy)) continue;
      let up = 0;
      let down = 0;
      let left = 0;
      let right = 0;
      while (up < 30 && hits(cx, cy - up - 1)) up += 1;
      while (down < 30 && hits(cx, cy + down + 1)) down += 1;
      while (left < 30 && hits(cx - left - 1, cy)) left += 1;
      while (right < 30 && hits(cx + right + 1, cy)) right += 1;
      const w = left + right + 1;
      const h = up + down + 1;
      if (w < 24 || h < 24) out.push({ text: own.slice(0, 40), w, h });
    }
    return out;
  });
}

test("no control is smaller than a finger can hit", async ({ page }) => {
  await useHousehold(page, "targets", "sweep");
  const found: Target[] = [];
  for (const route of SCREENS) {
    await page.goto(route);
    await switchToTestWorker(page);
    if (route === "/settings") await openSettingsGroups(page);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      // The grid and the folds re-lay out on a width change; the sweep reads
      // positions, so it waits for the layout to settle rather than for a
      // request.
      await page.waitForTimeout(250);
      for (const small of await tooSmall(page)) {
        found.push({ route, width, ...small });
      }
    }
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  expect(found).toEqual([]);
});

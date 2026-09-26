import { expect, test, type Page } from "@playwright/test";
import { useHousehold, switchToTestWorker } from "./household";

/**
 * Every run of visible text on every screen holds WCAG AA contrast (F48's own
 * check; the user put it in the suite on 2026-09-25).
 *
 * Ten screens at two widths: each text run's effective foreground against the
 * nearest **actually painted** background — a transparent parent is walked
 * through, since a colour nothing paints is not the colour behind the words —
 * the WCAG 2.x ratio, and AA's thresholds, 4.5 or 3.0 for text at 24px, or
 * 18.66px bold, and above. `aria-hidden` subtrees are decoration and are
 * skipped.
 *
 * **It measures painted colour and never a token's name**, which is the whole
 * of why it exists: an assertion naming `text-ink-faint` would pass the day
 * that token is swapped for another faint one. It found three paragraphs at
 * 3.23:1 and it fails the next token used for body text whatever it is called.
 *
 * **It is slow by nature** — every text node on ten screens, twice — and it is
 * the only test in the suite that sweeps rather than asserting one thing, so
 * it is worth its minute only as long as it stays honest about what it reads.
 */

const SCREENS = [
  "/",
  "/alerts",
  "/settings",
  "/settings/holidays",
  "/payments",
  "/reports",
  "/month/payslip",
  "/month/export",
  "/workers",
  "/workers/new",
];

interface Failure {
  text: string;
  ratio: number;
  fg: string;
  bg: string;
  size: number;
  weight: string;
  tag: string;
  cls: string;
}

async function sweep(page: Page): Promise<Failure[]> {
  return page.evaluate(() => {
    const lin = (c: number) =>
      c / 255 <= 0.03928
        ? c / 255 / 12.92
        : Math.pow((c / 255 + 0.055) / 1.055, 2.4);
    const parse = (s: string): [number, number, number, number] => {
      const n = s.match(/[\d.]+/g)?.map(Number) ?? [];
      return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 1];
    };
    const lum = ([r, g, b]: number[]) =>
      0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const over = (fg: number[], bg: number[]) => {
      const a = fg[3];
      return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
    };

    function background(el: Element): number[] {
      let node: Element | null = el;
      let acc: number[] | null = null;
      while (node) {
        const c = parse(getComputedStyle(node).backgroundColor);
        if (c[3] > 0) {
          acc = acc === null ? [c[0], c[1], c[2], c[3]] : over(acc, c as number[]);
          if ((acc[3] ?? 1) >= 1 || c[3] >= 1) return [acc[0], acc[1], acc[2]];
        }
        node = node.parentElement;
      }
      return acc ? [acc[0], acc[1], acc[2]] : [255, 255, 255];
    }

    const out: Failure[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      if (el.closest("[aria-hidden='true']")) continue;
      if (el.closest(".sr-only")) continue;
      const own = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "",
      );
      if (!own) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.opacity === "0") continue;
      const bg = background(el);
      const fgRaw = parse(s.color);
      const fg = over([fgRaw[0], fgRaw[1], fgRaw[2], fgRaw[3]], [...bg, 1]);
      const l1 = lum(fg);
      const l2 = lum(bg);
      const ratio =
        (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(s.fontSize);
      const weight = Number(s.fontWeight) >= 700 ? "bold" : s.fontWeight;
      const large = size >= 24 || (size >= 18.66 && weight === "bold");
      const floor = large ? 3 : 4.5;
      if (ratio + 0.005 < floor) {
        out.push({
          text: (el.textContent ?? "").trim().slice(0, 60),
          ratio: Math.round(ratio * 100) / 100,
          fg: s.color,
          bg: `rgb(${bg.map((v) => Math.round(v)).join(", ")})`,
          size,
          weight,
          tag: el.tagName.toLowerCase(),
          cls: el.className?.toString().slice(0, 90) ?? "",
        });
      }
    }
    return out;
  });
}

test("every screen holds WCAG AA contrast", async ({ page }) => {
  await useHousehold(page, "contrast", "sweep");
  const all: Record<string, Failure[]> = {};
  // The worker profile has no fixed address, so it is reached the way a user
  // reaches it and its id is put into the list below.
  await page.goto("/workers");
  const profile = await page
    .locator('a[href^="/workers/"]')
    .first()
    .getAttribute("href");
  const routes = profile ? [...SCREENS, profile] : SCREENS;

  for (const route of routes) {
    await page.goto(route);
    if (route !== "/workers/new") await switchToTestWorker(page).catch(() => {});
    await page.waitForTimeout(400);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      const bad = await sweep(page);
      if (bad.length > 0) all[`${route} @${width}`] = bad;
    }
  }
  console.log(JSON.stringify(all, null, 2));
  expect(Object.keys(all)).toEqual([]);
});

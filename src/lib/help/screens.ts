import type { TwoToneName } from "@/components/icons";
import { he } from "@/lib/i18n/he";

/**
 * Every screen the application has an address for, joined to its name and to
 * what it settles (`he.screens`).
 *
 * **It is the help screen's whole corpus in a fresh clone.** A clone has never
 * scraped, so the cached Kol Zchut sections are absent and the legal links are
 * labels without text behind them; this list is the one thing matching can
 * always answer from (specs.md item 24). That is why `settles` is written to
 * name the things a user asks about and not to describe a layout.
 *
 * **The bar reads it too, so the tabs and the help answers cannot disagree.** A
 * second list of tabs kept beside this one is a list in which a screen can be
 * renamed in the bar and keep its old name in an answer. The `tab` field is what
 * the bar filters on, and this list's order is the order the tabs are drawn in.
 *
 * **Three addresses are deliberately absent**, because an answer that points at
 * one of them is a wrong answer rather than a missing one:
 * - `/sign-in`, which anyone reading help has already passed;
 * - `/help` itself, which would answer a question with the screen asking it;
 * - `/dev/throw`, scaffolding that is refused outside development.
 *
 * `/workers/[id]` is absent for a different reason: it names a worker, and help
 * is account-blind. `/workers` is where an answer about one profile points, and
 * its own `settles` says the personal page is reached from there.
 */
export interface HelpScreen {
  /** The key into `he.screens`, which holds the name and what it settles. */
  id: ScreenId;
  /** The address, exactly as the application links it. A route here has a
   * `page.tsx`, which `screens.test.ts` holds it to: a help answer pointing at
   * an address that 404s is worse than no answer at all, and nothing about the
   * registry entry would look wrong. */
  route: string;
  /**
   * The shape the bar draws beside the label, for a screen the bar shows as a
   * tab, and `null` for one reached from another screen.
   *
   * The icon is decorative — the label is what names the tab — but it is
   * recognised before the label is read, and on a phone, where the strip
   * scrolls sideways, it is what a half-scrolled tab still shows.
   */
  tab: TwoToneName | null;
}

export type ScreenId = keyof typeof he.screens;

/** The five tabs first and in the order the bar draws them, then the screens
 * reached from another screen. */
export const HELP_SCREENS: readonly HelpScreen[] = [
  { id: "home", route: "/", tab: "home" },
  { id: "workers", route: "/workers", tab: "people" },
  { id: "payments", route: "/payments", tab: "coin" },
  { id: "settings", route: "/settings", tab: "gear" },
  { id: "reports", route: "/reports", tab: "doc" },
  { id: "alerts", route: "/alerts", tab: null },
  { id: "payslip", route: "/month/payslip", tab: null },
  { id: "beforeExport", route: "/month/export", tab: null },
  { id: "holidays", route: "/settings/holidays", tab: null },
  { id: "addWorker", route: "/workers/new", tab: null },
];

/** A screen the bar shows as a tab, which is a `HelpScreen` whose icon is
 * settled — so the tab strip never has to assert that it has one. */
export type NavScreen = HelpScreen & { tab: TwoToneName };

/** What the bar draws, in order. */
export const NAV_SCREENS: readonly NavScreen[] = HELP_SCREENS.filter(
  (screen): screen is NavScreen => screen.tab !== null,
);

/** A screen's name — the one the bar shows and the one an answer says. */
export function screenName(id: ScreenId): string {
  return he.screens[id].name;
}

/** The address of a screen. A scan of ten entries rather than an index built
 * over them: `screens.test.ts` holds the registry and `he.screens` to each
 * other, so every `ScreenId` is in the list and the fallback is unreachable. */
export function routeOf(id: ScreenId): string {
  return HELP_SCREENS.find((screen) => screen.id === id)?.route ?? "/";
}

import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { HELP_SCREENS, NAV_SCREENS, screenAt, screenName } from "@/lib/help/screens";
import { he } from "@/lib/i18n/he";

/**
 * **Every expected figure here comes from outside the registry** (`CLAUDE.md`
 * rule 11). The five tabs are read off the shell as it stood before stage 9 —
 * `git show f3631ff:src/components/AppShell.tsx`, the `navItems` array — so a
 * tab quietly renamed, reordered or dropped while moving the list into the
 * registry fails here rather than on someone's screen. The routes are held
 * against the file system, which is the only authority on whether an address
 * exists.
 */
const NAV_ITEMS_BEFORE_STAGE_9 = [
  { href: "/", label: "דף הבית", icon: "home" },
  { href: "/workers", label: "עובדים/ות", icon: "people" },
  { href: "/payments", label: "תשלומים", icon: "coin" },
  { href: "/settings", label: "הגדרות", icon: "gear" },
  { href: "/reports", label: "דוחות", icon: "doc" },
];

/** Where the framework looks for the screen at an address. */
function pageFile(route: string): string {
  return route === "/" ? "src/app/page.tsx" : `src/app${route}/page.tsx`;
}

describe("the help screen registry", () => {
  it("names only addresses the application actually has", () => {
    for (const screen of HELP_SCREENS) {
      expect(existsSync(pageFile(screen.route)), screen.route).toBe(true);
    }
  });

  it("draws the same five tabs the shell drew before it read the registry", () => {
    expect(
      NAV_SCREENS.map((screen) => ({
        href: screen.route,
        label: screenName(screen.id),
        icon: screen.tab,
      })),
    ).toEqual(NAV_ITEMS_BEFORE_STAGE_9);
  });

  it("gives every screen a name and something it settles", () => {
    for (const screen of HELP_SCREENS) {
      const entry = he.screens[screen.id];
      expect(entry.name.trim(), screen.route).not.toBe("");
      expect(entry.settles.trim(), screen.route).not.toBe("");
    }
  });

  it("holds every screen `he.screens` names, so neither list grows alone", () => {
    expect(HELP_SCREENS.map((screen) => screen.id).sort()).toEqual(
      Object.keys(he.screens).sort(),
    );
  });

  it("gives each address one entry, and matches an address whole", () => {
    const routes = HELP_SCREENS.map((screen) => screen.route);
    expect(new Set(routes).size).toBe(routes.length);
    expect(screenAt("/settings/holidays")?.id).toBe("holidays");
    expect(screenAt("/settings")?.id).toBe("settings");
    // Not a screen: `/workers/[id]` names a worker, and help is account-blind.
    expect(screenAt("/workers/abc")).toBeNull();
    expect(screenAt("/help")).toBeNull();
  });
});

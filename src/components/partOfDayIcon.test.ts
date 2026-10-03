import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PartOfDayIcon } from "./icons";
import { partOfDay, type PartOfDay } from "@/lib/partOfDay";

/**
 * Each part of day gets the scene the user drew for it (2026-10-02).
 *
 * That the map *has* an entry for every part is the compiler's job —
 * `Record<PartOfDay, ReactNode>` fails to build the day a fifth part is added
 * with nothing drawn for it — so nothing is spent on it here.
 *
 * What no type can see is the four entries wired to the wrong parts, or one
 * copied over another: a moon at noon renders perfectly, agrees with the
 * greeting beside it (both are read from the same value, so no browser test can
 * tell them apart) and reads as a decision somebody took.
 *
 * The scenes are told apart by the one thing that makes each what it is, and
 * each mark is asserted present on its own scene *and absent from the other
 * three* — which is what leaves noon as the sun with nothing around it without
 * having to say so. The marks are the palette's own names for hills, a horizon
 * and a moon, which is the only vocabulary this question can be asked in; they
 * are the drawings' description and not a copy of what the component emitted.
 */
const MARK: Record<Exclude<PartOfDay, "noon">, string> = {
  morning: "fill-icon-hill-deep",
  evening: "stroke-icon-horizon",
  night: "fill-icon-moon",
};

describe("PartOfDayIcon", () => {
  // Read through `partOfDay` and not off the map's own keys: a part the clock
  // can reach but the map never draws has to fail here too.
  const drawn = new Map<PartOfDay, string>();
  for (let hour = 0; hour < 24; hour++) {
    const part = partOfDay(hour);
    drawn.set(part, renderToStaticMarkup(PartOfDayIcon({ part })));
  }

  // Pins what the cases below iterate: three of four would otherwise pass by
  // running one case fewer.
  it("draws every part of day the clock can reach", () => {
    expect([...drawn.keys()].sort()).toEqual(["evening", "morning", "night", "noon"]);
  });

  it.each([...drawn.keys()])("%s gets its own scene", (part) => {
    const markup = drawn.get(part)!;
    for (const [scene, mark] of Object.entries(MARK)) {
      expect(markup.includes(mark), mark).toBe(scene === part);
    }
    // The amber is the one thing all four share: three suns and the night star.
    expect(markup).toContain("fill-icon-sun-2");
  });
});

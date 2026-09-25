"use client";

import type { ReactNode } from "react";

import { busyAttrs } from "@/components/Field";

/**
 * The chip every picker in this application is built from — the rest day, the
 * gender, how the income tax is arrived at, the holiday source, the marks on a
 * month.
 *
 * **One component for every screen that offers a choice**, so the screens read
 * as one mechanism and no copy of the class string can drift from the others.
 *
 * **The chosen chip is filled and not merely outlined.** A single step of border
 * colour is a distinction a family glancing at four terms of an employment
 * cannot be expected to see — and these chips are the whole of how the profile
 * says what is currently true.
 * `sage` is the palette's own "this one is chosen": it is what the home
 * screen's primary action is filled with, so nothing new is invented to say it.
 *
 * `aria-pressed` says the same thing to anyone not reading the colour; the fill
 * makes the screen agree with the accessibility tree rather than replacing it.
 */
export function Chip({
  selected,
  onClick,
  busy = false,
  children,
  ...rest
}: {
  selected: boolean;
  onClick: () => void;
  /** This chip's own change is on its way to the store, so this chip is what
   * says so — not the card around it (`busyAttrs` in `Field.tsx`). */
  busy?: boolean;
  children: ReactNode;
  /** For the e2e suite, which finds a source by the code it is filed under. */
  "data-source"?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      data-source={rest["data-source"]}
      {...busyAttrs(
        busy,
        [
          "rounded-full border px-3.25 py-1.75 text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
          selected
            ? "border-sage-hover bg-sage font-semibold text-sage-ink hover:bg-sage-hover hover:text-sage-ink-hover"
            : "border-line bg-surface font-medium text-day-ink hover:border-line-hover hover:bg-hover hover:text-ink",
        ].join(" "),
      )}
    >
      {children}
    </button>
  );
}

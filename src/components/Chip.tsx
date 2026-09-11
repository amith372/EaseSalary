"use client";

import type { ReactNode } from "react";

/**
 * The chip every picker in this application is built from — the rest day, the
 * gender, how the income tax is arrived at, the holiday source, the marks on a
 * month.
 *
 * **One component because it was three copies**, in `MonthActions`,
 * `WorkerProfileScreen` and `HolidayPickerScreen`, each carrying the same class
 * string and each free to drift from the others. The comment in two of them
 * already claimed the screens "read as one mechanism", which is a claim only a
 * shared component can actually hold.
 *
 * **The chosen chip is filled and not merely outlined** (asked for by the user
 * on 2026-09-11). It used to differ from an unchosen one by a single step of
 * border colour, `#efe6da` to `#dcc7a9`, which is a distinction a family
 * glancing at four terms of an employment cannot be expected to see — and
 * these chips are the whole of how the profile says what is currently true.
 * `sage` is the palette's own "this one is chosen": it is what the home
 * screen's primary action is filled with, so nothing new is invented to say it.
 *
 * `aria-pressed` says the same thing to anyone not reading the colour, and said
 * it before the fill did — the fill is what makes the screen agree with the
 * accessibility tree rather than a replacement for it.
 */
export function Chip({
  selected,
  onClick,
  children,
  ...rest
}: {
  selected: boolean;
  onClick: () => void;
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
      className={[
        "rounded-full border px-3.25 py-1.75 text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
        selected
          ? "border-sage-hover bg-sage font-semibold text-sage-ink hover:bg-sage-hover hover:text-sage-ink-hover"
          : "border-line bg-surface font-medium text-day-ink hover:border-line-hover hover:bg-hover hover:text-ink",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

import type { ReactNode } from "react";

/**
 * The pill a figure sits in at the end of a row — an amount, or a count of
 * days. `warm` is the ordinary one on a white card; `plain` is the white one
 * used inside the tinted total block, where warm on warm would disappear.
 */
export type ChipTone = "warm" | "plain";

export const chipClass: Record<ChipTone, string> = {
  warm: "rounded-chip bg-chip px-3 py-1",
  plain: "rounded-chip bg-surface px-3 py-1",
};

/**
 * A count in its pill, at the size every row draws one.
 *
 * **It carries no `tone` and no `className`**, because it had both and no
 * caller ever set either: all three passed the same size class and none passed
 * a tone. `MoneyValue` is the other reader of `chipClass` and it needs the
 * tone, so the record stays exported and the component does not offer a choice
 * that only one of the two ever makes.
 */
export function ValueChip({ children }: { children: ReactNode }) {
  return (
    <span className={`${chipClass.warm} text-[16px] font-semibold`}>
      {children}
    </span>
  );
}

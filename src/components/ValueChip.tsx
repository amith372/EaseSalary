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

interface ValueChipProps {
  children: ReactNode;
  tone?: ChipTone;
  className?: string;
}

export function ValueChip({ children, tone = "warm", className }: ValueChipProps) {
  return (
    <span className={[chipClass[tone], className ?? ""].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}

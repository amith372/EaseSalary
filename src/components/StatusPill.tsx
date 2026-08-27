import type { ReactNode } from "react";

/**
 * `attention` is the clay pill that says this needs the user; `settled` the
 * green one that says it does not; `shared` the quieter green that states a
 * fact about a worker rather than a state of the work.
 */
export type PillTone = "attention" | "settled" | "shared";

const toneClass: Record<PillTone, string> = {
  attention: "bg-clay-bg text-clay-ink",
  settled: "bg-moss-bg text-moss-ink",
  shared: "bg-moss-bg text-moss-soft font-medium",
};

/** `sm` is the tracked eyebrow pill that sits above a heading; `md` the pill
 * that sits at the end of a row and states a status. */
type PillSize = "sm" | "md";

const sizeClass: Record<PillSize, string> = {
  sm: "px-3 py-1.5 text-[13px] font-semibold tracking-[0.06em]",
  md: "px-3.5 py-2 text-[15px] font-semibold",
};

interface StatusPillProps {
  children: ReactNode;
  tone?: PillTone;
  size?: PillSize;
  className?: string;
}

export function StatusPill({
  children,
  tone = "attention",
  size = "md",
  className,
}: StatusPillProps) {
  return (
    <span
      dir="auto"
      className={[
        "inline-flex items-center rounded-full whitespace-nowrap",
        toneClass[tone],
        sizeClass[size],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}

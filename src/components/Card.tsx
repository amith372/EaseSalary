import type { ElementType, ReactNode } from "react";

/**
 * The three panel tones v3 uses, and nothing else:
 *
 * - `surface` — the white card on the page's warm ground, which is every card
 *   on the screen.
 * - `inset` — a panel sitting inside a white card, which takes the page's own
 *   ground so it reads as a step back rather than a step darker.
 * - `tint` — the warm block that carries the month's total, and the only panel
 *   with no rule around it.
 */
export type CardTone = "surface" | "inset" | "tint";

const toneClass: Record<CardTone, string> = {
  surface: "border border-line bg-surface",
  inset: "border border-line bg-ground",
  tint: "bg-tint",
};

/** The radii the artboard gives a panel, named for what carries them. */
export type CardRadius = "panel" | "tint" | "sm" | "md" | "lg";

const radiusClass: Record<CardRadius, string> = {
  panel: "rounded-panel",
  tint: "rounded-tint",
  sm: "rounded-card-sm",
  md: "rounded-card",
  lg: "rounded-calendar",
};

interface CardProps {
  children: ReactNode;
  tone?: CardTone;
  radius?: CardRadius;
  as?: ElementType;
  id?: string;
  className?: string;
}

export function Card({
  children,
  tone = "surface",
  radius = "md",
  as: Tag = "div",
  id,
  className,
}: CardProps) {
  return (
    <Tag
      id={id}
      className={[radiusClass[radius], toneClass[tone], className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}

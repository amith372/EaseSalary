import type { ElementType, ReactNode } from "react";

/**
 * The four panel tones the canvas uses, and nothing else:
 *
 * - `surface` — the ordinary panel on the page's white ground.
 * - `sand` — the warm panel that carries money ("מה שולם החודש").
 * - `inset` — a panel sitting inside a `surface` panel, one step darker.
 * - `insetOnSand` — the same idea inside a `sand` panel, where one step darker
 *   would disappear, so it goes one step lighter instead.
 */
export type CardTone = "surface" | "sand" | "inset" | "insetOnSand";

const toneClass: Record<CardTone, string> = {
  surface: "bg-surface border-line",
  sand: "bg-sand border-sand-line",
  inset: "bg-sunken border-sunken-line",
  insetOnSand: "bg-surface border-sand-line",
};

interface CardProps {
  children: ReactNode;
  tone?: CardTone;
  /** The one shadow in the system. Reserved for a panel that should read as
   * lifted off the page — the hero, a worker's card. */
  elevated?: boolean;
  /** A short tracked label above the card's content: "מה שולם החודש". */
  eyebrow?: ReactNode;
  as?: ElementType;
  id?: string;
  className?: string;
}

export function Card({
  children,
  tone = "surface",
  elevated,
  eyebrow,
  as: Tag = "div",
  id,
  className,
}: CardProps) {
  return (
    <Tag
      id={id}
      className={[
        "rounded-2xl border",
        toneClass[tone],
        elevated ? "shadow-card" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {eyebrow ? (
        <span
          dir="auto"
          className={[
            "mb-4 block text-[14px] font-semibold tracking-[0.06em]",
            tone === "sand" ? "text-sand-ink" : "text-ink-faint",
          ].join(" ")}
        >
          {eyebrow}
        </span>
      ) : null}
      {children}
    </Tag>
  );
}

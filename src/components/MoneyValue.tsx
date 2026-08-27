import { Bidi } from "@/components/Bidi";
import { he } from "@/lib/i18n/he";
import { formatAgorot } from "@/lib/money";

/** The sizes the canvas actually uses for an amount, smallest first: a balance
 * or summary line, a salary line, a card total, the month's headline figure. */
type MoneySize = "sm" | "md" | "lg" | "xl" | "hero";

const sizeClass: Record<MoneySize, string> = {
  sm: "text-[17px] font-semibold",
  md: "text-[18px] font-semibold",
  lg: "text-[20px] font-semibold",
  xl: "text-[26px] font-bold tracking-[-0.02em]",
  hero: "text-[42px] font-bold tracking-[-0.03em] leading-[1.1]",
};

interface MoneyValueProps {
  /**
   * Integer agorot, or `null` while the engine has not supplied the figure — in
   * which case the placeholder the canvas draws is shown instead of a number
   * invented to fill the space.
   */
  agorot: number | null;
  size?: MoneySize;
  /** Marks the amount as one the user set by hand, which survives every later
   * recalculation of the month (specs.md item 17). */
  manual?: boolean;
  className?: string;
}

/**
 * An amount, isolated and never translated. A deduction is drawn in clay rather
 * than announced in words, because the leading minus already says it and the
 * colour is what the eye finds when scanning a column.
 */
export function MoneyValue({ agorot, size = "md", manual, className }: MoneyValueProps) {
  const negative = agorot !== null && agorot < 0;
  const text = agorot === null ? he.placeholder.amount : formatAgorot(agorot);

  return (
    <span className="inline-flex items-baseline gap-2">
      <Bidi
        noTranslate
        className={[
          sizeClass[size],
          negative ? "text-clay-deep" : "text-ink",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {text}
      </Bidi>
      {manual ? (
        <span className="rounded-full bg-sand-hover px-2 py-0.5 text-[12px] font-medium text-ink-mute">
          {he.money.manual}
        </span>
      ) : null}
    </span>
  );
}

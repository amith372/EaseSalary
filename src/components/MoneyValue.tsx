import { Bidi } from "@/components/Bidi";
import { chipClass, type ChipTone } from "@/components/ValueChip";
import { he } from "@/lib/i18n/he";
import { formatAgorot } from "@/lib/money";

/** The sizes v3 uses for an amount: a line of the summary, the month's total
 * under it, and the payslip's own headline figure — the one the family looks
 * for first, which `דף המשכורת` draws at 42px. */
type MoneySize = "md" | "lg" | "xl";

const sizeClass: Record<MoneySize, string> = {
  md: "text-[16px] font-semibold",
  lg: "text-[18px] font-bold",
  xl: "text-[42px] leading-tight font-bold tracking-tighter",
};

interface MoneyValueProps {
  /**
   * Integer agorot, or `null` while the engine has not supplied the figure — in
   * which case the placeholder the canvas draws is shown instead of a number
   * invented to fill the space.
   */
  agorot: number | null;
  size?: MoneySize;
  /** The pill the amount sits in. Omitted, the amount is bare text. */
  chip?: ChipTone;
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
export function MoneyValue({ agorot, size = "md", chip, manual, className }: MoneyValueProps) {
  const negative = agorot !== null && agorot < 0;
  const text = agorot === null ? he.placeholder.amount : formatAgorot(agorot);

  return (
    <span className="inline-flex items-baseline gap-2">
      <Bidi
        noTranslate
        className={[
          chip ? chipClass[chip] : "",
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
        <span className="rounded-full bg-hover px-2 py-0.5 text-[12px] font-medium text-ink-mute">
          {he.money.manual}
        </span>
      ) : null}
    </span>
  );
}

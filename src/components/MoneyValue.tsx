import { Bidi } from "@/components/Bidi";
import { chipClass, type ChipTone } from "@/components/ValueChip";
import { he } from "@/lib/i18n/he";
import { formatAgorot } from "@/lib/money";

/** The sizes an amount is drawn at: a line of the home screen's summary and
 * the month's total under it; a line of the payslip and its closing total,
 * which `דף המשכורת` draws larger because it is the screen that is read line by
 * line; a fact on the workers list and on a worker's page; and the payslip's
 * headline figure, the one the family looks for first. */
type MoneySize = "md" | "lg" | "fact" | "sheet" | "sheetTotal" | "xl";

const sizeClass: Record<MoneySize, string> = {
  md: "text-[16px] font-semibold",
  lg: "text-[18px] font-bold",
  fact: "text-[18px] font-semibold sm:text-[20px]",
  sheet: "text-[19px] font-semibold",
  sheetTotal: "text-[26px] font-bold tracking-tight",
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
    // `data-money` names an amount for the browser suite, which otherwise has
    // to find one by matching digits inside a row that also carries a year.
    // `shrink-0` on this span, the flex item a row actually lays out: a long
    // label beside it wraps instead of squeezing the amount out of its chip.
    <span
      data-money={agorot ?? ""}
      className="inline-flex shrink-0 items-baseline gap-2 whitespace-nowrap"
    >
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

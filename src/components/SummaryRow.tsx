import type { ReactNode } from "react";
import { WhyButton, WhyPanel } from "@/components/WhyDisclosure";
import type { Explanation } from "@/lib/types";

/**
 * A label, a figure and the "?" that explains it — the only place the three are
 * put together, and the row both the month screen and the payslip are built of.
 *
 * **Extracted when the payslip arrived, and shared rather than copied.** The two
 * screens group the month differently — the preview by kind and the payslip by
 * the sheet's own columns (specs.md item 5) — but a row is a row, and two
 * implementations of it would drift in the details that matter: which figure
 * carries the `ידני` badge, where the explanation opens, and what the browser
 * suite can take hold of.
 */
export function SummaryRow({
  label,
  value,
  whyKey,
  explanation,
  openWhy,
  onToggleWhy,
  hint,
  strong,
  within,
}: {
  label: string;
  value: ReactNode;
  whyKey: string;
  explanation: Explanation;
  openWhy: string | null;
  onToggleWhy: (key: string) => void;
  hint?: ReactNode;
  strong?: boolean;
  within?: "surface" | "tint";
}) {
  const open = openWhy === whyKey;
  return (
    // `data-row` is the browser suite's handle on one row (`CLAUDE.md` rule 9):
    // the preview's figures have to be *asserted* and not looked at, and a
    // selector built out of the Hebrew label beside a figure breaks on a
    // wording change that broke nothing.
    <div data-row={whyKey} className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-px">
          <span
            dir="auto"
            className={
              strong
                ? "text-[17px] font-semibold"
                : "text-[16px] font-light text-ink-warm"
            }
          >
            {label}
          </span>
          {hint ? (
            <span className="text-[13px] font-light text-ink-quiet">{hint}</span>
          ) : null}
        </span>
        <span className="flex flex-none items-center gap-2.25">
          {value}
          <WhyButton
            controls={`why-${whyKey}`}
            open={open}
            onToggle={() => onToggleWhy(whyKey)}
          />
        </span>
      </div>
      <WhyPanel
        id={`why-${whyKey}`}
        open={open}
        explanation={explanation}
        within={within}
      />
    </div>
  );
}

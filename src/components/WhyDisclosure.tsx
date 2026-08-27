import { Card } from "@/components/Card";
import { he } from "@/lib/i18n/he";
import { legalLink } from "@/lib/links";
import type { Explanation } from "@/lib/types";

/**
 * The circular "?" and the panel it opens — the most repeated element on the
 * canvas, and the whole of the application's help: there is no separate help
 * section to visit (specs.md item 24).
 *
 * It is two components rather than one because the canvas puts them in two
 * different places: the button sits beside the value at the end of a row, the
 * panel below the whole row. They share one piece of state, and the caller
 * holds it — which is also what lets a panel close when another opens, as the
 * canvas does with a single `open` key per card.
 */

interface WhyButtonProps {
  open: boolean;
  onToggle: () => void;
  /** What the button means to a screen reader, since it shows no text. */
  label?: string;
  /** The id of the panel it controls, so the two are announced as a pair. */
  controls: string;
}

export function WhyButton({ open, onToggle, label, controls }: WhyButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={label ?? he.why.amountLabel}
      className="flex size-[17px] flex-none items-center justify-center rounded-full border border-ask-line text-[11px] font-semibold text-ask-ink transition-colors hover:border-ask-line-hover hover:text-ask-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
    >
      {/* Not translatable text: a question mark is a question mark. */}
      <span aria-hidden="true" translate="no">
        ?
      </span>
    </button>
  );
}

interface WhyPanelProps {
  id: string;
  open: boolean;
  explanation: Explanation;
  /** Which panel it sits inside, which decides whether it goes a step darker
   * or a step lighter than its parent. */
  within?: "surface" | "sand";
}

export function WhyPanel({ id, open, explanation, within = "surface" }: WhyPanelProps) {
  if (!open) return null;

  const link = explanation.link ? legalLink(explanation.link) : undefined;

  return (
    <Card
      id={id}
      tone={within === "sand" ? "insetOnSand" : "inset"}
      className="flex flex-col gap-2 rounded-xs px-4 py-3"
    >
      <span dir="auto" className="text-[15px] leading-[1.55] font-light text-ink-warm text-pretty">
        {explanation.text}
      </span>
      {link ? (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          dir="auto"
          className="text-[14px] font-medium hover:underline hover:underline-offset-[3px]"
        >
          <span>{link.label}</span>
          <span> — </span>
          <span>{he.why.linkSuffix}</span>
        </a>
      ) : null}
    </Card>
  );
}

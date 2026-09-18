import { cloneElement, useId, type ReactElement } from "react";

export const inputClass =
  "w-full rounded-card-sm border border-line-field bg-surface px-3 py-2 text-[15px] text-ink transition-colors placeholder:text-ink-quiet hover:border-ink-quiet focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest";

/** A labelled field. The input is `dir="ltr"` wherever it takes digits, so an
 * amount is typed left to right inside a right-to-left page (`CLAUDE.md`).
 * The hint sits outside the label and is attached as the input's description,
 * so a screen reader names the field by its label alone. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const hintId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="flex min-w-0 flex-col gap-1">
        <span dir="auto" className="text-[13px] font-medium text-ink-warm">
          {label}
        </span>
        {hint
          ? cloneElement(children, { "aria-describedby": hintId })
          : children}
      </label>
      {hint ? (
        <span
          id={hintId}
          dir="auto"
          className="text-[12px] font-light text-ink-quiet"
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}

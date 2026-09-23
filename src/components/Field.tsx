import {
  cloneElement,
  useId,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react";

import { he } from "@/lib/i18n/he";

export const inputClass =
  "w-full rounded-card-sm border border-line-field bg-surface px-3 py-2 text-[15px] text-ink transition-colors placeholder:text-ink-quiet hover:border-ink-quiet focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest";

/** The filled button a form is sent with. */
export const buttonClass =
  "rounded-card-sm bg-forest px-3.5 py-2 text-[14px] font-semibold text-surface transition-colors hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-50";

/** The outlined button, in a form and outside one alike. Disabled, it goes
 * quiet and stops answering the hover. */
export const outlineButtonClass =
  "rounded-full border border-line-strong bg-surface px-3.5 py-2 text-[14px] font-medium text-ink transition-colors hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:border-line disabled:text-ink-quiet disabled:hover:border-line";

/** A refusal, as the sentence that says why (specs.md item 25). */
export function RefusalLine({ children }: { children: ReactNode }) {
  return (
    /* `role="alert"` rather than `aria-live`: the paragraph is mounted with its
       sentence already in it, and a live region is only announced reliably
       when its content changes after it exists. */
    <p
      role="alert"
      dir="auto"
      className="text-[13px] leading-[1.5] font-light text-clay-deep text-pretty"
    >
      {children}
    </p>
  );
}

/** A labelled field. The input is `dir="ltr"` wherever it takes digits, so an
 * amount is typed left to right inside a right-to-left page (`CLAUDE.md`).
 * The hint sits outside the label and is attached as the input's description,
 * so a screen reader names the field by its label alone. */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  /** Added to the field's own box, for a caller that has to size it — a width
   * cap, or `flex-none` where the field is one item of a row. */
  className?: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const hintId = useId();
  return (
    <div className={`flex min-w-0 flex-col gap-1${className ? ` ${className}` : ""}`}>
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

/** A field that takes a sum of money. The input is `type="text"` with a decimal
 * keypad rather than `type="number"`, whose spinner and locale-dependent parsing
 * neither the calendar's panels nor the confirmations want, and `dir="ltr"` so
 * the digits are typed left to right inside a right-to-left page (`CLAUDE.md`).
 *
 * Everything else an `<input>` takes passes through, which is how a caller adds
 * the `data-` hook a browser test reads or a placeholder other than the default.
 * `className` is added to the input's own, never in place of it. */
export function AmountField({
  label,
  hint,
  fieldClassName,
  className,
  ...input
}: {
  label: string;
  hint?: string;
  /** Added to the field's box rather than to the input — `Field`'s `className`. */
  fieldClassName?: string;
} & ComponentPropsWithoutRef<"input">) {
  return (
    <Field label={label} hint={hint} className={fieldClassName}>
      <input
        type="text"
        inputMode="decimal"
        dir="ltr"
        placeholder={he.placeholder.amountInput}
        {...input}
        className={`${inputClass}${className ? ` ${className}` : ""}`}
      />
    </Field>
  );
}

/** A field that takes the user's own sentence beside a figure — why an advance
 * was given, what a one-off line is for. `dir="auto"` and not `dir="ltr"`: the
 * note may be Hebrew, Latin or both, and it is the one field here whose
 * direction is the text's rather than the digits'. */
export function NoteField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="text"
        dir="auto"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </Field>
  );
}

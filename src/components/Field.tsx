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

/** The filled button a form is sent with.
 *
 * **Disabled it goes to the chip grey, not to a lighter forest.** `opacity-50`
 * turned it into a sage indistinguishable from a deliberate quiet action, so a
 * screen with three saves dark and three sage read as two button styles rather
 * than as three dead controls — the same three things `outlineButtonClass`
 * below already says. */
export const buttonClass =
  "rounded-card-sm bg-forest px-3.5 py-2 text-[14px] font-semibold text-surface transition-colors hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:bg-chip disabled:text-ink-quiet disabled:hover:bg-chip";

/** The outlined button, in a form and outside one alike. Disabled, it goes
 * quiet and stops answering the hover. */
export const outlineButtonClass =
  "rounded-full border border-line-strong bg-surface px-3.5 py-2 text-[14px] font-medium text-ink transition-colors hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:border-line disabled:text-ink-quiet disabled:hover:border-line";

/**
 * What a bare text action adds so a finger can hit it.
 *
 * A link or a button drawn as a line of text is about 20px tall, under WCAG
 * 2.2 AA's 24×24 (2.5.8). The padding takes it past that and the negative
 * margin gives the space back, so the row is drawn exactly as the artboard has
 * it — the idiom `DESIGN.md` records for the forms, and the one the rest of the
 * application's bare actions take too.
 *
 * **Not for a link inside a sentence**, which WCAG's inline exception covers
 * and whose enlarged area would overlap the lines above and below it.
 */
export const touchTargetClass = "-my-3 py-3";

/**
 * What a control wears while its own action is on its way to the store and
 * back.
 *
 * **The busy state sits on the control that was pressed, not on the region
 * around it.** A screen-wide dim while one note is written greys the calendar
 * and every other row, which on a slow answer reads as the page failing rather
 * than as one field being saved; the region keeps `aria-busy`, which is what
 * says the same thing without repainting it.
 *
 * **It is not `disabled`.** Disabled is the chip grey (`buttonClass`) and means
 * the control cannot be pressed; this one can be, and is working. The repeat
 * press it therefore lets through is dropped by `useAction`, which is where one
 * change at a time is enforced.
 */
export function busyAttrs(busy: boolean, className: string) {
  return {
    "aria-busy": busy,
    // The suite's handle on "this is the control that was pressed", by what it
    // is rather than by the Hebrew on it.
    ...(busy ? { "data-busy": "" } : {}),
    className: busy ? `${className} cursor-wait opacity-60` : className,
  };
}

/** A refusal, as the sentence that says why (specs.md item 25). */
export function RefusalLine({
  children,
  role,
}: {
  children: ReactNode;
  /** The suite's handle on which kind of trouble this line is, where a screen
   * can draw more than one. Omitted for a refusal, which is read by its own
   * sentence. */
  role?: string;
}) {
  return (
    /* `role="alert"` rather than `aria-live`: the paragraph is mounted with its
       sentence already in it, and a live region is only announced reliably
       when its content changes after it exists. */
    <p
      role="alert"
      dir="auto"
      {...(role ? { "data-role": role } : {})}
      className="text-[13px] leading-[1.5] font-light text-clay-deep text-pretty"
    >
      {children}
    </p>
  );
}

/**
 * A fault at the control that failed (`useAction`'s `fault`).
 *
 * It is the refusal's own line and not a page strip, so the message sits where
 * the press was and the rest of the screen keeps working (the user,
 * 2026-09-27). `data-role` is the suite's handle on it, because the sentence
 * itself is Hebrew and is the thing under test.
 */
export function FaultLine() {
  return <RefusalLine role="fault">{he.fault}</RefusalLine>;
}

/** A labelled field. The input is `dir="ltr"` wherever it takes digits, so an
 * amount is typed left to right inside a right-to-left page (`CLAUDE.md`).
 * The hint sits outside the label and is attached as the input's description,
 * so a screen reader names the field by its label alone. */
export function Field({
  label,
  hint,
  hintFloats,
  className,
  children,
}: {
  label: string;
  hint?: string;
  /**
   * Draws the hint under the field without giving it height, for a field on a
   * row whose inputs have to share one line.
   *
   * A hint in the flow makes this box taller at the bottom, and a row aligned
   * on `items-end` then lifts *this* input by exactly the hint's height while
   * everything beside it stays put — four controls at four heights, which is
   * what this exists to stop. Floated, the hint stays where it was drawn and
   * under the field it belongs to; **the caller reserves the room for it**
   * under the row, since nothing else now does (`DESIGN.md`).
   */
  hintFloats?: boolean;
  /** Added to the field's own box, for a caller that has to size it — a width
   * cap, or `flex-none` where the field is one item of a row. */
  className?: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const hintId = useId();
  return (
    <div
      className={`flex min-w-0 flex-col gap-1${hintFloats ? " relative" : ""}${className ? ` ${className}` : ""}`}
    >
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
          className={`text-[12px] font-light text-ink-quiet${hintFloats ? " absolute inset-x-0 top-full pt-1" : ""}`}
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

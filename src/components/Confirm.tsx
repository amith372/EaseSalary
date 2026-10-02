/**
 * The question asked before a press that destroys more than it shows.
 *
 * **It is for a press whose cost is not on the screen.** Removing a line the
 * user can see and retype needs no question; removing an advance takes the debt
 * every later repayment was measured against, and any amount the user typed
 * over that row goes with it (`specs.md` item 20) — so what is lost is not what
 * the row is showing.
 *
 * **It is drawn where the press was and never as a dialog**, in the idiom of the
 * rows around it, for the reason `DESIGN.md` records for the rest-day question:
 * the question belongs where the change is being made, and a user sent
 * elsewhere to answer it has lost the thing they were doing. No artboard draws
 * it — it is a departure, and it is written down there.
 *
 * **The question is the caller's and the way out is everyone's.** The
 * affirmative names what it agrees to, since only the caller knows; the cancel
 * is `he.confirm.cancel`, so every confirmation in the application is cancelled
 * in one word.
 *
 * **A refusal is asked before the question, not after it.** A press the server
 * would refuse must not be offered for confirmation at all — the caller asks
 * the engine first and shows the refusal, which is the rule every other control
 * here follows.
 */

import { useId } from "react";

import { busyAttrs, buttonClass } from "@/components/Field";
import { he } from "@/lib/i18n/he";

export function Confirm({
  question,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
  name,
}: {
  question: string;
  /** What the affirmative says it is doing. Never "אישור": the word the user
   * presses is the gesture they are agreeing to. */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** The answer is on its way to the store. */
  busy: boolean;
  /** The suite's handle on which question is open, by what it is about rather
   * than by the Hebrew in it. */
  name: string;
}) {
  // The question is the affirmative's description and not a second label on a
  // group around it: a group's name would be read out, and then the sentence
  // again as its own paragraph.
  const questionId = useId();
  return (
    <div
      data-confirm={name}
      className="mt-1.5 flex flex-col gap-2 rounded-card-sm border border-line bg-ground px-3 py-2.5"
    >
      <p
        id={questionId}
        dir="auto"
        className="text-[13px] leading-[1.5] font-light text-ink-warm text-pretty"
      >
        {question}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-confirm-action="yes"
          aria-describedby={questionId}
          onClick={onConfirm}
          {...busyAttrs(busy, `${buttonClass} text-[13px]`)}
        >
          <span dir="auto">{confirmLabel}</span>
        </button>
        <button
          type="button"
          data-confirm-action="no"
          onClick={onCancel}
          className="-my-1 px-2 py-3 text-[13px] text-ink-quiet transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <span dir="auto">{he.confirm.cancel}</span>
        </button>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Chevron } from "@/components/icons";
import { he } from "@/lib/i18n/he";
import { routeOf } from "@/lib/help/screens";

/**
 * The wizard's address, read from the screen registry and **not** from
 * `AppShell`'s `ADD_WORKER`.
 *
 * The shell draws the panel, the panel draws this card, so importing the shell
 * back from here is a cycle between three client components — and what it costs
 * is this card not mounting at all, which looks like a card that was never
 * asked for. The registry is already the shell's own source for the tabs, so
 * the two cannot drift.
 */
const ADD_WORKER = routeOf("addWorker");

/**
 * The one card a family's first sign-in opens (specs.md item 32).
 *
 * **It leads into the first worker and tours nothing.** Four of the five tabs
 * hold nothing until a worker exists, and the step that adds one already asks
 * for everything it needs — so a tour would be a screen-by-screen description
 * of empty screens followed by the wizard asking the same questions again.
 * What this says is what the application is for, what a month looks like from
 * the family's side, and then it hands them over.
 *
 * **It states no rule and no rate.** An explanation lives in exactly one place
 * (item 24), and a tutorial that taught the entitlements would be the second
 * place it lived — the one nobody would think to correct when the first
 * changed.
 *
 * **Both ways out are the same way out.** Taking the wizard is leaving the
 * card, as pressing `דילוג` is: the card was shown, and the family acted on it.
 * Recording only the skip would leave the card owed on the next load, so the
 * family would meet it again having already done what it asked.
 *
 * It is drawn in the panel that holds the assistant (`HelpPanel`) rather than
 * on a surface of its own, because two cards over one screen are two things to
 * dismiss. The same cream as every answer the panel gives, for the reason
 * `DESIGN.md` states: one kind of card for one kind of thing.
 */
export function TutorialCard({ onLeave }: { onLeave: () => Promise<void> }) {
  const words = he.tutorial;

  return (
    <div
      data-role="tutorial"
      className="flex flex-col gap-3.5 rounded-calendar border border-help-answer-line bg-help-answer px-4 py-4"
    >
      <h2 dir="auto" className="text-[17px] font-semibold text-ink">
        {words.title}
      </h2>
      <p dir="auto" className="text-[14px] font-light text-ink-warm text-pretty">
        {words.lead}
      </p>

      {/* Numbered because it is a sequence and not a set: the marking comes
          before the wage and the wage before the file. `ol` says that to a
          screen reader without a word being spent on it. */}
      <ol className="flex flex-col gap-2">
        {words.steps.map((step, index) => (
          <li key={step} className="flex items-start gap-2.5">
            {/* The numeral is its own isolate: a digit beside Hebrew resolves
                by the bidi algorithm and not by the order it was written in. */}
            <bdi className="flex-none text-[13px] font-semibold text-help-eyebrow">
              {index + 1}
            </bdi>
            <span
              dir="auto"
              className="min-w-0 text-[14px] font-light text-ink-warm text-pretty"
            >
              {step}
            </span>
          </li>
        ))}
      </ol>

      <p dir="auto" className="text-[14px] font-light text-ink-warm text-pretty">
        {words.lead2}
      </p>

      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href={ADD_WORKER}
          prefetch={false}
          /* **Taking the step is leaving the card**, so the press records it
             and the link then follows as a link does. It is not waited for:
             the transition keeps the document, so the record is sent and
             arrives after it, and what keeps the card from re-opening over
             the step is `HelpPanel`'s own once-per-document (where the reason
             is written out). */
          onClick={() => void onLeave()}
          data-role="tutorial-add"
          className="flex flex-none items-center gap-2.5 rounded-tint bg-forest px-4 py-2.5 text-[15px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-deep hover:text-white"
        >
          <span dir="auto">{words.add}</span>
          <Chevron towards="next" className="flex-none" />
        </Link>
        <button
          type="button"
          onClick={() => void onLeave()}
          data-role="tutorial-skip"
          className="min-h-11 rounded-tint px-3 text-[15px] font-semibold text-ink-quiet transition-colors hover:text-ink"
        >
          <span dir="auto">{words.skip}</span>
        </button>
      </div>
    </div>
  );
}

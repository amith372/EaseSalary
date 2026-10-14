import { HelpConversation } from "@/components/HelpConversation";
import { he } from "@/lib/i18n/he";
import type { CachedPage } from "@/lib/scrape/pageSections";

/**
 * `עוזר דיגיטלי` at `/help` (specs.md item 24).
 *
 * **The screen survives the panel**, which is where the assistant is now
 * reached from (`HelpPanel`): this is the address an answer can be linked to
 * and the one a user who typed it lands on, and it draws the same conversation
 * rather than a second one. What is here and not in the panel is the heading
 * and the opening line, which a card that announces itself in its own header
 * does not need twice.
 */
export function HelpScreen({
  pages,
  names,
}: {
  pages: CachedPage[];
  /** The household's own worker names, for the matcher (item 24). */
  names: readonly string[];
}) {
  const words = he.help;

  return (
    /* **A column of a definite height**, because the box is pinned at the foot
       of the conversation as it is in the panel (`HelpConversation`): in a
       column that grew with its content the box would sit under the last
       answer and move down the page with every question. */
    <div className="mx-auto flex h-[min(52rem,calc(100dvh-11rem))] min-h-[26rem] w-full max-w-[880px] min-w-0 flex-col gap-7">
      <section className="flex flex-none flex-col gap-1.5">
        <h1
          dir="auto"
          className="text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[34px]"
        >
          {words.title}
        </h1>
        <p dir="auto" className="max-w-[60ch] text-[17px] font-light text-ink-mute text-pretty">
          {words.lead}
        </p>
      </section>

      <HelpConversation pages={pages} names={names} />
    </div>
  );
}

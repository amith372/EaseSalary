"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { Chevron } from "@/components/icons";
import { bestTopic, narrowTopics, saysNothing } from "@/lib/help/match";
import { HELP_SCREENS, routeOf, screenName } from "@/lib/help/screens";
import type { HelpTopic } from "@/lib/help/topics";
import { he } from "@/lib/i18n/he";
import { RuleLink } from "@/components/WhyDisclosure";
import type { CachedPage } from "@/lib/scrape/pageSections";

/**
 * `EaseSalary - עזרה` (specs.md item 24).
 *
 * **It authors nothing.** Every answer is a destination, a gesture and the rule
 * behind it; the arithmetic of a figure stays in the "?" beside that figure and
 * the law stays on the page the link opens. A sentence of explanation written
 * here would be the second place an answer lives, which is the one thing item 24
 * is about.
 *
 * **It is account-blind.** No worker, no figure, no month — which is what makes
 * one screen correct for an account whose months are refused, whose workers are
 * of either gender, and which has no worker in it yet. It is also why nothing
 * here is inflected: `עובד/ת` is the inclusive form because no worker is chosen.
 *
 * **The control is the prototype's variant C**, which is what the prototype was
 * built to settle: an open field with the closed list below it, narrowing as the
 * user types. The list is what makes the matcher's reach visible rather than
 * discovered by failure, and the screen list under it is what a question that
 * matched nothing falls back to.
 *
 * The matching runs in the browser, on every keystroke, over a corpus the server
 * handed down (`pages`). It is pure string work over a few thousand words and
 * holds no secret: a round trip per keystroke would make a list that narrows as
 * you type into a list that narrows a moment later.
 */
export function HelpScreen({ pages }: { pages: CachedPage[] }) {
  const words = he.help;
  // What the field holds, and separately what was searched for. They differ
  // while the user is typing: the list narrows on every keystroke and the answer
  // card changes only when they ask for it, so an answer does not slide out from
  // under the eye that is reading it.
  const [typed, setTyped] = useState("");
  const [asked, setAsked] = useState<string | null>(null);

  const narrowed = useMemo(() => narrowTopics(typed, pages), [typed, pages]);
  const [chosen, setChosen] = useState<HelpTopic | null>(null);

  const answer = useMemo(() => {
    if (chosen !== null) return chosen;
    return asked === null ? null : bestTopic(asked, pages);
  }, [chosen, asked, pages]);

  const missed = asked !== null && chosen === null && answer === null;

  // A field holding nothing, or nothing but question words, has not asked
  // anything — so pressing the button clears the answer rather than reporting
  // that nothing matched (`saysNothing`).
  function search(query: string) {
    setChosen(null);
    setAsked(saysNothing(query) ? null : query);
  }

  return (
    <div className="mx-auto flex w-full max-w-[880px] min-w-0 flex-col gap-7">
      <section className="flex flex-col gap-1.5">
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

      <section className="flex flex-col gap-3">
        <form
          className="flex items-center gap-2 rounded-card border border-shell-line bg-day p-2 ps-3.5 shadow-[0_1px_2px_rgba(51,41,31,0.04)]"
          onSubmit={(event) => {
            event.preventDefault();
            search(typed);
          }}
        >
          <SearchGlyph />
          <input
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
              setChosen(null);
            }}
            aria-label={words.ask.label}
            placeholder={words.ask.placeholder}
            data-field="help-query"
            dir="auto"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[17px] text-ink outline-none placeholder:font-light placeholder:text-ink-quiet sm:text-[19px]"
          />
          {typed === "" ? null : (
            <button
              type="button"
              onClick={() => {
                setTyped("");
                setAsked(null);
                setChosen(null);
              }}
              data-role="help-clear"
              className="flex min-h-11 flex-none items-center rounded-card-sm px-3 text-[15px] font-medium text-ink-quiet hover:bg-hover hover:text-ink"
            >
              <span dir="auto">{words.ask.clear}</span>
            </button>
          )}
          <button
            type="submit"
            data-role="help-submit"
            className="flex min-h-11 flex-none items-center rounded-[13px] bg-forest px-6 text-[16px] font-semibold text-white transition-colors hover:bg-forest-deep hover:text-white"
          >
            <span dir="auto">{words.ask.submit}</span>
          </button>
        </form>
        <p dir="auto" className="ps-1.5 text-[15px] font-light text-ink-quiet">
          {words.ask.examples}
        </p>
      </section>

      {answer !== null ? <Answer topic={answer} /> : null}
      {missed ? <NoMatch /> : null}

      <section aria-labelledby="help-topics" className="flex flex-col gap-4">
        <h2 id="help-topics" dir="auto" className="text-[20px] font-semibold sm:text-[22px]">
          {words.topicsTitle}
        </h2>
        {narrowed.length === 0 ? (
          <p dir="auto" data-role="no-topics" className="text-[15px] font-light text-ink-mute">
            {words.noMatch.body}
          </p>
        ) : (
          <Card radius="md" className="overflow-hidden">
            <ul>
              {narrowed.map((topic, index) => (
                <li key={topic.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(topic);
                      setAsked(he.help.topics[topic.id].ask);
                    }}
                    data-row={`topic-${topic.id}`}
                    className={[
                      "flex w-full flex-wrap items-center gap-x-5 gap-y-1 px-5 py-4 text-start transition-colors hover:bg-row-hover sm:px-6",
                      index === 0 ? "" : "border-t border-line-soft",
                    ].join(" ")}
                  >
                    <span dir="auto" className="min-w-0 flex-[1_1_260px] text-[17px] font-medium">
                      {he.help.topics[topic.id].ask}
                    </span>
                    <span className="flex min-w-0 flex-[1_1_260px] items-center gap-2.25">
                      <span
                        dir="auto"
                        className="flex-none text-[15px] font-semibold whitespace-nowrap text-forest"
                      >
                        {screenName(topic.screen)}
                      </span>
                      <span aria-hidden="true" className="text-ink-faint">
                        ·
                      </span>
                      <span
                        dir="auto"
                        className="min-w-0 truncate text-[15px] font-light text-ink-warm"
                      >
                        {he.help.topics[topic.id].where}
                      </span>
                    </span>
                    <Chevron towards="next" className="flex-none text-chevron-soft" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section aria-labelledby="help-screens" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="help-screens" dir="auto" className="text-[20px] font-semibold sm:text-[22px]">
            {words.screensTitle}
          </h2>
          <span dir="auto" className="text-[15px] font-light text-ink-quiet">
            {words.screensNote}
          </span>
        </div>
        <ul className="grid gap-3.5 sm:grid-cols-2">
          {HELP_SCREENS.map((screen) => (
            <li key={screen.id} className="flex">
              <Link
                href={screen.route}
                data-row={`screen-${screen.id}`}
                className="flex w-full flex-col gap-1.25 rounded-card-sm border border-line bg-day px-5 py-4.5 text-ink transition-colors hover:border-line-hover hover:text-ink"
              >
                <span dir="auto" className="text-[17px] font-semibold">
                  {screenName(screen.id)}
                </span>
                <span dir="auto" className="text-[15px] font-light text-ink-mute text-pretty">
                  {he.screens[screen.id].settles}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Where the answer sends them, what to press there, and the rule beside it. */
function Answer({ topic }: { topic: HelpTopic }) {
  const words = he.help.answer;
  const said = he.help.topics[topic.id];

  return (
    <section aria-labelledby="help-answer" className="flex flex-col gap-4">
      <h2 id="help-answer" dir="auto" className="text-[20px] font-semibold sm:text-[22px]">
        {words.title}
      </h2>
      <div
        data-role="help-answer"
        data-topic={topic.id}
        className="flex flex-col gap-4.5 rounded-calendar border border-help-answer-line bg-help-answer px-6 py-6 sm:px-7.5"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-1.75">
            <span
              dir="auto"
              className="self-start text-[13px] font-semibold tracking-[0.06em] text-help-eyebrow"
            >
              {words.eyebrow}
            </span>
            <span
              dir="auto"
              className="text-[24px] leading-[1.2] font-bold tracking-[-0.02em] sm:text-[27px]"
            >
              {screenName(topic.screen)}
            </span>
            <span
              dir="auto"
              className="max-w-[52ch] text-[17px] font-light text-ink-warm text-pretty"
            >
              {said.where}
            </span>
          </div>
          <Link
            href={routeOf(topic.screen)}
            data-role="help-go"
            className="flex flex-none items-center gap-2.5 rounded-tint bg-forest px-6 py-3.5 text-[17px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-deep hover:text-white"
          >
            <span dir="auto">{words.goTo(screenName(topic.screen))}</span>
            <Chevron towards="next" className="flex-none" />
          </Link>
        </div>
        {topic.rule === null ? null : (
          <div
            data-role="help-rule"
            className="flex flex-wrap items-center gap-2.5 border-t border-help-answer-line pt-4"
          >
            <span dir="auto" className="text-[15px] font-light text-ink-mute">
              {words.rule}
            </span>
            <RuleLink rule={topic.rule} className="text-[16px]" />
          </div>
        )}
      </div>
    </section>
  );
}

/** Nothing matched. The screen list below this is the whole of the offer. */
function NoMatch() {
  const words = he.help.noMatch;
  return (
    <Card
      radius="md"
      data-role="help-no-match"
      className="flex flex-col gap-1.5 px-6 py-5"
    >
      <span dir="auto" className="text-[17px] font-semibold">
        {words.title}
      </span>
      <span dir="auto" className="text-[15px] font-light text-ink-mute text-pretty">
        {words.body}
      </span>
    </Card>
  );
}

/** The magnifier in the field. Decorative: the field carries its own label. */
function SearchGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="flex-none text-ink-faint"
    >
      <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12.2 12.2L16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}


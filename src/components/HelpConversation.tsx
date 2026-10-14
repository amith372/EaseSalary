"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import {
  answerFromAccount,
  stageGesture,
  type AnswerGiven,
  type NamedWorker,
  type Staging,
} from "@/app/help/actions";
import { Card } from "@/components/Card";
import { HelpAnswer } from "@/components/HelpAnswer";
import { HelpStaged } from "@/components/HelpStaged";
import { Chevron } from "@/components/icons";
import { instructionIn } from "@/lib/help/gesture";
import { bestReach, narrowTopics, saysNothing, type Reach } from "@/lib/help/match";
import type { AnswerId } from "@/lib/help/answers";
import { HELP_SCREENS, routeOf, screenName } from "@/lib/help/screens";
import { stepsOf, type HelpTopic } from "@/lib/help/topics";
import { he, type Said } from "@/lib/i18n/he";
import { RuleLink } from "@/components/WhyDisclosure";
import type { CachedPage } from "@/lib/scrape/pageSections";

/**
 * One turn: the question as it was asked, and what it reached.
 *
 * The question is kept rather than read back off the field, because the field
 * is emptied the moment it is sent and goes on changing under the user's hands
 * while the thread stands.
 *
 * `reached === null` is a question that reached nothing, which is a turn like
 * any other: it carries `NoMatch` instead of an answer, and the way on is the
 * screen list under `שאלות נפוצות`.
 */
type Turn = {
  /** In asking order, counting from one — the order the thread is read in. */
  id: number;
  question: string;
  /** Where the question landed, or `instruction` where it was not a question
   * at all but a sentence telling the application to mark days (item 24). */
  reached: Reach | Instruction | null;
  /**
   * What the account answered, on a turn that asked it something.
   *
   * `null` is the moment before the server has answered, `"failed"` a read that
   * did not come back. A turn that reached a *topic* never has one: a
   * destination and a gesture are known in the browser and need no round trip.
   */
  given: AnswerGiven | "failed" | null;
  /**
   * What the account makes of an instruction: whose calendar it is, which days
   * it would change, and which it could not.
   *
   * `null` is the moment before the server has worked it out, `"failed"` a
   * read that did not come back. A turn that was a question never has one.
   */
  staging: Staging | "failed" | null;
};

/** A turn that told the application to do something rather than asking it
 * anything. The sentence itself is the whole of it — what it comes to is
 * `staging`, worked out on the server. */
type Instruction = { kind: "instruction" };

/** The two things the panel holds, one at a time (the user, 2026-10-10): the
 * conversation, and the two lists that are the same for every account. */
type Side = "ask" | "faq";

/**
 * The exchange itself (specs.md item 24).
 *
 * **It is drawn in two places and is one component**, because they are one
 * conversation: the panel that opens over whatever screen the user is on, and
 * `/help`, which is the address an answer can be linked to. A second copy for
 * the panel would be a second place a question is matched and an answer worded.
 *
 * **It is shaped like a messaging app** (the user, 2026-10-10): the box is
 * pinned at the foot of the card, what was asked goes up into the thread above
 * it, the answer comes under the question it answers, and the box stays where
 * it is for the next one. The thread therefore reads downwards, oldest first,
 * and the newest turn sits directly above the box, which is where the eye
 * already is.
 *
 * **The box empties when it is sent** (the user, 2026-10-10), as a messaging
 * app's does: the question is in the thread by then, and a field still holding
 * what was just asked has to be cleared by hand before the next question.
 *
 * **Two sides, one at a time.** `לשאול` is the conversation; `שאלות נפוצות` is
 * the closed list of the questions families ask and the list of every screen —
 * what the application offers, the same for every account. Typing narrows that
 * list while it is open (item 24), and asking sends them to the thread, because
 * the answer is the thing they were waiting for.
 *
 * **It both navigates and answers** (item 24). Where the question is where to
 * go, the destination and the gesture are the whole answer and are known here;
 * where it asks what this household owes or when it falls due, the figures come
 * back from `answerFromAccount` — the replay runs on the server and what crosses
 * is what would have been on the screen anyway.
 *
 * **Every turn stands, and the thread lasts the session and is stored nowhere**
 * (item 24). It is this component's own state, so it survives the card being
 * closed and reopened and the user walking from screen to screen, and a reload
 * empties it: it is a way of reaching an answer, not a record of one.
 *
 * **It authors no explanation.** A navigation answer is a destination, a gesture
 * and the rule behind it; an account answer is the engine's own figures with
 * each row's own sentence beside them. The arithmetic stays in the "?" beside
 * the figure and the law stays on the page the link opens.
 *
 * **What it offers still names no worker and draws no figure.** The closed list
 * and the screen list are the same for every account, which is what keeps them
 * right for one whose months are refused and for one with no worker in it yet;
 * it is an *answer* that may name a worker and draw a figure.
 *
 * The matching runs in the browser, on every keystroke, over a corpus the
 * caller handed down (`pages`) and the household's own worker names. It is pure
 * string work over a few thousand words and holds no secret: a round trip per
 * keystroke would make a list that narrows as you type into a list that narrows
 * a moment later. An empty corpus is the ordinary state and not a fault — the
 * matcher answers from the registry alone, so the panel is usable from the
 * moment it opens and widens when the cache arrives (`match.ts`).
 */
export function HelpConversation({
  pages,
  names = [],
  compact = false,
  onTutorial,
}: {
  pages: CachedPage[];
  /**
   * The household's own worker names, which join the matcher's corpus (item
   * 24): a question that names one of them is about the account, and is
   * answered for that worker alone.
   *
   * Empty is the ordinary state of an account with no worker in it, and of the
   * moment before the panel has been told — the matcher reaches every entry
   * without them.
   */
  names?: readonly string[];
  /**
   * Drawn inside the panel rather than on a screen of its own.
   *
   * It is the type scale and the padding that change and nothing else: the same
   * rows, the same handles and the same answer, at the size a 380px card can
   * hold. A second component for the narrow case would be two screens to keep
   * in step.
   */
  compact?: boolean;
  /**
   * Re-opens the card a first sign-in was shown (specs.md item 32), where
   * there is somewhere to draw it.
   *
   * **The row exists only when this is given**, which is the honest way round:
   * the card belongs to the panel, and `/help` draws this conversation without
   * one — a row there would be a control with nothing behind it. `DESIGN.md`
   * records that the two places differ in this one row.
   */
  onTutorial?: () => void;
}) {
  const words = he.help;
  const [side, setSide] = useState<Side>("ask");
  // What the field holds, and separately what has been asked. They differ while
  // the user is typing: the closed list narrows on every keystroke and the
  // thread changes only when they send.
  const [typed, setTyped] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);

  const narrowed = useMemo(() => narrowTopics(typed, pages), [typed, pages]);

  /**
   * The newest turn is brought into sight after every ask.
   *
   * The thread is the one thing that scrolls, and a long answer pushes the
   * question that produced it off the top — so what is scrolled to is the
   * newest turn's own top edge, and `nearest` is the smallest scroll that
   * reaches it.
   */
  const newest = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (turns.length === 0) return;
    newest.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns.length]);

  /**
   * The turn numbers, counted here rather than off the thread's length.
   *
   * Two questions asked in the same tick would otherwise be given the same
   * number: `turns.length` is what the last render saw, and the second of the
   * two reads it before the first has landed.
   */
  const asks = useRef(0);

  function asked(question: string, reached: Reach | Instruction | null) {
    asks.current += 1;
    const id = asks.current;
    setTurns((before) => [
      ...before,
      { id, question, reached, given: null, staging: null },
    ]);
    // Asked from the list, the answer is on the other side of the panel — so
    // the press takes them to it rather than leaving them on a list that did
    // not visibly change.
    setSide("ask");
    // An instruction is worked out against the account the same way an answer
    // is — on the server, over the household's own spans — and lands on the
    // turn that gave it by number, because the thread moves on while it runs.
    if (reached?.kind === "instruction") {
      stageGesture(question).then(
        (staging) =>
          staging === null ? asQuestion(id, question) : stage(id, staging),
        () => stage(id, "failed"),
      );
      return;
    }
    if (reached?.kind === "answer") askTheAccount(id, reached.id, question);
  }

  function askTheAccount(id: number, answer: AnswerId, question: string) {
    // The account is read once per asking and the turn it belongs to is found
    // again by its number: the thread moves on while the server is answering,
    // and an answer written into "the last turn" would land on whichever
    // question was asked next.
    void answerFromAccount(answer, question).then(
      (given) => settle(id, given),
      // A read that did not come back is said on the turn that asked, and
      // nothing else on the screen changes: the question is still there to ask
      // again, and the lists are still a way on.
      () => settle(id, "failed"),
    );
  }

  /**
   * A turn the server does not read as an instruction after all, answered as
   * the question it then is.
   *
   * **The two halves of the grammar can disagree, and this is which way it
   * falls.** The browser reads a sentence without a clock, so that it can tell
   * an instruction from a question without a round trip; the server reads it
   * again with today in hand and with the range cap that keeps a sentence
   * inside what a sweep could draw (`gesture.ts`). A sentence either of them
   * declines is a question — which leaves the user on the screen that settles
   * it, where saying "the calendar could not be updated" about a sentence
   * nobody tried to perform would leave them with a failure that never
   * happened.
   */
  function asQuestion(id: number, question: string) {
    const reached = bestReach(question, pages, names);
    setTurns((before) =>
      before.map((turn) => (turn.id === id ? { ...turn, reached } : turn)),
    );
    if (reached?.kind === "answer") askTheAccount(id, reached.id, question);
  }

  function settle(id: number, given: AnswerGiven | "failed") {
    setTurns((before) =>
      before.map((turn) => (turn.id === id ? { ...turn, given } : turn)),
    );
  }

  function stage(id: number, staging: Staging | "failed") {
    setTurns((before) =>
      before.map((turn) => (turn.id === id ? { ...turn, staging } : turn)),
    );
  }

  /**
   * Whose calendar an instruction is for, once the user has said.
   *
   * The turn is worked out again with the worker named rather than filtered in
   * the browser: which days may take the mark depends on *their* rest day and
   * *their* spans, so the answer to "whose" changes the proposal and not only
   * its heading.
   */
  function chose(id: number, question: string, worker: NamedWorker) {
    // Back to the state before the server answered, so the card says it is
    // working rather than leaving the question standing under the press.
    setTurns((before) =>
      before.map((turn) => (turn.id === id ? { ...turn, staging: null } : turn)),
    );
    stageGesture(question, worker.workerId).then(
      (staging) => stage(id, staging ?? "failed"),
      () => stage(id, "failed"),
    );
  }

  // A field holding nothing, or nothing but question words, has not asked
  // anything — so sending adds no turn and leaves the thread standing, rather
  // than reporting that nothing matched (`saysNothing`).
  function search(query: string) {
    if (saysNothing(query)) return;
    // **An instruction is read before the question is matched**, because the
    // two reach different things from the same words: `סמן חופשה ב-28.9` holds
    // every word that takes the user to the calendar, and taking them there is
    // not what they asked for. The grammar is deliberately narrow — a verb, a
    // kind and a date — so a question falls through it (`gesture.ts`).
    const instruction = instructionIn(query);
    asked(
      query,
      instruction === null
        ? bestReach(query, pages, names)
        : { kind: "instruction" },
    );
    setTyped("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        role="tablist"
        aria-label={words.sides.label}
        className="flex flex-none gap-1.5 rounded-card bg-chip p-1"
      >
        {(["ask", "faq"] as const).map((one) => (
          <button
            key={one}
            type="button"
            role="tab"
            aria-selected={side === one}
            onClick={() => setSide(one)}
            data-tab={one}
            className={[
              "min-h-11 flex-1 rounded-tint px-3 font-semibold transition-colors",
              compact ? "text-[14px]" : "text-[16px]",
              side === one
                ? "bg-surface text-ink shadow-[0_1px_2px_rgba(51,41,31,0.10)]"
                : "text-ink-quiet hover:text-ink",
            ].join(" ")}
          >
            <span dir="auto">{words.sides[one]}</span>
          </button>
        ))}
      </div>

      <div
        data-role="help-body"
        className={[
          "flex min-h-0 flex-1 flex-col overflow-y-auto",
          compact ? "gap-4" : "gap-7",
        ].join(" ")}
      >
        {side === "ask" ? (
          turns.length === 0 ? (
            <p
              dir="auto"
              data-role="help-opener"
              className={[
                "m-auto max-w-[46ch] text-center font-light text-ink-quiet text-pretty",
                compact ? "text-[14px]" : "text-[16px]",
              ].join(" ")}
            >
              {words.ask.examples}
            </p>
          ) : (
            turns.map((turn, index) => (
              <Exchange
                key={turn.id}
                turn={turn}
                compact={compact}
                onScreens={() => setSide("faq")}
                onChoose={(worker) => chose(turn.id, turn.question, worker)}
                // The newest turn is the last drawn, and is the one the scroll
                // is for; the rest are where the reader left them.
                ref={index === turns.length - 1 ? newest : null}
              />
            ))
          )
        ) : (
          <>
            {onTutorial === undefined ? null : (
              /* **At the head of the questions and not among them**, because it
                 is the one row here that is not a question: it re-opens what the
                 first sign-in showed. A family who pressed past it on their
                 first day has one place to look for it. */
              /* **`shrink-0`, which is not decoration.** This card is a flex
                 item in the panel's scroller, so without it the row is
                 squeezed to a sliver while the button inside keeps its own
                 height and is clipped — leaving a control that reads as
                 visible, sits under the section below it and cannot be
                 pressed. */
              <Card radius="md" className="shrink-0 overflow-hidden">
                <button
                  type="button"
                  onClick={onTutorial}
                  data-row="tutorial-again"
                  className={[
                    "flex w-full items-center text-start font-medium transition-colors hover:bg-row-hover",
                    compact ? "px-3.5 py-3 text-[14px]" : "px-5 py-4 text-[17px] sm:px-6",
                  ].join(" ")}
                >
                  <span dir="auto">{he.tutorial.again}</span>
                </button>
              </Card>
            )}

            <section aria-labelledby="help-topics" className="flex flex-col gap-4">
              <h2
                id="help-topics"
                dir="auto"
                className={
                  compact ? "text-[16px] font-semibold" : "text-[20px] font-semibold sm:text-[22px]"
                }
              >
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
                          /* The row's own question is what the turn shows as
                             asked: the user chose it, so it is as much their
                             question as one they typed, and an answer with no
                             question above it is an answer to nothing visible. */
                          onClick={() => asked(he.help.topics[topic.id].ask, { kind: "topic", topic })}
                          data-row={`topic-${topic.id}`}
                          className={[
                            "flex w-full flex-wrap items-center gap-x-5 gap-y-1 text-start transition-colors hover:bg-row-hover",
                            compact ? "px-3.5 py-3" : "px-5 py-4 sm:px-6",
                            index === 0 ? "" : "border-t border-line-soft",
                          ].join(" ")}
                        >
                          <span
                            dir="auto"
                            className={[
                              "min-w-0 font-medium",
                              compact
                                ? "order-1 flex-[1_1_auto] text-[14px]"
                                : "flex-[1_1_260px] text-[17px]",
                            ].join(" ")}
                          >
                            {he.help.topics[topic.id].ask}
                          </span>
                          <span
                            className={[
                              "flex min-w-0 items-center gap-2.25",
                              compact ? "order-3 flex-[1_1_100%]" : "flex-[1_1_260px]",
                            ].join(" ")}
                          >
                            <span
                              dir="auto"
                              className={[
                                "flex-none font-semibold whitespace-nowrap text-forest",
                                compact ? "text-[13px]" : "text-[15px]",
                              ].join(" ")}
                            >
                              {screenName(topic.screen)}
                            </span>
                            <span aria-hidden="true" className="text-ink-faint">
                              ·
                            </span>
                            <span
                              dir="auto"
                              className={[
                                "min-w-0 truncate font-light text-ink-warm",
                                compact ? "text-[13px]" : "text-[15px]",
                              ].join(" ")}
                            >
                              {he.help.topics[topic.id].where}
                            </span>
                          </span>
                          <Chevron
                            towards="next"
                            className={[
                              "flex-none text-chevron-soft",
                              compact ? "order-2" : "",
                            ].join(" ")}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </section>

            <section aria-labelledby="help-screens" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2
                  id="help-screens"
                  dir="auto"
                  className={
                    compact ? "text-[16px] font-semibold" : "text-[20px] font-semibold sm:text-[22px]"
                  }
                >
                  {words.screensTitle}
                </h2>
                <span
                  dir="auto"
                  className={[
                    "font-light text-ink-quiet",
                    compact ? "text-[13px]" : "text-[15px]",
                  ].join(" ")}
                >
                  {words.screensNote}
                </span>
              </div>
              <ul className={compact ? "grid gap-2" : "grid gap-3.5 sm:grid-cols-2"}>
                {HELP_SCREENS.map((screen) => (
                  <li key={screen.id} className="flex">
                    <Link
                      href={screen.route}
                      data-row={`screen-${screen.id}`}
                      className={[
                        "flex w-full flex-col gap-1.25 rounded-card-sm border border-line bg-day text-ink transition-colors hover:border-line-hover hover:text-ink",
                        compact ? "px-3.5 py-3" : "px-5 py-4.5",
                      ].join(" ")}
                    >
                      <span
                        dir="auto"
                        className={compact ? "text-[14px] font-semibold" : "text-[17px] font-semibold"}
                      >
                        {screenName(screen.id)}
                      </span>
                      <span
                        dir="auto"
                        className={[
                          "font-light text-ink-mute text-pretty",
                          compact ? "text-[13px]" : "text-[15px]",
                        ].join(" ")}
                      >
                        {he.screens[screen.id].settles}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>

      <form
        className={[
          "flex flex-none items-center gap-2 rounded-card border border-shell-line bg-day shadow-[0_1px_2px_rgba(51,41,31,0.04)]",
          compact ? "p-1.5 ps-3" : "p-2 ps-3.5",
        ].join(" ")}
        onSubmit={(event) => {
          event.preventDefault();
          search(typed);
        }}
      >
        <SearchGlyph />
        <input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          aria-label={words.ask.label}
          placeholder={words.ask.placeholder}
          data-field="help-query"
          dir="auto"
          className={[
            "min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:font-light placeholder:text-ink-quiet",
            compact ? "py-2 text-[15px]" : "py-2.5 text-[17px] sm:text-[19px]",
          ].join(" ")}
        />
        {typed === "" ? null : (
          <button
            type="button"
            /* The field's own control, for a question abandoned half-typed: it
               empties the box and puts the whole closed list back. Sending
               empties the box too, so this is the way out of a question that
               was never asked. */
            onClick={() => setTyped("")}
            data-role="help-clear"
            className="flex min-h-11 flex-none items-center rounded-card-sm px-3 text-[15px] font-medium text-ink-quiet hover:bg-hover hover:text-ink"
          >
            <span dir="auto">{words.ask.clear}</span>
          </button>
        )}
        <button
          type="submit"
          data-role="help-submit"
          className={[
            "flex min-h-11 flex-none items-center rounded-[13px] bg-forest font-semibold text-white transition-colors hover:bg-forest-deep hover:text-white",
            compact ? "px-4 text-[15px]" : "px-6 text-[16px]",
          ].join(" ")}
        >
          <span dir="auto">{words.ask.submit}</span>
        </button>
      </form>
    </div>
  );
}

/**
 * One turn of the thread: the question above, and under it what it reached.
 *
 * **The question is the answer's own heading** (`aria-labelledby`), which is why
 * no turn carries a worded one: in a thread of several answers a heading reading
 * "the answer" names none of them, while the question names exactly the one
 * below it.
 *
 * The question sits at the inline end and the answer runs the full width, which
 * is what makes the two read as one exchange rather than as two cards that
 * happen to be adjacent.
 */
function Exchange({
  turn,
  ref,
  compact,
  onScreens,
  onChoose,
}: {
  turn: Turn;
  /** What the thread scrolls to — passed on the newest turn only. */
  ref: Ref<HTMLElement>;
  compact: boolean;
  /** The way to the screen list, for a question that reached nothing. */
  onScreens: () => void;
  /** Whose calendar an instruction is for, where the turn had to ask. */
  onChoose: (worker: NamedWorker) => void;
}) {
  const label = `help-asked-${turn.id}`;

  return (
    <section
      ref={ref}
      data-row={`turn-${turn.id}`}
      aria-labelledby={label}
      className="flex flex-none flex-col gap-2.5"
    >
      <p
        id={label}
        dir="auto"
        data-role="help-asked"
        className={[
          "max-w-[85%] self-end rounded-tint bg-chip px-4 py-2.5 font-medium text-ink-warm text-pretty",
          compact ? "text-[14px]" : "text-[16px]",
        ].join(" ")}
      >
        {turn.question}
      </p>
      {turn.reached === null ? <NoMatch onScreens={onScreens} /> : null}
      {turn.reached?.kind === "topic" ? (
        <Answer topic={turn.reached.topic} compact={compact} />
      ) : null}
      {turn.reached?.kind === "answer" ? (
        <HelpAnswer given={turn.given} compact={compact} />
      ) : null}
      {turn.reached?.kind === "instruction" ? (
        <HelpStaged
          question={turn.question}
          staging={turn.staging}
          compact={compact}
          onChoose={onChoose}
        />
      ) : null}
    </section>
  );
}

/** Where the answer sends them, what to press there, and the rule beside it. */
function Answer({ topic, compact }: { topic: HelpTopic; compact: boolean }) {
  const words = he.help.answer;
  const said = he.help.topics[topic.id];
  const steps = stepsOf(topic.id);

  return (
    <div
      data-role="help-answer"
      data-topic={topic.id}
      className={[
        "flex flex-col rounded-calendar border border-help-answer-line bg-help-answer",
        compact ? "gap-3 px-4 py-4" : "gap-4.5 px-6 py-6 sm:px-7.5",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div
          className={[
            "flex min-w-0 flex-col gap-1.75",
            compact ? "flex-[1_1_100%]" : "flex-[1_1_340px]",
          ].join(" ")}
        >
          <span
            dir="auto"
            className={[
              "self-start font-semibold tracking-[0.06em] text-help-eyebrow",
              compact ? "text-[11px]" : "text-[13px]",
            ].join(" ")}
          >
            {words.eyebrow}
          </span>
          <span
            dir="auto"
            className={[
              "leading-[1.2] font-bold tracking-[-0.02em]",
              compact ? "text-[19px]" : "text-[24px] sm:text-[27px]",
            ].join(" ")}
          >
            {screenName(topic.screen)}
          </span>
          <span
            dir="auto"
            className={[
              "max-w-[52ch] font-light text-ink-warm text-pretty",
              compact ? "text-[14px]" : "text-[17px]",
            ].join(" ")}
          >
            {said.where}
          </span>
          {steps.length === 0 ? null : <Steps steps={steps} compact={compact} />}
        </div>
        <Link
          href={routeOf(topic.screen)}
          data-role="help-go"
          className={[
            "flex flex-none items-center gap-2.5 rounded-tint bg-forest font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-deep hover:text-white",
            compact ? "px-4 py-2.5 text-[15px]" : "px-6 py-3.5 text-[17px]",
          ].join(" ")}
        >
          <span dir="auto">{words.goTo(screenName(topic.screen))}</span>
          <Chevron towards="next" className="flex-none" />
        </Link>
      </div>
      {topic.rule === null ? null : (
        <div
          data-role="help-rule"
          className={[
            "flex flex-wrap items-center gap-2.5 border-t border-help-answer-line",
            compact ? "pt-3" : "pt-4",
          ].join(" ")}
        >
          <span
            dir="auto"
            className={[
              "font-light text-ink-mute",
              compact ? "text-[13px]" : "text-[15px]",
            ].join(" ")}
          >
            {words.rule}
          </span>
          <RuleLink rule={topic.rule} className={compact ? "text-[14px]" : "text-[16px]"} />
        </div>
      )}
    </div>
  );
}

/**
 * The presses a gesture takes, in order, under the one line that summarises it
 * (specs.md item 24).
 *
 * **Nothing here is written by this file.** Every word is `he.help.topics`', and
 * every control name inside a step is that control's own string, so a renamed
 * button cannot leave a stale instruction behind (`he.ts`'s `CONTROLS`).
 *
 * **A control name is isolated and still translated.** It is a mixed run and
 * wants its own `<bdi>` (`docs/agents/rtl.md`), but it is not an identifier:
 * under Chrome's translator the button on the screen is translated too, so a
 * step pinned to the Hebrew name would send the family looking for a word that
 * is no longer drawn anywhere.
 */
function Steps({ steps, compact }: { steps: readonly Said[]; compact: boolean }) {
  return (
    <ol className={["mt-1 flex flex-col", compact ? "gap-2" : "gap-2.5"].join(" ")}>
      {steps.map((step, index) => (
        <li key={index} data-step={index + 1} className="flex items-start gap-2.5">
          {/* The number is drawn and not read: the list element already carries
              the order for anyone listening to it. */}
          <span
            aria-hidden="true"
            className={[
              "mt-0.5 flex flex-none items-center justify-center rounded-full bg-sage font-bold text-sage-ink",
              compact ? "size-[21px] text-[11px]" : "size-[24px] text-[12px]",
            ].join(" ")}
          >
            {index + 1}
          </span>
          <span
            dir="auto"
            className={[
              "font-light text-ink-warm text-pretty",
              compact ? "text-[13.5px]" : "text-[15px]",
            ].join(" ")}
          >
            {step.map((part, at) =>
              typeof part === "string" ? (
                <span key={at}>{part}</span>
              ) : (
                <bdi
                  key={at}
                  // `box-decoration-clone`: a long label wraps, and without it the
                  // border is drawn once around both fragments and closes on
                  // neither.
                  className="box-decoration-clone rounded-tint border border-line-strong bg-day px-1.5 font-semibold text-ink"
                >
                  {part.value}
                </bdi>
              ),
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Nothing matched.
 *
 * **It carries the way to the screen list**, which is now on the other side of
 * the panel: a question that reached nothing still has to leave them the whole
 * application to choose from (item 24), and a card that only said "not found"
 * would have returned them to where they started.
 */
function NoMatch({ onScreens }: { onScreens: () => void }) {
  const words = he.help.noMatch;
  return (
    <Card
      radius="md"
      data-role="help-no-match"
      className="flex flex-col items-start gap-1.5 px-6 py-5"
    >
      <span dir="auto" className="text-[17px] font-semibold">
        {words.title}
      </span>
      <span dir="auto" className="text-[15px] font-light text-ink-mute text-pretty">
        {words.body}
      </span>
      <button
        type="button"
        onClick={onScreens}
        data-role="help-to-screens"
        className="mt-1 flex min-h-11 items-center rounded-card-sm bg-sage-soft px-4 text-[15px] font-semibold text-sage-ink transition-colors hover:bg-sage-soft-hover"
      >
        <span dir="auto">{words.toScreens}</span>
      </button>
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

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { dismissTutorial, loadHelpPages } from "@/app/help/actions";
import { HelpConversation } from "@/components/HelpConversation";
import { TutorialCard } from "@/components/TutorialCard";
import { he } from "@/lib/i18n/he";
import type { CachedPage } from "@/lib/scrape/pageSections";

/** The one address the panel's own screen lives at, named once so the link and
 * the route the launcher hides itself on cannot stop agreeing. */
export const HELP = "/help";

/**
 * Whether the card of item 32 has already opened itself in this document.
 *
 * **Module state and not component state, because the panel is remounted.**
 * The shell draws a different tree on the wizard's route — the step gets the
 * screen to itself — so walking into the wizard unmounts this component and
 * mounts another, and the layout that read the record is not re-rendered by a
 * client navigation. The new instance would therefore be handed a `true` that
 * is already out of date and open the card over the very step it had just sent
 * the family to. This says "this document has shown it", which no remount can
 * contradict and a reload resets, by which time the record is what answers.
 */
let shownInThisDocument = false;

/**
 * The way in to `עוזר דיגיטלי`: a control that floats in the bottom corner, and
 * the card it opens over whatever screen the user is on.
 *
 * **Pressing it opens a card and no longer navigates** (the user, 2026-10-07,
 * shown as a commercial support widget on 2026-10-10). The assistant is
 * something you ask while you are in the middle of something, and a screen of
 * its own takes the user away from the thing they were asking about — which is
 * the half of the answer they then have to find their way back to. `/help`
 * survives as the address an answer can be linked to and draws the same
 * conversation (`HelpScreen`).
 *
 * **It is a `<dialog>` opened with `showModal`**, which is this application's
 * one existing way of putting something over a screen (`RemindersDialog`): Esc,
 * the backdrop and the focus ring come with it rather than being rebuilt here,
 * and a card drawn over a page that still took presses behind it would be a
 * card the user can lose behind what they were doing.
 *
 * **The close control sits below the card, where the launcher was**, as the
 * widget the user showed draws it: the way out is where the way in was, so the
 * press that opened it and the press that closes it are the same reach. The
 * dialog is therefore the pair and not the card — it carries no ground of its
 * own, and the card inside it is what is drawn.
 *
 * **It is not a "?".** That circle is already taken: it opens the explanation
 * beside a figure (specs.md item 24), and two identical marks doing two
 * different things on one screen is the mistake the artboard's own note warns
 * against. This one carries a word.
 *
 * **It carries a visible label and not a glyph alone.** Chrome can translate
 * neither an image nor a CSS `content:`, so a bare icon is a control that says
 * nothing to a reader using the page in English — the icon is `aria-hidden`
 * beside a real label, which is the convention everywhere else here.
 *
 * **Bottom right, which under `dir="rtl"` is the inline start.** It is written
 * as `start-*` and never as `right-*`: the document is right-to-left from the
 * `<html>` element down, so the logical property is what puts it where the user
 * asked for it, and it is the physical property that would be the guess.
 *
 * **It departs from the artboard**, which draws this entry as a pill in the top
 * bar beside `התראות`. The placement is the user's own decision of 2026-10-01
 * and `DESIGN.md` records it, as it records the panel.
 */
export function HelpPanel({
  names = [],
  tutorialPending = false,
}: {
  /**
   * The household's own worker names, which join the matcher's corpus (item
   * 24): a question naming one of them is about the account and is answered
   * for that worker alone.
   *
   * The shell already holds them for the switcher, so they cost this panel
   * nothing; an account with no worker hands over an empty list, which is a
   * matcher that reaches every entry and names nobody.
   */
  names?: readonly string[];
  /**
   * Whether this person's first sign-in still owes them the one card item 32
   * describes. The layout reads it with the workers, so it costs the panel
   * nothing; `false` is what every screen after the first one hands over.
   */
  tutorialPending?: boolean;
} = {}) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  /**
   * The cached pages, once they have been asked for.
   *
   * **The panel is usable before they arrive**, and that is why nothing waits on
   * them: the matcher answers from the registry alone, so an empty corpus is the
   * state a fresh clone is permanently in and the state this panel is in for the
   * first moment of its life (`match.ts`). They are fetched once per session,
   * not once per opening — the text does not change while the page is open.
   */
  const [pages, setPages] = useState<CachedPage[] | null>(null);
  const [open, setOpen] = useState(false);
  /**
   * Whether the card has ever been opened on this page.
   *
   * **The conversation is not drawn until it has been**, and from then on it
   * stays drawn: a closed `<dialog>` is still in the document, so a panel
   * mounted on every route would put the ten questions, the ten screens and
   * every answer into the markup of every screen the household loads — text no
   * one asked for, found by the browser's own find-in-page and by anything
   * reading the document. It is not unmounted on closing, because the thread is
   * this component's state and item 24's exchange lasts the session: a card
   * shut to look at the screen behind it has not ended the conversation.
   */
  const [opened, setOpened] = useState(false);
  /**
   * Which card the dialog is drawing, and whether leaving it is to be recorded
   * (specs.md item 32).
   *
   * **Three states and not a boolean**, because the card has two ways of being
   * up and only one of them is the once: `pending` is the card that opened
   * itself on a first sign-in, and leaving *that* is what is remembered;
   * `again` is the same card re-opened on purpose from the questions side, and
   * leaving it records nothing, since there is nothing left to record.
   */
  const [tutorial, setTutorial] = useState<"pending" | "again" | "left">(
    tutorialPending && !shownInThisDocument ? "pending" : "left",
  );
  const showingTutorial = tutorial !== "left";
  /** Whether the leaving has already been sent, held in a ref and not in state
   * because the ways out reach each other: the press closes the dialog, which
   * fires `close`, which is itself a way out. A state flag would still read as
   * unsent inside the same tick. */
  const recorded = useRef(false);

  /**
   * Leaving the card, by whichever of its ways out (specs.md item 32).
   *
   * **It is one function and not a handler per control**, because there are
   * five ways out — Esc, the backdrop, the control below the card, the two
   * presses on the card itself — and a tab in the bar is a sixth, since the
   * pathname effect closes the dialog and that fires `close`. Four of the six
   * would be the ones to forget.
   *
   * **It is awaited by the press that leads into the wizard**, which is the one
   * caller that then leaves the screen: the record has to be made before the
   * next render reads it, or the card opens itself again over the very step it
   * sent the family to. The other callers do not wait, because nothing they
   * draw depends on it.
   *
   * Only the card that opened itself is recorded. Re-opened on purpose from the
   * questions side, there is nothing left to record.
   */
  async function leaveTutorial() {
    const record = tutorial === "pending" && !recorded.current;
    // Set before the close, which may dispatch `close` and come straight back
    // in here.
    recorded.current = true;
    setTutorial("left");
    dialog.current?.close();
    if (record) await dismissTutorial();
  }

  useEffect(() => {
    if (!open || pages !== null) return;
    let live = true;
    void loadHelpPages().then(
      (fetched) => {
        if (live) setPages(fetched);
      },
      // A corpus that cannot be read is a narrower matcher and not a broken
      // panel, so the failure is kept off the screen: what the user asked for
      // still reaches every topic and every screen.
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [open, pages]);

  /** The address the panel was last drawn at, so the effect below can tell a
   * navigation from a mount. */
  const drawnAt = useRef(pathname);

  /**
   * The panel does not follow the user to the next screen: an answer's button
   * is a link, and a card left standing over the screen it just sent them to
   * would hide the thing they were sent to press.
   *
   * **It closes on a change of address and not on a mount**, which is what the
   * sentence above always meant and what the dependency alone did not say.
   * Mount effects run twice in development, so this ran a second time after
   * the card below had opened — shutting it, and being read as the family
   * leaving it, which recorded the one card they had not seen yet. The last
   * address is held in a ref and compared, rather than a "first run" flag: a
   * flag is flipped by the first of the two runs and the second one then acts.
   */
  useEffect(() => {
    if (drawnAt.current === pathname) return;
    drawnAt.current = pathname;
    dialog.current?.close();
  }, [pathname]);

  /**
   * A first sign-in opens the card by itself (specs.md item 32).
   *
   * **What keeps it open is the effect above closing on a navigation only.**
   * Both run on mount, twice each in development, and an unconditional close
   * there shut this card a moment after it opened — which the dialog reports
   * as a close like any other, so the leaving was recorded for a card nobody
   * had read.
   *
   * It runs once per state it reads, and that state only ever moves away from
   * `pending`.
   *
   * **It opens the dialog and sets no state.** What `open` is for is the
   * launcher's own transparency and the one fetch of the corpus, and the card
   * needs neither — it draws no conversation, so there is nothing to match
   * against. The launcher reads `showingTutorial` beside `open` instead, which
   * also keeps this effect free of a state write a render would have to chase.
   */
  useEffect(() => {
    if (tutorial !== "pending") return;
    // Already up: the effect runs twice on a development mount, and asking a
    // modal dialog to open again is at best nothing.
    if (dialog.current === null || dialog.current.open) return;
    shownInThisDocument = true;
    dialog.current.showModal();
  }, [tutorial]);

  // Not on the screen it is the panel for: a control that opens what you are
  // already reading is a control that looks broken when pressed.
  if (pathname === HELP) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setOpened(true);
          dialog.current?.showModal();
        }}
        data-role="help-launcher"
        /* **Hidden while the card is up, and not unmounted.** The way out
           stands exactly where it does, so two controls in one corner would be
           one control too many — but `display:none` takes it out of the focus
           order, and closing a `<dialog>` restores focus to whatever held it
           before, which would then be nothing. */
        className={[
          "fixed bottom-5 start-5 z-30 flex min-h-11 items-center gap-2 rounded-full bg-help-launcher px-4 py-3 text-[15px] font-semibold text-help-ink shadow-[0_8px_24px_rgba(51,41,31,0.18)] transition-colors hover:bg-help-launcher-hover hover:text-help-ink md:bottom-6 md:start-6",
          open || showingTutorial ? "opacity-0" : "",
        ].join(" ")}
      >
        <HelpGlyph />
        <span dir="auto">{he.help.ask.launcher}</span>
      </button>

      <dialog
        ref={dialog}
        data-role="help-panel"
        aria-labelledby="help-panel-name"
        // Esc and the backdrop close it without passing through the button
        // below, so what the panel knows about being open is read from the
        // element's own close event and never from the press alone.
        onClose={() => {
          setOpen(false);
          // Esc, the backdrop and the pathname effect all arrive here, and so
          // does the press that already called it — which is why the leaving
          // is guarded rather than counted.
          if (showingTutorial) void leaveTutorial();
        }}
        // Pressing the backdrop closes it, as Esc already does. The target is
        // the dialog itself only where the press missed the card inside it.
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
        /* The dialog is the pair — the card and the way out under it — so it
           carries no ground and no border of its own, and sits where the
           launcher does rather than in the middle of the screen. `max-h` is
           what keeps the card inside the viewport on a phone, where it is
           nearly the whole of it. */
        className="fixed inset-auto bottom-5 start-5 m-0 max-h-[min(42rem,calc(100dvh-2.5rem))] w-[min(26rem,calc(100vw-2.5rem))] bg-transparent p-0 text-ink backdrop:bg-ink/25 md:bottom-6 md:start-6"
      >
        <div className="flex max-h-[min(42rem,calc(100dvh-2.5rem))] flex-col gap-2.5">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-card border border-line bg-surface shadow-[0_18px_44px_rgba(51,41,31,0.22)]">
            <div className="flex flex-none items-center gap-2.5 border-b border-help-answer-line bg-help-launcher px-4 py-3.5">
              <HelpGlyph />
              <span
                id="help-panel-name"
                dir="auto"
                className="text-[16px] font-bold text-help-ink"
              >
                {he.help.title}
              </span>
            </div>
            {/* The conversation owns the scrolling from here down, because the
                box is pinned at its foot: a scroller around the whole of it
                would take the box with it. */}
            <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
              {showingTutorial ? (
                <TutorialCard onLeave={leaveTutorial} />
              ) : opened ? (
                <HelpConversation
                  pages={pages ?? []}
                  names={names}
                  compact
                  onTutorial={() => setTutorial("again")}
                />
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => dialog.current?.close()}
            data-role="help-close"
            className="flex min-h-11 w-fit items-center gap-2 rounded-full bg-help-launcher px-4 py-3 text-[15px] font-semibold text-help-ink shadow-[0_8px_24px_rgba(51,41,31,0.18)] transition-colors hover:bg-help-launcher-hover hover:text-help-ink"
          >
            <CloseGlyph />
            <span dir="auto">{he.help.ask.close}</span>
          </button>
        </div>
      </dialog>
    </>
  );
}

/** The artboard's own help mark: a ring, a centre, and four ticks pointing out
 * of it. Decorative — the label beside it is what names the control. It is
 * radially symmetric, so unlike a chevron it needs no mirroring under RTL. */
function HelpGlyph() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="flex-none"
    >
      <circle cx="9" cy="9" r="7.2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="9" r="2.8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4.1 4.1L7 7M11 11l2.9 2.9M13.9 4.1L11 7M7 11l-2.9 2.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The cross on the way out. Decorative, beside the word that names it, and
 * symmetric, so it needs no mirroring under RTL. */
function CloseGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="flex-none"
    >
      <path
        d="M4.5 4.5l9 9M13.5 4.5l-9 9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

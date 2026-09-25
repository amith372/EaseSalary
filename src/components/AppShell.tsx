"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Bell } from "@/components/Bell";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { LogoMark, TwoToneIcon, type TwoToneName } from "@/components/icons";
import { WorkerScopeProvider, WorkerSwitcher } from "@/components/WorkerScope";
import type { BellView } from "@/lib/alertsView";
import { he } from "@/lib/i18n/he";
import { partOfDay } from "@/lib/partOfDay";
import type { Worker } from "@/lib/types";

/**
 * The frame every route gets: a single 62px white bar across the top, as
 * `EaseSalary - דף הבית v3 לוח במרכז` draws it. The 232px green sidebar of v2 is
 * gone from the application and not only from the home screen, so this is
 * rebuilt rather than forked — a sidebar surviving on one route would be a
 * second shell to keep in step with the first.
 *
 * The bell (`Bell`) counts the household's warnings as `/alerts` shows them
 * (specs.md item 27). The layout reads it, and it stays current because every
 * server action that changes a month or a warning revalidates, and a
 * revalidation refreshes the layout with the page.
 *
 * The circular "?" v3 draws in the bar, linking `/help`, is left out until
 * Stage 9 decides whether that screen is built: a link
 * on every screen to an address that 404s is a promise the bar cannot keep.
 *
 * The greeting and the worker switcher sit here too, where v3 draws them as a
 * row of their own at the top of the home screen. That row cost about seventy
 * pixels and was what pushed the screen past the fold; both belong to the whole
 * screen rather than to any one card, so the bar is where they go and the home
 * screen opens straight onto the calendar. This is the one deliberate departure
 * from the artboard, and the artboard is otherwise followed as drawn.
 *
 * The ten other artboards still draw the sidebar. They now disagree with this
 * shell and each is rebuilt when its own stage arrives; the disagreement is
 * written down here so a later session does not read one of them as current and
 * put the sidebar back.
 *
 * It is a client component only because the active nav item is decided by the
 * current route, which a layout cannot know on the server.
 */

/** The wizard's address, named once: the shell steps aside for it and the empty
 * household links to it, and a route spelt twice is a route that stops
 * agreeing with itself. */
export const ADD_WORKER = "/workers/new";

/**
 * Puts a screen back where it was when the user presses Back.
 *
 * **The document never scrolls**, because `<main>` is the scroller from `md`
 * up — that is what buys a bar that never leaves, and it is worth more than
 * what it costs. What it costs is the browser's own restoration, which acts on
 * the document: press a blocker card from the foot of the opening screen and
 * come back, and the screen is at the top.
 *
 * **Only a Back or a Forward is restored.** A fresh navigation is left exactly
 * as it is, since the framework already puts it at the top and an address
 * naming an anchor (`/settings#rates`) scrolls to that anchor — an offset
 * written over either of those would undo it.
 */
function useScrollRestoration(pathname: string): void {
  const offsets = useRef(new Map<string, number>());
  const popped = useRef(false);

  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // **Read when she leaves, not while she scrolls.** The framework scrolls this
  // element to the top as a navigation starts, and a scroll listener records
  // that nought over the place she was at — so the offset is taken in the click
  // that begins the navigation, before anything has moved, and again on a
  // `popstate` so that Forward has somewhere to return to as well.
  useEffect(() => {
    const remember = () => {
      const main = document.getElementById(MAIN_ID);
      if (main !== null) offsets.current.set(pathname, main.scrollTop);
    };
    document.addEventListener("click", remember, true);
    window.addEventListener("popstate", remember);
    return () => {
      document.removeEventListener("click", remember, true);
      window.removeEventListener("popstate", remember);
    };
  }, [pathname]);

  useEffect(() => {
    if (!popped.current) return;
    popped.current = false;
    const saved = offsets.current.get(pathname);
    if (saved === undefined || saved === 0) return;
    const main = document.getElementById(MAIN_ID);
    if (main === null) return;
    main.scrollTop = saved;
    // The screen restored to may still be arriving, and a shorter page clamps
    // the offset to its own height — so it is set once more on the next frame,
    // by when it has the height it was left at.
    const frame = requestAnimationFrame(() => {
      main.scrollTop = saved;
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
}

/** What the skip link points at and `<main>` answers to. Named once: an
 * anchor that stops agreeing with its target skips to nowhere, silently. */
const MAIN_ID = "main";

interface NavItem {
  href: string;
  label: string;
  /** The shape beside the label, one per screen. It is
   * recognised before the label is read, and on a phone — where the tabs
   * scroll sideways — it is what a half-scrolled tab still shows. Decorative:
   * the label is what names the tab, so the icon is `aria-hidden`. */
  icon: TwoToneName;
}

/**
 * What a new account sees until its first worker exists.
 *
 * The one control on it is the only thing there is to do here, and it now leads
 * to the flow that does it (`ADD_WORKER`).
 */
function EmptyHousehold() {
  return (
    <Card radius="md" className="mt-6 px-6 py-8" data-role="empty-household">
      <h1 dir="auto" className="text-[19px] font-semibold text-ink">
        {he.emptyHousehold.title}
      </h1>
      <p dir="auto" className="mt-2.5 max-w-prose text-[15px] text-ink-mute">
        {he.emptyHousehold.lead}
      </p>
      <Link
        href={ADD_WORKER}
        className="mt-5 inline-flex rounded-card-sm bg-forest px-6 py-3 text-[16px] font-semibold text-white transition-colors hover:bg-forest-deep hover:text-white"
      >
        <span dir="auto">{he.emptyHousehold.add}</span>
      </Link>
    </Card>
  );
}

const navItems: NavItem[] = [
  { href: "/", label: he.nav.home, icon: "home" },
  { href: "/workers", label: he.nav.workers, icon: "people" },
  { href: "/payments", label: he.nav.payments, icon: "coin" },
  { href: "/settings", label: he.nav.settings, icon: "gear" },
  { href: "/reports", label: he.nav.reports, icon: "doc" },
];

interface AppShellProps {
  children: ReactNode;
  /**
   * The household's workers, read from the store by the layout above.
   *
   * **They are not the home screen's fixtures**, and the difference is not
   * cosmetic: the switcher's worker is the id every write action is made
   * against, so a shell holding a fixed list would send one household's ids to
   * another household's store.
   */
  workers: Worker[];
  /** The worker the switcher was left on, as the layout read it from the
   * cookie (`WorkerScope`). */
  initialWorkerId?: string;
  /** The greeting names the user only when there is a name to give: the
   * canvas's bracketed placeholder read as a broken screen. */
  userName?: string;
  /** What the bell shows, or null when nobody is signed in. */
  bell: BellView | null;
}

// The hour is the browser's, never the server's, so the greeting is read through
// an external store: the server snapshot is null, hydration matches it, and the
// browser's own hour follows without a render ever reading the clock itself.
function subscribeToMinutes(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}
const currentPartOfDay = () => partOfDay(new Date().getHours());
const noPartOfDay = () => null;

export function AppShell({
  children,
  workers,
  initialWorkerId,
  userName,
  bell,
}: AppShellProps) {
  const pathname = usePathname();
  const part = useSyncExternalStore(subscribeToMinutes, currentPartOfDay, noPartOfDay);

  // The tab strip scrolls sideways below `xl`, which raises two questions a
  // static row never had: which tab is current when it is outside the visible
  // part, and whether there is anything outside it at all. Both are answered
  // here rather than by a second, taller bar.
  //
  // These sit above the early returns because hooks must: the two routes below
  // render no bar, and a hook that ran only sometimes is a hook that runs in a
  // different order between renders.
  const navRef = useRef<HTMLElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useScrollRestoration(pathname);

  /** Whether anything is hidden behind either edge of the strip. */
  const readEdges = useCallback(() => {
    const nav = navRef.current;
    if (nav === null) return;
    const hidden = nav.scrollWidth - nav.clientWidth;
    // Chrome reports `scrollLeft` as 0 at the start of a right-to-left strip
    // and counts *down* from there, so what has been travelled is its
    // magnitude and never its sign.
    const travelled = Math.abs(nav.scrollLeft);
    const next = {
      start: hidden > 1 && travelled > 1,
      end: hidden > 1 && travelled < hidden - 1,
    };
    // Compared before it is set, because this runs on every scroll event and a
    // state write per frame would re-render the whole shell while a thumb is
    // still moving.
    setEdges((was) =>
      was.start === next.start && was.end === next.end ? was : next,
    );
  }, []);

  // Bring the current tab into view when the route changes, and re-measure.
  // Without it a phone lands on `/reports` with `דוחות` 150px outside the
  // strip and nothing on screen saying which of the five it is on.
  useEffect(() => {
    const nav = navRef.current;
    const tab = activeTabRef.current;
    if (nav !== null && tab !== null) {
      const strip = nav.getBoundingClientRect();
      const current = tab.getBoundingClientRect();
      if (current.left < strip.left || current.right > strip.right) {
        // Moved by hand rather than with `scrollIntoView`, which scrolls every
        // ancestor that can scroll and would take the page with it.
        nav.scrollLeft +=
          current.left + current.width / 2 - (strip.left + strip.width / 2);
      }
    }
    readEdges();
  }, [pathname, readEdges]);

  // A window that grows past `xl` leaves nothing hidden, and the fades have to
  // hear about it — nothing scrolls, so the scroll handler never fires.
  useEffect(() => {
    window.addEventListener("resize", readEdges);
    return () => window.removeEventListener("resize", readEdges);
  }, [readEdges]);

  // Two routes are outside the shell, and each for its own reason.
  //
  // `/sign-in`: a person who can see this bar is already signed in, so drawing
  // five nav tabs around a sign-in form would offer five links that redirect
  // straight back to it.
  //
  // `/workers/new`: the `הוספת עובד` artboard draws a wizard chrome of its own
  // — the wordmark, a way out, and nothing else — and it is right to. The nav
  // is a promise about a household that has a worker in it, and this is the
  // flow reached precisely when that is not yet true; a family half-way through
  // it would otherwise be offered five tabs into screens about nobody.
  if (pathname === "/sign-in" || pathname === ADD_WORKER) return <>{children}</>;

  // A household with no worker in it yet, which is what every new account is
  // until the first profile is created. Every screen below is a screen about
  // one worker, so there is nothing for any of them to draw: the bar stays,
  // because it is the frame and not a promise about data, and what would have
  // been the screen says why it is empty.
  const noWorkerYet = workers.length === 0;

  return (
    /*
      One desktop screen that does not scroll: the page is locked to the
      viewport and the content area takes what the bar leaves. Below `md` the
      lock is released and the page stacks and scrolls, because a phone has no
      screen to fit (v3, and there is no narrow artboard).
    */
    <WorkerScopeProvider workers={workers} initialWorkerId={initialWorkerId}>
    <div className="flex min-h-screen flex-col bg-ground text-ink md:h-screen md:min-h-0 md:overflow-hidden">
      {/*
        The first thing a keyboard reaches on every screen, and seen only while
        it holds focus. It sits above the header rather than inside it so that
        what it skips is the whole bar — the five tabs, the switcher and the
        alerts pill — which is otherwise walked past once per screen.
      */}
      <a
        href={`#${MAIN_ID}`}
        className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:m-2 focus:rounded-card-sm focus:bg-forest focus:px-4 focus:py-2 focus:text-[15px] focus:font-semibold focus:text-white"
      >
        <span dir="auto">{he.nav.skip}</span>
      </a>

      {/*
        One row on a wide screen and two below it, from one set of elements:
        the header wraps, and the nav takes a full row of its own while the
        logo and the controls share the row above it. The alternative — a
        second nav hidden at the other width — is two lists of tabs to keep in
        step with each other.

        The two rows begin at `xl` and not at `md`, which was measured rather
        than chosen: five Hebrew tabs, the switcher, the alerts pill and the
        greeting need about 1200px in one line, and at 768 and 1024 four of the
        five tabs sat outside the scroll with nothing to say so. Below that the
        tabs scroll sideways instead of shrinking, because a clipped tab label
        reads as a broken one.
      */}
      <header className="flex flex-none flex-wrap items-center gap-x-4 border-b border-line bg-surface px-4 pb-2 md:px-7 xl:h-15.5 xl:flex-nowrap xl:gap-x-5 xl:pb-0">
        <Link
          href="/"
          className="order-1 flex h-15.5 min-w-11 flex-none items-center justify-center gap-2.25 text-ink hover:text-ink"
        >
          {/* First in the row, so the mark stands in the top right corner. */}
          <LogoMark />
          {/*
            On a phone the mark stands alone and the name is read but not
            drawn. The two together are 123px of a 400px bar, which was what
            pushed the switcher onto a third row of chrome; the mark is the
            distinctive half, and the link is still named `EaseSalary` for a
            screen reader.
          */}
          <span
            translate="no"
            className="sr-only text-[19px] font-bold tracking-[-0.02em] sm:not-sr-only"
          >
            {he.app.name}
          </span>
        </Link>

        {/* The negative inline margin lets the scrolled row run to both edges
            of the phone, so the last tab is not hidden under the padding. The
            wrapper exists to hang the two fades on; the nav itself is the
            thing that scrolls. */}
        {/* `min-w-0` is load-bearing: without it this flex item takes its
            content's full 527px, the nav inside it never clips, and the page
            itself scrolls sideways instead of the tab strip. */}
        <div className="relative order-3 -mx-4 min-w-0 basis-full md:-mx-7 xl:order-2 xl:mx-0 xl:basis-auto">
          <nav
            ref={navRef}
            onScroll={readEdges}
            aria-label={he.nav.landmark}
            className="flex min-w-0 items-center gap-1 overflow-x-auto px-4 md:px-7 xl:px-0"
          >
            {navItems.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  ref={active ? activeTabRef : undefined}
                  aria-current={active ? "page" : undefined}
                  className={[
                    // 44px tall, a finger's height, rather than the 40 the padding gave.
                    "flex min-h-11 flex-none items-center gap-1.75 rounded-tab px-3 py-2 text-[16px] whitespace-nowrap transition-colors",
                    active
                      ? "bg-chip font-semibold text-ink"
                      : "font-normal text-ink-mute hover:bg-hover hover:text-ink",
                  ].join(" ")}
                >
                  <TwoToneIcon name={item.icon} className="size-4" />
                  <span dir="auto">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/*
            What says there are more tabs than the phone is showing. Each fade
            appears only while there is something behind that edge, so a bar
            with nothing hidden carries none.

            The gradients are named by physical direction because a gradient
            has no logical form, and this document is `dir="rtl"` from the
            `<html>` element down: `start` is the right edge and fades leftward.

            Driven by overflow alone and not by a breakpoint, because the one
            row is a near thing at exactly 1280 and a strip that clips there
            should say so too.
          */}
          {edges.start ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 start-0 w-8 bg-gradient-to-l from-surface to-transparent"
            />
          ) : null}
          {edges.end ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 end-0 w-8 bg-gradient-to-r from-surface to-transparent"
            />
          ) : null}
        </div>

        <div className="order-2 ms-auto flex h-15.5 flex-none items-center gap-2.5 ps-2 sm:gap-3.5 xl:order-3">
          <WorkerSwitcher />

          {bell !== null ? <Bell bell={bell} /> : null}

          <Link
            href="/settings"
            className="flex min-h-11 min-w-11 items-center justify-center gap-2.5 text-ink hover:text-forest"
          >
            {/*
              Below `lg` the greeting is read but not drawn, rather than not
              rendered: hiding it outright left the link with an aria-hidden
              circle for its only child and so with no name at all for a screen
              reader, which is what a critique found. What is announced is the
              same words that are visible where there is room for them.
            */}
            <span className="sr-only text-[15px] font-medium whitespace-nowrap lg:not-sr-only">
              {part !== null ? (
                <span dir="auto">
                  {`${he.header.greeting[part]}${userName ? ", " : ""}`}
                </span>
              ) : null}
              {userName ? <Bidi>{userName}</Bidi> : null}
            </span>
            <span
              aria-hidden="true"
              className="size-8.5 flex-none rounded-full border border-shell-line bg-shell"
            />
          </Link>
        </div>
      </header>

      <main
        id={MAIN_ID}
        tabIndex={-1}
        className="flex min-h-0 flex-1 justify-center overflow-auto px-4 pt-3 pb-3 md:px-7"
      >
        <div className="flex w-full max-w-[1320px] min-w-0 flex-col gap-2.5">
          {noWorkerYet ? <EmptyHousehold /> : children}
        </div>
      </main>
    </div>
    </WorkerScopeProvider>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { WorkerScopeProvider, WorkerSwitcher } from "@/components/WorkerScope";
import { he } from "@/lib/i18n/he";
import type { Worker } from "@/lib/types";

/**
 * The frame every route gets: a single 62px white bar across the top, as
 * `EaseSalary - דף הבית v3 לוח במרכז` draws it. The 232px green sidebar of v2 is
 * gone from the application and not only from the home screen, so this is
 * rebuilt rather than forked — a sidebar surviving on one route would be a
 * second shell to keep in step with the first.
 *
 * Help is the circular "?" in the bar rather than a card at the foot of the
 * sidebar: it is then in view on every screen by construction, which is the
 * whole of what pinning the card was trying to buy.
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

interface NavItem {
  href: string;
  label: string;
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
  { href: "/", label: he.nav.home },
  { href: "/workers", label: he.nav.workers },
  { href: "/payments", label: he.nav.payments },
  { href: "/settings", label: he.nav.settings },
  { href: "/reports", label: he.nav.reports },
];

interface AppShellProps {
  children: ReactNode;
  /**
   * The household's workers, read from the store by the layout above.
   *
   * **They are not the home screen's fixtures**, and the difference is not
   * cosmetic: the switcher's worker is the id every write action is made
   * against, so a shell holding a fixed list would send one household's ids to
   * another household's store — which is exactly what it did, and what the
   * second seeded household found. Stage 3 changes where the layout reads them
   * from and nothing here.
   */
  workers: Worker[];
  /** Defaults to the canvas placeholders, so the shell renders before there is
   * an account behind it. */
  userName?: string;
  alertCount?: string;
}

export function AppShell({
  children,
  workers,
  userName = he.header.yourName,
  alertCount = he.placeholder.count,
}: AppShellProps) {
  const pathname = usePathname();

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
  // it would otherwise be offered five tabs into screens about nobody. Settled
  // with the user on 2026-09-12, against `build_plan.md`'s open question about
  // this artboard.
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
    <WorkerScopeProvider workers={workers}>
    <div className="flex min-h-screen flex-col bg-ground text-ink md:h-screen md:min-h-0 md:overflow-hidden">
      <header className="flex h-15.5 flex-none items-center justify-between gap-6 border-b border-line bg-surface px-4 md:px-7">
        <div className="flex min-w-0 flex-auto items-center gap-6">
          <Link href="/" className="flex flex-none items-center gap-2.25 text-ink hover:text-ink">
            <span translate="no" className="text-[19px] font-bold tracking-[-0.02em]">
              {he.app.name}
            </span>
            <span aria-hidden="true" className="size-4.75 flex-none rounded-mark bg-clay" />
          </Link>

          <nav aria-label={he.nav.landmark} className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex-none rounded-tab px-3.5 py-2 text-[16px] whitespace-nowrap transition-colors",
                    active
                      ? "bg-chip font-semibold text-ink"
                      : "font-normal text-ink-mute hover:bg-hover hover:text-ink",
                  ].join(" ")}
                >
                  <span dir="auto">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-none items-center gap-3.5 ps-2">
          <WorkerSwitcher className="hidden sm:flex" />

          <Link
            href="/help"
            aria-label={he.nav.help.title}
            className="flex size-8 flex-none items-center justify-center rounded-full border border-line text-[15px] font-semibold text-ink-quiet transition-colors hover:border-ask-line-hover hover:text-forest"
          >
            {/* Not translatable text: a question mark is a question mark. */}
            <span aria-hidden="true" translate="no">
              ?
            </span>
          </Link>

          <Link
            href="/alerts"
            className="flex items-center gap-2 rounded-full border border-line px-3.25 py-1.75 text-[15px] text-ink-soft transition-colors hover:border-line-hover hover:text-ink"
          >
            <span aria-hidden="true" className="size-1.75 flex-none rounded-full bg-clay" />
            <span dir="auto" className="hidden sm:inline">
              {he.header.alerts}
            </span>
            <span className="font-semibold text-clay-ink">
              <Bidi noTranslate>{alertCount}</Bidi>
            </span>
          </Link>

          <Link href="/settings" className="flex items-center gap-2.5 text-ink hover:text-forest">
            <span className="hidden text-[15px] font-medium whitespace-nowrap lg:inline">
              <span dir="auto">{he.header.greeting} </span>
              <Bidi>{userName}</Bidi>
            </span>
            <span
              aria-hidden="true"
              className="size-8.5 flex-none rounded-full border border-shell-line bg-shell"
            />
          </Link>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 justify-center overflow-auto px-4 pt-3 pb-3 md:px-7">
        <div className="flex w-full max-w-[1320px] min-w-0 flex-col gap-2.5">
          {noWorkerYet ? <EmptyHousehold /> : children}
        </div>
      </main>
    </div>
    </WorkerScopeProvider>
  );
}

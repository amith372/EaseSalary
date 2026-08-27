"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Bidi } from "@/components/Bidi";
import { he } from "@/lib/i18n/he";

/**
 * The frame every artboard on the canvas draws verbatim: a 232px dark-green
 * sidebar on the inline start, and a header above the page's own content.
 *
 * It is a client component only because the active nav item is decided by the
 * current route, which a layout cannot know on the server.
 */

interface NavItem {
  href: string;
  label: string;
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
  /** Defaults to the canvas placeholders, so the shell renders before there is
   * an account behind it. */
  userName?: string;
  alertCount?: string;
  todayLabel?: string;
}

export function AppShell({
  children,
  userName = he.header.yourName,
  alertCount = he.placeholder.count,
  todayLabel = he.header.today,
}: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink md:flex-row">
      {/*
        The sidebar is a column beside the content at desktop width and a strip
        above it below `md`. The canvas has no narrow artboard; folding the same
        pieces into a strip keeps the design rather than inventing a second one,
        and keeps the body from scrolling sideways at phone width.
      */}
      <aside
        aria-label={he.nav.landmark}
        className="flex w-full flex-none flex-col justify-between bg-bark px-4.5 pt-7.5 pb-4 text-cream md:min-h-screen md:w-58 md:pb-6.5"
      >
        <div className="flex flex-col gap-6 md:gap-11.5">
          <div className="flex items-center gap-2.5 ps-2.5">
            <span
              translate="no"
              className="text-[21px] font-bold tracking-[-0.02em] text-cream-hi"
            >
              {he.app.name}
            </span>
            <span aria-hidden="true" className="size-5.5 flex-none rounded-lg bg-clay" />
          </div>

          <nav className="-mx-1 flex flex-row gap-0.5 overflow-x-auto px-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
            {navItems.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex flex-none items-center gap-3 rounded-xs px-3.5 py-3.25 text-[17px] whitespace-nowrap transition-colors",
                    active
                      ? "bg-cream-hi/13 font-semibold text-cream-hi"
                      : "font-normal text-cream-mute hover:bg-cream-hi/10 hover:text-cream-hi",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "size-[7px] flex-none rounded-full",
                      active ? "bg-clay" : "bg-cream/35",
                    ].join(" ")}
                  />
                  <span dir="auto">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/*
          The help screen holds no explanation of its own: it points at the
          explanation beside the figure, at the reference link, or at the screen
          that settles the question (specs.md item 24). Built in stage 7; until
          then this link has nowhere to land, like the nav items above it.
        */}
        <Link
          href="/help"
          className="mt-6 hidden flex-col gap-2.5 rounded-lg bg-cream-hi/8 p-4.5 text-cream transition-colors hover:bg-cream-hi/14 hover:text-cream-hi md:flex"
        >
          <span dir="auto" className="text-[16px] font-semibold text-cream-hi">
            {he.nav.help.title}
          </span>
          <span dir="auto" className="text-[14px] font-light text-cream-mute text-pretty">
            {he.nav.help.body}
          </span>
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline px-5 py-4.5 md:px-10">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="size-9 flex-none rounded-full border border-shell-line bg-shell"
            />
            <span className="text-[17px] text-ink-soft">
              <span dir="auto">{he.header.greeting} </span>
              <Bidi>{userName}</Bidi>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[15px] font-light text-ink-faint">
              <Bidi>{todayLabel}</Bidi>
            </span>
            <Link
              href="/alerts"
              className="flex items-center gap-2 rounded-full border border-sunken-line bg-surface px-3.25 py-1.75 text-[15px] text-ink-soft transition-colors hover:border-line hover:text-ink"
            >
              <span aria-hidden="true" className="size-[7px] rounded-full bg-clay" />
              <span dir="auto">{he.header.alerts}</span>
              <span className="font-semibold text-clay-ink">
                <Bidi>{alertCount}</Bidi>
              </span>
            </Link>
          </div>
        </header>

        <main className="flex min-w-0 flex-1 justify-center px-5 pt-11 pb-25 md:px-10">
          <div className="flex w-full max-w-[1040px] min-w-0 flex-col gap-8.5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

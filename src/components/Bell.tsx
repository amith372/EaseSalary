"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTitle, RemindersDialog, Sentence } from "@/components/AlertsScreen";
import type { BellView } from "@/lib/alertsView";
import { he } from "@/lib/i18n/he";
import { returningTo } from "@/lib/pickerReturn";

const pillClass =
  "flex min-h-11 flex-none items-center gap-1.75 rounded-full border border-line px-3 text-[14px] text-ink-soft transition-colors hover:border-line-hover hover:text-ink";

/**
 * The bell in the bar, as `דף הבית v4` draws it: a dot, the word, the count
 * (specs.md item 27). It opens a small panel listing the first four warnings
 * and counting the rest beside the link to `/alerts`. The dot is lit only while
 * there is a warning to count, and below `sm` the word is read but not drawn,
 * as the artboard hides it on a phone.
 */
export function Bell({ bell }: { bell: BellView }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // A route change closes the panel: every link in it leads somewhere else.
  const [shownOn, setShownOn] = useState(pathname);
  if (shownOn !== pathname) {
    setShownOn(pathname);
    setOpen(false);
  }

  // A press outside closes it, and so does Esc. The reminders pop-up is a
  // child of the panel in the DOM, so a press inside it keeps the panel open
  // behind it.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const face = (
    <>
      {bell.count > 0 ? (
        <span aria-hidden="true" className="size-1.75 flex-none rounded-full bg-clay" />
      ) : null}
      <span dir="auto" className="sr-only sm:not-sr-only">
        {he.header.alerts}
      </span>
      <span translate="no" data-row="warnings" className="font-semibold text-clay-ink">
        <bdi>{bell.count}</bdi>
      </span>
    </>
  );

  const cards = bell.shown;
  return (
    <div ref={root} className="relative flex-none">
      <button
        type="button"
        data-role="bell"
        aria-expanded={open}
        aria-controls="bell-panel"
        onClick={() => setOpen((was) => !was)}
        className={pillClass}
      >
        {face}
      </button>
      {open ? (
        <div
          // Below `sm` the bell stands mid-bar, and a panel hung from it ran
          // past the screen's edge, so it spans the screen under the top row.
          id="bell-panel"
          role="region"
          aria-labelledby="bell-panel-title"
          data-role="bell-panel"
          className="fixed inset-x-4 top-15.5 z-20 overflow-hidden sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-1.5 sm:w-[22rem] rounded-card border border-line bg-surface text-ink shadow-lg"
        >
          <h2
            id="bell-panel-title"
            dir="auto"
            className="border-b border-line px-4 py-3 text-[17px] font-semibold"
          >
            {he.header.alerts}
          </h2>
          {cards.length === 0 ? (
            <p dir="auto" className="px-4 py-4 text-[15px] text-ink-mute">
              {he.header.bell.nothing}
            </p>
          ) : (
            <ul className="flex flex-col">
              {cards.map((card) => (
                <li key={card.id} className="border-b border-line-soft last:border-b-0">
                  <Link
                    href={returningTo(card.action.href, pathname)}
                    data-role="bell-entry"
                    className="flex items-start gap-3 px-4 py-3 text-ink transition-colors hover:bg-hover hover:text-ink"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-2 size-2 flex-none rounded-full bg-clay-soft"
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[15px] font-semibold">
                        <AlertTitle card={card} />
                      </span>
                      <span className="text-[14px] font-light text-ink-mute">
                        <Sentence said={card.note} />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-x-2 border-t border-line bg-ground px-4 py-1">
            {bell.more > 0 ? (
              <>
                <span data-role="bell-more" className="text-[14px] text-ink-mute">
                  <Sentence said={he.alerts.more(bell.more)} />
                </span>
                <span aria-hidden="true" className="text-ink-faint">
                  ·
                </span>
              </>
            ) : null}
            <Link
              href="/alerts"
              className="flex min-h-11 items-center text-[14px] font-medium text-forest hover:underline hover:underline-offset-4"
            >
              <span dir="auto">{he.header.bell.showAll}</span>
            </Link>
            <span aria-hidden="true" className="text-ink-faint">
              ·
            </span>
            <RemindersDialog
              switchedOff={bell.switchedOff}
              className="flex min-h-11 items-center text-[14px] font-medium text-forest hover:underline hover:underline-offset-4"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

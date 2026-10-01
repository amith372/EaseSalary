"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { he } from "@/lib/i18n/he";

/** The one address the launcher opens, named once so the link and the route it
 * hides itself on cannot stop agreeing. */
export const HELP = "/help";

/**
 * The way in to `עזרה`, as a control that floats in the bottom corner rather
 * than as an entry in the top bar.
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
 * and `DESIGN.md` records it; the colours stay the artboard's, because only
 * where it sits was changed.
 */
export function HelpLauncher() {
  const pathname = usePathname();
  // Not on the screen it opens: a control that goes where you already are is a
  // control that looks broken when pressed.
  if (pathname === HELP) return null;

  return (
    <Link
      href={HELP}
      data-role="help-launcher"
      className="fixed bottom-5 start-5 z-30 flex min-h-11 items-center gap-2 rounded-full bg-help-launcher px-4 py-3 text-[15px] font-semibold text-help-ink shadow-[0_8px_24px_rgba(51,41,31,0.18)] transition-colors hover:bg-help-launcher-hover hover:text-help-ink md:bottom-6 md:start-6"
    >
      <HelpGlyph />
      <span dir="auto">{he.help.ask.launcher}</span>
    </Link>
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

import type { ReactNode } from "react";

interface BidiProps {
  children: ReactNode;
  /**
   * Keeps Chrome's translation away from the text. Set it on the wordmark, on
   * amounts, and later on passport and bank numbers — a translated identifier
   * is a wrong identifier.
   */
  noTranslate?: boolean;
  className?: string;
}

/**
 * Isolates a run of mixed script from the paragraph around it.
 *
 * A browser reorders mixed runs of Hebrew and Latin text, so a month range, a
 * passport number, or a name written partly in each script can appear with its
 * pieces in the wrong order — exactly where it matters most (specs.md Part 5).
 * `<bdi>` isolates by default and `dir="auto"` lets the content decide its own
 * direction, so a Hebrew name resolves right-to-left and an English one, or a
 * translated string, resolves left-to-right without the layout moving.
 *
 * This also carries the Chrome-translate convention: a dynamic string always
 * gets its own wrapping element, never sitting bare beside other nodes, or
 * React throws `NotFoundError` on `removeChild` when Chrome swaps the text node
 * in place.
 */
export function Bidi({ children, noTranslate, className }: BidiProps) {
  return (
    <bdi dir="auto" translate={noTranslate ? "no" : undefined} className={className}>
      {children}
    </bdi>
  );
}

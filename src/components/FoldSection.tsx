"use client";

import { useId, type ReactNode } from "react";
import { Chevron } from "@/components/icons";

export type Fold = { open: boolean; onToggle: () => void };

/**
 * A section folded until its heading is pressed, because a screen of open forms
 * is too much to meet at once. The body is hidden rather than
 * unmounted, so a half-typed field survives a fold. `data-group` is the browser
 * suite's handle on the section, since a label such as "סכום" repeats across
 * sections and a lookup by label alone matches several.
 */
export function FoldSection({
  group,
  title,
  aside,
  fold,
  className,
  children,
}: {
  group: string;
  title: string;
  /** Beside the heading, and shown only while the section is open. */
  aside?: ReactNode;
  fold: Fold;
  className: string;
  children: ReactNode;
}) {
  const bodyId = useId();
  const headingId = useId();
  return (
    <section data-group={group} aria-labelledby={headingId} className={className}>
      <div className="flex items-center justify-between gap-3">
        {/* The heading takes the row, so the whole line opens the section and
            not only its words. */}
        <h2 id={headingId} className="min-w-0 flex-1 text-[19px] font-semibold">
          <button
            type="button"
            aria-expanded={fold.open}
            aria-controls={bodyId}
            onClick={fold.onToggle}
            className="flex w-full items-center gap-2 rounded-chip text-start transition-colors hover:text-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            {/* Points towards the inline end when folded and down when open.
                The turn is on a wrapper, since the icon already rotates itself
                for the page's direction. */}
            <span
              aria-hidden="true"
              className={[
                "flex flex-none text-ink-quiet transition-transform",
                fold.open ? "rotate-90 rtl:-rotate-90" : "",
              ].join(" ")}
            >
              <Chevron towards="next" />
            </span>
            <span dir="auto">{title}</span>
          </button>
        </h2>
        {fold.open ? aside : null}
      </div>
      <div id={bodyId} hidden={!fold.open} className="flex min-w-0 flex-col gap-2.5">
        {children}
      </div>
    </section>
  );
}

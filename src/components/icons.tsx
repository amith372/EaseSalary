/**
 * Icons are inline SVG and never text.
 *
 * The canvas draws its chevrons as the characters `›` and `‹` and the Excel
 * button's badge as the letter `X`. Both are text nodes: Chrome tries to
 * translate them, and a chevron character reads backwards once the page is
 * right-to-left. Drawn instead, they are `aria-hidden` decoration beside a
 * label that carries the meaning.
 */

/**
 * `towards` is a direction in *time*, not on screen. Previous points at the
 * inline start, next at the inline end, so the arrow follows the document's
 * direction instead of being mirrored by hand at every call site.
 */
export function Chevron({
  towards,
  className,
}: {
  towards: "previous" | "next";
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={[
        "size-[15px]",
        towards === "previous" ? "rtl:rotate-180" : "rotate-180 rtl:rotate-0",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}

/** The badge on the "לייצא לאקסל" button. */
export function SheetBadge({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      fill="none"
      className={["size-4.25", className ?? ""].filter(Boolean).join(" ")}
    >
      <rect x="1" y="1.5" width="14" height="13" rx="3" className="fill-surface" />
      <path
        d="M5.4 5.4 10.6 10.6M10.6 5.4 5.4 10.6"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The sprout beside "צריך לטפל" — the one drawing on the screen, and the
 * reason that card reads as an invitation rather than as a warning. */
export function Sprout({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 26 26"
      fill="none"
      className={["size-6.5 flex-none", className ?? ""].filter(Boolean).join(" ")}
    >
      <path
        d="M13 21V11.5"
        className="stroke-leaf"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path d="M13 12.5C13 8.5 10 5.5 6 5C5.6 9.4 8.6 12.4 13 12.5Z" className="fill-leaf-soft" />
      <path d="M13 15.5C13 11.5 16 8.5 20 8C20.4 12.4 17.4 15.4 13 15.5Z" className="fill-leaf-mid" />
    </svg>
  );
}

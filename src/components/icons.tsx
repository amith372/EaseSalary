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
        "size-[18px]",
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
      viewBox="0 0 24 24"
      fill="none"
      className={["size-5", className ?? ""].filter(Boolean).join(" ")}
    >
      <rect x="1" y="1" width="22" height="22" rx="6" fill="currentColor" opacity="0.22" />
      <path
        d="M8.5 8 15.5 16M15.5 8 8.5 16"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </svg>
  );
}

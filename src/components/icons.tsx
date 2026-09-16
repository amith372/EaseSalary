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

/**
 * The two-tone icons of דף הבית v4: a filled shape in one colour and its detail
 * in a second. Each day kind has one, so a marked day is told apart by its
 * shape as well as its fill — colour alone says nothing to a reader who cannot
 * see it.
 */
const TWO_TONE = {
  sun: {
    shape: "M8 4.2a3.8 3.8 0 100 7.6 3.8 3.8 0 000-7.6z",
    shapeClass: "fill-icon-sun",
    detail:
      "M7.2 0.4h1.6v2.4H7.2zM7.2 13.2h1.6v2.4H7.2zM13.2 7.2h2.4v1.6h-2.4zM0.4 7.2h2.4v1.6H0.4zM11.9 2.9l1.2 1.2-1.7 1.7-1.2-1.2zM4.1 10.7l1.2 1.2-1.7 1.7-1.2-1.2zM13.1 11.9l-1.2 1.2-1.7-1.7 1.2-1.2zM2.9 4.1l1.2-1.2 1.7 1.7-1.2 1.2z",
    detailClass: "fill-icon-sun-2",
  },
  cross: {
    shape:
      "M3.6 2.4h8.8a1.2 1.2 0 011.2 1.2v8.8a1.2 1.2 0 01-1.2 1.2H3.6a1.2 1.2 0 01-1.2-1.2V3.6a1.2 1.2 0 011.2-1.2z",
    shapeClass: "fill-icon-cross",
    detail: "M6.9 4.6h2.2v2.3h2.3v2.2H9.1v2.3H6.9V9.1H4.6V6.9h2.3z",
    detailClass: "fill-surface",
  },
  star: {
    shape: "M8 1.6l2 4 4.4.6-3.2 3.1.8 4.4L8 11.6l-4 2.1.8-4.4L1.6 6.2 6 5.6z",
    shapeClass: "fill-icon-star",
    detail: "M8 4.2l1 2 2.2.3-1.6 1.6.4 2.2L8 9.2z",
    detailClass: "fill-icon-star-2",
  },
  home: {
    shape: "M8 1.8l6.4 5.2v6.6a1 1 0 01-1 1H2.6a1 1 0 01-1-1V7z",
    shapeClass: "fill-icon-home",
    detail: "M6.4 9.3h3.2v5.3H6.4z",
    detailClass: "fill-surface",
  },
  calendar: {
    shape:
      "M2.4 3.4h11.2a.9.9 0 01.9.9v9a.9.9 0 01-.9.9H2.4a.9.9 0 01-.9-.9v-9a.9.9 0 01.9-.9z",
    shapeClass: "fill-icon-calendar",
    detail:
      "M1.5 6.6h13v1.4h-13zM4.4 1.2h1.4v3.2H4.4zM10.2 1.2h1.4v3.2h-1.4zM3.6 9.4h2v1.9h-2zM7 9.4h2v1.9H7z",
    detailClass: "fill-icon-calendar-2",
  },
  calc: {
    shape:
      "M3.6 1.8h8.8a1.2 1.2 0 011.2 1.2v10a1.2 1.2 0 01-1.2 1.2H3.6a1.2 1.2 0 01-1.2-1.2V3a1.2 1.2 0 011.2-1.2z",
    shapeClass: "fill-icon-calc",
    detail:
      "M4.8 3.6h6.4v2.2H4.8zM4.8 7.4h1.6v1.5H4.8zM7.2 7.4h1.6v1.5H7.2zM9.6 7.4h1.6v1.5H9.6zM4.8 10.2h1.6v1.6H4.8zM7.2 10.2h1.6v1.6H7.2zM9.6 10.2h1.6v3.4H9.6z",
    detailClass: "fill-icon-calc-2",
  },
  // The four below belong to the top bar's tabs, which is why `home`,
  // `calendar` and `calc` above are not enough: a tab is named by its screen,
  // and the shape beside the name is what is recognised before the name is
  // read. Each is aria-hidden — the label is the tab.
  people: {
    shape:
      "M5.9 1.9a2.6 2.6 0 110 5.2 2.6 2.6 0 010-5.2zM1.3 14.4c0-2.6 2.1-4.5 4.6-4.5s4.6 1.9 4.6 4.5z",
    shapeClass: "fill-icon-person",
    detail:
      "M11.4 3.4a2.2 2.2 0 110 4.4 2.2 2.2 0 010-4.4zM10.6 9.6c2.3-.4 4.1 1.5 4.1 3.7v1.1h-2.6v-1.1c0-1.4-.5-2.7-1.5-3.7z",
    detailClass: "fill-icon-person-2",
  },
  coin: {
    shape:
      "M1.8 3.9h12.4a1.1 1.1 0 011.1 1.1v6a1.1 1.1 0 01-1.1 1.1H1.8A1.1 1.1 0 01.7 11V5a1.1 1.1 0 011.1-1.1z",
    shapeClass: "fill-icon-coin",
    detail:
      "M8 5.7a2.3 2.3 0 110 4.6 2.3 2.3 0 010-4.6zM2.3 5.4h1.5v1.4H2.3zM12.2 9.2h1.5v1.4h-1.5z",
    detailClass: "fill-icon-coin-2",
  },
  // Generated rather than drawn by hand: eight teeth on a circle is arithmetic,
  // and an eyeballed one is visibly uneven at any size.
  gear: {
    shape:
      "M7.05 2.58L6.74 0.81L9.26 0.81L8.95 2.58A5.5 5.5 0 0 1 11.16 3.50L12.20 2.03L13.97 3.80L12.50 4.84A5.5 5.5 0 0 1 13.42 7.05L15.19 6.74L15.19 9.26L13.42 8.95A5.5 5.5 0 0 1 12.50 11.16L13.97 12.20L12.20 13.97L11.16 12.50A5.5 5.5 0 0 1 8.95 13.42L9.26 15.19L6.74 15.19L7.05 13.42A5.5 5.5 0 0 1 4.84 12.50L3.80 13.97L2.03 12.20L3.50 11.16A5.5 5.5 0 0 1 2.58 8.95L0.81 9.26L0.81 6.74L2.58 7.05A5.5 5.5 0 0 1 3.50 4.84L2.03 3.80L3.80 2.03L4.84 3.50A5.5 5.5 0 0 1 7.05 2.58Z",
    shapeClass: "fill-icon-gear",
    detail: "M8 5.2a2.8 2.8 0 110 5.6 2.8 2.8 0 010-5.6z",
    detailClass: "fill-icon-gear-2",
  },
  doc: {
    shape: "M3.4 1.2h6.2l3.8 3.8v9.2a.9.9 0 01-.9.9H3.4a.9.9 0 01-.9-.9V2.1a.9.9 0 01.9-.9z",
    shapeClass: "fill-icon-doc",
    detail:
      "M9.6 1.4v3.4h3.4zM4.5 10.4h1.5v2.7H4.5zM7.3 8.2h1.5v4.9H7.3zM10.1 9.4h1.5v3.7h-1.5z",
    detailClass: "fill-icon-doc-2",
  },
} as const;

export type TwoToneName = keyof typeof TWO_TONE;

export function TwoToneIcon({
  name,
  className,
}: {
  name: TwoToneName;
  className?: string;
}) {
  const icon = TWO_TONE[name];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      className={["flex-none", className ?? "size-3.25"].join(" ")}
    >
      <path d={icon.shape} className={icon.shapeClass} />
      <path d={icon.detail} className={icon.detailClass} />
    </svg>
  );
}

/** The outlined icons of the home screen's tiles: a person for the workers, a
 * calendar for the balances, a sheet for the export, a ruled page for the
 * payslip — lined rather than folded, so the two ways further in do not wear
 * one icon — the pencil on "עריכת היום", and the plus on "הוספת עובד/ת". One
 * stroke weight for all six. */
export function RailIcon({
  name,
  className,
}: {
  name: "person" | "calendar" | "sheet" | "payslip" | "pencil" | "plus";
  className?: string;
}) {
  const common = {
    "aria-hidden": true,
    focusable: false,
    viewBox: name === "pencil" ? "0 0 16 16" : "0 0 18 18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    className: ["flex-none", className ?? "size-4.25"].join(" "),
  } as const;
  switch (name) {
    case "person":
      return (
        <svg {...common}>
          <circle cx="9" cy="6" r="3.1" />
          <path d="M3.4 15.2c.6-2.8 2.9-4.3 5.6-4.3s5 1.5 5.6 4.3" strokeLinecap="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="2.3" y="3.4" width="13.4" height="12" rx="2.8" />
          <path d="M2.3 7.2h13.4M6 2.2v2.6M12 2.2v2.6" strokeLinecap="round" />
        </svg>
      );
    case "sheet":
      return (
        <svg {...common}>
          <path d="M4.2 2.4h6l3.9 3.9v9.3H4.2z" strokeLinejoin="round" />
          <path d="M10 2.6v3.9h3.9" strokeLinejoin="round" />
        </svg>
      );
    case "payslip":
      return (
        <svg {...common}>
          <rect x="3.6" y="2.4" width="10.8" height="13.2" rx="1.8" />
          <path d="M6.2 6h5.6M6.2 9h5.6M6.2 12h3.2" strokeLinecap="round" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...common}>
          <path d="M10.6 2.6l2.8 2.8-7.6 7.6-3.4.6.6-3.4z" strokeLinejoin="round" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common} strokeWidth={1.7}>
          <path d="M9 3.5v11M3.5 9h11" strokeLinecap="round" />
        </svg>
      );
  }
}

/**
 * The wordmark's mark: two people whose bodies meet as one heart — the family
 * and the one who looks after them — in the band's amber and the wordmark's
 * clay. Decorative, since the name beside it says what it is.
 */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={`flex-none ${className}`}>
      <circle cx="10.5" cy="5.5" r="3.4" className="fill-icon-sun" />
      <circle cx="21.5" cy="5.5" r="3.4" className="fill-clay" />
      <path
        d="M15.1 29.5C9 25 3 20.4 3 14.6 3 11.5 5.5 9.4 8.6 9.4c2.8 0 5 1.5 6.5 3.9Z"
        className="fill-icon-sun"
      />
      <path
        d="M16.9 29.5C23 25 29 20.4 29 14.6c0-3.1-2.5-5.2-5.6-5.2-2.8 0-5 1.5-6.5 3.9Z"
        className="fill-clay"
      />
    </svg>
  );
}
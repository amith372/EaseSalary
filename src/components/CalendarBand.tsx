import type { ReactNode } from "react";
import { he } from "@/lib/i18n/he";

/**
 * The illustrated band across the top of the home calendar, as
 * `EaseSalary - דף הבית v4` draws it: the month's controls at the start, and at
 * the end a branch, a sun and "כל יום נחשב" in a hand-written face.
 *
 * **Everything past the controls is decoration** and is hidden from assistive
 * technology; the slogan is still real text rather than part of the drawing,
 * because text inside an image is text Chrome cannot translate (CLAUDE.md).
 *
 * When the card is narrow the branch is clipped first and the slogan second,
 * so the controls never lose room to the drawing; at phone width there is no
 * room for either, and the drawing is left out rather than shown as a stub.
 */
export function CalendarBand({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative isolate flex min-h-26 flex-none items-center gap-4.5 overflow-hidden rounded-t-calendar border-b border-line bg-band ps-5.5",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* The sage wave behind the controls. An SVG is not mirrored by `dir`, so
          its right edge is the start of a right-to-left row by construction. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 -z-10 size-full"
      >
        <path
          d="M500 100C590 100 640 62 720 32 792 6 860 0 1000 0V100Z"
          className="fill-band-wave"
        />
      </svg>

      {children}

      <span
        aria-hidden="true"
        className="pointer-events-none hidden min-w-0 sm:flex flex-auto items-center justify-end self-stretch overflow-hidden ps-3"
      >
        {/* Tight against the slogan, and tight against the drawing: the heart
            belongs to the words rather than floating between them and the
            branch, and the twenty-odd pixels it gives back are what a long
            month name — `אוקטובר`, `ספטמבר` — takes out of the drawing (the
            user, 2026-09-16). */}
        <span className="flex flex-none -rotate-2 items-end gap-2 me-2.5">
          <span className="flex flex-col gap-0.75">
            <span
              translate="no"
              dir="auto"
              className="font-hand text-[25px] leading-[1.05] whitespace-nowrap text-band-ink"
            >
              {he.home.band.slogan}
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 122 9"
              preserveAspectRatio="none"
              className="block h-2.25 w-[94%] self-start"
            >
              <path
                d="M2 7C38 4.6 80 2.6 120 2.4"
                className="fill-none stroke-band-underline"
                strokeWidth="2.4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </span>
          <svg aria-hidden="true" viewBox="0 0 17 15" className="mb-3 h-3.75 w-4.25 flex-none">
            <path
              d="M8.5 13.4C4 10.4 1.2 8 1.2 5.2A3.7 3.7 0 018.5 3.6 3.7 3.7 0 0115.8 5.2c0 2.8-2.8 5.2-7.3 8.2z"
              className="fill-none stroke-band-ink"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {/* Clipped from the branch end and never from the sun. The drawing is
            pinned to the card's own edge, so what a narrow band takes is the
            tip of a leaf; pinned the other way it took a bite out of the sun,
            which is a circle and shows a straight cut. */}
        <span className="flex h-26 w-36.5 min-w-0 flex-[0_1_auto] justify-start overflow-hidden">
          <svg aria-hidden="true" viewBox="0 14 218 167" className="block h-26 w-36.5 flex-none">
            <circle cx="170" cy="62" r="42" className="fill-band-sun" />
            <path
              d="M56 184C64 152 78 120 98 98M82 114C74 100 66 88 62 76M70 142C88 134 106 132 122 132"
              className="fill-none stroke-band-stem"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path transform="translate(62 78) rotate(-113.4)" d="M0 0C11.8 -24.2 40.5 -25.3 65.4 0C40.5 25.3 11.8 24.2 0 0Z" className="fill-band-leaf" />
            <path transform="translate(98 100) rotate(-74.7)" d="M0 0C8.2 -17.9 28.3 -18.7 45.6 0C28.3 18.7 8.2 17.9 0 0Z" className="fill-band-leaf-light" />
            <path transform="translate(58 136) rotate(-149)" d="M0 0C10.5 -23.1 36.2 -24.2 58.3 0C36.2 24.2 10.5 23.1 0 0Z" className="fill-band-leaf-deep" />
            <path transform="translate(72 166) rotate(-45)" d="M0 0C11.7 -22.1 40.3 -23.1 65.1 0C40.3 23.1 11.7 22.1 0 0Z" className="fill-band-leaf" />
            <path transform="translate(120 132) rotate(4.2)" d="M0 0C9.7 -16.8 33.6 -17.6 54.1 0C33.6 17.6 9.7 16.8 0 0Z" className="fill-band-leaf-light" />
          </svg>
        </span>
      </span>
    </div>
  );
}

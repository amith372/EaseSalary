import type { ReactNode } from "react";
import { BandScene } from "@/components/BandScene";
import type { Season } from "@/lib/season";
import { he } from "@/lib/i18n/he";

/**
 * The illustrated band across the top of the home calendar, as
 * `EaseSalary - דף הבית v4` draws it: the month's controls at the start, and at
 * the end a branch, a sun and "כל יום נחשב" in a hand-written face.
 *
 * **It is drawn in the season of the month being shown**, which is the one
 * thing on the screen that is there to be liked rather than read. The season
 * arrives as a prop and is never worked out here, because it comes from the
 * month the calendar is on and not from today (`CLAUDE.md`: nothing reads the
 * clock during a render). `data-season` is the whole mechanism — it sets the
 * scene's colours on this element and every `band-*` utility inside inherits
 * them (`globals.css`).
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
  season,
  children,
  className,
}: {
  season: Season;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-season={season}
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
            month name — `אוקטובר`, `ספטמבר` — takes out of the drawing. */}
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
          <BandScene season={season} />
        </span>
      </span>
    </div>
  );
}

"use client";

import { he } from "@/lib/i18n/he";
import type { MarkKind } from "@/lib/types";

/**
 * Which mark the next gesture on the calendar draws.
 *
 * The canvas has no picker: its calendar hint says a click marks vacation,
 * sickness or a holiday without saying how the three are told apart. They
 * cannot be, so the choice is made before the gesture rather than guessed after
 * it — and the swatch on each button is the same colour the day takes, so the
 * legend under the calendar reads as the answer to what these buttons do.
 *
 * The chosen tool is the caller's state: the calendar takes it as a prop and
 * decides nothing about it.
 */

const tools: MarkKind[] = ["vacation", "sick", "holiday", "freeSaturday"];

const swatchClass: Record<MarkKind, string> = {
  vacation: "bg-vacation",
  sick: "bg-sick",
  holiday: "bg-holiday",
  freeSaturday: "bg-rest",
};

interface MarkToolPickerProps {
  value: MarkKind | null;
  onChange: (tool: MarkKind | null) => void;
  className?: string;
}

export function MarkToolPicker({
  value,
  onChange,
  className,
}: MarkToolPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label={he.calendar.tools.title}
      className={["flex flex-wrap items-center gap-2", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {tools.map((tool) => {
        const active = value === tool;
        return (
          <button
            key={tool}
            type="button"
            role="radio"
            aria-checked={active}
            // Clicking the chosen tool again turns marking off, so a day can be
            // cleared without a new mark being drawn on the next click.
            onClick={() => onChange(active ? null : tool)}
            className={[
              "flex items-center gap-2 rounded-full border px-3.5 py-1.75 text-[15px] transition-colors",
              active
                ? "border-forest bg-forest text-cream-hi font-semibold"
                : "border-line bg-surface text-ink-soft font-normal hover:border-sand-line hover:bg-sand-hover hover:text-ink",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
            ].join(" ")}
          >
            <span
              aria-hidden="true"
              className={`size-[9px] flex-none rounded-full ${swatchClass[tool]}`}
            />
            <span dir="auto">{he.calendar.marks[tool]}</span>
          </button>
        );
      })}
    </div>
  );
}

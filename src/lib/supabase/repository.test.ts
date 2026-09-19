import { describe, expect, it } from "vitest";
import { spanOf, spanRowOf } from "@/lib/supabase/repository";
import type { MonthSpan } from "@/lib/engine/types";
import { unansweredHolidays } from "@/lib/engine/types";
import type { IsoDate } from "@/lib/types";

const workerId = "00000000-0000-0000-0000-000000000001";
const day = (iso: string) => iso as IsoDate;

describe("a span survives the trip through its row (specs.md items 9 and 18)", () => {
  const spans: MonthSpan[] = [
    { id: "h-unanswered", kind: "holiday", from: day("2026-10-02"), to: day("2026-10-02"), worked: null },
    { id: "h-worked", kind: "holiday", from: day("2026-10-07"), to: day("2026-10-07"), worked: true, fraction: 0.5 },
    { id: "h-off", kind: "holiday", from: day("2026-10-14"), to: day("2026-10-14"), worked: false },
    { id: "s-open", kind: "sick", from: day("2026-10-20"), to: null },
    { id: "v", kind: "vacation", from: day("2026-10-26"), to: day("2026-10-27"), note: "טיול" },
  ];

  it.each(spans)("$id comes back as it went in", (span) => {
    expect(spanOf(spanRowOf(workerId, span))).toEqual(span);
  });

  // The row the table's check constraint judges: only a holiday carries
  // `worked`, and an unanswered one carries it as null.
  it("writes worked only on a holiday, null while nobody has said", () => {
    expect(spans.map((span) => spanRowOf(workerId, span).worked)).toEqual([
      null,
      true,
      false,
      null,
      null,
    ]);
  });

  // What the lost null cost: a holiday read back without `worked` is neither
  // answered nor unanswered, so the export was not stopped for it.
  it("an unanswered holiday read back still stops the export", () => {
    const read = spans.map((span) => spanOf(spanRowOf(workerId, span)));
    expect(unansweredHolidays(read).map((span) => span.id)).toEqual([
      "h-unanswered",
    ]);
  });
});

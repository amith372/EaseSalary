import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { Sentence } from "@/components/AlertsScreen";
import { fullDayLabel } from "@/lib/dateLabels";
import { documentDates } from "@/lib/documentDates";
import type { DocumentDateRow } from "@/lib/documentDates";
import { PASSPORT_MONTHS_REQUIRED } from "@/lib/engine/actionList";
import { he } from "@/lib/i18n/he";
import type { IsoDate } from "@/lib/types";

/**
 * The three expiry dates in one place (`specs.md` item 28).
 *
 * **It draws dates and never the numbers beside them.** The passport, visa and
 * permit numbers are encrypted at rest and opened only where they are needed;
 * the expiry dates explicitly are not (item 28), which is what lets them be
 * listed. Correcting either still happens on `/settings`, and the note says so
 * rather than this screen growing a second way to write the same field.
 *
 * **Nothing here duplicates `לקראת החודשים הבאים`**, which is about fees and
 * amounts. This is about documents and dates, which is the half that had
 * nowhere to be read.
 *
 * `today` is a prop and never a clock (`CLAUDE.md`).
 */
export function WorkerDocuments({
  documents,
  today,
}: {
  documents: {
    employmentPermitExpiry: IsoDate | null;
    workVisaExpiry: IsoDate | null;
    passportExpiry: IsoDate | null;
  };
  today: IsoDate;
}) {
  const words = he.workers.profile.documents;
  const rows = documentDates(documents, today);

  return (
    <section
      aria-labelledby="documents-title"
      className="flex min-w-0 flex-col gap-3.5"
    >
      <h2
        id="documents-title"
        dir="auto"
        className="text-[20px] font-semibold sm:text-[22px]"
      >
        {words.title}
      </h2>
      <Card radius="md" className="flex flex-col overflow-hidden">
        {/* A list of rows and not a `<table>`: each row is one document and
            three facts about it, and at phone width the three wrap under one
            another, which a table's columns cannot do. The column names are
            drawn once above, for the width where they do line up. */}
        <div
          aria-hidden="true"
          className="hidden flex-wrap items-center gap-x-5 border-b border-line-soft px-5 py-2.5 text-[13px] font-semibold text-ink-quiet sm:flex sm:px-6"
        >
          <span dir="auto" className="min-w-0 flex-[1_1_11rem]">
            {words.columns.document}
          </span>
          <span dir="auto" className="w-[9.5rem] flex-none">
            {words.columns.until}
          </span>
          <span dir="auto" className="w-[9.5rem] flex-none">
            {words.columns.near}
          </span>
        </div>
        {rows.map((row) => (
          <div
            key={row.document}
            data-row={`document-${row.document}`}
            data-state={row.state}
            className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line-soft px-5 py-4 first:border-t-0 sm:px-6"
          >
            <span dir="auto" className="min-w-0 flex-[1_1_11rem] text-[17px] font-medium">
              {words.names[row.document]}
            </span>
            <span
              data-cell="until"
              className="w-[9.5rem] flex-none text-[16px] font-light text-ink-mute"
            >
              {row.expiresOn === null ? (
                <span dir="auto">{words.none}</span>
              ) : (
                <Bidi noTranslate>{fullDayLabel(row.expiresOn)}</Bidi>
              )}
            </span>
            <span
              data-cell="near"
              className={[
                "w-[9.5rem] flex-none text-[16px]",
                row.state === "expired"
                  ? "font-semibold text-clay-deep"
                  : row.state === "due"
                    ? "font-medium text-ink"
                    : "font-light text-ink-mute",
              ].join(" ")}
            >
              <Near row={row} />
            </span>
          </div>
        ))}
      </Card>
      <p dir="auto" className="text-[14px] font-light text-ink-mute text-pretty">
        {words.note}
      </p>
    </section>
  );
}

/** What the third cell says, which is one of four things and never a number on
 * its own (`documentDates.ts` holds the four states and why). */
function Near({ row }: { row: DocumentDateRow }) {
  const words = he.workers.profile.documents;
  if (row.state === "missing") return <span dir="auto">{words.none}</span>;
  if (row.state === "expired") return <span dir="auto">{words.expired}</span>;
  // The passport, which says which side of its eighteen months it is on.
  if (row.daysLeft === null) {
    return (
      <Sentence
        said={
          row.state === "due"
            ? words.below(PASSPORT_MONTHS_REQUIRED)
            : words.above(PASSPORT_MONTHS_REQUIRED)
        }
      />
    );
  }
  return <Sentence said={he.alerts.tag.inDays(row.daysLeft)} />;
}

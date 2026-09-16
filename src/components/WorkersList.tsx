import Link from "next/link";
import type { ReactNode } from "react";
import { Bidi } from "@/components/Bidi";
import { ADD_WORKER } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { RailIcon, TwoToneIcon } from "@/components/icons";
import { MoneyValue } from "@/components/MoneyValue";
import { WorkerAvatar } from "@/components/WorkerAvatar";
import { WorkerSettingsLink } from "@/components/WorkerSettingsLink";
import { fullDayLabel } from "@/lib/dateLabels";
import { he } from "@/lib/i18n/he";
import { formatDays } from "@/lib/money";
import type { IsoDate, Worker } from "@/lib/types";

/**
 * The household's workers — `EaseSalary - העובדות` (specs.md item 11).
 *
 * **Three things the artboard draws are not here.** The status chip on each
 * card ("[חודש] ממתין לחישוב" / "הכול מעודכן") names one of the month's four
 * states, which are Part 5's and which nothing in the application can yet set —
 * a chip here would be a state invented to fill a shape. The
 * "משותף/ת עם [שם]" chip needs the other member's name, which this list is not
 * given. And the header's "להוסיף עובד/ת" button: the dashed card at the foot of
 * the list is the one way in (`DESIGN.md`). That card shows only while the
 * household has room: two workers is item 11's limit and a trigger in the
 * database refuses a third, so a card offering a wizard whose save would be
 * refused is a promise the application cannot keep. The limit itself is stated
 * either way, in the sentence the artboard closes with.
 *
 * It holds no state and no arithmetic: the four facts under each worker are
 * read from the same replay the home screen reads (item 13), on the server.
 */
export interface WorkerSummary {
  worker: Worker;
  employedSince: IsoDate;
  /** Her country of origin in Hebrew, resolved on the server by
   * `countryNameHe` from the shipped holiday lists. A country nothing is stored
   * for falls back to its two-letter code. */
  country: string;
  baseMonthlySalaryAgorot: number;
  /** Her last month's closing balances, or the opening position for a worker
   * who has no months yet (items 6, 7). */
  vacationDays: number;
  sickDays: number;
  /** What is still owed across every advance she carries (item 20). */
  outstandingAgorot: number;
}

export function WorkersList({
  household,
  hasRoom,
}: {
  household: WorkerSummary[];
  /** Whether the person's own household holds fewer than two workers. Not
   * `household.length < 2`: a worker shared from another household is shown
   * here and not counted (item 11). */
  hasRoom: boolean;
}) {
  const words = he.workers;

  return (
    /* The artboard's narrower measure, which `/payments` already takes: a page
       of facts read across the shell's full 1320px is a line the eye loses on
       the way back. */
    <div className="mx-auto flex w-full max-w-[860px] min-w-0 flex-col gap-6 sm:gap-7.5">
      <div className="flex min-w-0 flex-col gap-1.5">
        {/* The tab's own icon, beside the heading rather than inside it — see
            `PaymentsScreen` for why the distinction matters under `dir="auto"`. */}
        <div className="flex items-center gap-2.5">
          <TwoToneIcon name="people" className="size-7" />
          <h1
            dir="auto"
            className="text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[34px]"
          >
            {words.title}
          </h1>
        </div>
        <p
          dir="auto"
          className="max-w-[62ch] text-[16px] leading-[1.55] font-light text-ink-soft text-pretty sm:text-[18px]"
        >
          {words.lead}
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {household.map(
          ({
            worker,
            employedSince,
            country,
            baseMonthlySalaryAgorot,
            vacationDays,
            sickDays,
            outstandingAgorot,
          }) => (
            <Card
              key={worker.id}
              id={`worker-${worker.id}`}
              radius="lg"
              className="flex min-w-0 flex-col gap-5 px-4.5 py-5 sm:gap-5.5 sm:px-7.5 sm:py-6.5"
            >
              <div className="flex min-w-0 items-start gap-4 sm:gap-5">
                <WorkerAvatar />
                <div className="flex min-w-0 flex-col gap-1">
                  <h2
                    dir="auto"
                    className="text-[22px] leading-[1.2] font-bold tracking-[-0.02em] break-words sm:text-[26px]"
                  >
                    <Bidi>{worker.name}</Bidi>
                  </h2>
                  <p className="text-[15px] font-light text-ink-mute sm:text-[17px]">
                    <span dir="auto">{words.employedSince} </span>
                    <Bidi>{fullDayLabel(employedSince)}</Bidi>
                    <span aria-hidden="true"> · </span>
                    <span dir="auto">{words.country} </span>
                    {/* Isolated: a Hebrew name beside Latin fallbacks such as a
                        two-letter code. A country is a word, not an
                        identifier, so translation may have it. */}
                    <Bidi>{country}</Bidi>
                  </p>
                </div>
              </div>

              {/* A ruled grid: each cell draws its own top and start rules and
                  is pulled back over the frame by a pixel, so the frame and the
                  rules between cells are one hairline. Two columns even on a phone:
                  the longest figure fits in half of 390px. */}
              <Card
                tone="inset"
                radius="sm"
                className="grid grid-cols-2 overflow-hidden"
              >
                <Fact label={words.facts.salary}>
                  <MoneyValue agorot={baseMonthlySalaryAgorot} size="fact" />
                </Fact>
                <Fact label={words.facts.vacation}>
                  <Days value={vacationDays} />
                </Fact>
                <Fact label={words.facts.sick}>
                  <Days value={sickDays} />
                </Fact>
                <Fact label={words.facts.advance}>
                  <MoneyValue agorot={outstandingAgorot} size="fact" />
                </Fact>
              </Card>

              <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-4.5 sm:pt-5">
                <Link
                  href={`/workers/${worker.id}`}
                  className="text-[17px] font-semibold text-forest transition-colors hover:text-forest-deep sm:text-[18px]"
                >
                  <span dir="auto">{words.toProfile(worker.firstName)}</span>
                </Link>
                <Link href={`/workers/${worker.id}#months`} className={quietLink}>
                  <span dir="auto">{words.profile.months.title}</span>
                </Link>
                <WorkerSettingsLink workerId={worker.id} className={quietLink}>
                  <span dir="auto">{words.toSettings}</span>
                </WorkerSettingsLink>
              </div>
            </Card>
          ),
        )}

        {hasRoom ? (
          <Link
            href={ADD_WORKER}
            data-role="add-worker-link"
            className="flex min-w-0 items-center gap-4 rounded-calendar border border-dashed border-line-strong px-4.5 py-5 transition-colors hover:border-line-hover hover:bg-row-hover sm:gap-4.5 sm:px-8 sm:py-7.5"
          >
            <span className="flex size-11 flex-none items-center justify-center rounded-tint bg-tile-amber text-clay-deep">
              <RailIcon name="plus" className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.75">
              <span dir="auto" className="text-[18px] font-semibold sm:text-[20px]">
                {he.emptyHousehold.add}
              </span>
              <span
                dir="auto"
                className="text-[15px] font-light text-ink-mute text-pretty sm:text-[16px]"
              >
                {words.addLead}
              </span>
            </span>
          </Link>
        ) : null}
      </div>

      <p
        dir="auto"
        className="max-w-[70ch] text-[15px] leading-[1.55] font-light text-ink-faint text-pretty sm:text-[16px]"
      >
        {words.limit}
      </p>
    </div>
  );
}

const quietLink =
  "text-[16px] text-ink-soft transition-colors hover:text-forest sm:text-[17px]";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="-ms-px -mt-px flex min-w-0 flex-col gap-1 border-s border-t border-line px-3.5 py-3 sm:px-5 sm:py-4">
      <span dir="auto" className="text-[14px] font-light text-ink-mute sm:text-[15px]">
        {label}
      </span>
      {children}
    </div>
  );
}

function Days({ value }: { value: number }) {
  return (
    <span className="text-[18px] font-semibold whitespace-nowrap sm:text-[20px]">
      <Bidi noTranslate>{formatDays(value)}</Bidi>
      <span> </span>
      <span dir="auto" className="font-light text-ink-quiet">
        {he.units.days}
      </span>
    </span>
  );
}

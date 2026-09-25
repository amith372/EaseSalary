"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { dismiss, saveReminders } from "@/app/alerts/actions";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { touchTargetClass } from "@/components/Field";
import type { AlertCard, AlertsView } from "@/lib/alertsView";
import { warningKinds, type WarningKind } from "@/lib/engine/alerts";
import { he, type Said } from "@/lib/i18n/he";
import { returningTo } from "@/lib/pickerReturn";

/**
 * `EaseSalary - התראות`, for the whole household (specs.md item 27). Everything
 * on it was worked out on the server (`alertsView`); this draws it.
 */
export function AlertsScreen({ view }: { view: AlertsView }) {
  const words = he.alerts;
  return (
    <div className="mx-auto flex w-full max-w-[780px] min-w-0 flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1.5">
          <h1 dir="auto" className="text-[24px] leading-[1.2] font-bold tracking-[-0.02em]">
            {words.title}
          </h1>
          <p dir="auto" className="text-[15px] font-light text-ink-mute text-pretty">
            {words.lead}
          </p>
        </div>
        <RemindersDialog switchedOff={view.switchedOff} />
      </div>

      <section aria-labelledby="alerts-open" className="flex flex-col gap-3">
        <h2 id="alerts-open" dir="auto" className="text-[14px] font-semibold text-ink-quiet">
          {words.open}
        </h2>
        {view.open.length === 0 ? (
          <p dir="auto" data-role="nothing-open" className="text-[15px] text-ink-mute">
            {words.nothingOpen}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {view.open.map((card) => (
              <li key={card.id}>
                <OpenCard card={card} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="alerts-done" className="flex flex-col">
        <h2 id="alerts-done" dir="auto" className="mb-2 text-[14px] font-semibold text-ink-quiet">
          {words.done}
        </h2>
        {view.done.length === 0 ? (
          <p dir="auto" className="text-[15px] text-ink-mute">
            {words.nothingDone}
          </p>
        ) : (
          <ul className="flex flex-col">
            {view.done.map((row) => (
              <li
                key={row.id}
                data-role="handled"
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line py-3.5"
              >
                <span
                  aria-hidden="true"
                  className="flex size-4.5 flex-none items-center justify-center rounded-full bg-sage text-sage-ink"
                >
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                    <path
                      d="M1 4.2L3.6 6.8L9 1.4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="min-w-0 flex-[1_1_14rem] text-[16px] text-ink-warm">
                  <AlertTitle card={row} />
                </span>
                <Bidi className="text-[14px] font-light whitespace-nowrap text-ink-quiet">
                  {row.when}
                </Bidi>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function OpenCard({ card }: { card: AlertCard }) {
  const [pending, startPending] = useTransition();
  const dismissal = card.dismiss;
  return (
    <Card
      radius="md"
      data-role="alert"
      data-list={card.blockage ? "blockage" : "warning"}
      aria-busy={pending}
      className="flex flex-wrap items-start gap-x-4 gap-y-3 px-5 py-4.5"
    >
      <span
        aria-hidden="true"
        className={[
          "mt-2 size-2.5 flex-none rounded-full",
          card.blockage ? "bg-clay" : "bg-clay-soft",
        ].join(" ")}
      />
      <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span data-role="alert-title" className="text-[18px] font-semibold tracking-[-0.01em]">
            <AlertTitle card={card} />
          </span>
          <span
            className={[
              "rounded-full px-3 py-1 text-[13px] font-semibold",
              card.blockage ? "bg-band-sun text-clay-ink" : "bg-chip text-ink-warm",
            ].join(" ")}
          >
            <Sentence said={card.tag} />
          </span>
        </div>
        <span className="text-[15px] font-light text-ink-mute text-pretty">
          <Sentence said={card.note} />
        </span>
        {card.law ? (
          <LawLink law={card.law} className="pt-0.5 text-[14px]" />
        ) : null}
        {/* **A card standing for several months puts each of them off on its
            own** (item 27's grouping, the user on 2026-09-25): the gesture
            cannot be undone from the screen, so there is no press that answers
            four months at once. Each button is named for its month, because
            four drawn alike are four a screen reader cannot tell apart. */}
        {dismissal !== null && dismissal.months.length > 1 ? (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pt-1.5">
            <span dir="auto" className="text-[14px] text-ink-quiet">
              {he.alerts.markHandledEach}
            </span>
            {dismissal.months.map((one) => (
              <button
                key={one.fingerprint}
                type="button"
                disabled={pending}
                aria-label={he.alerts.markHandledMonth(one.month ?? "")}
                onClick={() => startPending(() => dismiss(card.workerId, one.fingerprint))}
                className="flex min-h-9 items-center gap-1.5 rounded-full bg-chip px-3 py-1.5 text-[14px] text-ink-warm transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:text-ink-quiet"
              >
                <Bidi>{one.month}</Bidi>
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 9 9"
                  fill="none"
                  aria-hidden="true"
                  className="flex-none"
                >
                  <path
                    d="M1 1L8 8M8 1L1 8"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-4">
        <Link
          href={returningTo(card.action.href, "/alerts")}
          className="rounded-card-sm bg-forest px-5 py-2.5 text-[15px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-deep hover:text-white"
        >
          <span dir="auto">{card.action.label}</span>
        </Link>
        {dismissal !== null && dismissal.months.length === 1 && dismissal.months[0] ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startPending(() => dismiss(card.workerId, dismissal.months[0]!.fingerprint))
            }
            className="min-h-11 text-[15px] whitespace-nowrap text-ink-quiet transition-colors hover:text-ink-warm"
          >
            <span dir="auto">{dismissal.label}</span>
          </button>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * "להגדיר אילו תזכורות לקבל" and the pop-up it opens: the warning kinds and
 * nothing else, one checkbox each (specs.md item 27). A tick saves at once; the
 * page re-renders from the store when it has.
 */
export function RemindersDialog({
  switchedOff,
  className = "flex min-h-11 items-center text-[15px] font-medium text-forest hover:underline hover:underline-offset-4",
}: {
  switchedOff: WarningKind[];
  /** The link's look, which the bell's panel draws smaller. */
  className?: string;
}) {
  const words = he.alerts.reminders;
  const dialog = useRef<HTMLDialogElement>(null);
  const [off, setOff] = useState(switchedOff);
  const [, startSaving] = useTransition();

  function toggle(kind: WarningKind) {
    const next = off.includes(kind) ? off.filter((one) => one !== kind) : [...off, kind];
    setOff(next);
    startSaving(() => saveReminders(next));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={className}
      >
        <span dir="auto">{he.alerts.settingsLink}</span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="reminders-title"
        data-role="reminders"
        // Pressing the backdrop closes it, as Esc already does.
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink backdrop:bg-ink/30"
      >
        <div className="flex flex-col gap-3 px-5 py-4.5">
          <h2 id="reminders-title" dir="auto" className="text-[18px] font-semibold">
            {words.title}
          </h2>
          <ul className="flex flex-col">
            {warningKinds.map((kind) => (
              <li key={kind}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[16px]">
                  <input
                    type="checkbox"
                    checked={!off.includes(kind)}
                    onChange={() => toggle(kind)}
                    className="size-4.5 flex-none accent-forest"
                  />
                  <span dir="auto">{words.kinds[kind]}</span>
                </label>
              </li>
            ))}
          </ul>
          <p
            dir="auto"
            data-role="always-shown"
            className="border-t border-line pt-3 text-[14px] leading-[1.5] font-light text-ink-mute text-pretty"
          >
            {words.alwaysShown}
          </p>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="self-end rounded-card-sm bg-forest px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-forest-deep"
          >
            <span dir="auto">{words.close}</span>
          </button>
        </div>
      </dialog>
    </>
  );
}

/** A sentence from `he.ts`, each value in its own isolate (`CLAUDE.md`). */
export function Sentence({ said }: { said: Said }) {
  return (
    <span dir="auto">
      {said.map((part, index) =>
        typeof part === "string" ? (
          <span key={index}>{part}</span>
        ) : (
          <bdi key={index} translate="no">
            {part.value}
          </bdi>
        ),
      )}
    </span>
  );
}

/** An alert's title and, in a household of two, whose it is. */
export function AlertTitle({
  card,
}: {
  card: { title: Said; workerName: string | null };
}) {
  return (
    <>
      <Sentence said={card.title} />
      <WorkerName name={card.workerName} />
    </>
  );
}

/** "מה אומר החוק — <the page>": the rule an alert rests on. `className`
 * carries the size and the offset, which differ between the strip and the
 * list. */
export function LawLink({
  law,
  className,
}: {
  law: { label: string; url: string };
  className: string;
}) {
  return (
    <a
      href={law.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${touchTargetClass} self-start text-ink-quiet hover:text-forest hover:underline hover:underline-offset-[3px] ${className}`}
    >
      <span dir="auto">{he.alerts.whatTheLawSays}</span>
      <span> — </span>
      <span dir="auto">{law.label}</span>
    </a>
  );
}

function WorkerName({ name }: { name: string | null }) {
  if (name === null) return null;
  return (
    <>
      <span> · </span>
      <Bidi className="font-normal text-ink-mute">{name}</Bidi>
    </>
  );
}

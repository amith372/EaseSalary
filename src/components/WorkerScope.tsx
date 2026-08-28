"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Bidi } from "@/components/Bidi";
import { Chevron } from "@/components/icons";
import { he } from "@/lib/i18n/he";
import type { Worker } from "@/lib/types";

/**
 * Which worker every screen is about.
 *
 * It lives in the shell rather than on a screen because it scopes the whole of
 * one: the calendar, the month's totals and the balances beside them are all
 * one worker's, and a switch that sat inside the calendar card would read as
 * though it moved only the calendar. An account holds no more than two workers
 * (specs.md item 11), so this is a step between them rather than a list.
 *
 * The workers themselves are handed in. Until Stage 3 they are the fixtures;
 * from Stage 3 they are the account's own, and only the source changes.
 */

interface WorkerScope {
  workers: Worker[];
  worker: Worker;
  /** Forward or back through the account's workers, wrapping at either end. */
  step: (by: number) => void;
}

const WorkerScopeContext = createContext<WorkerScope | null>(null);

export function WorkerScopeProvider({
  workers,
  children,
}: {
  workers: Worker[];
  children: ReactNode;
}) {
  const [index, setIndex] = useState(0);

  const value = useMemo<WorkerScope>(
    () => ({
      workers,
      worker: workers[index] ?? workers[0],
      step: (by) => setIndex((current) => (current + by + workers.length) % workers.length),
    }),
    [workers, index],
  );

  return <WorkerScopeContext.Provider value={value}>{children}</WorkerScopeContext.Provider>;
}

export function useWorkerScope(): WorkerScope {
  const scope = useContext(WorkerScopeContext);
  if (!scope) throw new Error("useWorkerScope must be used inside a WorkerScopeProvider");
  return scope;
}

/** The control in the top bar: two arrows and the name between them. The
 * caption v3 draws above the name ("מוצג/ת כרגע") becomes the group's label,
 * because a bar 62px tall has room for the name and not for both. */
export function WorkerSwitcher({ className }: { className?: string }) {
  const { worker, workers, step } = useWorkerScope();
  if (workers.length < 2) return null;

  return (
    <div
      role="group"
      aria-label={he.header.workerSwitcher.showing}
      className={[
        "flex flex-none items-center gap-0.5 rounded-tab border border-line px-1 py-1",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        aria-label={he.header.workerSwitcher.previous}
        onClick={() => step(-1)}
        className="flex size-6.5 items-center justify-center rounded-chip text-ink-quiet transition-colors hover:bg-hover hover:text-ink"
      >
        <Chevron towards="previous" />
      </button>
      <Bidi className="max-w-40 truncate px-1 text-[15px] font-medium">{worker.name}</Bidi>
      <button
        type="button"
        aria-label={he.header.workerSwitcher.next}
        onClick={() => step(1)}
        className="flex size-6.5 items-center justify-center rounded-chip text-ink-quiet transition-colors hover:bg-hover hover:text-ink"
      >
        <Chevron towards="next" />
      </button>
    </div>
  );
}

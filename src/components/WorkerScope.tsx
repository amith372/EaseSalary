"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Bidi } from "@/components/Bidi";
import { Chevron } from "@/components/icons";
import { he } from "@/lib/i18n/he";
import { WORKER_COOKIE } from "@/lib/workerCookie";
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
 * **The choice survives a reload** (`build_plan.md` stage 3). It is kept in a
 * cookie the layout reads, so the server renders the chosen worker from the
 * first byte: a choice kept only in the browser would render the first worker
 * and then jump, and the server and the browser would disagree about whose
 * month the page is.
 *
 * **On a worker's own page the address decides**, because `/workers/[id]`
 * takes its worker from it. The switcher there goes to the other worker's
 * page rather than renaming the bar over a profile it no longer matches, and
 * arriving on her page makes her the choice for the screens that follow.
 */


interface WorkerScope {
  workers: Worker[];
  worker: Worker;
  /** Forward or back through the account's workers, wrapping at either end. */
  step: (by: number) => void;
  /** Show this worker, as a link from her own page does. An id the household
   * does not hold leaves the choice as it was. */
  select: (id: string) => void;
}

const WorkerScopeContext = createContext<WorkerScope | null>(null);

/** The worker a `/workers/<id>` address names, where it names one of these. */
function workerOfAddress(pathname: string, workers: Worker[]): string | null {
  const match = /^\/workers\/([^/]+)$/.exec(pathname);
  if (match === null) return null;
  const id = decodeURIComponent(match[1]);
  return workers.some((one) => one.id === id) ? id : null;
}

export function WorkerScopeProvider({
  workers,
  initialWorkerId,
  children,
}: {
  workers: Worker[];
  /** The choice as the cookie held it when the request arrived. */
  initialWorkerId?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const addressed = workerOfAddress(pathname, workers);

  const [chosenId, setChosenId] = useState<string | undefined>(() =>
    workers.some((one) => one.id === initialWorkerId) ? initialWorkerId : undefined,
  );

  // Arriving on her own page makes her the choice. Adjusted during render
  // rather than in an effect, which is React's own pattern for state derived
  // from a prop: an effect would paint the old worker for a frame first.
  if (addressed !== null && addressed !== chosenId) setChosenId(addressed);

  // The cookie follows the state and never leads it. Written in an effect
  // because a render must not write anything.
  useEffect(() => {
    if (chosenId === undefined) return;
    document.cookie = `${WORKER_COOKIE}=${encodeURIComponent(chosenId)}; path=/; max-age=31536000; samesite=lax`;
  }, [chosenId]);

  const value = useMemo<WorkerScope>(() => {
    const worker =
      workers.find((one) => one.id === (addressed ?? chosenId)) ?? workers[0];
    return {
      workers,
      worker,
      step: (by) => {
        const at = Math.max(0, workers.indexOf(worker));
        const next = workers[(at + by + workers.length) % workers.length];
        if (next === undefined) return;
        setChosenId(next.id);
        if (addressed !== null) router.push(`/workers/${next.id}`);
      },
      select: (id) => {
        if (workers.some((one) => one.id === id)) setChosenId(id);
      },
    };
  }, [workers, addressed, chosenId, router]);

  return <WorkerScopeContext.Provider value={value}>{children}</WorkerScopeContext.Provider>;
}

export function useWorkerScope(): WorkerScope {
  const scope = useContext(WorkerScopeContext);
  if (!scope) throw new Error("useWorkerScope must be used inside a WorkerScopeProvider");
  return scope;
}

/**
 * One of the switcher's two arrows.
 *
 * **The drawn button is 26px and the thing a thumb hits is 44px.** The square
 * stays small because the bar is 62px tall and the two arrows sit either side
 * of a name; the `after` pseudo-element carries the rest of the target, which
 * is the same trick `WhyButton` uses. It matters more here than anywhere else
 * in the bar: this is the control that decides *whose* salary every screen is
 * about, and on a phone it was the smallest thing on it.
 */
const arrow =
  "relative flex size-6.5 items-center justify-center rounded-chip text-ink-quiet transition-colors after:absolute after:-inset-2.25 after:content-[''] hover:bg-hover hover:text-ink";

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
        className={arrow}
      >
        <Chevron towards="previous" />
      </button>
      {/* Narrower on a phone, where the whole bar is 400px: the name truncates
          rather than pushing the switcher onto a row of its own, which cost
          the screen a third row of chrome. */}
      <Bidi className="max-w-24 truncate px-1 text-[15px] font-medium sm:max-w-40">
        {worker.name}
      </Bidi>
      <button
        type="button"
        aria-label={he.header.workerSwitcher.next}
        onClick={() => step(1)}
        className={arrow}
      >
        <Chevron towards="next" />
      </button>
    </div>
  );
}

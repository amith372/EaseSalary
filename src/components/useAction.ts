import { useRef, useState, useTransition } from "react";

/** What every server action here answers: done, or refused with a reason. */
export type ActionResult<Reason> = { ok: true } | { ok: false; reason: Reason };

/** Sends an action and hands its result back — a parent's, when the parent
 * owns the transition and the busy state around it.
 *
 * **It answers whether it took the action.** A parent that allows one change at
 * a time drops a second, and a control told nothing about the drop would wear
 * its busy state waiting for a result that is never coming. */
export type Send<Reason> = (
  action: () => Promise<ActionResult<Reason>>,
  onResult: (result: ActionResult<Reason>) => void,
) => boolean;

/**
 * A change on its way to the store, and the refusal it may come back with.
 *
 * Every control that calls a server action does the same three things around
 * it — clear the last refusal, send, then either keep the new one or run what
 * follows a success — so they do it once here. It holds no rule: every rule is
 * on the server, and this is the shape of asking.
 *
 * `saving` says when a change of this hook's is under way, whether the
 * transition is the hook's or a parent's, because that is what the control that
 * was pressed wears while it waits (`busyAttrs` in `Field.tsx`). Where one hook
 * backs several controls — a list's rows and the panel above them — `run` takes
 * the pressed one's name and `busyAt` answers for it.
 */
export function useAction<Reason>(send?: Send<Reason>) {
  const [saving, startSaving] = useTransition();
  // A parent's transition is the parent's; this is the hook's own record of
  // having sent, so a control under one still knows it is the one waiting.
  const [sent, setSent] = useState(false);
  const [refusal, setRefusal] = useState<Reason | null>(null);
  // Which control was pressed, for a hook that backs more than one. `null`
  // where there is only one, which is most of them.
  const [pressed, setPressed] = useState<string | null>(null);

  // One change at a time. A second press while the first is on its way would
  // send it again — two identical lines, where the user meant one — so it is
  // dropped. A ref rather than `saving`, which a second keypress in the same
  // tick would still read as false.
  const inFlight = useRef(false);

  function settle(result: ActionResult<Reason>, onDone?: () => void) {
    inFlight.current = false;
    setSent(false);
    setPressed(null);
    if (result.ok) onDone?.();
    else setRefusal(result.reason);
  }

  function run(
    action: () => Promise<ActionResult<Reason>>,
    onDone?: () => void,
    at?: string,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefusal(null);
    setPressed(at ?? null);
    if (send) {
      setSent(true);
      // Refused by the parent — it already has a change of its own in flight —
      // so nothing is waiting and nothing should say it is.
      if (!send(action, (result) => settle(result, onDone))) {
        inFlight.current = false;
        setSent(false);
        setPressed(null);
      }
      return;
    }
    startSaving(async () => {
      try {
        settle(await action(), onDone);
      } finally {
        // `settle` clears it on every answer; this is the throw, which would
        // otherwise leave the control unable to be pressed again.
        inFlight.current = false;
      }
    });
  }

  const busy = saving || sent;
  return {
    refusal,
    run,
    saving: busy,
    /** Whether *this* control is the one waiting. */
    busyAt: (at: string) => busy && pressed === at,
    clear: () => setRefusal(null),
  };
}

import { useState, useTransition } from "react";

/** What every server action here answers: done, or refused with a reason. */
export type ActionResult<Reason> = { ok: true } | { ok: false; reason: Reason };

/** Sends an action and hands its result back — a parent's, when the parent
 * owns the transition and the busy state around it. */
export type Send<Reason> = (
  action: () => Promise<ActionResult<Reason>>,
  onResult: (result: ActionResult<Reason>) => void,
) => void;

/**
 * A change on its way to the store, and the refusal it may come back with.
 *
 * Every control that calls a server action does the same three things around
 * it — clear the last refusal, send, then either keep the new one or run what
 * follows a success — so they do it once here. It holds no rule: every rule is
 * on the server, and this is the shape of asking.
 *
 * Given `send`, the action goes through it; without one, the hook runs its own
 * transition and `saving` says when it is under way.
 */
export function useAction<Reason>(send?: Send<Reason>) {
  const [saving, startSaving] = useTransition();
  const [refusal, setRefusal] = useState<Reason | null>(null);

  function settle(result: ActionResult<Reason>, onDone?: () => void) {
    if (result.ok) onDone?.();
    else setRefusal(result.reason);
  }

  function run(
    action: () => Promise<ActionResult<Reason>>,
    onDone?: () => void,
  ) {
    setRefusal(null);
    if (send) send(action, (result) => settle(result, onDone));
    else startSaving(async () => settle(await action(), onDone));
  }

  return { refusal, run, saving, clear: () => setRefusal(null) };
}

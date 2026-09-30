/**
 * What an action answers when it could not answer at all.
 *
 * **A fault is returned and never thrown**, which is not a style choice: React
 * rethrows a server action's error from its own dispatch, so a throw replaces
 * the whole screen with the framework's own English one before any control can
 * say anything. Anything the user must be shown is a return value — the
 * framework's own guidance, in
 * `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`.
 *
 * **It is not a refusal.** A refusal names a reason the user can act on and each
 * action has its own closed union of them, exhaustively switched; a fault has
 * nothing to name, so it is a third arm beside them rather than a member of any
 * of those unions. It carries no detail either: an error's message can hold a
 * worker id, a Postgres message or ciphertext, so none of it is passed on.
 *
 * **A transport failure is not this.** Offline, a 500, an aborted POST — the
 * request never reaches the server, so there is no return to carry a fault and
 * only an error boundary can answer it.
 */
export type ActionFault = { ok: false; fault: true };

/** The one value every guarded action answers with. `as const` rather than a
 * function, because there is nothing about one fault that differs from another. */
export const ACTION_FAULT: ActionFault = { ok: false, fault: true };

/**
 * Runs an action's body and turns anything it throws into a fault.
 *
 * It is the whole of the server half: a body that already answers a refusal goes
 * on answering it, and a body that throws answers a fault instead of taking the
 * screen down. `revalidatePath` and the rest stay inside the body, so nothing is
 * revalidated on a failure.
 */
export async function answering<T>(
  body: () => Promise<T>,
): Promise<T | ActionFault> {
  try {
    return await body();
  } catch {
    return ACTION_FAULT;
  }
}

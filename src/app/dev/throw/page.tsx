import { notFound } from "next/navigation";

/**
 * A page that throws, so the error boundary above it can be driven through a
 * browser (`e2e/error-boundary.spec.ts`).
 *
 * **It exists because no page *render* in the application can be made to throw
 * from the outside.** Every reachable cause the PRD lists is a refusal the
 * action returns (`actionFault.ts`), a 404 the route answers, or a failure of
 * the *layout*, which `error.tsx` deliberately never sees; the pages that read
 * an address or a query parse it and answer null rather than raising. A server
 * action can be made to throw — the spec does that too, with a lost worker —
 * but that lands on the boundary from the client, so a render that threw would
 * otherwise be the one path verified by reading the code that draws it, which
 * is the half already known (`CLAUDE.md` rule 8).
 *
 * **It is refused outside development**, exactly as the seeded stores and the
 * fixed-day cookie are (`store.ts`, `today.ts`) and for the same reason: an
 * address that takes the screen down is not one a family may reach. In
 * production it is a 404 like any other address the application does not have.
 *
 * **The message is deliberately shaped like a secret**, because what the test
 * asks of the boundary is that it prints nothing of it. A real one can carry a
 * worker id, a Postgres error or ciphertext — `todayFor` throws with the
 * cookie's own value in its message — and this stands in for all of them.
 */
export default async function ThrowPage() {
  if (process.env.NODE_ENV === "production") notFound();
  throw new Error(THROWN_MESSAGE);
}

/** Exported so the spec forbids this exact string rather than a guess at it. */
export const THROWN_MESSAGE =
  "worker 11111111-2222-3333-4444-555555555555 leaked-message-must-not-be-shown";

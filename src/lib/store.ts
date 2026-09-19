import { cookies } from "next/headers";
import {
  UnknownWorkerError,
  createInMemoryRepository,
} from "@/lib/engine/repository";
import type { SalaryRepository } from "@/lib/engine/repository";
import { devSeed, filedSeed } from "@/lib/dev/seed";
import { knownCaseSeed } from "@/lib/dev/known";
import { INVITATION_COOKIE, invitationToken } from "@/lib/invitationCookie";
import { createPostgresRepository } from "@/lib/supabase/repository";
import { supabaseOnServer } from "@/lib/supabase/server";

/**
 * The store a request talks to: the signed-in household's in Postgres, or a
 * seeded one in memory.
 *
 * **They are held on the server and nowhere else.** `specs.md` Part 3 is plain
 * about the boundary — all salary logic runs on the server and the browser only
 * collects facts and displays results — so a repository is reached from server
 * components and server actions, and the browser receives the calculated month
 * rather than the facts and an engine to run over them. Nothing here is
 * imported from a `"use client"` module, which is what keeps that true; there
 * is no `server-only` package in this repository to enforce it, and adding a
 * dependency to say what one import line already says is not worth the entry.
 *
 * **A store is a module singleton, so a mark survives a click and not a
 * restart.** `next dev` runs one process, so the marks made in a session are
 * still there when the page re-renders; they are gone when the server restarts,
 * which is the honest shape of an in-memory store and not a defect to work
 * around. The thing that outlives a restart is Postgres, and it substitutes
 * exactly here — `getRepository` is the only line in the
 * application that names an implementation.
 *
 * The singletons are hung off `globalThis` because `next dev` re-evaluates a
 * module on every edit: without it, saving a file would silently reset the
 * store mid-check and look like a mark that failed to save.
 */

/**
 * The households there are, by name.
 *
 * **Four, and three of them hold data.** The demo household is nine months of
 * 2026 chosen to be clicked at; the known case is August 2025, whose four
 * totals come from the family's own sheet (`specs.md` Part 4). They are kept
 * apart because mixing them would put the one month that means something into a
 * store whose whole point is that it means nothing — and an account holds no
 * more than two workers anyway (item 11), so a third worker was never the
 * shape. `filed` is the demo with two months confirmed and not exported, and
 * the last seed holds nobody; why each is here is said where it stands.
 */
const seeds = {
  demo: devSeed,
  known: knownCaseSeed,
  filed: filedSeed,
  /**
   * A household with nothing in it, which is what every new account is.
   *
   * **It is here so the browser suite can reach the state a real account starts
   * in.** The flow that adds a worker begins on a screen that exists only while
   * there is no worker, and the other two seeds both have one — so without this
   * the only household that could be added to is the live Postgres one, and a
   * spec that created a worker there would leave it behind on every run.
   */
  empty: {},
} as const;

type SeedName = keyof typeof seeds;

const DEFAULT_SEED: SeedName = "demo";

/** The cookie that names a seeded in-memory household in development. Without
 * it the request is in the signed-in person's household (`getRepository`). */
const HOUSEHOLD_COOKIE = "household";

const STORES = Symbol.for("easesalary.dev.repositories");

type Global = typeof globalThis & { [STORES]?: Map<string, SalaryRepository> };

/**
 * Which seed a household name is built from — everything before the first
 * hyphen, and the demo seed for a name that matches none.
 *
 * **The suffix is what gives a run its own store.** `known-e2e-7` is the known
 * case seeded fresh, separate from the `known` the user is clicking at, which
 * is what lets a browser spec sweep a range and open a month without leaving
 * that month behind in the store somebody else is looking at (`CLAUDE.md`
 * rule 9). A name nobody recognises is the demo household rather than an error:
 * this is a development store reached by a cookie anyone can set, and the
 * conservative answer to a name it does not know is the ordinary household.
 */
function seedOf(name: string): { seed: (typeof seeds)[SeedName]; key: string } {
  const head = name.split("-")[0];
  const known = head in seeds ? (head as SeedName) : DEFAULT_SEED;
  // Keyed by the whole name and not by the seed, so two names that share a seed
  // are two stores. Keyed by the *given* name, so an unrecognised one gets its
  // own demo household rather than sharing the default's.
  return { seed: seeds[known], key: name };
}

/**
 * The store this request's household is kept in.
 *
 * **This is the substitution point**, and it is the only line in the
 * application that names an implementation. Every caller awaits a
 * `SalaryRepository` and none of them knows or can know which one it got.
 *
 * **The signed-in person's household is the answer, and a seeded store is the
 * exception.** A request with no `household` cookie reads and writes Postgres
 * under that person's own session, so row-level security is what decides which
 * rows exist. A request that carries the cookie gets an in-memory household
 * built from a seed — which is how the browser suite works, since every spec in
 * `e2e/` opens a store of its own by naming one (`e2e/household.ts`), and how
 * the known case of `specs.md` Part 4 is reached.
 *
 * **The seeded stores are refused outside development**, and the check is the
 * whole reason the cookie is safe: it is set by the browser and anyone can set
 * it, so in production a person who set it would otherwise be handed a store
 * that belongs to nobody and outlives no restart. There, the cookie is ignored
 * and the household is the one the session says it is.
 */
export async function getRepository(): Promise<SalaryRepository> {
  const name = (await cookies()).get(HOUSEHOLD_COOKIE)?.value;

  if (name === undefined || process.env.NODE_ENV === "production") {
    return householdRepository();
  }

  const { seed, key } = seedOf(name);

  const holder = globalThis as Global;
  holder[STORES] ??= new Map();
  const existing = holder[STORES].get(key);
  if (existing !== undefined) return existing;

  const created = createInMemoryRepository(seed);
  holder[STORES].set(key, created);
  return created;
}

/** The worker an action names, or a throw. Actions are reachable by a crafted
 * request, so the id is checked against the household's own store rather than
 * assumed. */
export async function requireWorker(
  workerId: string,
  repository?: SalaryRepository,
) {
  const profile = await (repository ?? (await getRepository())).getWorker(workerId);
  if (profile === null) throw new UnknownWorkerError(workerId);
  return profile;
}

/**
 * The household the signed-in person belongs to, and the store that keeps it.
 *
 * **A person in two households sees both households' workers side by side**
 * (criterion 11: someone may keep their own caregiver and help with a parent's),
 * because row-level security returns every worker they can reach and the
 * switcher lists them all. The oldest household is only where something new is
 * put — a worker they create, a fetched rate — and each existing worker is
 * written back to her own household (`createPostgresRepository`).
 */
async function householdRepository(): Promise<SalaryRepository> {
  const client = await supabaseOnServer();

  const {
    data: { user },
  } = await client.auth.getUser();
  if (user === null) throw new NotSignedInError();

  // **An invitation link opened while signed in is accepted here** (specs.md
  // item 11). The proxy sends a signed-in person past the sign-in screen, so the
  // first page after the link is where they join. Only the link's own token
  // accepts — signing in alone joins nothing, or any member could pull a
  // stranger's address into their household.
  await acceptInvitationFromCookie(client);

  return createPostgresRepository(client, await householdIdOf(client));
}

/**
 * Accept the invitation whose link this browser opened, if any
 * (`invitationCookie.ts`). The database matches the token against the caller's
 * own confirmed address, so a token that is not theirs accepts nothing. The
 * cookie is left for `acceptInvitation` to clear, since a server component
 * cannot write one; accepting it twice joins nothing more.
 */
export async function acceptInvitationFromCookie(
  client: Awaited<ReturnType<typeof supabaseOnServer>>,
): Promise<void> {
  const token = invitationToken((await cookies()).get(INVITATION_COOKIE)?.value);
  if (token === null) return;
  await client.rpc("accept_household_invitation", { invitation_token: token });
}

/**
 * The household a signed-in person is working in: the first they joined.
 *
 * Exported so the invitation actions invite into the same household every
 * screen shows, rather than deciding "your household" a second way.
 */
export async function householdIdOf(
  client: Awaited<ReturnType<typeof supabaseOnServer>>,
): Promise<string> {
  const { data, error } = await client
    .from("household_members")
    .select("household_id")
    .order("joined_at")
    .limit(1)
    .maybeSingle();
  if (error !== null) {
    throw new Error(`could not read the household: ${error.message}`);
  }
  if (data === null) throw new NoHouseholdError();
  return data.household_id as string;
}

/**
 * Reached by a request the proxy should already have sent to `/sign-in`.
 *
 * It is thrown rather than answered with an empty household, because an empty
 * household is a screen saying this family has no workers — which is a sentence
 * about their data and not about their session, and is the wrong thing to tell
 * someone whose session merely expired.
 */
export class NotSignedInError extends Error {
  constructor() {
    super("No session behind this request");
    this.name = "NotSignedInError";
  }
}

/**
 * Signed in, and a member of no household.
 *
 * The sign-in screen creates one on the first sign-in and the database makes the
 * creator its first member in the same transaction (migration 1), so this is a
 * state the application does not produce. It is thrown rather than papered over
 * for that reason: if it is ever seen, something upstream failed and the
 * household the person then filled in would be one nobody could reach.
 */
class NoHouseholdError extends Error {
  constructor() {
    super("Signed in, but a member of no household");
    this.name = "NoHouseholdError";
  }
}

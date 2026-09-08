import { cookies } from "next/headers";
import { createInMemoryRepository } from "@/lib/engine/repository";
import type { SalaryRepository } from "@/lib/engine/repository";
import { devSeed } from "@/lib/dev/seed";
import { knownCaseSeed } from "@/lib/dev/known";

/**
 * The stores the running application talks to until stage 3 lands the real one
 * beside it.
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
 * around. The thing that outlives a restart is stage 3's Postgres, and it
 * substitutes exactly here — `getRepository` is the only line in the
 * application that names an implementation.
 *
 * The singletons are hung off `globalThis` because `next dev` re-evaluates a
 * module on every edit: without it, saving a file would silently reset the
 * store mid-check and look like a mark that failed to save.
 */

/**
 * The households there are, by name.
 *
 * **Two, because one of them is the case the whole application is checked
 * against** (`specs.md` Part 4) and it cannot live inside the other: the demo
 * household is nine months of 2026 chosen to be clicked at, and August 2025 is
 * a month whose four totals come from the family's own sheet. Mixing them would
 * put the one month that means something into a store whose whole point is that
 * it means nothing, and an account holds no more than two workers anyway
 * (item 11) — so a third worker was never the shape.
 */
const seeds = {
  demo: devSeed,
  known: knownCaseSeed,
} as const;

type SeedName = keyof typeof seeds;

const DEFAULT_SEED: SeedName = "demo";

/** The cookie that says which household the request is in. Stage 3 replaces it
 * with the household the signed-in person belongs to, which is the same
 * question asked of an identity rather than of the browser. */
export const HOUSEHOLD_COOKIE = "household";

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
 * It is asynchronous because reading a cookie is, and because stage 3's answer —
 * the household the signed-in person belongs to — is a query. Every caller is
 * already in an async function, so the shape is the one that survives the
 * substitution rather than the one that is convenient now.
 */
export async function getRepository(): Promise<SalaryRepository> {
  const name = (await cookies()).get(HOUSEHOLD_COOKIE)?.value ?? DEFAULT_SEED;
  const { seed, key } = seedOf(name);

  const holder = globalThis as Global;
  holder[STORES] ??= new Map();
  const existing = holder[STORES].get(key);
  if (existing !== undefined) return existing;

  const created = createInMemoryRepository(seed);
  holder[STORES].set(key, created);
  return created;
}

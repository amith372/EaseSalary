import { createInMemoryRepository } from "@/lib/engine/repository";
import type { SalaryRepository } from "@/lib/engine/repository";
import { devSeed } from "@/lib/dev/seed";

/**
 * The one store the running application talks to until stage 3 lands the real
 * one beside it.
 *
 * **It is held on the server and nowhere else.** `specs.md` Part 3 is plain
 * about the boundary — all salary logic runs on the server and the browser only
 * collects facts and displays results — so the repository is reached from
 * server components and server actions, and the browser receives the calculated
 * month rather than the facts and an engine to run over them. Nothing here is
 * imported from a `"use client"` module, which is what keeps that true; there
 * is no `server-only` package in this repository to enforce it, and adding a
 * dependency to say what one import line already says is not worth the entry.
 *
 * **It is a module singleton, so a mark survives a click and not a restart.**
 * `next dev` runs one process, so the marks made in a session are still there
 * when the page re-renders; they are gone when the server restarts, which is
 * the honest shape of an in-memory store and not a defect to work around. The
 * thing that outlives a restart is stage 3's Postgres, and it substitutes
 * exactly here — `getRepository` is the only line in the application that names
 * an implementation.
 *
 * The singleton is hung off `globalThis` because `next dev` re-evaluates a
 * module on every edit: without it, saving a file would silently reset the
 * store mid-check and look like a mark that failed to save.
 */

const STORE = Symbol.for("easesalary.dev.repository");

type Global = typeof globalThis & { [STORE]?: SalaryRepository };

export function getRepository(): SalaryRepository {
  const holder = globalThis as Global;
  holder[STORE] ??= createInMemoryRepository(devSeed);
  return holder[STORE];
}

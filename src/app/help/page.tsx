import { connection } from "next/server";
import { HelpScreen } from "@/components/HelpScreen";
import { getRepository } from "@/lib/store";

/**
 * `/help` — `EaseSalary - עזרה` (specs.md item 24).
 *
 * **It reads nothing about the account**, and that is the whole shape of this
 * route: no worker, no month, no replay, so it cannot be taken off the screen by
 * a refused month and needs no gender to write a sentence with. What it fetches
 * is the stage 5 page cache, which belongs to the household only in where it is
 * stored — it is Kol Zchut's text, the same for everyone.
 *
 * **A clone that has never scraped gets an empty list and a working screen.**
 * The matcher answers from the registry alone (`match.ts`), so the cache widens
 * what a question can reach and is never what makes it reachable.
 *
 * `connection()` keeps it out of the prerender, because the cache is live.
 */
export default async function HelpPage() {
  await connection();
  const repository = await getRepository();
  const pages = await repository.listCachedPages();
  return <HelpScreen pages={pages} />;
}

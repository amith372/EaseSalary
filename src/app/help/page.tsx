import { connection } from "next/server";
import { HelpScreen } from "@/components/HelpScreen";
import { getRepository } from "@/lib/store";

/**
 * `/help` — `EaseSalary - עוזר דיגיטלי` (specs.md item 24).
 *
 * **What it reads about the account is the worker names and nothing else.**
 * They join the matcher's corpus, so a question naming one of them is answered
 * for that worker (item 24); the months, the terms and the figures are read
 * only when a question asks for them, and then on the server, by the action the
 * conversation calls (`answerFromAccount`). So this screen still cannot be
 * taken off the air by a refused month and still needs no gender to write a
 * sentence with.
 *
 * **A clone that has never scraped gets an empty cache and a working screen.**
 * The matcher answers from the registry alone (`match.ts`), so the stage 5
 * pages widen what a question can reach and are never what makes it reachable.
 *
 * `connection()` keeps it out of the prerender, because both reads are live.
 */
export default async function HelpPage() {
  await connection();
  const repository = await getRepository();
  const [pages, workers] = await Promise.all([
    repository.listCachedPages(),
    repository.listWorkers(),
  ]);
  return (
    <HelpScreen pages={pages} names={workers.map((worker) => worker.firstName)} />
  );
}

import type { SalaryRepository } from "@/lib/engine/repository";
import type { Scraped } from "@/lib/scrape/failure";
import type { CachedPage } from "@/lib/scrape/pageSections";

/**
 * Keeps the text a fetch read, beside the figure taken from it (specs.md
 * Part 3).
 *
 * **It cannot fail the refresh that called it.** The figure is the load-bearing
 * half of a fetch and the corpus is not: a month is valued, confirmed and
 * exported without a single page ever having been stored, while a rate that was
 * read and then lost costs the user a manual entry. So a refused write is
 * swallowed here rather than thrown at a screen that was only asking for a
 * wage — the page is read again tomorrow, and nothing in between behaves
 * differently.
 *
 * **A page that did not arrive, or whose article body could not be segmented,
 * stores nothing** and leaves whatever was stored before it standing, which is
 * the same degradation the rates have: a broken source never replaces what is
 * known with less.
 */
export async function keepPageText(
  repository: SalaryRepository,
  text: Scraped<CachedPage> | null,
): Promise<void> {
  if (text === null || !text.ok) return;
  try {
    await repository.saveCachedPage(text.value);
  } catch {
    // Deliberately silent, for the reason above. There is no logger in this
    // layer, and a failure here is invisible to the user by design.
  }
}

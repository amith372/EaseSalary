/**
 * The three ways a scrape ends without an answer, which are the three Part 4
 * requires each source page to be checked against.
 *
 * They are three and not one because the user is told which happened: a source
 * that could not be reached may work in a minute, markup that moved is a defect
 * in this application, and a value outside the plausible range means the page
 * was read and disbelieved. Collapsing them into "the fetch failed" would tell
 * the user nothing about whether to retry.
 *
 * They live in a file of their own rather than in the first scrape that needed
 * them, because every scrape answers in the same three kinds and the second one
 * would otherwise import them from the first — which reads as the holiday list
 * depending on the minimum wage, and it does not.
 *
 * - `unreachable` — no response, an error status, or an empty body.
 * - `notFound` — the page arrived and what was looked for is not in it.
 * - `implausible` — it was read, and it is outside the range the application's
 *   own stored history allows.
 */
export type ScrapeFailureKind = "unreachable" | "notFound" | "implausible";

/**
 * A failure a caller can act on.
 *
 * `detail` is English and is for a log and for a test, never for a screen: the
 * sentence the user reads is Hebrew and is chosen from `kind` in the
 * translations file, so a failure never reaches her as a message a scrape wrote
 * (CLAUDE.md: every user-facing string Hebrew, in one file).
 */
export interface ScrapeFailure {
  kind: ScrapeFailureKind;
  detail: string;
}

/** A scrape's answer: the thing it went for, or why it has none. */
export type Scraped<T> =
  | { ok: true; value: T }
  | { ok: false; failure: ScrapeFailure };

export function scrapeFailed<T>(
  kind: ScrapeFailureKind,
  detail: string,
): Scraped<T> {
  return { ok: false, failure: { kind, detail } };
}

/**
 * The request half of every scrape, and nothing else — everything that can be
 * got wrong lives in the parse the caller hands in, where a saved page can be
 * given to it instead.
 *
 * `fetchImpl` is injected so the suite never reaches the network (Part 4). A
 * thrown request and an error status are the same answer to the caller, because
 * they are the same thing to the user: the source did not give us a page.
 */
export async function fetchPage(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Scraped<string>> {
  let response: Response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    return scrapeFailed(
      "unreachable",
      error instanceof Error ? error.message : "request failed",
    );
  }
  if (!response.ok) {
    return scrapeFailed("unreachable", `status ${response.status}`);
  }
  return { ok: true, value: await response.text() };
}

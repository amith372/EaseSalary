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
 * translations file, so a failure never reaches them as a message a scrape wrote
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
 * How long a source is given to answer before the scrape is given up on
 * (specs.md Part 3: a slow or broken source never delays a screen).
 *
 * **A source that never answers is a source that is down**, and the difference
 * to the user is only how long they wait to be told so. Five seconds is the
 * figure because the screens that scrape draw a figure the application already
 * holds: the cached rate is right until the statute changes, so the whole value
 * of waiting is the day the page has been rewritten — and against that, a
 * pre-export screen that hangs on a government site is the one failure that
 * stops the family filing at all.
 *
 * **It bounds one request and not a screen's whole work.** The pre-export
 * screen reads up to three pages, the two tax ones only on a day's staleness,
 * so a day when every source is down costs three of these one after another.
 */
export const SCRAPE_TIMEOUT_MS = 5000;

/**
 * The request half of every scrape, and nothing else — everything that can be
 * got wrong lives in the parse the caller hands in, where a saved page can be
 * given to it instead.
 *
 * `fetchImpl` is injected so the suite never reaches the network (Part 4). A
 * thrown request, a request that ran out of time, and an error status are the
 * same answer to the caller, because they are the same thing to the user: the
 * source did not give us a page. So is an empty body — a 200 that carried
 * nothing, which is what a site mid-deploy or behind a stripping proxy serves —
 * and it is refused here once rather than by every parse.
 *
 * **The status is judged before the body is read, and that order is a rule.**
 * A site behind a bot challenge does not serve an empty 200: it serves an error
 * status carrying a well-formed page of ordinary size, which is what
 * kolzchut.org.il has served this application since 2026-10-01. Read the body
 * first and that page becomes one the parse can find no wage in — reported as
 * `notFound`, a defect in this application, when it is in fact a source to
 * retry — and its text is kept and shown as though it were the statute.
 * `minimumWage.test.ts` holds the challenge page and proves this order.
 *
 * **The timeout is asked of the signal and not of the error**, because what a
 * runtime throws on an abort differs between them and an injected `fetchImpl`
 * may throw anything at all: `signal.aborted` is the one answer that is the
 * same everywhere. **The body is read inside the same attempt**, since a source
 * that answers and then trickles is a source that did not give us a page either,
 * and the signal covers both halves.
 */
export async function fetchPage(
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = SCRAPE_TIMEOUT_MS,
): Promise<Scraped<string>> {
  const signal = AbortSignal.timeout(timeoutMs);
  let body: string;
  try {
    const response = await fetchImpl(url, { signal });
    if (!response.ok) {
      return scrapeFailed("unreachable", `status ${response.status}`);
    }
    body = await response.text();
  } catch (error) {
    if (signal.aborted) {
      return scrapeFailed("unreachable", `no answer within ${timeoutMs}ms`);
    }
    return scrapeFailed(
      "unreachable",
      error instanceof Error ? error.message : "request failed",
    );
  }
  if (body.trim() === "") return scrapeFailed("unreachable", "empty body");
  return { ok: true, value: body };
}

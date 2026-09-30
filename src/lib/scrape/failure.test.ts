import { describe, expect, it } from "vitest";
import { fetchPage, SCRAPE_TIMEOUT_MS } from "@/lib/scrape/failure";

/**
 * The request half every scrape shares. The three ways a source can fail to
 * give a page are tested here once, not once per scraper: each scraper hands
 * its request to `fetchPage` and parses only what it returns.
 */

const responding = (body: string, status = 200): typeof fetch =>
  (async () => new Response(body, { status })) as unknown as typeof fetch;

const kindOf = (result: Awaited<ReturnType<typeof fetchPage>>) =>
  result.ok ? "ok" : result.failure.kind;

describe("fetchPage", () => {
  it("hands back the body the source served", async () => {
    const result = await fetchPage("https://example.org", responding("<p>שכר</p>"));
    expect(result).toEqual({ ok: true, value: "<p>שכר</p>" });
  });

  it("reports a request that threw as unreachable", async () => {
    const throwing = (async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    }) as unknown as typeof fetch;
    expect(kindOf(await fetchPage("https://example.org", throwing))).toBe(
      "unreachable",
    );
  });

  it("reports an error status as unreachable", async () => {
    expect(
      kindOf(await fetchPage("https://example.org", responding("<p>x</p>", 503))),
    ).toBe("unreachable");
  });

  /**
   * **A source that never answers is given up on** (specs.md Part 3: a slow or
   * broken source never delays a screen). The fake below honours the signal as
   * a real `fetch` does and answers in no other way, so the only thing that can
   * end this test is the timeout — which is what makes it a test rather than a
   * demonstration: without one it does not fail, it hangs, and the suite times
   * out on the file.
   *
   * **What it would catch**: the signal not being passed to the request at all,
   * and the abort being reported as something other than a source that gave us
   * no page — the sentence the user reads is chosen from the kind, so a
   * `notFound` here would tell them the application's parsing is broken when the
   * source is merely down.
   */
  it("gives up on a source that never answers, and calls it unreachable", async () => {
    const silent = ((_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      })) as unknown as typeof fetch;

    const started = Date.now();
    const result = await fetchPage("https://example.org", silent, 20);
    expect(kindOf(result)).toBe("unreachable");
    expect(result.ok ? "" : result.failure.detail).toContain("20ms");
    // The wait is the timeout's and not the default's, which is the property a
    // screen depends on: it is bounded by the figure it was given.
    expect(Date.now() - started).toBeLessThan(SCRAPE_TIMEOUT_MS);
  });

  /** A body that arrives and then stops is a source that gave us no page
   * either, and the same signal covers it. */
  it("reports a body that never finishes as unreachable", async () => {
    const trickling = ((_url: string, init?: { signal?: AbortSignal }) =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          }),
      })) as unknown as typeof fetch;

    const result = await fetchPage("https://example.org", trickling, 20);
    expect(kindOf(result)).toBe("unreachable");
  });

  it("reports an empty body as unreachable, whitespace included", async () => {
    // A 200 that carried nothing is a source that gave no page, not a page
    // whose markup moved — the user may retry it in a minute.
    expect(kindOf(await fetchPage("https://example.org", responding("")))).toBe(
      "unreachable",
    );
    expect(
      kindOf(await fetchPage("https://example.org", responding(" \n\t "))),
    ).toBe("unreachable");
  });
});

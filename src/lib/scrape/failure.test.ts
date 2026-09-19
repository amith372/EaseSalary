import { describe, expect, it } from "vitest";
import { fetchPage } from "@/lib/scrape/failure";

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

import { describe, expect, it, vi } from "vitest";
import ThrowPage, { THROWN_MESSAGE } from "./page";

/**
 * The gate on the one address in the application that exists to fail.
 *
 * The page is test scaffolding: it is what drives `error.tsx` through a browser,
 * because nothing the interface can reach makes a *page* throw. That makes the
 * gate the only thing standing between it and a family, and a gate nobody
 * checks is a gate that has never been closed. The seeded stores and the fixed
 * day are refused in production the same way (`store.ts`, `today.ts`).
 */
describe("the throwing page", () => {
  it("throws outside production, which is what the error boundary is driven with", async () => {
    await expect(ThrowPage()).rejects.toThrow(THROWN_MESSAGE);
  });

  it("is a 404 in production and not a screen that fails", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      // `notFound()` raises, so this is still a rejection — but not the thrown
      // message, which is the whole distinction. Next's own digest is what
      // names it, and it is read rather than matched on wording.
      await expect(ThrowPage()).rejects.toMatchObject({
        digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404"),
      });
      await expect(ThrowPage()).rejects.not.toThrow(THROWN_MESSAGE);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

import { defineConfig } from "vitest/config";

/**
 * The checks that need the live database, which the ordinary suite may never
 * hold.
 *
 * `specs.md` Part 4 is plain that the suite reads saved files and never the
 * network, and `vitest.config.ts` keeps that true by including `src/**` alone.
 * A check of the Postgres repository is worth exactly nothing asked of anything
 * but Postgres, though — the mapping it performs is a set of column names, and
 * a wrong one type-checks — so it lives here and is run by hand, the way
 * `scripts/check-household-isolation.mjs` is:
 *
 *   npx vitest run --config vitest.live.config.ts
 *
 * Two configs rather than a tag on one, so that nothing an agent or a hook runs
 * by habit can reach the network.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["scripts/**/*.live.test.ts"],
    // A round trip to a hosted database is slower than anything in the unit
    // suite, and a timeout tuned for pure functions would fail on the network
    // rather than on the rule.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // One account, one household, shared by the file. Running its tests in
    // parallel would have them writing over each other's worker.
    fileParallelism: false,
  },
});

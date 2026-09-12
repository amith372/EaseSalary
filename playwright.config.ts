import { defineConfig, devices } from "@playwright/test";

// The signed-in state the whole run starts from. It is written out here and in
// `e2e/auth.setup.ts` rather than imported from there: the config imports the
// setup file, Playwright loads the config before it knows about tests, and a
// `test()` call reached that way is refused outright.
const STATE_FILE = "e2e/.auth/state.json";

// `next dev` reads `.env` for itself; this process does not, and the setup
// project below needs the project's address and its service-role key to make
// the account it signs in with. Missing is not fatal here — the setup project
// is where it is reported, in a sentence that says which two names to fill in.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env; the setup project says so when it runs.
}

/**
 * Browser verification of the important user-facing flows (`CLAUDE.md` rules
 * 9–12, `specs.md` Part 4, "Verifying through the browser").
 *
 * These specs live in `e2e/` and not in `src/`, so `npm test` — which includes
 * `src/**` only — keeps running the calculation suite alone. They are two
 * different checks with two different costs: the unit suite gates every commit
 * through `hooks/pre-commit`, and this one is run when a user-facing flow
 * changed.
 */
export default defineConfig({
  testDir: "./e2e",

  // A flow assembled from unit tests that each pass is a flow nobody has
  // performed, so a failure here is never retried into a pass: a flaky salary
  // figure is a wrong salary figure.
  retries: 0,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    // Evidence at meaningful checkpoints rather than after every click
    // (`CLAUDE.md` rule 12): a screenshot on failure, and a trace of the run
    // that failed, which is what says *which* step moved the figure.
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
    // The application is Hebrew and right-to-left, and the browser is told so:
    // a run under an English locale would not reproduce the bidi reordering
    // Part 5 warns about, which is one of the failures only a browser can see.
    locale: "he-IL",
    // Israel, so a date built in local time and a date built in UTC differ by a
    // whole day across the daylight-saving boundary. Pinning it here is what
    // makes "how many rest days does this month have" reproducible.
    timezoneId: "Asia/Jerusalem",
  },

  projects: [
    // One sign-in for the whole run, through the real screen. Every spec below
    // starts from the session it leaves behind, because the proxy sends an
    // unauthenticated request to `/sign-in` from every address.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STATE_FILE },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    // The dev server is single-instance: a second `next dev` is refused. Reusing
    // the one already running is therefore not an optimisation but the only way
    // these specs run on a machine where the app is already up.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});

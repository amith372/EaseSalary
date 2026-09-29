import type { Metadata } from "next";
import { Assistant } from "next/font/google";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { AppShell } from "@/components/AppShell";
import { bellOf, householdAlerts, type BellView } from "@/lib/alertsView";
import { WORKER_COOKIE } from "@/lib/workerCookie";
import { getRepository, NotSignedInError } from "@/lib/store";
import type { Worker } from "@/lib/types";
import { he } from "@/lib/i18n/he";
import "./globals.css";

const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

/**
 * The hand-written face of the home calendar's slogan (`CalendarBand`).
 *
 * **Served from the repo, not from Google Fonts**, because `next/font/google`
 * has no precalculated fallback metrics for this family and Turbopack's loader
 * logs `Failed to find font override values` on every `next dev` whatever it
 * is passed. The local loader measures the file itself, so it builds the
 * fallback the Google one could not. The file is Google Fonts' Hebrew subset,
 * the only one the slogan uses; its licence (SIL OFL 1.1) sits beside it and
 * must travel with it.
 */
const gveretLevin = localFont({
  src: "./fonts/GveretLevin-hebrew.woff2",
  variable: "--font-gveret-levin",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: he.app.name,
  description: he.app.description,
};

/**
 * **The layout reads the household's workers**, because the switcher that names
 * one lives in the bar and the id it holds is the id every write action is made
 * against (`AppShell`). Reading them here rather than on each screen is what
 * keeps the shell and the screens looking at one household: there is one bar,
 * so there is one read.
 *
 * It makes every route dynamic, which they already are — the store is a live
 * value and `readToday()` reads a clock, so a page rendered at build time
 * would show the household as it stood when the build ran.
 */
/**
 * The workers the bar's switcher offers and the bell, and neither for a
 * request with nobody behind it.
 *
 * **The layout wraps `/sign-in` too**, which is a route reached precisely when
 * there is no session — so the store has no household to answer for, and it says
 * so by raising rather than by handing back an empty list that would read as a
 * family with no workers. Caught here and nowhere else: every other caller is on
 * a screen the proxy has already refused an unauthenticated request to, so one
 * arriving there is a fault and should be seen as one.
 */
async function whatTheBarShows(): Promise<{ workers: Worker[]; bell: BellView | null }> {
  try {
    const repository = await getRepository();
    const [profiles, bell] = await Promise.all([
      repository.listWorkers(),
      theBell(),
    ]);
    return {
      workers: profiles.map(({ id, name, firstName, gender }) => ({
        id,
        name,
        firstName,
        gender,
      })),
      bell,
    };
  } catch (error) {
    if (error instanceof NotSignedInError) return { workers: [], bell: null };
    throw error;
  }
}

/**
 * The bell.
 *
 * **A household the engine refuses still has screens that work**, and the bar
 * is drawn on every page — `/settings` included, which is where a term that
 * caused a refusal is put right, so a refusal reaching this far would be a
 * household with no way back in. It cannot: the replay carries a refusal back
 * on the worker it belongs to rather than throwing (`householdSeries.ts`), and
 * `alertsView` leaves that worker out of the count. The bell then says what the
 * rest of the household has to do, which for a household of two is the other
 * worker's whole list.
 */
async function theBell(): Promise<BellView | null> {
  return bellOf(await householdAlerts());
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { workers, bell } = await whatTheBarShows();
  // The switcher's choice, read here so the first render is already the
  // chosen worker (`WorkerScope`).
  const initialWorkerId = (await cookies()).get(WORKER_COOKIE)?.value;

  return (
    // The whole document is Hebrew and right-to-left. Nothing below sets a
    // direction of its own: layout uses logical properties, and a leaf whose
    // text may arrive translated carries dir="auto" so English resolves
    // left-to-right without the layout moving.
    <html lang="he" dir="rtl" className={`${assistant.variable} ${gveretLevin.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell workers={workers} initialWorkerId={initialWorkerId} bell={bell}>{children}</AppShell>
      </body>
    </html>
  );
}

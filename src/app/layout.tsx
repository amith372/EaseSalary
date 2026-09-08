import type { Metadata } from "next";
import { Assistant } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { getRepository } from "@/lib/dev/store";
import { he } from "@/lib/i18n/he";
import "./globals.css";

const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700"],
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
 * value and `todayInIsrael()` is a clock, so a page rendered at build time
 * would show the household as it stood when the build ran.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const workers = (await (await getRepository()).listWorkers()).map(
    ({ id, name, firstName }) => ({ id, name, firstName }),
  );

  return (
    // The whole document is Hebrew and right-to-left. Nothing below sets a
    // direction of its own: layout uses logical properties, and a leaf whose
    // text may arrive translated carries dir="auto" so English resolves
    // left-to-right without the layout moving.
    <html lang="he" dir="rtl" className={`${assistant.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell workers={workers}>{children}</AppShell>
      </body>
    </html>
  );
}

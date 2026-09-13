import { connection } from "next/server";
import { HomeScreen } from "@/components/HomeScreen";
import { todayInIsrael } from "@/lib/today";

/**
 * The opening screen's route. It exists to read `today` on the server, so the
 * calendar opens on the current month without a component reading a clock
 * during a render. `connection()` keeps it out of the prerender, or the month
 * would be the one the build ran in.
 */
export default async function HomePage() {
  await connection();
  return <HomeScreen today={todayInIsrael()} />;
}

import { connection } from "next/server";
import { AlertsScreen } from "@/components/AlertsScreen";
import { householdAlerts } from "@/lib/alertsView";

/**
 * `/alerts` — `EaseSalary - התראות` (specs.md item 27): both lists for the whole
 * household, and what was handled in the last ninety days. `connection()` keeps
 * it out of the prerender: the store is live and `today` is a clock.
 */
export default async function AlertsPage() {
  await connection();
  const view = await householdAlerts();
  return <AlertsScreen view={view} />;
}

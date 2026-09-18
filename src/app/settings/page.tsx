import { connection } from "next/server";
import { SettingsScreen } from "@/components/SettingsScreen";
import type { Invitation, WorkerSettings } from "@/components/SettingsScreen";
import { getRepository } from "@/lib/store";
import { rateInForce } from "@/lib/datedRates";
import {
  monthlySickAccrual,
  seniorityYearOfCalendarYear,
  vacationDaysPerYear,
} from "@/lib/engine/balances";
import { holidayYear } from "@/lib/engine/holidayYear";
import { holidayAllowanceFor } from "@/lib/engine/leave";
import { recuperationDaysFor } from "@/lib/engine/recuperation";
import { fromIsoDate, monthOf } from "@/lib/dates";
import { readIdentifyingNumbers } from "@/lib/identifyingNumbers";
import { readToday } from "@/lib/requestToday";
import { supabaseOnServer } from "@/lib/supabase/server";

/**
 * `/settings` — `EaseSalary - הגדרות`: the terms of the employment, set once.
 *
 * **Every term is changed here and nowhere else** (the user, 2026-09-13). The
 * worker's page changed them from 2026-09-09 while this route did not exist;
 * they moved here when it did, and the page links to them.
 *
 * **Both workers are prepared, not only the one on screen**, exactly as
 * `/payments` and `/settings/holidays` do it: the switcher lives in the shell
 * and its choice is client state.
 *
 * **The figures in the "מחושב לפי החוק" rows are the engine's own functions**,
 * read here for the current calendar year and month, so this screen and the
 * month it values cannot disagree about what a year entitles her to.
 *
 * **Two of the artboard's rows are absent on purpose.** The medical-insurance
 * premium and the agency fee are payments, recorded on the month they were paid
 * on `/payments` (specs.md items 15, 16); a standing amount here would be a
 * second figure for one payment.
 */
/**
 * The household's invitations, pending and accepted (item 11), read through the
 * member's own session so the policies decide what is visible. An accepted one
 * stays listed so the member can see the person joined. Empty where there is no
 * session to read with, which is the in-memory store of the browser suite,
 * rather than an error on a screen that has more to show.
 */
async function householdInvitations(): Promise<Invitation[]> {
  try {
    const supabase = await supabaseOnServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("household_invitations")
      .select("id, email, token, accepted_at, invited_by")
      .order("created_at");
    return (data ?? []).map((row) => ({
      id: row.id as string,
      email: row.email as string,
      token: row.token as string,
      accepted: row.accepted_at !== null,
      sentByMe: user !== null && row.invited_by === user.id,
    }));
  } catch {
    return [];
  }
}

export default async function SettingsPage() {
  await connection();

  const today = await readToday();
  const year = fromIsoDate(today).getUTCFullYear();
  const month = monthOf(today);

  const repository = await getRepository();
  const rates = await repository.listRates();
  const minimumWage = rateInForce(rates, "minimumWage", month);
  const nationalInsurance = rateInForce(rates, "nationalInsurance", month);

  const workers = await repository.listWorkers();
  const household: WorkerSettings[] = await Promise.all(
    workers.map(async (profile) => {
      // The picker's own two figures, for the reason the worker's page gave
      // when it drew this row: the row and `/settings/holidays` must not be
      // able to disagree about how much of her year is chosen (item 10).
      const holidays = holidayYear(
        [],
        await repository.listSpans(profile.id),
        holidayAllowanceFor(profile.employedSince, year),
        year,
        profile.restDay,
      );
      return {
        profile,
        holidayDaysChosen: holidays.chosenDays,
        holidayAllowance: holidays.allowance,
        recuperationDays: recuperationDaysFor(
          profile.employedSince,
          profile.recuperationMonth,
          { year, month: profile.recuperationMonth },
        ),
        vacationDaysPerYear: vacationDaysPerYear(
          seniorityYearOfCalendarYear(profile.employedSince, year),
        ),
        // Opened on the server for the one screen that shows them (items 22,
        // 28), and handed to it beside the profile rather than on it.
        numbers: await readIdentifyingNumbers(repository, profile.id),
      };
    }),
  );

  return (
    <SettingsScreen
      invitations={await householdInvitations()}
      household={household}
      year={year}
      month={month}
      // A year's accrual at a balance nowhere near the ceiling (item 8).
      sickDaysPerYear={monthlySickAccrual(0) * 12}
      minimumWage={minimumWage}
      nationalInsurance={nationalInsurance}
    />
  );
}

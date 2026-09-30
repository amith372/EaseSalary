import { supabaseOnServer } from "@/lib/supabase/server";

/**
 * Who else can see a worker — what the `משותף/ת עם` chip on their card says
 * (specs.md item 11, the `העובדות` artboard).
 *
 * **It is an address and never a name.** A share is an invitation sent to an
 * email address; the account holds that address and nothing else about the
 * person, so the chip shows the address. Inventing a
 * name from the part before the `@` would put a word on the screen that nobody
 * chose and that the person may not answer to.
 *
 * **A share is the household's and not the worker's.** Accepting an invitation
 * makes the person a member, and a member sees every worker of that household —
 * so every worker of a shared household carries the same addresses, and a
 * household nobody joined carries none.
 *
 * **The caller's own address is left out.** The chip answers "who else", and a
 * member reading their own address back would learn nothing from it. It is also
 * the whole of what an invited member can see of the other side: the policy
 * shows them the household's invitations, which are addressed to them, and
 * never the address of the family that invited them — so a worker shared *into*
 * a person's view draws no chip for them.
 *
 * Empty where there is no session to read with — the in-memory store of the
 * browser suite — rather than an error on a screen that has more to show, which
 * is how `/settings` reads the same table.
 */
export async function sharedWith(): Promise<Map<string, string[]>> {
  const byWorker = new Map<string, string[]>();
  try {
    const supabase = await supabaseOnServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const [{ data: workers }, { data: invitations }] = await Promise.all([
      supabase.from("workers").select("id, household_id"),
      supabase
        .from("household_invitations")
        .select("household_id, email")
        .not("accepted_at", "is", null)
        .order("created_at"),
    ]);

    const mine = user?.email?.toLowerCase() ?? null;
    const byHousehold = new Map<string, string[]>();
    for (const row of invitations ?? []) {
      const email = row.email as string;
      if (email.toLowerCase() === mine) continue;
      const household = row.household_id as string;
      byHousehold.set(household, [...(byHousehold.get(household) ?? []), email]);
    }
    for (const row of workers ?? []) {
      const emails = byHousehold.get(row.household_id as string);
      if (emails !== undefined) byWorker.set(row.id as string, emails);
    }
  } catch {
    return byWorker;
  }
  return byWorker;
}

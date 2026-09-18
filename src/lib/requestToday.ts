import { cookies } from "next/headers";
import { TODAY_COOKIE, todayFor } from "@/lib/today";
import type { IsoDate } from "@/lib/types";

/**
 * Today for this request, read on the server and handed down as a value.
 *
 * Kept apart from `today.ts` because that file is imported by the engine and by
 * the browser suite, neither of which has a request to read a cookie from.
 */
export async function readToday(): Promise<IsoDate> {
  const fixed = (await cookies()).get(TODAY_COOKIE)?.value;
  return todayFor(fixed, process.env.NODE_ENV === "production");
}

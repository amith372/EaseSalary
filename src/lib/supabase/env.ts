/**
 * The two values every Supabase client here is built from.
 *
 * They are read in one place so that a missing one fails with a sentence rather
 * than with `undefined` handed to a constructor, which surfaces much later as a
 * request to the address `undefined/auth/v1/token` and reads like a network
 * fault.
 *
 * The publishable key reaches the browser by design and is safe there **only
 * because row-level security stands behind it**: it identifies the project, not
 * the person. The service-role key is not read here and is not read by anything
 * a browser loads.
 */
export function supabaseEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set; see .env.example",
    );
  }

  return { url, publishableKey };
}

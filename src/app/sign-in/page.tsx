import type { Metadata } from "next";
import { SignInScreen } from "@/components/SignInScreen";
import { he } from "@/lib/i18n/he";

export const metadata: Metadata = {
  title: `${he.signIn.signInTitle} · ${he.app.name}`,
};

/**
 * `/sign-in` — the one route that draws no nav tab, because the shell is not
 * around it. Everything else
 * redirects here when there is no session, which is what `src/proxy.ts` does.
 */
export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  // An invitation link names the address to open the account with (item 11).
  const { invite } = await searchParams;
  return (
    <SignInScreen invitedEmail={typeof invite === "string" ? invite : undefined} />
  );
}

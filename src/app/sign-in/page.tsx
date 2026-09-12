import type { Metadata } from "next";
import { SignInScreen } from "@/components/SignInScreen";
import { he } from "@/lib/i18n/he";

export const metadata: Metadata = {
  title: `${he.signIn.signInTitle} · ${he.app.name}`,
};

/**
 * `/sign-in` — the one route that draws no nav tab, because the shell is not
 * around it (build_plan.md stage 3, the sign-in step). Everything else
 * redirects here when there is no session, which is what `src/proxy.ts` does.
 */
export default function SignInPage() {
  return <SignInScreen />;
}

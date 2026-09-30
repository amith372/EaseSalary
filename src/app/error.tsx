"use client";

import Link from "next/link";
import { Card } from "@/components/Card";
import { Chevron } from "@/components/icons";
import { he } from "@/lib/i18n/he";

/**
 * A screen whose render threw — the fault that took the page rather than one
 * control.
 *
 * **Two things reach it.** A *render* that threw — the store unreachable, a
 * worker gone from under a page that had already begun drawing, a rotated key.
 * And a server action that threw rather than returning a fault, which the
 * eight actions with no slot to carry one still do (`src/lib/actionFault.ts`):
 * React rethrows those from its own dispatch, past every `catch` around the
 * awaited call, and this is where they land. Both cost the whole page, which is
 * why an action that *can* answer a fault at its control does that instead.
 *
 * **It says the same sentence as the inline fault**, because a fault is a fault
 * wherever it lands and two wordings for one thing would be two things to
 * learn. What differs is only how much of the screen is gone.
 *
 * **It renders `error.message` nowhere, and nothing may be added that does.** A
 * message can carry a worker id, a Postgres error, a decrypted field or
 * ciphertext — `todayFor` alone throws with the cookie's own value in it — and
 * the screen it would be printed on is the one a family is looking at.
 *
 * **There is no retry button**, which the user settled on 2026-09-27. The
 * boundary's prop for it is `retry` in Next 16 and not `reset`, the name a
 * model trained on Next 14 writes — and a `reset` prop is accepted silently and
 * simply never fires, so a button wired to it would be a control that does
 * nothing. It is left out rather than got wrong: reloading is the same act and
 * the sentence already asks for it.
 *
 * `error.tsx` catches a *page* that threw and never the root layout, which has
 * no parent boundary to bubble to — `global-error.tsx` is that one.
 */
export default function ErrorScreen() {
  return (
    <div className="mx-auto flex w-full max-w-[860px] min-w-0 flex-col gap-3">
      <Card
        radius="lg"
        data-role="fault-screen"
        className="flex min-w-0 flex-none flex-col gap-2 px-4.5 py-3.5"
      >
        {/* The page's own heading: what would have been the screen is gone, so
            there is nothing above this for it to sit under. */}
        <h1
          data-role="fault-screen-message"
          dir="auto"
          className="text-[17px] leading-[1.4] font-semibold text-pretty"
        >
          {he.fault}
        </h1>
        <Link
          href="/"
          data-role="fault-screen-way-home"
          className="flex items-center gap-1.5 self-start text-[15px] font-semibold text-forest transition-colors hover:text-forest-deep"
        >
          <Chevron towards="previous" />
          <span dir="auto">{he.wayHome}</span>
        </Link>
      </Card>
    </div>
  );
}

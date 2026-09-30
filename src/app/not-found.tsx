import Link from "next/link";
import { Card } from "@/components/Card";
import { Chevron } from "@/components/icons";
import { he } from "@/lib/i18n/he";

/**
 * An address the application does not have — Next's own 404, in Hebrew.
 *
 * **Without this file the screen is Next's built-in one**, which is English
 * (`This page could not be found`) and, worse, reads wrongly inside a
 * right-to-left container: the Latin sentence's full stop is displaced to the
 * front of it. So the one screen a mistyped bookmark reaches was the one screen
 * written in a language the family does not read.
 *
 * **It sits at the root and there is only one**, because nothing about a missing
 * address differs between sections. It renders inside the root layout, so the
 * bar and the switcher are drawn around it and every way on from here is the
 * shell's own; the link below is for the reader who is already looking at the
 * page rather than at the bar.
 *
 * **It says nothing about what was missing.** `notFound()` is reached from
 * `/workers/[id]` for an id that is nonsense *and* for another household's real
 * one, so a sentence naming a worker would confirm that id exists — the reason
 * `he.notFound` is worded for an address and not for a worker.
 *
 * **It is not an error boundary and must not read as one.** A fault invites a
 * second try because trying again can help; the same address will go on not
 * existing, so this screen offers a different address instead (`he.fault` draws
 * the same line in the other direction).
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[860px] min-w-0 flex-col gap-3">
      <Card
        radius="lg"
        data-role="not-found"
        className="flex min-w-0 flex-none flex-col gap-2 px-4.5 py-3.5"
      >
        <h1
          data-role="not-found-title"
          dir="auto"
          className="text-[17px] font-semibold"
        >
          {he.notFound.title}
        </h1>
        <p
          dir="auto"
          className="text-[15px] leading-[1.5] font-light text-ink-mute text-pretty"
        >
          {he.notFound.body}
        </p>
        {/* A link and not a button: nothing is submitted, and the reader has
            arrived at a screen with nothing on it to act on. */}
        <Link
          href="/"
          data-role="not-found-way-home"
          className="flex items-center gap-1.5 self-start text-[15px] font-semibold text-forest transition-colors hover:text-forest-deep"
        >
          <Chevron towards="previous" />
          <span dir="auto">{he.wayHome}</span>
        </Link>
      </Card>
    </div>
  );
}

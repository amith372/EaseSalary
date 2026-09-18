"use client";

import { useState } from "react";
import { Bidi } from "@/components/Bidi";
import { Card } from "@/components/Card";
import { WhyButton, WhyPanel } from "@/components/WhyDisclosure";
import { he } from "@/lib/i18n/he";
import type { Explanation } from "@/lib/types";

/**
 * The three balance cards on `דף העובד`, each with the "?" the artboard draws
 * beside its figure.
 *
 * **It is a client island and the page around it is not**, because the whole of
 * what it needs a browser for is which panel is open — one key, held here, so
 * opening one closes the last exactly as the canvas does. The figures and their
 * explanations are worked out on the server and handed in.
 *
 * **The explanations are the engine's own** for vacation and sickness — the
 * same sentence the opening screen shows beside the same figure — so the two
 * screens cannot explain one balance two ways. The advance carries the one
 * sentence that has no engine line behind it (`he.workers.profile.advanceWhy`).
 */

export interface ProfileBalance {
  /** Which balance it is, and the key the panel is addressed by. */
  key: "vacation" | "sick" | "advance";
  label: string;
  /** The figure, already formatted — days or money, which this does not need to
   * tell apart. */
  value: string;
  /** The mark's own dot colour from the calendar legend, so a balance and the
   * days that draw on it read as one thing. */
  dot: string;
  explanation: Explanation;
}

export function WorkerBalances({ balances }: { balances: ProfileBalance[] }) {
  const [openWhy, setOpenWhy] = useState<string | null>(null);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-4.5">
      {balances.map((balance) => (
        <Card
          key={balance.key}
          radius="sm"
          data-balance={balance.key}
          className="flex min-w-0 flex-col gap-2.5 px-4.5 py-3.5 sm:px-6 sm:py-5"
        >
          <span className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2.5 sm:flex-col sm:flex-nowrap sm:items-stretch">
            <span className="flex min-w-0 items-center gap-2.25 text-[15px] font-light text-ink-soft sm:text-[16px]">
              <span
                aria-hidden="true"
                className={`size-2.25 flex-none rounded-full ${balance.dot}`}
              />
              <span dir="auto">{balance.label}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[22px] font-bold tracking-[-0.02em] whitespace-nowrap sm:text-[26px]">
                <Bidi noTranslate>{balance.value}</Bidi>
              </span>
              <WhyButton
                controls={`why-${balance.key}`}
                open={openWhy === balance.key}
                onToggle={() =>
                  setOpenWhy((open) =>
                    open === balance.key ? null : balance.key,
                  )
                }
                label={he.why.balanceLabel}
                subject={balance.label}
              />
            </span>
          </span>
          <WhyPanel
            id={`why-${balance.key}`}
            open={openWhy === balance.key}
            explanation={balance.explanation}
          />
        </Card>
      ))}
    </div>
  );
}

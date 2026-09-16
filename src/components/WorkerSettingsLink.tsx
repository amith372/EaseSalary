"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useWorkerScope } from "@/components/WorkerScope";

/**
 * A link to `/settings` about one worker. `/settings` shows whichever worker the
 * switcher holds, so following the link selects her first — from the list the
 * switcher may be holding the other one.
 */
export function WorkerSettingsLink({
  workerId,
  className,
  children,
}: {
  workerId: string;
  className?: string;
  children: ReactNode;
}) {
  const { select } = useWorkerScope();
  return (
    <Link href="/settings" onClick={() => select(workerId)} className={className}>
      {children}
    </Link>
  );
}

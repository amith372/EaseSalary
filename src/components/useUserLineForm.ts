"use client";

/**
 * The panel behind a user line, wherever one is written.
 *
 * `/payments` writes a line into one month and `/settings` writes a standing
 * line onto the profile, and the two look nothing alike — one is a fold in the
 * month's actions, the other a row of the worker's terms, and they stay two
 * screens because they do two jobs (the user, 2026-09-22). What they share is
 * everything *behind* the look: the same four fields, the same direction and
 * placement chips, the same rule that the placement follows the direction until
 * she touches it, the same one-panel-at-a-time `open`, and the same reset. That
 * is what lives here, so the placement rule has one home rather than two that
 * drift.
 *
 * **Where the line is written is the caller's**, and it is the whole of the
 * difference: `save` is handed the panel's `open` — `"new"` for an addition, a
 * line's id for a correction — and answers with whatever that screen's action
 * answers, which is why the hook is generic over the refusal.
 */

import { useState } from "react";

import { useAction, type ActionResult, type Send } from "@/components/useAction";
import {
  defaultPlacementFor,
  placementOf,
  type UserLine,
  type UserLineDirection,
  type UserLinePlacement,
} from "@/lib/engine/types";
import type { UserLineDraft } from "@/lib/engine/userLines";
import { formatAgorot } from "@/lib/money";

/** `null` when nothing is open, `"new"` for a line being added, and a line's id
 * when that line is being corrected — one panel at a time, so two half-filled
 * forms cannot both be on screen claiming the same line. */
export type OpenPanel = "new" | string | null;

export function useUserLineForm<Reason>({
  send,
  save,
}: {
  send: Send<Reason>;
  save: (
    open: "new" | string,
    draft: UserLineDraft,
  ) => Promise<ActionResult<Reason>>;
}) {
  const [open, setOpen] = useState<OpenPanel>(null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [direction, setDirection] = useState<UserLineDirection>("addition");
  // `null` until she chooses, which is what lets the chips follow the direction
  // and then stop following it.
  const [chosen, setChosen] = useState<UserLinePlacement | null>(null);
  const { refusal, run, clear } = useAction(send);

  const placement = chosen ?? defaultPlacementFor(direction);

  /**
   * Closes the panel and empties it, the last refusal included. It is reached
   * both by a successful save and by the cancel button, and a refusal left
   * standing after the panel that produced it has gone would be an error about
   * a field the user can no longer see.
   */
  function reset() {
    setOpen(null);
    setLabel("");
    setAmount("");
    setNote("");
    setDirection("addition");
    setChosen(null);
    clear();
  }

  /**
   * The panel reopened over a line that already exists, with what it holds
   * already in the fields (item 20).
   *
   * **The placement is set rather than left to follow the direction.** What is
   * stored is what she chose, so a panel that let the default take it again
   * would silently move a line she had deliberately placed, the moment she
   * reopened it to correct a typo in its words.
   */
  function openEdit(line: UserLine) {
    clear();
    setOpen(line.id);
    setLabel(line.label);
    setAmount(formatAgorot(line.agorot));
    setNote(line.note ?? "");
    setDirection(line.direction);
    setChosen(placementOf(line));
  }

  /** One call for both gestures: the id is what tells them apart, and the
   * server keeps it rather than minting a new one. */
  function submit() {
    if (open === null) return;
    run(() => save(open, { label, amount, direction, placement, note }), reset);
  }

  return {
    open,
    setOpen,
    label,
    setLabel,
    amount,
    setAmount,
    note,
    setNote,
    direction,
    setDirection,
    placement,
    setChosen,
    refusal,
    run,
    /** Drops a refusal without closing anything — for a caller that opens the
     * panel from a button and does not want last time's reason greeting her. */
    clear,
    reset,
    openEdit,
    submit,
  };
}

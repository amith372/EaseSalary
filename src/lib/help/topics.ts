import type { LegalLinkKey } from "@/lib/links";
import type { ScreenId } from "@/lib/help/screens";
import { he } from "@/lib/i18n/he";

/**
 * The questions the help screen offers as a closed list, each naming the screen
 * that settles it and where to press once there (specs.md item 24).
 *
 * **A topic authors nothing.** It says a destination, a gesture and the rule
 * behind it, and the rule is a key into `legalLinks` rather than a sentence —
 * the explanation stays beside the figure it explains, and a second wording of
 * it here would be the manual item 24 refuses.
 *
 * **It is account-blind.** No topic names a worker, a figure or a month, which
 * is what keeps the screen clear of inflection, of the replay and of a refused
 * month. Where a sentence has to say "the worker" it says the inclusive
 * `עובד/ת`, because no worker is chosen here (`CLAUDE.md`).
 *
 * **The list grows only when the user asks it to.** It began as the `עזרה`
 * artboard's eight; `markVacation` and `addPayment` are the user's own, added
 * 2026-10-01. A question nobody asked for is a product decision taken by
 * nobody, and the hardest kind of wrong answer to find later (`CLAUDE.md` rule
 * 4). What covers everything else is the screen list the panel falls back to,
 * which is the whole registry.
 *
 * The Hebrew is in `he.help.topics`, keyed by the same id, and `topics.test.ts`
 * holds the two lists to each other so neither can grow alone.
 */
export interface HelpTopic {
  /** The suite's and `data-row`'s handle on one entry, by what it is rather
   * than by the Hebrew beside it (`CLAUDE.md` rule 10). */
  id: TopicId;
  /**
   * Which screen of the registry settles it, and the whole of where a topic
   * leads.
   *
   * **It names no fold inside that screen**, which was tried and removed: the
   * settings folds carry `data-group` and no `id`, so `/settings#rates` landed
   * at the top of the screen with every fold shut — an address that works, goes
   * nowhere, and looks entirely right in the code. Which fold to open is said in
   * `where`, in words, which is what the artboard does and what survives a
   * screen being rearranged.
   */
  screen: ScreenId;
  /** The rule behind the gesture, or null where no legal rule bears on it. It
   * is what joins a topic to the stage 5 cached section of the same heading
   * (`match.ts`). */
  rule: LegalLinkKey | null;
}

export type TopicId = keyof typeof he.help.topics;

export const HELP_TOPICS: readonly HelpTopic[] = [
  { id: "markSick", screen: "home", rule: "sickPay" },
  { id: "markVacation", screen: "home", rule: "annualLeave" },
  { id: "vacationLeft", screen: "home", rule: "annualLeave" },
  // The payslip rule: every payment appears on it as its own line, with its
  // type and its amount. It is what item 2's structure rests on, and it is the
  // nearest thing in law to a rule about adding one.
  { id: "addPayment", screen: "payments", rule: "wageProtection" },
  { id: "addAdvance", screen: "payments", rule: "wageDeductions" },
  { id: "recuperationWhen", screen: "payments", rule: "recuperation" },
  { id: "chooseHolidays", screen: "holidays", rule: "holidayWork" },
  { id: "deductMedicalInsurance", screen: "settings", rule: "medicalInsurance" },
  { id: "changeRestDay", screen: "settings", rule: "restDayWork" },
  { id: "monthNotConfirmed", screen: "beforeExport", rule: "wageProtection" },
];

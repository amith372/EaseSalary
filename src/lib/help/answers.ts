import { addMonths, compareIsoDate, compareMonth, monthOf, quarterOf } from "@/lib/dates";
import type { ActionEntry, ExpiringDocument } from "@/lib/engine/actionList";
import type { WorkerProfile } from "@/lib/engine/repository";
import type { MonthInSeries } from "@/lib/engine/series";
import { LINK_FOR_THIRD_PARTY } from "@/lib/engine/thirdParty";
import { thirdPartyKinds, type ThirdPartyKind } from "@/lib/engine/types";
import type { UpcomingEntry } from "@/lib/engine/upcoming";
import type { ScreenId } from "@/lib/help/screens";
import type { LegalLinkKey } from "@/lib/links";
import type { IsoDate, YearMonth } from "@/lib/types";

/**
 * What `עוזר דיגיטלי` answers out of the household's own months — the half of
 * item 24 that is not navigation.
 *
 * **Nothing here calculates anything.** Every figure is one the replay has
 * already produced and every sentence of reasoning is the row's own
 * `explanation`: these functions gather, choose and order, and where the
 * application does not hold a figure they say so rather than working one out.
 * That is what keeps an answer and the screen it is about saying the same thing
 * — they are one engine result read twice (`CLAUDE.md` rule 12) — and it is why
 * a new figure would be a change to the engine and never a change here.
 *
 * **Data and never words**, exactly as `actionList` is: an answer carries
 * months, dates and agorot, plus the labels and explanations the engine wrote
 * onto its own rows. The Hebrew frame around them is the panel's
 * (`he.help.answers`), so the two places an answer is drawn cannot word it
 * differently.
 *
 * **It is one worker's answer and the caller decides whose.** An account holds
 * two (item 11) and an answer names the worker it belongs to, so these take one
 * worker's replay and the caller runs them for each worker the question was
 * about.
 */

/** The questions the panel answers rather than points at. The ids are the
 * matcher's handles and `data-row`'s (`CLAUDE.md` rule 10). */
export const ANSWER_IDS = [
  "owedThisMonth",
  "nationalInsuranceDue",
  "visaFeeDue",
  "thirdPartyDue",
] as const;

export type AnswerId = (typeof ANSWER_IDS)[number];

/** The rule behind each answer, as a topic carries one: the answer points at
 * the page and never restates it (item 24). */
export const ANSWER_RULES: Record<AnswerId, LegalLinkKey> = {
  owedThisMonth: "wageProtection",
  nationalInsuranceDue: "nationalInsurance",
  visaFeeDue: "employmentGuide",
  // The one guide covering the fees, the visa and the permit together
  // (`LINK_FOR_THIRD_PARTY`). Each row of the answer carries the rule behind
  // its own kind as well, so this is the footer's link and not the answer's
  // only one.
  thirdPartyDue: "employmentGuide",
};

/**
 * The screen each answer sends them on to, as a topic names one: the answer is
 * the figure, and this is where it is acted on.
 *
 * The missing work-visa date is the one case an answer points somewhere else —
 * the worker's own page, where the date is entered — and the panel says so in
 * words beside it (`he.help.answers.visaFeeDue.noDateWhere`).
 */
export const ANSWER_SCREENS: Record<AnswerId, ScreenId> = {
  owedThisMonth: "home",
  nationalInsuranceDue: "payments",
  visaFeeDue: "payments",
  thirdPartyDue: "payments",
};

/** One line of what the month pays, quoted off the engine's own row. */
export interface AnswerLine {
  key: string;
  label: string;
  agorot: number | null;
  /** The row's own sentence, which is the one place this explanation lives
   * (item 24). */
  explanation: string;
  link: LegalLinkKey | null;
}

export interface Quarter {
  from: YearMonth;
  to: YearMonth;
}

/**
 * A quarter, what each of its months accrued, and the three added up.
 *
 * **The total is the sum of the months' own estimates and nothing else** (the
 * user, 2026-10-10, who asked for it): each month's figure is already a whole
 * number of shekels, and a total is the sum of its already-rounded parts
 * (item 3), so nothing is rounded a second time here and no percentage is
 * applied to anything.
 *
 * **It is an estimate exactly as its parts are** (item 19) and is said to be
 * one wherever it is drawn — the amount actually billed has differed from it.
 *
 * `months` holds only the months of the quarter the replay reached, which is
 * all of them for a quarter that has ended, and fewer for a worker employed
 * part-way through one — where fewer is the right answer rather than a gap.
 */
export interface QuarterAccrued {
  quarter: Quarter;
  months: { month: YearMonth; estimateAgorot: number | null }[];
  /** `null` where a month of the quarter carries no estimate at all, which a
   * month before the percentage's own table does: a sum that quietly left one
   * out would be a figure too small with nothing to show for it. */
  totalAgorot: number | null;
}

/** The three yearly fees `upcoming()` dates, as it names them (item 15). */
type UpcomingFee = Extract<UpcomingEntry, { key: "fee" }>["kind"];

/**
 * Why one payment to a third party is still owed.
 *
 * **Every reason is a list the application already keeps**, which is what keeps
 * this answer and the screens about it from disagreeing (`CLAUDE.md` rule 12):
 * `quarterEnded` is `/alerts`' own entry, `lapsed` and `ending` are its
 * document entries, and `ahead` is `לקראת החודשים הבאים`' own. The one reason
 * with no list behind it is `neverRecorded`, and it is the absence of a payment
 * rather than a date worked out from anything.
 *
 * `document` travels with the two expiry reasons because the sentence drawn for
 * them is the alert's own, and the alert is worded per document (item 28 pairs
 * them: the worker's visa with B14's fee, the employer's permit with B16's).
 */
export type ThirdPartyDueReason =
  | { why: "quarterEnded"; quarter: Quarter; accruedAgorot: number | null }
  | {
      why: "lapsed" | "ending";
      document: ExpiringDocument;
      expiresOn: IsoDate;
      lastPaidAgorot: number | null;
    }
  | {
      why: "ahead";
      kind: UpcomingFee;
      month: YearMonth;
      lastPaidAgorot: number | null;
    }
  | { why: "neverRecorded" };

/** One kind the family still owes, with the rule behind that kind. */
export interface ThirdPartyOwed {
  kind: ThirdPartyKind;
  reason: ThirdPartyDueReason;
  /** The kind's own reference page, which is the one place its rule lives
   * (item 24, `LINK_FOR_THIRD_PARTY`). */
  link: LegalLinkKey;
}

export type Answer =
  | {
      id: "owedThisMonth";
      /** `null` where the replay reached no month at all — a worker whose first
       * month is still ahead. */
      month: YearMonth | null;
      lines: AnswerLine[];
      /** What the month comes to for the worker, as the month screen shows it. */
      totalAgorot: number | null;
    }
  | {
      id: "nationalInsuranceDue";
      /** Quarters that have ended with no payment recorded against them — the
       * same entries `/alerts` draws, off one `actionList` result. */
      unpaid: QuarterAccrued[];
      /** The quarter running now and the month it can be paid from, which is
       * the month after it ends (item 19). */
      next: { quarter: Quarter; payableFrom: YearMonth };
    }
  | {
      id: "visaFeeDue";
      /** `null` where no work-visa expiry is stored: that date is what the fee
       * is dated off (item 28), so without it there is nothing to answer and
       * the panel says where to enter it. */
      due: {
        month: YearMonth;
        expiresOn: IsoDate;
        lastPaidAgorot: number | null;
      } | null;
    }
  | {
      id: "thirdPartyDue";
      /**
       * What is still owed, in the sheet's own order (`thirdPartyKinds`), so the
       * answer can be read down a month tab without a lookup.
       *
       * **Empty is an answer and not a gap**: a household that has recorded
       * everything owes nothing today, and the panel says so.
       */
      owed: ThirdPartyOwed[];
      /**
       * The kinds the application holds no "when" for, named rather than left
       * out — an answer that simply omitted them would read as a list of
       * everything that exists, and the family would stop looking for the rest.
       */
      undated: ThirdPartyKind[];
    };

export interface AnswerInput {
  profile: WorkerProfile;
  /** The replay up to today's month, as `householdSeries` hands it over. */
  series: MonthInSeries[];
  /**
   * That replay's action list and its upcoming list, passed in rather than
   * built here.
   *
   * `/alerts` draws the first and `לקראת החודשים הבאים` the second, so an
   * answer that built its own would be a second walk free to disagree with the
   * screen it is about (`CLAUDE.md` rule 12).
   */
  actions: readonly ActionEntry[];
  ahead: readonly UpcomingEntry[];
  today: IsoDate;
}

/** The answer to one question for one worker. */
export function answerFor(id: AnswerId, input: AnswerInput): Answer {
  switch (id) {
    case "owedThisMonth":
      return owedThisMonth(input);
    case "nationalInsuranceDue":
      return nationalInsuranceDue(input);
    case "visaFeeDue":
      return visaFeeDue(input);
    case "thirdPartyDue":
      return thirdPartyDue(input);
  }
}

/**
 * What this month pays the worker, line by line.
 *
 * **The month is the last the replay reached, which is always the one running
 * now**: the walk ends at today's month (`calculateSeries`), so what is drawn
 * is a preview of a month still being marked and the panel says so in words.
 *
 * **Column H is left out, and that is the whole of the division.** Those lines
 * are money paid to third parties and never part of what reaches the worker
 * (item 16).
 */
function owedThisMonth({ series }: AnswerInput): Answer {
  const current = series.at(-1);
  if (current === undefined) {
    return { id: "owedThisMonth", month: null, lines: [], totalAgorot: null };
  }
  return {
    id: "owedThisMonth",
    month: current.facts.month,
    lines: current.result.lines
      .filter((line) => line.column !== "H")
      .map((line) => ({
        key: line.key,
        label: line.label,
        agorot: line.amount,
        explanation: line.explanation.text,
        link: line.explanation.link ?? null,
      })),
    totalAgorot: current.result.net,
  };
}

/**
 * When the national insurance next falls due, and what the months behind it
 * have put aside.
 *
 * **The quarters already owed are `/alerts`' own entries** and are not worked
 * out a second time: one `actionList` result produces the card on the opening
 * screen and this answer, so the two cannot name different quarters
 * (`CLAUDE.md` rule 12).
 *
 * **The quarter running now is the calendar and not a rule of its own**: the
 * insurance is paid in arrears, so the soonest a quarter can be recorded is the
 * month after it closes (item 19), which is what `/payments` offers when a
 * payment is entered there.
 */
function nationalInsuranceDue({ series, actions, today }: AnswerInput): Answer {
  const unpaid = actions
    .filter((entry) => entry.key === "nationalInsurance")
    .map((entry) => accruedQuarter(series, entry.quarter));
  const running = quarterOf(monthOf(today));
  return {
    id: "nationalInsuranceDue",
    unpaid,
    next: { quarter: running, payableFrom: addMonths(running.to, 1) },
  };
}

/** A quarter with what each of its months put aside and the three together. A
 * month the replay has not reached carries nothing, which is the ordinary
 * state of the quarter running now. */
function accruedQuarter(series: MonthInSeries[], quarter: Quarter): QuarterAccrued {
  const months = series
    .filter(
      ({ facts }) =>
        compareMonth(facts.month, quarter.from) >= 0 &&
        compareMonth(facts.month, quarter.to) <= 0,
    )
    .map(({ facts, result }) => ({
      month: facts.month,
      estimateAgorot: result.nationalInsuranceEstimate,
    }));
  const missing = months.some((month) => month.estimateAgorot === null);
  return {
    quarter,
    months,
    totalAgorot:
      missing || months.length === 0
        ? null
        : months.reduce((sum, month) => sum + (month.estimateAgorot ?? 0), 0),
  };
}

/**
 * When the visa-extension fee falls due.
 *
 * **It is `upcoming()`'s own entry**, so this answer and `לקראת החודשים הבאים`
 * name one month. The expiry is said beside it because it is what dates the fee
 * (item 28), and an answer about a date the family cannot see is an answer they
 * cannot check.
 *
 * A profile with no work-visa expiry stored has no entry and no month — the
 * ordinary state of documents nobody has filled in — so the answer says the
 * date is not stored rather than drawing one from somewhere else.
 */
function visaFeeDue({ profile, ahead }: AnswerInput): Answer {
  const expiresOn = profile.documents.workVisaExpiry;
  const entry = ahead.find(
    (one) => one.key === "fee" && one.kind === "visaExtensionFee",
  );
  if (expiresOn === null || entry === undefined || entry.key !== "fee") {
    return { id: "visaFeeDue", due: null };
  }
  return {
    id: "visaFeeDue",
    due: { month: entry.month, expiresOn, lastPaidAgorot: entry.lastPaidAgorot },
  };
}

/**
 * The fee each expiring document costs the family, as item 28 pairs them: the
 * worker's visa is extended against B14's fee and the employer's permit against
 * B16's, and the medical insurance's lapse is its own row rather than a fee on
 * something else.
 *
 * **The passport is deliberately absent.** It is the one document of item 28
 * whose lapse costs no payment to anybody — the employer has to see it stays
 * valid, and there is nothing to pay when it does not.
 */
const FEE_FOR_DOCUMENT: Partial<Record<ExpiringDocument, ThirdPartyKind>> = {
  workVisa: "visaExtensionFee",
  employmentPermit: "licenceFee",
  medicalInsurance: "medicalInsurance",
};

/**
 * The kinds the application can say nothing about *when*.
 *
 * **Empty, and the list stays all the same.** Item 24 requires a dateless kind
 * to be named at the foot of an answer rather than left out, because an
 * omission in a list of what is owed reads as an exemption — so the rule needs
 * somewhere to read its kinds from whether or not there are any today. Every
 * kind `upcoming()` covers is dated by it, and the rest fall due on an event
 * this answer already reaches: `workerVisa` was the last member and left when
 * the permit's two fees were given the permit's own expiry (item 15).
 */
const UNDATED_KINDS: readonly ThirdPartyKind[] = [];

/**
 * **`placementFee` is owed once per worker, not once per household.** The
 * bureau charges it for placing *this* worker and not again while that
 * employment lasts, so "has this worker's replay ever recorded one" is the
 * whole test — and it is the right test for an account holding two workers,
 * where the second was placed and paid for separately (item 11).
 */
const ONCE_PER_WORKER: readonly ThirdPartyKind[] = ["placementFee"];

/**
 * What the family still owes to somebody other than the worker, and why.
 *
 * **Nothing here decides when anything falls due.** Every reason is lifted off
 * a list the application already keeps — `actionList` for the quarter that has
 * ended and the documents that have run out, `upcoming` for the fees still
 * ahead — so this answer cannot name a month `/alerts` or `לקראת החודשים הבאים`
 * would not name (`CLAUDE.md` rule 12). The one thing it reads directly is
 * whether a once-per-worker payment was ever recorded, which is an absence and
 * not a date.
 *
 * **A document that has already lapsed is the reason that outranks a fee still
 * ahead.** `upcoming()` looks forward from this month, so a visa that expired
 * in the spring is in no upcoming list at all while the fee for extending it is
 * precisely what the family owes; `actionList` is where that lapse lives. Where
 * both speak of one kind — an expiry falling this month — the lapse is kept and
 * the fee ahead dropped, because one kind twice in one answer reads as two
 * payments.
 */
function thirdPartyDue({ series, actions, ahead }: AnswerInput): Answer {
  const owed: ThirdPartyOwed[] = [];
  const claimed = new Set<ThirdPartyKind>();

  for (const entry of actions) {
    if (entry.key === "nationalInsurance") {
      owed.push({
        kind: "nationalInsurance",
        reason: {
          why: "quarterEnded",
          quarter: entry.quarter,
          accruedAgorot: accruedQuarter(series, entry.quarter).totalAgorot,
        },
        link: LINK_FOR_THIRD_PARTY.nationalInsurance,
      });
      claimed.add("nationalInsurance");
      continue;
    }
    if (entry.key !== "documentExpired" && entry.key !== "documentExpiring") continue;
    const kind = FEE_FOR_DOCUMENT[entry.document];
    if (kind === undefined) continue;
    owed.push({
      kind,
      reason: {
        why: entry.key === "documentExpired" ? "lapsed" : "ending",
        document: entry.document,
        expiresOn: entry.expiresOn,
        lastPaidAgorot: lastPaidFor(series, kind),
      },
      link: LINK_FOR_THIRD_PARTY[kind],
    });
    claimed.add(kind);
  }

  for (const entry of ahead) {
    if (entry.key !== "fee" || claimed.has(entry.kind)) continue;
    owed.push({
      kind: entry.kind,
      reason: {
        why: "ahead",
        kind: entry.kind,
        month: entry.month,
        lastPaidAgorot: entry.lastPaidAgorot,
      },
      link: LINK_FOR_THIRD_PARTY[entry.kind],
    });
    claimed.add(entry.kind);
  }

  for (const kind of ONCE_PER_WORKER) {
    if (claimed.has(kind) || lastPaidFor(series, kind) !== null) continue;
    owed.push({ kind, reason: { why: "neverRecorded" }, link: LINK_FOR_THIRD_PARTY[kind] });
  }

  return {
    id: "thirdPartyDue",
    owed: owed.sort(
      (one, other) =>
        thirdPartyKinds.indexOf(one.kind) - thirdPartyKinds.indexOf(other.kind),
    ),
    undated: [...UNDATED_KINDS],
  };
}

/** What this worker's months last recorded for a kind, or `null` where they
 * never recorded one — the figure `לקראת החודשים הבאים` shows beside a fee,
 * read the same way for the kinds that list does not cover. */
function lastPaidFor(series: MonthInSeries[], kind: ThirdPartyKind): number | null {
  const payments = series
    .flatMap(({ facts }) => facts.thirdPartyPayments)
    .filter((payment) => payment.kind === kind)
    .sort((one, other) => compareIsoDate(one.paidOn, other.paidOn));
  return payments.at(-1)?.agorot ?? null;
}

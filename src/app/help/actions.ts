"use server";

import { markRange, setHolidayWorked, type MarkRangeResult } from "@/app/month/actions";
import { answering, type Done } from "@/lib/actionFault";
import { monthOf } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { actionList } from "@/lib/engine/actionList";
import { upcoming } from "@/lib/engine/upcoming";
import { ANSWER_IDS, answerFor, type Answer, type AnswerId } from "@/lib/help/answers";
import { gestureIn, stage, type GestureKind } from "@/lib/help/gesture";
import { workersNamed } from "@/lib/help/match";
import { householdSeries, refusalShown } from "@/lib/householdSeries";
import { readToday } from "@/lib/requestToday";
import type { SkippedDay } from "@/lib/spans";
import { getRepository, requireWorker } from "@/lib/store";
import type { IsoDate, YearMonth } from "@/lib/types";
import { isBeforeFirstMonth } from "@/lib/workerMonths";
import type { CachedPage } from "@/lib/scrape/pageSections";

/**
 * The corpus the panel matches against, fetched the first time it is opened.
 *
 * **It is fetched on opening and not handed down with every screen.** The
 * launcher is drawn on every route, so passing the cached pages through the
 * shell would put the whole stage 5 cache into the payload of every page the
 * household loads, to be read by the few that open the panel. `/help` keeps
 * reading it on the server, where it is the screen's own data.
 *
 * **It reads nothing about the account.** The cache belongs to the household
 * only in where it is stored — it is Kol Zchut's text, the same for everyone —
 * so this answers the same thing for any member, and a clone that has never
 * scraped gets an empty list and a working panel (`match.ts`).
 */
export async function loadHelpPages(): Promise<CachedPage[]> {
  const repository = await getRepository();
  return repository.listCachedPages();
}

/**
 * Records that the card a first sign-in opens was left (specs.md item 32).
 *
 * **It takes nothing and says nothing about the account**, which is what makes
 * it safe to reach from a public address: it marks the caller and can mark
 * nobody else, because the store answers for whoever this request is and the
 * Postgres function behind it reads `auth.uid()` in its own body.
 *
 * **A fault is reported rather than raised**, as every action here does. The
 * consequence of one is that the card opens itself once more, which is the
 * mildest failure in the application — so nothing waits on this and the panel
 * closes whether or not it came back.
 */
export async function dismissTutorial(): Promise<Done> {
  return answering(async () => {
    const repository = await getRepository();
    await repository.dismissTutorial();
    return { ok: true } as const;
  });
}

/** One worker's share of an answer. */
export interface AnsweredWorker {
  workerId: string;
  /** Their first name, as every screen names them. */
  name: string;
  /** `null` where their replay refused, which is when `refusedMonth` is
   * said instead (items 13 and 25). */
  answer: Answer | null;
  /** The month that stopped the replay, already as words, or `null` where it
   * stood. */
  refusedMonth: string | null;
}

/** What the panel draws for one question. */
export interface AnswerGiven {
  id: AnswerId;
  /** Empty where the account holds no worker at all, which the panel says
   * rather than drawing an answer about nobody (item 24). */
  workers: AnsweredWorker[];
  /** Whether the household holds more than one worker, which is what decides
   * if an answer has to name whose it is. */
  several: boolean;
}

/**
 * The answer itself, worked out on the server from the household's own months
 * (specs.md item 24).
 *
 * **The replay never reaches the browser.** The panel sends the question and
 * the entry it matched, and what comes back is the figures that answer it —
 * so the months, the terms and the documents stay where they are, and what
 * crosses is what would have been on the screen anyway.
 *
 * **It answers for both workers unless the question named one** (the user,
 * 2026-10-10). The names are matched by the same folding the rest of the
 * matcher uses, and a question that names neither, or names them ambiguously,
 * is answered for both rather than for a guess (`workersNamed`).
 *
 * **One `actionList` and one `upcoming` per worker, over `householdSeries`.**
 * They are the lists `/alerts` and `לקראת החודשים הבאים` are drawn from, so an
 * answer about when something falls due says what those screens say
 * (`CLAUDE.md` rule 12). The switches and deferrals of item 27 are not applied
 * here and need not be: they never hide a blockage, and the national-insurance
 * quarter is one.
 *
 * **A worker whose replay refused is answered with the refusal** rather than
 * left out, which is the difference between this and the alerts list: a family
 * asking what they owe has asked a question, and silence about one worker is an
 * answer they would read as "nothing".
 */
export async function answerFromAccount(
  id: AnswerId,
  question: string,
): Promise<AnswerGiven> {
  // **The entry is checked and not trusted.** A server action is an address
  // anything can post to, and the types that make this safe in the panel are
  // gone by the time the request arrives: an id outside the list would fall
  // through every resolver and hand back an answer that is not one.
  if (!(ANSWER_IDS as readonly string[]).includes(id)) {
    throw new Error("no such answer");
  }
  const [replayed, repository, today] = await Promise.all([
    householdSeries(),
    getRepository(),
    readToday(),
  ]);
  const rates = await repository.listRates();
  const asked = workersNamed(
    question,
    replayed.map((worker) => worker.profile),
  );
  const workers = await Promise.all(
    replayed
      .filter((worker) => asked.includes(worker.profile))
      .map(async ({ profile, months, refusal }): Promise<AnsweredWorker> => {
        if (refusal !== null) {
          return {
            workerId: profile.id,
            name: profile.firstName,
            answer: null,
            refusedMonth: refusalShown({ profile, months, refusal })?.monthLabel ?? null,
          };
        }
        const spans = await repository.listSpans(profile.id);
        return {
          workerId: profile.id,
          name: profile.firstName,
          answer: answerFor(id, {
            profile,
            series: months,
            actions: actionList({ profile, series: months, spans, rates, today }),
            ahead: upcoming({ profile, series: months, today }),
            today,
          }),
          refusedMonth: null,
        };
      }),
  );
  return { id, workers, several: replayed.length > 1 };
}

/** The worker a proposal is for, named the way every screen names them. */
export interface NamedWorker {
  workerId: string;
  name: string;
}

/**
 * What a typed instruction comes to, before anything is written
 * (specs.md item 24).
 *
 * **Three states and not a flag**, because the panel draws three different
 * cards: a question about whose calendar it is, a proposal to accept, and a
 * range the worker's own first month puts out of reach (item 6).
 */
export type Staging =
  | { state: "choose"; workers: NamedWorker[] }
  | {
      state: "ready";
      worker: NamedWorker;
      /** What the sentence asked for, which the card names in the calendar's
       * own words for the mark and for the range. */
      kind: GestureKind;
      from: IsoDate;
      to: IsoDate;
      restDay: RestDay;
      /** Every day the press would change, in order. */
      days: IsoDate[];
      /** The days inside the range that would not take the mark, with why —
       * the calendar's own reasons, said in the calendar's own words. */
      skipped: SkippedDay[];
    }
  | { state: "tooEarly"; worker: NamedWorker; firstMonth: YearMonth };

/**
 * A sentence read as an instruction and worked out against the account
 * (specs.md item 24).
 *
 * **It writes nothing.** The whole of this path is a proposal: the grammar
 * reads the sentence, `spans.ts` says which days could take the mark, and the
 * answer goes back to be drawn. Only `performGesture` below writes, and only
 * when the user has pressed.
 *
 * **Whose calendar it is, is asked and never guessed.** A marking is a fact
 * about one worker, so where the household holds two and the sentence names
 * neither, the choice is put to the user — unlike an answer, which is given
 * for both (item 24).
 */
export async function stageGesture(
  question: string,
  workerId: string | null = null,
): Promise<Staging | null> {
  const [repository, today] = await Promise.all([getRepository(), readToday()]);
  const gesture = gestureIn(question, today);
  if (gesture === null) return null;

  const workers = await repository.listWorkers();
  // **An account with no worker in it has no calendar to mark**, so the
  // sentence is not an instruction here at all and the panel answers it as the
  // question it then is — which leaves them the screen that adds a worker.
  // Asking whose calendar it is, with no name to offer, would be a dead end on
  // the one account item 24 says must still reach every screen.
  if (workers.length === 0) return null;
  const chosen =
    workerId === null
      ? workersNamed(question, workers)
      : // An id that names nobody in this household is treated as no id at
        // all: a crafted request cannot reach another household's worker
        // through it, and the user is asked whose calendar it is as usual.
        workers.filter((worker) => worker.id === workerId);
  const only = chosen.length === 1 ? chosen[0] : undefined;
  if (only === undefined) {
    return {
      state: "choose",
      workers: workers.map((worker) => ({
        workerId: worker.id,
        name: worker.firstName,
      })),
    };
  }

  const named: NamedWorker = { workerId: only.id, name: only.firstName };
  if (isBeforeFirstMonth(only, monthOf(gesture.from))) {
    return { state: "tooEarly", worker: named, firstMonth: only.firstMonth };
  }
  const staged = stage(gesture, only.restDay, await repository.listSpans(only.id));
  return {
    state: "ready",
    worker: named,
    kind: gesture.kind,
    from: gesture.from,
    to: gesture.to,
    restDay: only.restDay,
    days: staged.days,
    skipped: staged.skipped,
  };
}

/**
 * The press, and the only part of this path that writes.
 *
 * **The sentence is read again here and the browser's answer is not trusted.**
 * A server action is an address anything can post to, so what is performed is
 * what the grammar makes of the sentence on the server, against spans read
 * again — not a list of days that arrived with the request. The browser decides
 * only *that* the user pressed and *whose* calendar it is.
 *
 * **It performs through the calendar's own actions and no others**, which is
 * what keeps the press to what a user could have done by hand: `markRange`
 * sweeps a range and `setHolidayWorked` answers a holiday, each deciding for
 * itself what it allows (specs.md item 24).
 */
export async function performGesture(
  question: string,
  workerId: string,
): Promise<MarkRangeResult | null> {
  // **A crafted request is answered and never thrown at.** Every action in this
  // application reports a fault rather than raising one (`actionFault.ts`), and
  // this one is reachable with any worker id and any sentence at all: an
  // unknown worker, a sentence the grammar no longer reads, a range before the
  // employment began. The panel draws the fault the same way it draws a read
  // that did not come back.
  const answered = await answering(async () => {
    const [repository, today] = await Promise.all([getRepository(), readToday()]);
    const gesture = gestureIn(question, today);
    if (gesture === null) return null;
    const profile = await requireWorker(workerId, repository);

    // **Checked here and not only inside `markRange`.** The sweep refuses a
    // range before the first month itself (item 6), but the holiday path below
    // does not go through it — and a holiday the year drew before the
    // employment began is a span this would otherwise answer for, in a month
    // the user cannot open or view.
    if (isBeforeFirstMonth(profile, monthOf(gesture.from))) {
      throw new Error(`A mark before the first month of ${workerId}`);
    }

    if (gesture.kind === "holidayWorked") {
      const staged = stage(gesture, profile.restDay, await repository.listSpans(workerId));
      for (const spanId of staged.holidaySpans) {
        const done = await setHolidayWorked(workerId, spanId, true);
        if (done.ok === false) return done;
      }
      return { ok: true, skipped: [] } satisfies MarkRangeResult;
    }
    return markRange(workerId, {
      kind: gesture.kind,
      from: gesture.from,
      to: gesture.to,
    });
  });
  // `answering` hands back its own fault, which is a `MarkRangeResult` already.
  return answered;
}

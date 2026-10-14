import { describe, expect, it } from "vitest";

import {
  bestReach,
  bestTopic,
  matchTopics,
  narrowTopics,
  normalise,
  saysNothing,
  sectionBehind,
  workersNamed,
} from "@/lib/help/match";
import type { AnswerId } from "@/lib/help/answers";
import { HELP_TOPICS, type TopicId } from "@/lib/help/topics";
import { he } from "@/lib/i18n/he";
import { termsPage } from "@/lib/scrape/caregiver-terms-page.fixture";
import { CAREGIVER_TERMS } from "@/lib/links";
import { segmentArticle } from "@/lib/scrape/pageSections";
import type { CachedPage } from "@/lib/scrape/pageSections";

/**
 * **The questions below were written before the matcher was, and none of them is
 * a topic's own wording.** That is the whole point of the exercise (`CLAUDE.md`
 * rule 11): a matcher tested against the eight strings it already holds proves
 * only that a substring search works, and would pass on the day it stopped
 * reaching anything a user would actually type. Each case is a sentence a family
 * would type — a different verb, a prefixed noun, a word left half-finished, a
 * synonym the topic does not use — and the expected hit is decided from which
 * screen settles it, which is a question about the application and not about
 * this code.
 *
 * **The corpus is built twice**, because a fresh clone has never scraped and the
 * screen has to work in both states: once with the committed Kol Zchut page
 * segmented as stage 5 segments it, and once with no pages at all.
 */

function cachedPages(): CachedPage[] {
  const page = segmentArticle(termsPage(), CAREGIVER_TERMS);
  if (!page.ok) throw new Error("the committed caregiver-terms page no longer segments");
  return [page.value];
}

const SCRAPED = cachedPages();
const FRESH_CLONE: CachedPage[] = [];

/** A question, and the screen whose topic has to come out on top. */
const ASKED: { query: string; topic: TopicId; why: string }[] = [
  {
    query: "שבוע שלם היא היתה במחלה",
    topic: "markSick",
    why: "a sick spell stated as a fact, with the noun carrying a preposition",
  },
  {
    query: "היא נוסעת לחופשה בשבוע הבא, איך רושמים את הימים",
    topic: "markVacation",
    why: "marking vacation, said as a plan rather than as a gesture",
  },
  {
    // The gesture the whole-day question cannot carry: it is three presses
    // behind a fold, and a family asking for it gets the whole day otherwise.
    query: "היא לקחה חצי יום חופש ביום רביעי, איך רושמים את זה",
    topic: "markHalfVacation",
    why: "half a day, said as what happened rather than as the part the panel asks for",
  },
  {
    query: "נשארו לה ימי חופש?",
    topic: "vacationLeft",
    why: "the balance, with the noun in a shorter form than the topic uses",
  },
  {
    query: "שילמנו לה תוספת חד־פעמית על עבודה בחג",
    topic: "addPayment",
    why: "a one-off line, and the word the screen's own button uses for it",
  },
  {
    query: "העובדת לקחה מקדמה על חשבון המשכורת, איפה רושמים את זה",
    topic: "addAdvance",
    why: "an advance, named once inside a sentence of words no topic holds",
  },
  {
    // The word is the family's and not the application's: their own sheet
    // writes `קיזוז 1/4` and `קיזוז מקדמה 1` for an instalment
    // (`שכר_חודשי_להאנה2026.xlsx`), while every screen says `פירעון`. It
    // reached nothing at all until it was put in the question.
    query: "איפה רושמים קיזוז",
    topic: "addAdvance",
    why: "the sheet's word for an instalment, which no screen of the application uses",
  },
  {
    // The payment is already made and is being recorded. The account's own
    // `nationalInsuranceDue` answers when it falls due and how much, which is
    // the same subject asked the other way round — so this pair is where the
    // asking word earns its weight (`match.ts`).
    query: "שילמנו את הביטוח הלאומי של הרבעון, איך רושמים את זה",
    topic: "recordNationalInsurance",
    why: "a payment already made, which is a gesture and not a figure",
  },
  {
    query: "באיזה חודש ההבראה",
    topic: "recuperationWhen",
    why: "recuperation with the definite article prefixed onto it",
  },
  {
    query: "בחירת החגים לשנה הבאה",
    topic: "chooseHolidays",
    why: "the picker, with the noun carrying the article",
  },
  {
    query: "הביטוח הרפואי מנוכה מהשכר שלה?",
    topic: "deductMedicalInsurance",
    why: "two prefixed words, and the one topic the insurer field settles",
  },
  {
    query: "העובדת נחה ביום שישי ולא בשבת, איפה משנים",
    topic: "changeRestDay",
    why: "the weekly rest, named by two concrete days the topic never mentions",
  },
  {
    query: "למה אין קובץ לחודש הזה",
    topic: "monthNotConfirmed",
    why: "the export blocked, asked as a question about the missing file",
  },
];

describe("matching a typed question to the topic that settles it", () => {
  for (const corpus of [
    { name: "with the committed Kol Zchut page cached", pages: SCRAPED },
    { name: "in a fresh clone, which has never scraped", pages: FRESH_CLONE },
  ]) {
    describe(corpus.name, () => {
      for (const asked of ASKED) {
        it(`reaches ${asked.topic}: ${asked.why}`, () => {
          expect(bestTopic(asked.query, corpus.pages)?.id).toBe(asked.topic);
        });
      }

      it("reaches nothing for a question the application does not answer", () => {
        // Deliberately about the law and not about a screen: help points at the
        // rule page, it never settles a legal question itself (item 24).
        expect(matchTopics("מתי הוטבעו המטבעות הראשונים", corpus.pages)).toEqual([]);
        expect(bestTopic("zzzz qqqq", corpus.pages)).toBeNull();
      });
    });
  }

  it("scores a word in the question itself above one in a cached paragraph", () => {
    // `restDayWork`'s cached section is long prose about the weekly rest, and
    // `changeRestDay` is the topic whose own question asks about it. Were the
    // weights the other way round, the longest field would win every query.
    const hits = matchTopics("יום המנוחה", SCRAPED);
    expect(hits[0]?.topic.id).toBe("changeRestDay");
  });

  it("does not let the cached page change which topic wins", () => {
    // The scrape may add to a score and must never reorder the answer: a clone
    // that has scraped and one that has not are the same application.
    for (const asked of ASKED) {
      expect(
        bestTopic(asked.query, SCRAPED)?.id,
        asked.query,
      ).toBe(bestTopic(asked.query, FRESH_CLONE)?.id);
    }
  });
});

describe("the closed list, as it narrows", () => {
  it("shows every topic before anything is typed", () => {
    expect(narrowTopics("", SCRAPED)).toHaveLength(HELP_TOPICS.length);
    expect(narrowTopics("   ", SCRAPED)).toHaveLength(HELP_TOPICS.length);
    // A question mark alone is punctuation, which normalises away to nothing.
    expect(narrowTopics("?", SCRAPED)).toHaveLength(HELP_TOPICS.length);
  });

  it("narrows to fewer than it started with", () => {
    const narrowed = narrowTopics("חופשה", SCRAPED);
    expect(narrowed.length).toBeGreaterThan(0);
    expect(narrowed.length).toBeLessThan(HELP_TOPICS.length);
    // Both vacation questions survive the word they share. **Which of the two
    // leads is not asserted**, and that is deliberate: they score the same on
    // this word, so the order is the registry's tie-break and an assertion on
    // it would be a test of the array's order dressed up as a test of matching.
    expect(narrowed.map((topic) => topic.id)).toEqual(
      expect.arrayContaining(["markVacation", "vacationLeft"]),
    );
  });

  it("separates the two vacation questions on the word that distinguishes them", () => {
    // Which is the real requirement: one asks how many are left and the other
    // how to record one, and a user who types either must not get the other.
    expect(bestTopic("יתרת ימי החופשה", SCRAPED)?.id).toBe("vacationLeft");
    expect(bestTopic("לסמן לה חופשה בלוח", SCRAPED)?.id).toBe("markVacation");
  });

  it("narrows to nothing rather than back to everything", () => {
    expect(narrowTopics("גידול עגבניות בחממה", SCRAPED)).toEqual([]);
  });

  it("tells a query that said nothing from one that matched nothing", () => {
    // The screen draws these two differently — the whole list against a
    // sentence saying nothing was found — so the difference is settled here and
    // not at the screen, where the stop-word list would be consulted twice.
    expect(saysNothing("")).toBe(true);
    expect(saysNothing("   ")).toBe(true);
    expect(saysNothing("?")).toBe(true);
    expect(saysNothing("מה")).toBe(true);
    expect(saysNothing("באיזה")).toBe(true);
    // Said something, even though nothing in the application answers it.
    expect(saysNothing("גידול עגבניות")).toBe(false);
    expect(saysNothing("חופשה")).toBe(false);
  });

  it("keeps the half day and the whole day apart on the one word between them", () => {
    // They share every other word, so the registry's order decides a tie and
    // the whole day is first. What must not happen is the half day being
    // unreachable.
    expect(bestTopic("איך מסמנים חצי יום חופשה", SCRAPED)?.id).toBe("markHalfVacation");
    expect(bestTopic("איך מסמנים יום חופשה", SCRAPED)?.id).toBe("markVacation");
  });

  it("narrows to the half day while the word is still half-typed", () => {
    expect(narrowTopics("חצי", SCRAPED).map((topic) => topic.id)).toContain(
      "markHalfVacation",
    );
    expect(narrowTopics("חצי", SCRAPED).length).toBeLessThan(HELP_TOPICS.length);
  });

  it("narrows while a word is still half-typed", () => {
    // The user stops at four letters of the word for recuperation. Three
    // letters is the floor, so a shorter fragment must not reach it.
    expect(narrowTopics("הברא", SCRAPED).map((topic) => topic.id)).toContain(
      "recuperationWhen",
    );
  });
});

describe("normalising what was typed", () => {
  it("folds a final letter to the form a stripped prefix leaves", () => {
    expect(normalise("שלום")).toBe(normalise("שלומ"));
  });

  it("drops niqqud, so a pointed spelling matches an unpointed one", () => {
    expect(normalise("מַחֲלָה")).toBe(normalise("מחלה"));
  });

  it("scores nothing for a question word, however it is prefixed", () => {
    // The flaw this list was added for: five of the eight questions open with
    // an interrogative, so a sentence sharing only that word was answered
    // confidently and wrongly.
    expect(matchTopics("מתי", SCRAPED)).toEqual([]);
    expect(matchTopics("באיזה", SCRAPED)).toEqual([]);
    // And it must not empty the closed list, which is a different state: the
    // user is mid-sentence, not asking about nothing.
    expect(narrowTopics("מתי", SCRAPED)).toHaveLength(HELP_TOPICS.length);
  });

  it("turns punctuation into a separator rather than joining two words", () => {
    expect(normalise("חופשה, מחלה — וחגים?")).toBe("חופשה מחלה וחגימ");
  });

  it("leaves nothing at all for text with no indexable character in it", () => {
    expect(normalise("?! …")).toBe("");
  });
});

describe("the join between a rule and the page cached behind it", () => {
  it("finds the section a legal link's own anchor names", () => {
    const section = sectionBehind("sickPay", SCRAPED);
    expect(section).not.toBeNull();
    // The heading the anchor was read off, as `links.ts` records it.
    expect(section?.heading).toContain("מחלה");
    expect(section?.text.length).toBeGreaterThan(0);
  });

  it("answers null for a link that names no section", () => {
    // `holidayWork` is a page of its own with no fragment, and that page is not
    // one of the two the application caches.
    expect(sectionBehind("holidayWork", SCRAPED)).toBeNull();
  });

  it("answers null in a clone that has never scraped", () => {
    expect(sectionBehind("sickPay", FRESH_CLONE)).toBeNull();
  });
});

describe("the two lists that have to stay in step", () => {
  it("gives every topic its Hebrew, and every Hebrew entry a topic", () => {
    expect(HELP_TOPICS.map((topic) => topic.id).sort()).toEqual(
      Object.keys(he.help.topics).sort(),
    );
  });

  it("words every topic as a question with somewhere to press", () => {
    for (const topic of HELP_TOPICS) {
      const said = he.help.topics[topic.id];
      expect(said.ask.trim(), topic.id).not.toBe("");
      expect(said.where.trim(), topic.id).not.toBe("");
    }
  });
});

/**
 * The questions the panel answers rather than points at (item 24).
 *
 * **These four are the user's own words, written down on 2026-10-07 before any
 * of this existed** — "what payments am i required to pay", "what payments to
 * 3rd things do i need to pay?", "when is the next time ill need to pay ביטוח
 * לאומי", "when is the next time ill need to pay אגרת ויזה" — asked here in the
 * Hebrew a family would type them in. Which entry each must reach is decided by
 * what the question is about and not by what the matcher returned.
 */
const ANSWERED: { query: string; id: AnswerId; why: string }[] = [
  {
    query: "כמה ביטוח לאומי לשלם החודש",
    id: "nationalInsuranceDue",
    why: "the user's own question, and the one a quarter in arrears is about",
  },
  {
    query: "מתי התשלום הבא למוסד לביטוח לאומי",
    id: "nationalInsuranceDue",
    why: "the same question asked about the date rather than the amount",
  },
  {
    query: "מתי אני משלם את האגרה על הויזה",
    id: "visaFeeDue",
    why: "the fee is dated off the visa's own expiry",
  },
  {
    query: "כמה המשכורת של החודש הזה",
    id: "owedThisMonth",
    why: "what the month comes to is the month's own lines",
  },
  {
    query: "אילו תשלומים לגורמים שלישיים אני חייב",
    id: "thirdPartyDue",
    why: "the user's fourth question, and the one about what is owed elsewhere",
  },
  {
    query: "מה נשאר לי לשלם לצד שלישי",
    id: "thirdPartyDue",
    why: "the same question asked as what is left rather than as what applies",
  },
];

describe("a question the account can answer", () => {
  for (const { query, id, why } of ANSWERED) {
    it(`${query} → ${id} (${why})`, () => {
      expect(bestReach(query, SCRAPED), "scraped").toEqual({ kind: "answer", id });
      expect(bestReach(query, FRESH_CLONE), "fresh clone").toEqual({
        kind: "answer",
        id,
      });
    });
  }

  /**
   * **A question about where to press still reaches the screen that settles
   * it.** The two kinds are ranked in one list, so the risk the moment answers
   * were added is that they swallow the navigation the screen was built for.
   */
  it("leaves the navigation questions where they were", () => {
    for (const { query, topic } of ASKED) {
      expect(bestReach(query, SCRAPED), query).toEqual({
        kind: "topic",
        topic: HELP_TOPICS.find((one) => one.id === topic),
      });
    }
  });

  it("reaches nothing where nothing was asked about", () => {
    expect(bestReach("גידול עגבניות בחממה", SCRAPED)).toBeNull();
  });

  /** A name on its own says the question is about the account and nothing about
   * which question it is, so it may not outrank the words that do. */
  it("does not let a worker's name decide which question was asked", () => {
    expect(bestReach("מתי משלמים אגרת ויזה להאנה", SCRAPED, ["האנה"])).toEqual({
      kind: "answer",
      id: "visaFeeDue",
    });
  });
});

describe("which worker a question is about", () => {
  const workers = [
    { firstName: "האנה", name: "האנה מונטנה" },
    { firstName: "מריה", name: "מריה סנטוס" },
  ];

  /** Both, unless one of them was named — the user's decision of 2026-10-10,
   * and item 24's "where that is unclear it answers for both". */
  it("answers for both where the question names neither", () => {
    expect(workersNamed("מתי משלמים ביטוח לאומי", workers)).toEqual(workers);
  });

  it("answers for the one the question named", () => {
    expect(workersNamed("כמה ביטוח לאומי לשלם עבור מריה", workers)).toEqual([
      workers[1],
    ]);
  });

  /** A name with a prefix attached is the same name: Hebrew writes `להאנה` for
   * "to Hanna", and a family asking about them writes it that way. */
  it("finds a name a preposition is stuck to", () => {
    expect(workersNamed("מה משולם להאנה החודש", workers)).toEqual([workers[0]]);
  });

  /** Both named is both answered, which is the same answer as neither. */
  it("answers for both where both are named", () => {
    expect(workersNamed("מה משולם להאנה ומריה", workers)).toEqual(workers);
  });
});

import { legalLink, type LegalLinkKey } from "@/lib/links";
import type { CachedPage } from "@/lib/scrape/pageSections";
import { he } from "@/lib/i18n/he";
import { HELP_TOPICS, type HelpTopic } from "@/lib/help/topics";

/**
 * Matching what the user typed to the entry that settles it — by hand, with no
 * model, as pure functions over text (specs.md item 24).
 *
 * **It answers from the registry alone when it has to.** The corpus is three
 * things: the topics with the screens they name (`topics.ts`, `screens.ts`), the
 * labels of `legalLinks`, and the stage 5 cached page sections. Only the first
 * is always there — a fresh clone has never scraped, so `pages` arrives empty —
 * and every question the closed list draws must still reach its screen in that
 * state. `match.test.ts` asserts it twice over, once against the committed Kol
 * Zchut page and once against nothing.
 *
 * **The cached sections join through the heading id and nothing else.** A key in
 * `links.ts` ends in the page's own anchor and a cached section carries that
 * same anchor (`links.ts`, `pageSections.ts`), so a topic, its rule and the
 * paragraphs behind it resolve to one unit. Matching a section by its Hebrew
 * heading instead would be a join on a label, which is the silent failure
 * `links.ts` already refuses for addresses.
 *
 * **Nothing here writes an answer.** A hit is a topic, and a topic says which
 * screen settles the question and where to press on it; the explanation stays
 * beside the figure it explains.
 */

/** Niqqud and the cantillation marks, which a user may type or paste and which
 * no corpus text here carries. */
const DIACRITICS = /[֑-ׇ]/g;

/** The letters Hebrew writes differently at the end of a word. A stem reached by
 * stripping a prefix ends mid-word, so one form written with its final letter
 * and the same form written without it have to compare equal; folding them is
 * cheaper than carrying both spellings everywhere. */
const FINAL_FORMS: Record<string, string> = {
  "ך": "כ",
  "ם": "מ",
  "ן": "נ",
  "ף": "פ",
  "ץ": "צ",
};

/** The definite article, which is the one prefix that stacks under another. */
const ARTICLE = "ה";

/**
 * The one-letter prefixes Hebrew attaches to a word: the conjunction, the
 * definite article, the four prepositions and the relative.
 *
 * **They are stripped into an extra form and never in place.** The word for
 * illness begins with one of these letters and is not a prefixed form of
 * anything, so a word reduced to a stem would match the wrong entry with
 * nothing about it looking wrong. Both forms are indexed instead and a hit on
 * either counts.
 */
const PREFIXES = new Set([
  "ו",
  ARTICLE,
  "ב",
  "ל",
  "ש",
  "מ",
  "כ",
]);

/** The shortest stem worth indexing: below it, stripping a prefix leaves a
 * fragment that reaches half the corpus. */
const MIN_STEM = 3;

/** The shortest typed word that may match by its opening letters rather than
 * whole, so a word left unfinished still reaches the one it was going to be
 * while a two-letter word has to match exactly. */
const MIN_PREFIX_MATCH = 3;

/** Hebrew letters, Latin letters and digits. Everything else is a separator. */
const INDEXED = /[א-ת0-9a-z]/;

/**
 * Text reduced to what two spellings of one word have in common: no diacritics,
 * no final forms, no punctuation, one space between words.
 *
 * Latin is lower-cased and kept, because a few labels carry it and a user may
 * type it.
 */
export function normalise(text: string): string {
  let folded = "";
  for (const character of text.toLowerCase().replace(DIACRITICS, "")) {
    const base = FINAL_FORMS[character] ?? character;
    folded += INDEXED.test(base) ? base : " ";
  }
  return folded.trim().replace(/\s+/g, " ");
}

/** A word and the forms of it a prefix may be hiding. */
function stemsOf(word: string): string[] {
  const forms = [word];
  const first = word[0];
  if (first !== undefined && PREFIXES.has(first) && word.length - 1 >= MIN_STEM) {
    const once = word.slice(1);
    forms.push(once);
    if (once.startsWith(ARTICLE) && once.length - 1 >= MIN_STEM) {
      forms.push(once.slice(1));
    }
  }
  return forms;
}

/**
 * The words that say nothing about which screen is wanted, and so score
 * nothing.
 *
 * **Without this list a matcher is confidently wrong, which is worse than being
 * empty-handed.** Five of the eight questions begin with an interrogative, so
 * "when were the first coins struck" scored a full hit on the question asking
 * when recuperation is paid — on the word "when" alone — and answered it. A
 * question word, a pronoun and a preposition appear in every other sentence a
 * family types; what distinguishes one question from another is the nouns.
 *
 * **It holds no word that names anything.** `לפני` and `אחרי` are deliberately
 * absent, because `לפני הייצוא` is a screen's name and a user typing it must
 * reach that screen.
 */
const UNINFORMATIVE = new Set([
  "מה", "מי", "מתי", "איך", "איפה", "למה", "כמה", "האם", "איזה", "היכן",
  "מדוע", "כיצד", "לאן",
  "אני", "אתה", "את", "הוא", "היא", "אנחנו", "הם", "הן",
  "שלי", "שלו", "שלה", "שלהם", "שלנו",
  "של", "על", "עם", "זה", "זו", "זאת", "אלה", "אלו",
  "אותו", "אותה", "אותם", "לי", "לו", "לה", "להם", "לנו",
  "לא", "כן", "גם", "רק", "או", "אם", "כי", "אבל", "אז", "עוד", "כבר",
  "יש", "אין", "היה", "היתה", "היו",
  "צריך", "צריכה", "רוצה", "רוצים", "אפשר", "מותר",
  "כדי", "בשביל", "בגלל",
]);

/** The words of a piece of text, each with its stems. A one-letter word is
 * dropped: it is a preposition standing alone and reaches everything. */
function wordsOf(text: string): string[][] {
  return normalise(text)
    .split(" ")
    .filter((word) => word.length > 1)
    .map(stemsOf);
}

/**
 * The words of what the user typed, with the uninformative ones gone.
 *
 * A word is dropped when **any** of its forms is uninformative, because the
 * prefixes attach to these words as readily as to any other: `באיזה` is
 * `ב` + `איזה` and says no more than `איזה` does.
 */
function typedWordsOf(query: string): string[][] {
  return wordsOf(query).filter(
    (forms) => !forms.some((form) => UNINFORMATIVE.has(form)),
  );
}

/**
 * Whether the query has not said anything yet — empty, punctuation, or nothing
 * but question words.
 *
 * **It is a different state from matching nothing**, and the screen draws the
 * two differently: someone who has typed `מה` is mid-sentence and is shown the
 * whole list, while someone who asked about tomatoes is told so. Both are
 * decided here rather than at the screen, so the stop-word list is consulted in
 * one place.
 */
export function saysNothing(query: string): boolean {
  return typedWordsOf(query).length === 0;
}

/** Whether a typed word reaches any word of a field. A typed word of three
 * letters or more may match by its opening letters, which is what lets the list
 * narrow while the user is still typing; a shorter one has to match whole. */
function reaches(typed: string[], field: string[][]): boolean {
  return field.some((forms) =>
    forms.some((form) =>
      typed.some(
        (stem) =>
          stem === form ||
          (stem.length >= MIN_PREFIX_MATCH && form.startsWith(stem)),
      ),
    ),
  );
}

/**
 * What a hit in each field is worth.
 *
 * **The order is how directly a field answers the question**, not how much text
 * it holds: the topic's own question is what the user was trying to say, the
 * screen's name is what the answer will tell them, and a cached paragraph is the
 * loosest of the seven — it is a page about the law, and a word appearing
 * somewhere inside it says little. Without that ordering the longest field wins
 * every query, because long text has more words to be hit.
 */
const WEIGHTS = {
  ask: 6,
  screenName: 4,
  where: 3,
  settles: 2,
  ruleLabel: 2,
  sectionHeading: 2,
  sectionText: 1,
} as const;

/** The page address and the section inside it that a legal link names. A link
 * with no fragment names no section. */
function anchorOf(url: string): { page: string; anchor: string } | null {
  const hash = url.indexOf("#");
  if (hash === -1) return null;
  return { page: url.slice(0, hash), anchor: url.slice(hash + 1) };
}

/** A Kol Zchut address is written in Hebrew letters and comes back
 * percent-encoded from a fetch, so the two spellings of one page have to compare
 * equal. A malformed escape is left as it stands rather than throwing: this runs
 * while the user is typing. */
function decoded(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * The cached section behind a legal link, or null when no stored page carries
 * it.
 *
 * **Null is the ordinary state and not a fault.** Two pages are cached at all
 * (`pageSections.ts`), four of the keys name no section, and a clone that has
 * never scraped has nothing — so every caller treats an absent section as text
 * it simply does not have.
 */
export function sectionBehind(
  key: LegalLinkKey,
  pages: readonly CachedPage[],
): { heading: string; text: string } | null {
  const named = anchorOf(legalLink(key).url);
  if (named === null) return null;
  const wanted = decoded(named.anchor);
  for (const page of pages) {
    if (decoded(page.url) !== decoded(named.page)) continue;
    const section = page.sections.find(
      (candidate) => decoded(candidate.anchor) === wanted,
    );
    if (section !== undefined) {
      return { heading: section.heading, text: section.text };
    }
  }
  return null;
}

/** A topic that matched, with what it scored. */
export interface HelpHit {
  topic: HelpTopic;
  score: number;
}

/** Everything one topic can be matched on, each with its weight. */
function haystackOf(
  topic: HelpTopic,
  pages: readonly CachedPage[],
): { weight: number; words: string[][] }[] {
  const said = he.help.topics[topic.id];
  const screen = he.screens[topic.screen];
  const fields: { weight: number; text: string }[] = [
    { weight: WEIGHTS.ask, text: said.ask },
    { weight: WEIGHTS.screenName, text: screen.name },
    { weight: WEIGHTS.where, text: said.where },
    { weight: WEIGHTS.settles, text: screen.settles },
  ];
  if (topic.rule !== null) {
    fields.push({ weight: WEIGHTS.ruleLabel, text: legalLink(topic.rule).label });
    const section = sectionBehind(topic.rule, pages);
    if (section !== null) {
      fields.push({ weight: WEIGHTS.sectionHeading, text: section.heading });
      fields.push({ weight: WEIGHTS.sectionText, text: section.text });
    }
  }
  return fields.map((field) => ({
    weight: field.weight,
    words: wordsOf(field.text),
  }));
}

/**
 * The topics a query reaches, best first.
 *
 * Each typed word scores the heaviest field it reaches, and scores it once — so
 * a word repeated through a long cached paragraph cannot outweigh the same word
 * in the question itself. A word that reaches nothing costs nothing: a typed
 * question is mostly words no corpus has, and docking them would leave only
 * one-word queries matching anything.
 *
 * Ties keep the registry's order, which is the order the closed list draws, so a
 * list that narrows never reorders what stayed in it.
 */
export function matchTopics(query: string, pages: readonly CachedPage[]): HelpHit[] {
  const typed = typedWordsOf(query);
  if (typed.length === 0) return [];
  const hits: HelpHit[] = [];
  for (const topic of HELP_TOPICS) {
    const haystack = haystackOf(topic, pages);
    let score = 0;
    for (const word of typed) {
      let best = 0;
      for (const field of haystack) {
        if (field.weight > best && reaches(word, field.words)) best = field.weight;
      }
      score += best;
    }
    if (score > 0) hits.push({ topic, score });
  }
  return hits.sort((one, other) => other.score - one.score);
}

/**
 * What the closed list shows: every topic until the user has typed something,
 * and from then on the ones their words reach.
 *
 * **A query that reaches nothing narrows to nothing rather than back to
 * everything.** A list returning to its full length would read as a match on all
 * eight; the screen says in words that nothing matched, and offers the registry
 * instead.
 *
 * **A query of nothing but question words has not said anything yet**, so it
 * leaves the list whole rather than emptying it: someone who has typed `מה` is
 * mid-sentence, not asking about nothing.
 */
export function narrowTopics(query: string, pages: readonly CachedPage[]): HelpTopic[] {
  if (saysNothing(query)) return [...HELP_TOPICS];
  return matchTopics(query, pages).map((hit) => hit.topic);
}

/** The one topic a typed question reaches, or null when it reaches none. */
export function bestTopic(
  query: string,
  pages: readonly CachedPage[],
): HelpTopic | null {
  return matchTopics(query, pages)[0]?.topic ?? null;
}

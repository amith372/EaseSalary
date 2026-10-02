/**
 * Every action that rests on a legal rule carries a link to the page that
 * states it, kept in one list rather than scattered through the interface, so a
 * page that moves is fixed in a single place (specs.md item 26).
 *
 * **The pages are the caregiver ones, not the general ones.** Kol Zchut writes
 * a general article for each entitlement and a second one for a live-in foreign
 * caregiver employed in the patient's home, and where both exist the second is
 * the primary link: it is the one that describes this worker. The general
 * articles are not wrong — the minimum wage is the same for a foreign worker
 * and an Israeli one — they are simply about a wider category, and the user who
 * follows a link wants the rule as it applies to them.
 *
 * **Never link to `דמי_חגים`, and this is not a style preference.** That page
 * is about workers paid by the day and by the hour, a category this worker is
 * not in, and it says in so many words that a worker on a monthly salary
 * receives no holiday pay. A user who read it would conclude the exact opposite
 * of what this application does. Holiday work is `holidayWork` below, which
 * points at the page about *payment for work on a holiday*, and the two titles
 * are close enough that the wrong one is an easy correction to make by
 * accident.
 *
 * **Every address below has been checked against the live site.** None is
 * assembled from an article's title: a slug built from a page's name is the
 * mistake Part 5 records against a holiday address rebuilt rather than stored,
 * where the address looked right and returned nothing, which reads exactly like
 * a rule that does not exist. Where no dedicated page could be found, the key
 * points at a section of a page that does exist rather than at a plausible
 * address — and it names that section by the page's own heading id, which is
 * also the unit the page's cached text is segmented into (Part 3).
 */

const KOL_ZCHUT = "https://www.kolzchut.org.il/he";

/**
 * The one page that carries most of this employment: the wage, the rest-eve
 * supplement, the weekly rest, the sick accrual and the recuperation ladder are
 * all sections of it. Several keys below point at it on purpose — the key names
 * the *action* the user was taking, which is what item 26 asks for, so two
 * actions resting on the same article still get their own entry and their own
 * label rather than sharing one.
 */
export const CAREGIVER_TERMS = `${KOL_ZCHUT}/תנאי_העסקה_של_עובד_זר_בסיעוד_המועסק_בבית_המטופל`;

/**
 * A single section of that page, named by the page's **own** heading id.
 *
 * **The anchor is not a nicety and it is not assembled from a label.** The page
 * text is cached segmented by those same headings (Part 3), so a key here, a
 * cached section and — on the help screen — a question all resolve to one unit only
 * because they all carry the heading id. An anchor invented from a Hebrew label
 * would land the user at the top of the page and match no section at all, which
 * is the same silent failure `links.ts` already refuses for addresses.
 *
 * Every anchor below is read off the saved page in
 * `src/lib/scrape/fixtures/kolzchut-caregiver-terms.html`, and a test asserts
 * that each one still names a section of it — so a heading renamed at the
 * source fails the suite rather than quietly sending the user nowhere.
 */
function termsSection(anchor: string): string {
  return `${CAREGIVER_TERMS}#${anchor}`;
}

export interface LegalLink {
  /** The label the interface shows, before " — באתר כל זכות". */
  label: string;
  url: string;
}

export const legalLinks = {
  minimumWage: {
    label: "שכר מינימום לעובד/ת סיעוד",
    // The general שכר_מינימום article is valid — the figure is the same — but
    // this one is about this worker, so it is the primary link (item 26).
    url: termsSection("שכר_מינימום"),
  },
  caregiverWage: {
    label: "תנאי העסקה של עובד/ת זר/ה בסיעוד",
    url: CAREGIVER_TERMS,
  },
  restDayWork: {
    label: "מנוחה שבועית לעובד/ת זר/ה בסיעוד",
    // The weekly-rest section of the terms page, which links onward to the
    // article on a caregiver's weekly rest. The section is linked rather than
    // that article, because the onward address has not been read here and a
    // slug assembled from a page's title is the mistake Part 5 records against
    // an address rebuilt rather than stored.
    url: termsSection("גמול_עבור_העסקה_במנוחה_השבועית"),
  },
  holidayWork: {
    label: "תשלום עבור ימי חג לעובד/ת זר/ה בסיעוד",
    // Not `דמי_חגים`. See the warning at the top of this file. This article is
    // the caregiver's own: nine holidays of them faith or of Israel, a worked one
    // paid at 150% plus an hour, and an unworked one leaving the salary whole
    // (item 10).
    url: `${KOL_ZCHUT}/תשלום_עבור_ימי_חג_לעובד_זר_בסיעוד`,
  },
  annualLeave: {
    label: "חופשה שנתית לעובד/ת זר/ה בסיעוד",
    // The caregiver's own section: accrual, scheduling, and no redemption while
    // they are employed. It links onward to the general article, which holds the
    // seniority ladder of item 7.
    url: termsSection("חופשה_שנתית"),
  },
  sickPay: {
    label: "ימי מחלה לעובד/ת סיעוד",
    // 1.5 days a month, 18 a year, accruing to 90 — the figures of item 8 —
    // are in this section rather than in the general דמי_מחלה article.
    url: termsSection("דמי_מחלה"),
  },
  recuperation: {
    label: "דמי הבראה",
    url: termsSection("דמי_הבראה"),
  },
  hospitalOvertime: {
    label: "שעות נוספות לעובד/ת זר/ה בסיעוד",
    // The page's summary box is where it says a live-in caregiver is not
    // entitled to overtime pay (specs.md item 20); no section of its own does.
    url: termsSection("בקצרה"),
  },
  nationalInsurance: {
    label: "ביטוח לאומי עבור עובד/ת זר/ה בסיעוד",
    // This page settles what the 3.6% is taken on (item 19).
    url: `${KOL_ZCHUT}/דיווח_ותשלום_דמי_ביטוח_לאומי_עבור_עובד_זר_בסיעוד`,
  },
  employmentGuide: {
    label: "מדריך להעסקת עובד/ת זר/ה בסיעוד",
    // General background, the fees, and the employment permit — which is what
    // the visa, licence, agency and placement lines of column H rest on.
    url: `${KOL_ZCHUT}/מדריך_להעסקת_עובד_זר_בסיעוד`,
  },
  medicalInsurance: {
    label: "ביטוח רפואי לעובד/ת זר/ה",
    // No dedicated article for a foreign worker's medical insurance exists, and
    // the terms page carries the rule anyway. This section is the employer's
    // obligation to insure them; the cap on deducting for it — half the cost and
    // no more than ₪154.29 a month, which this application deducts nothing of
    // (item 16) — is a paragraph of ניכויים_משכר_העובד, where `incomeTax`
    // points. The obligation is what the label promises, so it is what the link
    // opens at.
    url: termsSection("ביטוח_רפואי"),
  },
  incomeTax: {
    label: "ניכוי מס הכנסה משכר העובד/ת",
    // The application calculates the tax (item 17), so this link is not a
    // substitute for a figure but the source of the rule behind it: the terms
    // page states that the employer deducts on the basis of the wage and of the
    // credits the worker is entitled to, and that a caregiver in home care
    // receives 2.25 credit points, more than a foreign worker in another
    // sector. That credit is what the automatic mode derives from the gender on
    // the profile, and what stops a family deducting too much when they choose
    // a flat percentage instead.
    url: termsSection("ניכויים_משכר_העובד"),
  },
  wageDeductions: {
    label: "ניכויים משכר העובד/ת",
    // What an advance repaid out of the salary rests on (item 20): the same
    // section `incomeTax` opens at, named for the deduction the user is
    // entering rather than for the tax.
    url: termsSection("ניכויים_משכר_העובד"),
  },
  wageProtection: {
    label: "תלוש שכר",
    // The general article on purpose: the payslip rules are the same for every
    // employee, and no article restates them for a foreign caregiver.
    // What item 2 rests on: this page is the one that lists what a payslip must
    // carry — the period and the days worked, the vacation and sick days used
    // that month and the days left, and each payment as its type, its number of
    // units and its final amount. Those are the export's structure, not a
    // decision this application took.
    url: `${KOL_ZCHUT}/תלוש_שכר`,
  },
} as const satisfies Record<string, LegalLink>;

export type LegalLinkKey = keyof typeof legalLinks;

export function legalLink(key: LegalLinkKey): LegalLink {
  return legalLinks[key];
}

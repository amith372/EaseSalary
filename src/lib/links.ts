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
 * follows a link wants the rule as it applies to her.
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
 * mistake Part 5 records against Ukraine's holiday list, where the address
 * looked right and returned nothing, which reads exactly like a rule that does
 * not exist. Where no dedicated page could be found, the key points at a
 * section of a page that does exist rather than at a plausible address.
 */

const KOL_ZCHUT = "https://www.kolzchut.org.il/he";

/**
 * The one page that carries most of this employment: the wage, the Friday
 * supplement, the weekly rest, the sick accrual and the recuperation ladder are
 * all sections of it. Several keys below point at it on purpose — the key names
 * the *action* the user was taking, which is what item 26 asks for, so two
 * actions resting on the same article still get their own entry and their own
 * label rather than sharing one.
 */
const CAREGIVER_TERMS = `${KOL_ZCHUT}/תנאי_העסקה_של_עובד_זר_בסיעוד_המועסק_בבית_המטופל`;

interface LegalLink {
  /** The label the interface shows, before " — באתר כל זכות". */
  label: string;
  url: string;
}

export const legalLinks = {
  minimumWage: {
    label: "שכר מינימום לעובד/ת סיעוד",
    // The general שכר_מינימום article is valid — the figure is the same — but
    // this one is about this worker, so it is the primary link (item 26).
    url: CAREGIVER_TERMS,
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
    // Ukraine's holiday list.
    url: CAREGIVER_TERMS,
  },
  holidayWork: {
    label: "תשלום על עבודה בימי חג",
    // Not `דמי_חגים`. See the warning at the top of this file.
    url: `${KOL_ZCHUT}/תשלום_על_עבודה_בימי_חג`,
  },
  annualLeave: {
    label: "חופשה שנתית",
    // The general article, and deliberately: the terms page does not restate
    // the accrual ladder. The seniority tiers of item 7 are here.
    url: `${KOL_ZCHUT}/חופשה_שנתית`,
  },
  sickPay: {
    label: "ימי מחלה לעובד/ת סיעוד",
    // 1.5 days a month, 18 a year, accruing to 90 — the figures of item 8 —
    // are in the terms page rather than in the general דמי_מחלה article.
    url: CAREGIVER_TERMS,
  },
  recuperation: {
    label: "דמי הבראה",
    url: CAREGIVER_TERMS,
  },
  nationalInsurance: {
    label: "ביטוח לאומי עבור עובד/ת זר/ה בסיעוד",
    // This page settles what the 3.6% is taken on (item 19), which was
    // previously inferred from the family's workbook.
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
    // the terms page carries the rule anyway: the employer may deduct up to half
    // the cost of the insurance and no more than ₪154.29 a month — which this
    // application deducts nothing of (item 16).
    url: CAREGIVER_TERMS,
  },
  incomeTax: {
    label: "ניכוי מס הכנסה משכר העובד/ת",
    // The application never calculates the tax, so this link is the whole of
    // what it can give the user before she types a figure (item 17). The terms
    // page states the rule — the employer deducts on the basis of the wage and
    // of the credits the worker is entitled to — and a caregiver in home care
    // receives 2.25 credit points, more than a foreign worker in another
    // sector, which is the fact that stops her deducting too much.
    url: CAREGIVER_TERMS,
  },
  wageProtection: {
    label: "תלוש שכר",
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

/**
 * Every action that rests on a legal rule carries a link to the page that
 * states it, kept in one list rather than scattered through the interface, so a
 * page that moves is fixed in a single place (specs.md item 25).
 *
 * Only `minimumWage` is quoted verbatim from specs.md Part 3. The rest follow
 * Kol Zchut's article-title address pattern and have not been checked against
 * the live site; a wrong slug here shows up as one dead link and is corrected
 * in this file alone, which is the point of the list.
 */

const KOL_ZCHUT = "https://www.kolzchut.org.il/he";

interface LegalLink {
  /** The label the interface shows, before " — באתר כל זכות". */
  label: string;
  url: string;
}

export const legalLinks = {
  minimumWage: {
    label: "שכר מינימום",
    url: `${KOL_ZCHUT}/שכר_מינימום`,
  },
  caregiverWage: {
    label: "שכר לעובד/ת סיעוד",
    url: `${KOL_ZCHUT}/העסקת_עובד_זר_בסיעוד`,
  },
  restDayWork: {
    label: "עבודה במנוחה השבועית",
    url: `${KOL_ZCHUT}/עבודה_במנוחה_השבועית`,
  },
  holidayWork: {
    label: "עבודה בחגים",
    url: `${KOL_ZCHUT}/עבודה_בחגים`,
  },
  annualLeave: {
    label: "ימי חופשה",
    url: `${KOL_ZCHUT}/חופשה_שנתית`,
  },
  sickPay: {
    label: "דמי מחלה",
    url: `${KOL_ZCHUT}/דמי_מחלה`,
  },
  recuperation: {
    label: "דמי הבראה",
    url: `${KOL_ZCHUT}/דמי_הבראה`,
  },
  nationalInsurance: {
    label: "ביטוח לאומי",
    url: `${KOL_ZCHUT}/ביטוח_לאומי_עבור_עובד_זר`,
  },
  medicalInsurance: {
    label: "ביטוח רפואי לעובד זר",
    url: `${KOL_ZCHUT}/ביטוח_רפואי_לעובד_זר`,
  },
} as const satisfies Record<string, LegalLink>;

export type LegalLinkKey = keyof typeof legalLinks;

export function legalLink(key: LegalLinkKey): LegalLink {
  return legalLinks[key];
}

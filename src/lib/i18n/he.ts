/**
 * Every user-facing string in the application, in one file (CLAUDE.md). Code,
 * comments and identifiers stay English; nothing here is a rule, only wording.
 *
 * A placeholder in square brackets — "[סכום]", "[מספר]" — is a value the
 * calculation engine has not supplied yet. It is written as a Hebrew string
 * rather than left blank so a screen built against fixtures reads as the canvas
 * draws it.
 */
export const he = {
  app: {
    /** The wordmark is Latin and stays Latin: it is a name, not a word. */
    name: "EaseSalary",
    description: "ניהול המשכורת החודשית של עובד/ת סיעוד — בלי אקסל ובלי נוסחאות.",
  },

  nav: {
    home: "דף הבית",
    workers: "עובדים/ות",
    payments: "תשלומים",
    settings: "הגדרות",
    reports: "דוחות",
    /** Read by a screen reader in place of the sidebar itself. */
    landmark: "ניווט ראשי",
    help: {
      title: "צריך/ה עזרה?",
      body: "נסביר כל שלב בשפה פשוטה",
    },
  },

  header: {
    greeting: "שלום,",
    yourName: "[השם שלך]",
    today: "[יום בשבוע], [תאריך]",
    alerts: "התראות",
    avatarAlt: "התמונה שלך",
  },

  placeholder: {
    amount: "[סכום]",
    count: "[מספר]",
    date: "[תאריך]",
    year: "[שנה]",
    name: "[שם]",
    workerName: "[שם העובד/ת]",
    description: "[תיאור]",
  },

  units: {
    days: "ימים",
    day: "יום",
  },

  money: {
    manual: "עודכן ידנית",
  },

  why: {
    /** The "?" button carries no visible text, so its label is its whole
     * meaning to a screen reader. */
    amountLabel: "איך חושב הסכום",
    balanceLabel: "איך חושבה היתרה",
    /** Follows the rule's own name: "ימי חופשה — באתר כל זכות". */
    linkSuffix: "באתר כל זכות",
  },

  calendar: {
    hint: "לחיצה על יום מסמנת חופשה, מחלה או חג",
    today: "היום",
    previousMonth: "לחודש הקודם",
    nextMonth: "לחודש הבא",
    /** Sunday first — the week begins on Sunday and Sunday sits on the right. */
    dayNames: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"],
    monthNames: [
      "ינואר",
      "פברואר",
      "מרץ",
      "אפריל",
      "מאי",
      "יוני",
      "יולי",
      "אוגוסט",
      "ספטמבר",
      "אוקטובר",
      "נובמבר",
      "דצמבר",
    ],
    marks: {
      vacation: "יום חופש",
      sick: "יום מחלה",
      holiday: "חג",
      /** The Saturday the user marked free — an exception she recorded. */
      freeSaturday: "שבת חופשית",
      /** The ordinary weekly rest day, which every worker has and which is not
       * an entitlement. A different state from the one above. */
      restDay: "שבת",
    },
    selection: {
      /** "‎[מ] – ‎[עד] · ‎[מספר] ימים" while sweeping. */
      separator: "–",
      dayCount: "ימים",
      /** A span running past the month's end is stored whole and shown clipped;
       * the overflow is said in words rather than silently truncated. */
      continuesInto: "נמשך אל תוך החודש הבא",
      continuesFrom: "נמשך מהחודש הקודם",
    },
    /** The mark tool the user picks before drawing on the calendar. Marking
     * off — the tool chosen again — still clears a day, it just draws none. */
    tools: {
      title: "לסמן ימים",
      hint: "אפשר לסמן יום אחד, או לגרור על כמה ימים ברצף",
    },
    /**
     * A range applies to the days it legally can and says which it skipped and
     * why, rather than being refused whole over one day the user would then
     * have to go and find herself.
     */
    skipped: {
      title: "ימים שלא סומנו",
      weeklyRest: "שבת היא כבר יום המנוחה השבועי, ולכן אינה נגרעת ממכסת החופשה",
      notSaturday: "רק שבת יכולה להיות מסומנת כשבת חופשית",
      alreadyMarked: "היום כבר מסומן",
      restDayHoliday: "שבת שסומנה כחופשית משולמת פעם אחת, ולכן אי אפשר לסמן בה גם חג",
      dismiss: "להסתיר",
    },
  },

  status: {
    needsAttention: "צריך לטפל",
    settled: "הכול מעודכן",
  },

  home: {
    greeting: "בוקר טוב,",
    monthOf: "החודש של",
    workerSwitcher: {
      showing: "מוצג/ת כרגע",
      previous: "לעובד/ת הקודם/ת",
      next: "לעובד/ת הבא/ה",
    },
    hero: {
      readyToCalculate: "מוכן לחישוב",
      body: "נעבור יחד על הימים, החגים והמקדמה — ואז נפיק את דף המשכורת.",
      action: "להמשיך לחודש",
    },
    paid: {
      title: "מה שולם החודש",
      total: "לתשלום לעובד/ת",
      totalExplanation: "השכר של החודש והתוספות עליו, פחות המקדמה שנפרעת החודש.",
      exportToExcel: "לייצא לאקסל",
      fullSheet: "לדף המשכורת המלא",
    },
    balances: {
      title: "יתרות",
      vacation: "ימי חופשה שנשארו",
      sick: "ימי מחלה שנשארו",
    },
    alerts: {
      title: "גם מחכה לך",
      whatTheLawSays: "מה אומר החוק",
    },
  },

  lines: {
    baseSalary: "שכר החודש",
    supplements: "תוספות (שישי, שבת, חג)",
    advanceRepaid: "מקדמה שנפרעת",
  },

  explanations: {
    baseSalary:
      "משכורת מלאה, כי לקיחת יום חופשה לא מקטינה את המשכורת החודשית.",
    supplements:
      "עבודה בשישי, בשבת או בחג משולמת בתוספת מעל השכר הרגיל.",
    advanceRepaid:
      "זה החלק מהמקדמה שניתנה מראש ומנוכה החודש, לפי מה שהוסכם.",
    vacationBalance:
      "מכסת החופשה השנתית, פחות הימים שסומנו בלוח השנה עד היום.",
    sickBalance:
      "ימי המחלה נצברים בכל חודש עבודה, ומה שלא נוצל נשמר לחודשים הבאים.",
  },
} as const;

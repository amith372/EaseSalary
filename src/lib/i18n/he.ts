import { formatDays } from "@/lib/money";

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
    /** Read by a screen reader in place of the nav itself. */
    landmark: "ניווט ראשי",
    help: {
      /** The circular "?" in the top bar shows no text, so this is its whole
       * meaning to a screen reader. */
      title: "צריך/ה עזרה?",
    },
  },

  header: {
    /** The bar carries the greeting, so the home screen needs no heading row of
     * its own — the row it saves is the one that made the page scroll. */
    greeting: "בוקר טוב,",
    yourName: "[השם שלך]",
    alerts: "התראות",
    avatarAlt: "התמונה שלך",
    /** Which worker every screen is about. The caption labels the group rather
     * than sitting above the name: a 62px bar has room for one line. */
    workerSwitcher: {
      showing: "מוצג/ת כרגע",
      previous: "לעובד/ת הקודם/ת",
      next: "לעובד/ת הבא/ה",
    },
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
    hint: "לחיצה על יום, ואז על יום נוסף, מסמנת טווח",
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
      vacation: "חופשה",
      sick: "מחלה",
      holiday: "חג",
      /** The Saturday the worker had off — an exception the user recorded. */
      freeSaturday: "שבת חופשית",
      /** A day she worked, which is every day carrying no mark at all — an
       * unmarked Saturday included. It labels the legend and marks nothing. */
      workDay: "יום עבודה",
    },
    selection: {
      /** "‎16–20 באוגוסט": the day numbers, then the month with its prefix. */
      separator: "–",
      inMonth: "ב",
      dayCount: "ימים",
      oneDay: "יום אחד",
      /** A span running past the month's end is stored whole and shown clipped;
       * the overflow is said in words rather than silently truncated. */
      continuesInto: "נמשך אל תוך החודש הבא",
      continuesFrom: "נמשך מהחודש הקודם",
    },
    /** The panel that opens once a range has been drawn and asks what the range
     * means. The kind is chosen after the days rather than before them. */
    picker: {
      title: "איך לסמן?",
      clear: "לנקות סימון",
      cancel: "ביטול",
      cancelLabel: "לבטל בחירה",
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
      fullSheet: "לצפייה בדף המשכורת המלא",
    },
    balances: {
      title: "יתרות",
      vacation: "ימי חופשה שנשארו",
      sick: "ימי מחלה שנשארו",
    },
    alerts: {
      title: "גם מחכה לך",
      /** The "?" at the end of an alert row shows no text, so this is its whole
       * meaning to a screen reader. The link it opens sits inside the panel,
       * beside the sentence, rather than on the row. */
      whatTheLawSays: "מה אומר החוק",
    },
  },

  lines: {
    baseSalary: "שכר החודש",
    supplements: "תוספות (שישי, שבת, חג)",
    advanceRepaid: "מקדמה שנפרעת",
  },

  explanations: {
    baseSalary: "משכורת מלאה, כי לקיחת יום חופשה לא מקטינה את המשכורת החודשית.",
    supplements: "עבודה בשישי, בשבת או בחג משולמת בתוספת מעל השכר הרגיל.",
    advanceRepaid: "זה החלק מהמקדמה שניתנה מראש ומנוכה החודש, לפי מה שהוסכם.",
    vacationBalance: "מכסת החופשה השנתית, פחות הימים שסומנו בלוח השנה עד היום.",
    sickBalance: "ימי המחלה נצברים בכל חודש עבודה, ומה שלא נוצל נשמר לחודשים הבאים.",
    nationalInsurance:
      "ההפרשה לביטוח לאומי מחושבת מעלות החודש המלאה, ומשולמת אחת לרבעון בדיעבד.",
    medicalInsurance:
      "מעסיק/ה של עובד/ת סיעוד חייב/ת לבטח אותו/ה בביטוח רפואי, והפוליסה מתחדשת מדי שנה.",
    holidaysChosen:
      "המכסה היא תשעה ימי חג לשנה מלאה, והימים נבחרים מראש מתוך רשימת החגים של ארץ המוצא.",
  },

  /**
   * The month sheet's own rows: the label the export writes on each, and the
   * sentence behind its "?" (specs.md item 24). The sentences say how a figure
   * was reached in words rather than as a formula — a sentence that reads as
   * arithmetic has failed at the one job it has.
   *
   * Wording that carries a number is a function, so the number is placed inside
   * a Hebrew sentence here rather than assembled by the engine out of fragments:
   * a sentence built by concatenation is a sentence no one can correct without
   * reading code.
   */
  sheet: {
    lines: {
      base: "שכר החודש",
      fridaySupplement: "תוספת ימי שישי",
      restDays: "עבודה בשבת",
      holidaysWorked: "עבודה בחג",
      sickDeduction: "ניכוי ימי מחלה",
      incomeTax: "מס הכנסה",
      advanceGranted: "מקדמה שניתנה",
      advanceRepaid: "מקדמה שנפרעת",
    },

    thirdParty: {
      medicalInsurance: "ביטוח רפואי",
      nationalInsurance: "ביטוח לאומי",
      agencyFee: "דמי טיפול",
      placementFee: "דמי תיווך",
      visaFee: "אגרת ויזה",
      licenceFee: "חידוש רישיון",
    },

    /** The sheet prints a total per column before the month's own two totals:
     * criterion 1 checks four figures, not two. */
    subtotals: {
      E: "סך שכר החודש",
      F: "סך שבתות וחגים",
      G: "סך תשלומים חד־פעמיים",
      H: "סך תשלומים לגורמים שלישיים",
    },

    reporting: {
      standardDays: "ימי תקן",
      actualDays: "ימים בפועל",
      daysUsed: "ימים שנוצלו החודש",
      balanceLeft: "יתרה שנשארה",
      nationalInsuranceEstimate: "אומדן ביטוח לאומי לחודש",
      /** Precedes the months a quarterly or yearly payment covers, which travel
       * beside the line rather than inside its label (specs.md item 19). */
      coversMonths: "בגין החודשים",
    },

    why: {
      base: (standardDays: number) =>
        `משכורת חודשית מלאה. היא נשענת על ${standardDays} ימי התקן של החודש — כל ימי החודש חוץ מהשבתות — ולכן חופשה או מחלה אינן מקטינות אותה.`,
      fridaySupplement: (fridays: number) =>
        `תוספת קבועה שנקבעה בפרופיל עבור כל יום שישי, והחודש היא משולמת עבור ${fridays} ימי שישי.`,
      restDays: (saturdays: number) =>
        `עבודה בשבת משולמת בתעריף המנוחה השבועית: יום עבודה ועוד שעה, בתוספת של חצי. המנוחה השבועית של עובד/ת סיעוד היא 25 שעות ולא 24, ולכן התעריף גבוה מיום וחצי רגיל. החודש נעבדו ${saturdays} שבתות.`,
      holidaysWorked: (holidays: number) =>
        `חג שנעבד משולם באותו תעריף כמו שבת. חג שלא נעבד אינו מזכה בתוספת, כי המשכורת החודשית משולמת עליו במלואה. החודש נעבדו ${holidays} ימי חג.`,
      sickDeduction: (days: number) =>
        `המשכורת החודשית משולמת במלואה גם בחודש שהיו בו ימי מחלה, ולכן השורה הזו מחזירה את החלק שדמי המחלה אינם מכסים: על היום הראשון של כל מחלה לא משולמים דמי מחלה, על השני והשלישי משולם חצי יום, ומהיום הרביעי ואילך המחלה משולמת במלואה. כך נשאר בדיוק מה שהחוק מזכה בו. החודש הניכוי הוא על ${formatDays(days)} ימים, בערך של יום מחלה. שבתות שבתוך תקופת המחלה נספרות לתקופה ונגרעות מהמאזן, אך אינן משולמות ואינן מנוכות — המשכורת ממילא אינה כוללת אותן.`,
      incomeTax:
        "היישום אינו מחשב מס הכנסה. השורה מתחילה באפס, והסכום מוזן ידנית על ידך. הכלל הוא שהמעסיק מנכה מס לפי גובה השכר ולפי הזיכויים שהעובד/ת זכאי/ת להם, ועובד/ת זר/ה בסיעוד מקבל/ת 2.25 נקודות זיכוי — יותר מעובד/ת זר/ה בענף אחר. מי שאינו יודע זאת מנכה יותר מדי, ולכן כדאי לקרוא את הכלל לפני הזנת הסכום.",
      advanceGranted: (advanceNumber: number) =>
        `מקדמה מספר ${advanceNumber} שניתנה החודש ומתווספת לסכום המועבר. היא תיפרע בחודשים הבאים, לפי הסכום שיוזן בכל חודש.`,
      advanceRepaid: (advanceNumber: number) =>
        `החזר של מקדמה מספר ${advanceNumber} שניתנה קודם לכן. הסכום נקבע לחודש הזה בלבד ואינו נגזר מלוח תשלומים קבוע.`,
      extra: "תשלום שהוספת לחודש הזה, עם הסיבה שרשמת לו.",
      thirdParty:
        "תשלום שיוצא לגורם שלישי ולא לעובד/ת, ולכן אינו נכלל בסכום שמשולם לה.",
      nationalInsurancePaid:
        "הכסף שיצא בפועל לביטוח לאומי. התשלום נעשה אחת לרבעון ובדיעבד, ולכן הוא מופיע רק בחודש שבו שולם, יחד עם החודשים שהוא מכסה. זה אינו אומדן החודש: האומדן הוא מה שהחודש צבר, וזה מה שיצא מהחשבון.",
      gross: "השכר, התוספות והתשלומים החד־פעמיים של החודש, לפני המקדמות והניכויים.",
      net: "מה שמועבר בפועל: סכום החודש, אחרי המקדמות והניכויים שבתחתית הדף.",
      subtotal: {
        E: "סכום שורות השכר של החודש — המשכורת החודשית ותוספת ימי השישי.",
        F: "סכום התשלומים עבור עבודה בשבת ובחג, שניהם בתעריף המנוחה השבועית.",
        G: "סכום התשלומים החד־פעמיים של החודש.",
        H: "סכום מה ששולם לגורמים שלישיים. אינו נכנס לסכום שמשולם לעובד/ת.",
      },
      vacationBalance: (seniorityYear: number) =>
        `ימי החופשה נצברים לפי הוותק. בשנה ה־${seniorityYear} להעסקה הצבירה היא החלק החודשי של המכסה השנתית, והיתרה שלא נוצלה עוברת לחודשים ולשנים הבאות ואינה נמחקת.`,
      sickBalance:
        "ימי המחלה נצברים יום וחצי בכל חודש עבודה עד תקרה של תשעים ימים, ומה שלא נוצל נשמר לחודשים הבאים ואינו מתאפס בסוף השנה.",
      nationalInsuranceEstimate:
        "אומדן בלבד, לאישור ולא כעובדה: 3.6% מעלות החודש המלאה — השכר, התוספות, השבתות והחגים והתשלומים החד־פעמיים — לפני כל מה שקשור למקדמות. הסכום שנדרש בפועל שונה לעיתים מהאומדן, והתשלום עצמו מופיע רק בחודש שבו שולם.",
    },

    /** A refusal says why, not only what. The dates it concerns travel beside
     * it on the refusal itself, so the interface names them isolated rather
     * than inside a Hebrew sentence (specs.md Part 5). */
    refusals: {
      restDayHoliday:
        "אי אפשר לסמן חג בתאריך שכבר סומן בו שבת חופשית. היום היה משולם פעמיים — גם בתעריף המנוחה השבועית וגם כחג — ולכן צריך לבחור אחד מהשניים.",
      holidayLimit: (allowed: number) =>
        `המכסה היא ${allowed} ימי חג בשנה, והרישום הזה חורג ממנה. אפשר להסיר חג אחר שנבחר לשנה הזו במקומו.`,
      freeSaturdayNotSaturday:
        "שבת חופשית נרשמה על יום שאינו שבת. יום המנוחה השבועית הוא שבת עבור כל עובד/ת, ולכן הרישום הזה לא יכול להיות נכון.",
      saturdaysExceedMonth:
        "מספר השבתות שנעבדו גדול ממספר השבתות שיש בחודש.",
      thirdPartyPaidTwice: (paymentType: string) =>
        `נרשמו שני תשלומים מסוג ${paymentType} באותו חודש. דף המשכורת מחזיק שורה אחת לכל סוג תשלום, ושתי שורות באותו שם אי אפשר לעדכן או להסביר בנפרד. אפשר לרשום אותם כתשלום אחד מסוכם, או לבחור סוג אחר לאחד מהם.`,
      sickBalanceExhausted: (available: number, requested: number) =>
        `נרשמו ${formatDays(requested)} ימי מחלה, ובמאזן יש ${formatDays(available)} בלבד. יתרת המחלה אינה יורדת מתחת לאפס, ולכן אי אפשר לרשום מעבר לה. ימים מעבר ליתרה הם היעדרות ללא זכאות, וזה מצב שהיישום עדיין אינו יודע לחשב — עדיף לומר זאת מאשר לשלם או לנכות עליהם בשקט.`,
    },

    /** A warning changes no figure and stops nothing. It is worded as what the
     * law asks rather than as what the user did wrong (specs.md item 7). */
    warnings: {
      vacationUnderSeven: (year: number, days: number) =>
        `בשנת ${year} נוצלו ${formatDays(days)} ימי חופשה. החוק מבקש לפחות שבעה ימי חופשה בשנה. היתרה עצמה נשמרת ואינה נמחקת.`,
    },
  },
} as const;

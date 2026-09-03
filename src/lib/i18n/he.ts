import { restEveOf, SATURDAY, SUNDAY, THURSDAY, FRIDAY } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import { formatDays } from "@/lib/money";

/**
 * **The weekly rest day is a term of the employment, so the words for it are
 * not fixed either** (specs.md item 5). A Saturday-resting worker reads
 * "שבת חופשית"; a Friday-resting worker must not. The sentences below
 * are therefore written once and inflected, rather than kept three times over —
 * the same argument Part 3 makes for having one export template and not one per
 * rest day: three copies of a wording that must not diverge is three places to
 * change it.
 *
 * Only four weekdays can ever appear. The three the law allows as the rest day
 * are Friday, Saturday and Sunday, and each of those has one rest-eve — the
 * working day before it — so Thursday joins them and nothing else can.
 *
 * **Gender is the trap, and it is why this is a table and not a concatenation.**
 * שבת is feminine and יום שישי and יום ראשון are masculine, so a sentence
 * that reads correctly for Hanna reads as broken Hebrew for exactly the workers
 * this generalisation exists to serve. The inflected words are written out per
 * gender rather than derived, because Hebrew agreement is not a rule a format
 * string can carry.
 *
 * The one-letter prefixes do compose, so they are not stored: ב + שבת is בשבת
 * and ב + יום שישי is ביום שישי.
 */
interface DayWords {
  /** "שבת", "יום שישי" — the day as a bare noun phrase. */
  bare: string;
  /** "שבתות", "ימי שישי" — what follows a number. */
  plural: string;
  /** "השבתות", "ימי השישי" — the definite plural. */
  pluralDefinite: string;
  /** שבת alone is feminine; the two יום forms are masculine. */
  feminine: boolean;
}

const DAY_WORDS: Record<number, DayWords> = {
  [SUNDAY]: {
    bare: "יום ראשון",
    plural: "ימי ראשון",
    pluralDefinite: "ימי הראשון",
    feminine: false,
  },
  [THURSDAY]: {
    bare: "יום חמישי",
    plural: "ימי חמישי",
    pluralDefinite: "ימי החמישי",
    feminine: false,
  },
  [FRIDAY]: {
    bare: "יום שישי",
    plural: "ימי שישי",
    pluralDefinite: "ימי השישי",
    feminine: false,
  },
  [SATURDAY]: {
    bare: "שבת",
    plural: "שבתות",
    pluralDefinite: "השבתות",
    feminine: true,
  },
};

/** The words that agree with the day rather than describing it. */
const AGREEMENT = {
  feminine: {
    free: "חופשית",
    pronoun: "היא",
    can: "יכולה",
    marked: "מסומנת",
    wasMarked: "שסומנה",
    wasRecorded: "נרשמה",
    paid: "משולמת",
    inIt: "בה",
    isntSubtracted: "אינה נגרעת",
    counted: "נספרות",
    andSubtracted: "ונגרעות",
    arentPaid: "אינן משולמות",
    andArentDeducted: "ואינן מנוכות",
    them: "אותן",
  },
  masculine: {
    free: "חופשי",
    pronoun: "הוא",
    can: "יכול",
    marked: "מסומן",
    wasMarked: "שסומן",
    wasRecorded: "נרשם",
    paid: "משולם",
    inIt: "בו",
    isntSubtracted: "אינו נגרע",
    counted: "נספרים",
    andSubtracted: "ונגרעים",
    arentPaid: "אינם משולמים",
    andArentDeducted: "ואינם מנוכים",
    them: "אותם",
  },
} as const;

/** Her rest day, as words. */
function day(restDay: RestDay): DayWords {
  return DAY_WORDS[restDay];
}

/** Her rest-eve, as words: the working day before her rest day (item 14). */
function eve(restDay: RestDay): DayWords {
  return DAY_WORDS[restEveOf(restDay)];
}

function agrees(words: DayWords) {
  return words.feminine ? AGREEMENT.feminine : AGREEMENT.masculine;
}

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
    /** The third of the navigation trio, and it moves the calendar by a month
     * like the other two: it jumps to the month containing today, never to a
     * day. It read "היום" until someone pressed it. */
    thisMonth: "החודש",
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
    /** A function of her rest day, because one of the four names it: a
     * Saturday-resting worker reads "שבת חופשית" and a Friday-resting one
     * "יום שישי חופשי" (specs.md item 5). */
    marks: (restDay: RestDay) => ({
      vacation: "חופשה",
      sick: "מחלה",
      /** What a holiday's own cell says, in either weight. The **weight** is
       * what tells the two apart on the calendar — an outline for one she did
       * not work and a fill for one she did (specs.md item 9) — so the cell
       * says only that the day is a holiday, and the legend below names the two
       * states in words for the eye that has not learned the weights yet and
       * for the reader who cannot see them at all. */
      holiday: "חג",
      /** The weekly rest day the worker had off — an exception the user
       * recorded, not an entitlement. */
      freeRestDay: `${day(restDay).bare} ${agrees(day(restDay)).free}`,
      /** A day she worked, which is every day carrying no mark at all — an
       * unmarked rest day included. It labels the legend and marks nothing. */
      workDay: "יום עבודה",
    }),
    /**
     * The one fact a month records about a holiday: whether she worked it
     * (specs.md item 9). The user never marks the day — the year's dates arrive
     * drawn — so this is a question and not a kind, and the two answers are the
     * whole of it.
     */
    holiday: {
      worked: "חג שנעבד",
      notWorked: "חג שלא נעבד",
      question: "עבדה בחג?",
      yes: "כן, עבדה",
      no: "לא עבדה",
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
      /** An open spell of sickness, which is how one is normally recorded: on
       * the day she falls ill nobody knows the day she will return, so the
       * application does not ask for one (specs.md item 8). */
      stillOpen: "טרם הסתיימה",
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
    skipped: (restDay: RestDay) => ({
      title: "ימים שלא סומנו",
      weeklyRest: `${day(restDay).bare} ${agrees(day(restDay)).pronoun} כבר יום המנוחה השבועי, ולכן ${agrees(day(restDay)).isntSubtracted} ממכסת החופשה`,
      notRestDay: `רק ${day(restDay).bare} ${agrees(day(restDay)).can} להיות ${agrees(day(restDay)).marked} כ${day(restDay).bare} ${agrees(day(restDay)).free}`,
      /** A holiday is one of the marks a day can already carry: the year's
       * dates arrive drawn and are not the user's to sweep over (item 9). */
      alreadyMarked: "היום כבר מסומן",
      dismiss: "להסתיר",
    }),
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

  /** The month screen: the calendar, and the preview of what the month comes
   * to. The preview and the export are one engine's output shown twice, so
   * nothing here names a figure — only the rows it is shown in. */
  month: {
    /** A month the store has no record of. It is not an error and not an empty
     * result — nothing has been entered yet, which for a month ahead of the
     * present is the ordinary state (specs.md item 21). */
    empty: {
      title: "החודש הזה עדיין ריק",
      body: "לא נרשם בו דבר, ולכן אין עדיין מה לחשב.",
    },
    preview: {
      title: "החישוב של החודש",
      /**
       * The heading over the three lines the days of the week added, and **it
       * names her own two days** (specs.md items 5 and 14): "ימי שישי, שבתות
       * וחגים" for a Saturday-resting worker and "ימי חמישי, ימי שישי וחגים" for
       * one who rests on Friday.
       */
      dayAdditions: (restDay: RestDay) =>
        `${eve(restDay).plural}, ${day(restDay).plural} וחגים`,
      /**
       * The lines the user added, summed. One heading covers both directions,
       * so the sum may come out either way and the wording may not name only
       * one of them (item 20).
       */
      userLines: "תוספות והורדות שהוספת",
      userLinesWhy:
        "סיכום השורות שהוספת. הפירוט המלא — שורה־שורה, עם הסיבה שרשמת לכל אחת — נמצא במסך התשלומים ובקובץ האקסל, כי בתלוש כל תשלום חייב להופיע בנפרד.",
      /** The month's own total, before the closing block — ₪9,305.75 in the
       * August 2025 case, and the third of criterion 1's four figures. */
      gross: "סך הכול החודש",
      /** What is actually handed over, after the advances and the deductions. */
      net: "לתשלום לעובד/ת",
      /** The sheet's own column totals, shown apart from the lines rather than
       * under them (specs.md item 5). */
      byColumn: "לפי העמודות בדף המשכורת",
      thirdParty: "תשלומים לגורמים שלישיים",
      balances: "יתרות אחרי החודש הזה",
      warnings: "כדאי לדעת",
    },
  },

  /**
   * The home screen's coarse summary of a month, which folds several of the
   * sheet's own rows into one line each. The sheet's full row set is `sheet.lines`
   * below; these three are what a screen that is not the sheet shows.
   */
  lines: {
    baseSalary: "שכר החודש",
    /**
     * Three of the sheet's rows folded into one — the rest-eve supplement, the
     * rest-day work and the worked holiday. **It names her own two days**, so a
     * worker who rests on Friday reads "תוספות (יום חמישי, יום שישי, חג)" and
     * not Hanna's Friday and Saturday (specs.md items 5 and 14). It was a
     * constant until the switcher made the second worker visible, which is
     * exactly what the second fixture worker exists to expose.
     */
    supplements: (restDay: RestDay) =>
      `תוספות (${eve(restDay).bare}, ${day(restDay).bare}, חג)`,
    advanceRepaid: "מקדמה שנפרעת",
  },

  explanations: {
    baseSalary: "משכורת מלאה, כי לקיחת יום חופשה לא מקטינה את המשכורת החודשית.",
    /**
     * The folded line covers two different kinds of money and the sentence has
     * to say so: the rest-eve supplement is a standing amount paid for every
     * rest-eve of the month whether she worked it or not (item 14, and item 8 —
     * sickness does not reach it at all), while the rest day and the holiday are
     * paid at the weekly-rest rate for having been worked (item 9). The earlier
     * wording described all three as a premium for working, which was wrong
     * about the first of them, so this is a correction and not only a rename.
     */
    supplements: (restDay: RestDay) =>
      `תוספת קבועה עבור כל ${eve(restDay).bare} של החודש, ועבודה ב${day(restDay).bare} או בחג המשולמת בתעריף המנוחה השבועית.`,
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
      /**
       * **The label is a function of her rest day; the key never is.** The key
       * is `lineKeys.restEveSupplement`, which addresses a stored override
       * (item 17) and must not move, while the label names the day the money is
       * actually for: "תוספת ימי שישי" for Hanna and "תוספת ימי חמישי"
       * for a Friday-resting worker, whose rest-eve is Thursday (item 14).
       */
      restEveSupplement: (restDay: RestDay) =>
        `תוספת ${eve(restDay).plural}`,
      restDays: (restDay: RestDay) => `עבודה ב${day(restDay).bare}`,
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
    subtotals: (restDay: RestDay) => ({
      E: "סך שכר החודש",
      F: `סך ${day(restDay).plural} וחגים`,
      G: "סך תשלומים חד־פעמיים",
      H: "סך תשלומים לגורמים שלישיים",
    }),

    reporting: {
      standardDays: "ימי תקן",
      actualDays: "ימים בפועל",
      /** The two counts as one row, which is how the sheet asks for them: the
       * Wage Protection Act wants both on the payslip, and a screen showing one
       * of them has answered half the requirement (specs.md items 2, 5). */
      workDays: "ימי עבודה (בפועל / תקני)",
      daysUsed: "ימים שנוצלו החודש",
      balanceLeft: "יתרה שנשארה",
      nationalInsuranceEstimate: "אומדן ביטוח לאומי לחודש",
      /** Precedes the months a quarterly or yearly payment covers, which travel
       * beside the line rather than inside its label (specs.md item 19). */
      coversMonths: "בגין החודשים",
    },

    why: {
      /** Item 5's own asymmetry, said in the order a reader meets it: what the
       * standard count is and what it pays, then what leaves the actual count
       * and what does not. The worked holiday is named on both sides, because
       * a holiday behaving oppositely in money and in the counts is the check
       * item 5 says to hold on to. */
      workDays: (restDay: RestDay) =>
        `ימי התקן הם כל ימי החודש חוץ מ${day(restDay).pluralDefinite}, והמשכורת מחושבת מהם — חופשה או מחלה אינן מקטינות אותם. הימים בפועל הם אותם ימים פחות הימים שלא נעבדו: יום חופשה, יום מחלה, וחג שלא נעבד. חג שנעבד הוא יום עבודה ככל יום אחר ואינו יורד מהם. חוק הגנת השכר מחייב לציין בתלוש את שני המספרים.`,
      base: (standardDays: number, restDay: RestDay) =>
        `משכורת חודשית מלאה. היא נשענת על ${standardDays} ימי התקן של החודש — כל ימי החודש חוץ מ${day(restDay).pluralDefinite} — ולכן חופשה או מחלה אינן מקטינות אותה.`,
      restEveSupplement: (restEves: number, restDay: RestDay) =>
        `תוספת קבועה שנקבעה בפרופיל עבור כל ${eve(restDay).bare}, והחודש היא משולמת עבור ${restEves} ${eve(restDay).plural}.`,
      restDays: (worked: number, restDay: RestDay) =>
        `עבודה ב${day(restDay).bare} משולמת בתעריף המנוחה השבועית: יום עבודה ועוד שעה, בתוספת של חצי. המנוחה השבועית של עובד/ת סיעוד היא 25 שעות ולא 24, ולכן התעריף גבוה מיום וחצי רגיל. החודש נעבדו ${worked} ${day(restDay).plural}.`,
      holidaysWorked: (holidays: number, restDay: RestDay) =>
        `חג שנעבד משולם באותו תעריף כמו ${day(restDay).bare}. חג שלא נעבד אינו מזכה בתוספת, כי המשכורת החודשית משולמת עליו במלואה. החודש נעבדו ${holidays} ימי חג.`,
      sickDeduction: (days: number, restDay: RestDay) =>
        `המשכורת החודשית משולמת במלואה גם בחודש שהיו בו ימי מחלה, ולכן השורה הזו מחזירה את החלק שדמי המחלה אינם מכסים: על היום הראשון של כל מחלה לא משולמים דמי מחלה, על השני והשלישי משולם חצי יום, ומהיום הרביעי ואילך המחלה משולמת במלואה. כך נשאר בדיוק מה שהחוק מזכה בו. החודש הניכוי הוא על ${formatDays(days)} ימים, בערך של יום מחלה. ${day(restDay).plural} שבתוך תקופת המחלה ${agrees(day(restDay)).counted} לתקופה ${agrees(day(restDay)).andSubtracted} מהמאזן, אך ${agrees(day(restDay)).arentPaid} ${agrees(day(restDay)).andArentDeducted} — המשכורת ממילא אינה כוללת ${agrees(day(restDay)).them}.`,
      incomeTax:
        "היישום אינו מחשב מס הכנסה. השורה מתחילה באפס, והסכום מוזן ידנית על ידך. הכלל הוא שהמעסיק מנכה מס לפי גובה השכר ולפי הזיכויים שהעובד/ת זכאי/ת להם, ועובד/ת זר/ה בסיעוד מקבל/ת 2.25 נקודות זיכוי — יותר מעובד/ת זר/ה בענף אחר. מי שאינו יודע זאת מנכה יותר מדי, ולכן כדאי לקרוא את הכלל לפני הזנת הסכום.",
      advanceGranted: (advanceNumber: number) =>
        `מקדמה מספר ${advanceNumber} שניתנה החודש ומתווספת לסכום המועבר. היא תיפרע בחודשים הבאים, לפי הסכום שיוזן בכל חודש.`,
      advanceRepaid: (advanceNumber: number) =>
        `החזר של מקדמה מספר ${advanceNumber} שניתנה קודם לכן. הסכום נקבע לחודש הזה בלבד ואינו נגזר מלוח תשלומים קבוע.`,
      /**
       * A line the user added, explained in two halves: how long it lasts, and
       * where the user put it (specs.md item 20). The label is the user's own
       * words and is never written here — only the reasoning beside it is.
       *
       * **Two whole sentences joined, and not a sentence assembled from
       * fragments.** The lifetime and the placement are independent choices and
       * writing all four combinations out would be four sentences to keep in
       * step; each half here is a complete sentence that reads correctly on its
       * own, which is what keeps the join from being the thing `CLAUDE.md`
       * warns about. The **direction** is deliberately not a third half: the
       * amount already carries its sign, and a sentence restating it would say
       * what the figure beside it says.
       */
      userLine: {
        standing:
          "שורה קבועה שהגדרת בפרופיל, והיא חוזרת בכל חודש באותו סכום עד שתשנה או תפסיק אותה. היא נשמרת עם החודש שחושב, ולכן הפסקה שלה עכשיו אינה משנה חודשים קודמים.",
        oneOff: "שורה שהוספת לחודש הזה בלבד, עם הסיבה שרשמת לה.",
        beforeGross:
          "בחרת שהיא תיכנס לסך הכול של החודש, ולכן היא גם נכללת באומדן הביטוח הלאומי, שמחושב מעלות החודש המלאה.",
        afterGross:
          "בחרת שהיא תבוא אחרי סך הכול של החודש, ולכן היא משנה רק את הסכום שמועבר בפועל ואינה נכללת באומדן הביטוח הלאומי.",
      },
      thirdParty:
        "תשלום שיוצא לגורם שלישי ולא לעובד/ת, ולכן אינו נכלל בסכום שמשולם לה.",
      nationalInsurancePaid:
        "הכסף שיצא בפועל לביטוח לאומי. התשלום נעשה אחת לרבעון ובדיעבד, ולכן הוא מופיע רק בחודש שבו שולם, יחד עם החודשים שהוא מכסה. זה אינו אומדן החודש: האומדן הוא מה שהחודש צבר, וזה מה שיצא מהחשבון.",
      gross: "השכר, התוספות והתשלומים החד־פעמיים של החודש, לפני המקדמות והניכויים.",
      net: "מה שמועבר בפועל: סכום החודש, אחרי המקדמות והניכויים שבתחתית הדף.",
      subtotal: (restDay: RestDay) => ({
        E: `סכום שורות השכר של החודש — המשכורת החודשית, תוספת ${eve(restDay).pluralDefinite}, וכל תשלום קבוע שהגדרת.`,
        F: `סכום התשלומים עבור עבודה ב${day(restDay).bare} ובחג, שניהם בתעריף המנוחה השבועית.`,
        G: "סכום התשלומים החד־פעמיים של החודש.",
        H: "סכום מה ששולם לגורמים שלישיים. אינו נכנס לסכום שמשולם לעובד/ת.",
      }),
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
      restDayHoliday: (restDay: RestDay) =>
        `אי אפשר לסמן חג בתאריך שכבר סומן בו ${day(restDay).bare} ${agrees(day(restDay)).free}. היום היה משולם פעמיים — גם בתעריף המנוחה השבועית וגם כחג — ולכן צריך לבחור אחד מהשניים.`,
      holidayLimit: (allowed: number) =>
        `המכסה היא ${allowed} ימי חג בשנה, והרישום הזה חורג ממנה. אפשר להסיר חג אחר שנבחר לשנה הזו במקומו.`,
      /** Her own day, not everyone's: item 5 says the rest day is a term of
       * the employment, so the sentence names the day this employment holds
       * rather than telling a Friday-resting worker that Saturday is hers. */
      freeRestDayNotRestDay: (restDay: RestDay) =>
        `${day(restDay).bare} ${agrees(day(restDay)).free} ${agrees(day(restDay)).wasRecorded} על יום שאינו ${day(restDay).bare}. יום המנוחה השבועית של העובד/ת הוא ${day(restDay).bare}, ולכן הרישום הזה לא יכול להיות נכון.`,
      dayRecordedTwice:
        "בתאריך הזה נרשמו שני סימונים. יום אחד לא יכול להיות גם יום שנעבד וגם יום שלא נעבד, ואי אפשר לספור אותו פעמיים. היישום אינו יודע מה מבין השניים קרה, ולכן הוא עוצר ומבקש שתחליט/י — במקום לבחור לבד ולהראות סכום שנראה רגיל לגמרי.",
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

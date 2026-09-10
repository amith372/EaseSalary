import { restEveOf, SATURDAY, SUNDAY, THURSDAY, FRIDAY } from "@/lib/dates";
import type { RestDay } from "@/lib/dates";
import type { AdvanceKind } from "@/lib/engine/types";
import { formatAgorot, formatDays } from "@/lib/money";

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
    freePlural: "חופשיות",
    /** "שבת אחת", "יום שישי אחד" — Hebrew writes one as a word and puts it
     * after the noun, where every other count is a numeral before a plural. */
    one: "אחת",
    /** "סומנה" against the plural "סומנו", which is the same for both
     * genders and therefore is not in this table. */
    wasMarkedOne: "סומנה",
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
    freePlural: "חופשיים",
    one: "אחד",
    wasMarkedOne: "סומן",
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
    /** What an empty amount field shows. Not a translatable sentence — it is
     * the shape of the figure being asked for — but it is text the user reads,
     * and every such string lives in this file (`CLAUDE.md`). */
    amountInput: "0.00",
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
      /** "יום" before the weekday name, which `dayNames` holds bare because the
       * calendar's column headings show it bare. שבת takes no prefix: it is a
       * name and not a numbered day. */
      weekdayPrefix: "יום ",
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
      /**
       * How much of the day was taken, asked before the kind is chosen because
       * the kind chip is what commits the mark (specs.md item 7).
       *
       * The rule is said in words beneath both rows rather than left to be
       * discovered: only vacation among the three may be taken in part, so the
       * two kinds that may not are not offered while חצי יום stands.
       */
      part: {
        label: "כמה מהיום נלקח",
        whole: "יום מלא",
        half: "חצי יום",
        rule: (restDay: RestDay) =>
          `חופשה אפשר לקחת גם כחצי יום, והיא נגרעת מהמכסה באותו יחס. מחלה ו${day(restDay).bare} ${agrees(day(restDay)).free} הם ימים שלמים.`,
      },
      /** Every action can carry a free-text note (specs.md item 5). It is
       * optional, and the placeholder says so rather than a label doing it. */
      note: {
        label: "הערה",
        placeholder: "במילים שלך — לא חובה",
      },
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
      /** The same figure the month screen closes with, so it carries the same
       * word: one number, one name (specs.md Part 5). */
      total: "סך הכל תשלום לעובד/ת",
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
  /**
   * The payments screen (specs.md item 5). It is where everything that *records*
   * a payment lives — the additional payments and, in its own step, the payments
   * to third parties — while the month screen answers what the month came to.
   *
   * The lead says what the screen is for rather than what is on it, because a
   * user arrives here from a summarised row on the month screen and the first
   * thing she needs to know is that this is where that row is made.
   */
  payments: {
    title: "תשלומים",
    lead: "כאן נרשם כל מה שאינו נגזר מהלוח — מקדמות, מס הכנסה, ותוספות והורדות משלך. החישוב עצמו נמצא בדף החודש, והשורות האלה נכנסות אליו.",
    /** The screen records one month at a time, so it says which (item 5). */
    forMonth: "החודש שנרשם",
  },

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
      /**
       * The three figures the block closes with, in the order it draws them,
       * and **the user's own words for the first and the last** (specs.md
       * Part 5).
       *
       * `gross` is the month's own total before anything is withheld —
       * ₪9,305.75 in the August 2025 case, the third of criterion 1's four
       * figures, and `A26` of the month template. `net` is what is actually
       * transferred, ₪7,305.75 there, the fourth figure and `B29`.
       *
       * **`afterWithholding` is the one the sheet has no cell for**, and it is
       * the Hebrew נטו — which the code's own `net` is *not*. A month with no
       * income tax draws it alone, because it equals the ברוטו and two
       * identical figures under two headings is worse than one.
       */
      gross: "ברוטו",
      afterWithholding: "נטו",
      net: "סך הכל תשלום לעובד/ת",
      thirdParty: "תשלומים לגורמים שלישיים",
      balances: "יתרות אחרי החודש הזה",
      warnings: "כדאי לדעת",
    },

    /**
     * The additional-payments group on the payments screen — the first of item
     * 5's three groups, and not beside the calendar: the month screen answers
     * what the month came to and everything that *records* something lives on
     * `/payments`. All four of item 5's contents are now in it — the income-tax
     * line, the lines the user adds, the advances and the manual overrides —
     * and the payments to third parties beside them (item 16). It is still
     * named for the group and not for what is in it, which is what let the four
     * arrive one at a time without the card being renamed three times.
     */
    actions: {
      title: "תשלומים נוספים",
      incomeTax: {
        title: "מס הכנסה",
        field: "כמה נוכה החודש",
        /**
         * **Shown in words beside the control and not behind the "?"**
         * (specs.md item 17). It is what the user has to know before she types,
         * and someone who does not know it deducts too much — a rule that is
         * merely reachable is reachable by the user who already suspects there
         * is something to find.
         */
        rule: "מס הכנסה מנוכה לפי השכר ולפי נקודות הזיכוי שמגיעות לעובד/ת. עובד/ת זר/ה בסיעוד בבית המטופל/ת מקבל/ת 2.25 נקודות זיכוי — יותר מעובד/ת זר/ה בענף אחר, ומי שלא יודע/ת את זה מנכה יותר מדי.",
        /** Zero is an ordinary answer and not an empty field: it is what every
         * month holds until the user says otherwise, and typing it back is how
         * a tax entered by mistake is taken off. */
        none: "לא נוכה מס החודש",
        save: "לשמור",
        /**
         * **This field's own version of the amount refusal, and it may not say
         * "greater than zero".** Zero is an ordinary entry here (item 17) while
         * a line the user adds refuses it (item 20), so one sentence serving
         * both would state the wrong rule beside one of them — and beside this
         * one it would tell her that the figure she is allowed to type is not
         * allowed.
         */
        notANumber: "צריך להקליד סכום — מספר, בלי מינוס. שדה ריק או 0 פירושו שלא נוכה מס החודש.",
      },
      lines: {
        /** The list carries the preview's own heading. One thing, one name:
         * a summarised row above and the lines it summarises below must not
         * read as two different things (specs.md Part 5). */
        empty: "לא הוספת שורות לחודש הזה.",
        add: "להוסיף שורה",
        label: "על מה",
        labelHint: "במילים שלך — כך זה יופיע בדף המשכורת",
        amount: "סכום",
        note: "למה",
        noteHint: "לא חובה, אבל זה מה שיסביר את השורה בעוד שנה",
        submit: "להוסיף",
        /** The same panel, reopened over a line that already exists (item 20).
         * The verb changes because the gesture does: adding makes a line and
         * this one corrects the line she is looking at. */
        edit: "לתקן",
        editLabel: (label: string) => `לתקן את השורה "${label}"`,
        editTitle: "תיקון השורה",
        save: "לשמור",
        cancel: "ביטול",
        remove: "להסיר",
        /** The button shows the word above, which is the same word on every
         * line; this names *which* line it removes, for a reader who reaches
         * the button without the row around it. */
        removeLabel: (label: string) => `להסיר את השורה "${label}"`,
        direction: {
          addition: "תוספת",
          deduction: "הורדה",
        },
        /**
         * **Named for what the choice does and not for the row it lands under**
         * (specs.md Part 1: the option that requires the user to know less).
         * A chip reading "בתוך הברוטו" names a row the preview does not always
         * draw — a month withholding nothing shows no ברוטו at all (item 17) —
         * so the chip says the consequence and the sentence under it names the
         * figure for the user who thinks in those terms.
         */
        placement: {
          beforeGross: "חלק מהשכר של החודש",
          afterGross: "רק מהתשלום בסוף",
          beforeGrossWhy: "נכנס לברוטו, ולכן גם להערכת הביטוח הלאומי.",
          afterGrossWhy:
            "משנה רק את הסכום שמועבר בסוף החודש, ולא את הברוטו ולא את הערכת הביטוח הלאומי.",
        },
      },
      /**
       * The advances, given and repaid (specs.md item 20).
       *
       * **The number is the application's and the user never types one**, so
       * every sentence here names an advance by a number she reads rather than
       * one she has to remember — and a repayment is chosen from the advances
       * she has rather than typed against a number.
       */
      advances: {
        title: "מקדמות",
        empty: "לא נרשמו מקדמות.",
        /** The number is written into the sentence because it is what the
         * workbook calls the advance and what the salary sheet's own row says
         * (item 20). */
        name: (advanceNumber: number) => `מקדמה ${advanceNumber}`,
        given: "ניתנה",
        repaid: "נפרעו",
        outstanding: "נותרו",
        settled: "נפרעה במלואה",
        /** Given before the application existed, so no month granted it
         * (item 6) — and so no month is too early to repay it in. */
        fromOpening: "מלפני תחילת השימוש ביישום",
        grant: "לתת מקדמה",
        repay: "לפרוע",
        repayLabel: (advanceNumber: number) =>
          `לרשום פירעון של מקדמה ${advanceNumber}`,
        /** This month's own movements, listed under the advances they belong to
         * — the group itemises what the preview summarises (item 20). */
        thisMonth: "נרשם החודש",
        movement: {
          granted: "מקדמה שניתנה",
          repaid: "מקדמה שנפרעה",
        },
        amount: "סכום",
        note: "למה",
        noteHint: "לא חובה, אבל זה מה שיסביר את השורה בעוד שנה",
        submitGrant: "לתת",
        submitRepay: "לפרוע",
        cancel: "ביטול",
        remove: "להסיר",
        removeLabel: (advanceNumber: number, kind: AdvanceKind) =>
          kind === "granted"
            ? `להסיר את מקדמה ${advanceNumber} שניתנה החודש`
            : `להסיר את הפירעון של מקדמה ${advanceNumber} החודש`,
      },
      /**
       * The payments that go to a third party rather than to the worker
       * (specs.md item 16).
       *
       * **Every kind is named by `sheet.thirdParty` and never again here.** The
       * names are the template's own (item 2), and a second copy beside the
       * control would be a second place for one of them to be corrected alone
       * — which is the failure these labels were just fixed for.
       *
       * **The heading says where the money goes and not what it is called.** It
       * is the one group on this screen whose money never reaches the worker,
       * and a user who has just typed an income tax and an advance needs that
       * difference said rather than inferred from the fee names.
       */
      thirdParty: {
        title: "תשלומים לגורמים שלישיים",
        /** Said once, above the list: this money is not hers, and it is neither
         * added to her salary nor taken out of it (item 16). */
        lead: "כסף ששולם החודש לגורם אחר — מבטח רפואי, ביטוח לאומי, אגרות ודמי חברה. הוא אינו מתווסף למשכורת העובד/ת וגם אינו מנוכה ממנה.",
        empty: "לא נרשם החודש תשלום לגורם שלישי.",
        add: "לרשום תשלום",
        /** The kinds still open this month. One already recorded is not
         * offered, because the sheet holds one row per kind and the refusal is
         * what would answer the click (item 16). */
        kind: "על מה שולם",
        /** Every kind taken. Not a refusal — nothing was refused, there is
         * simply nothing left to add — so it stands where the button was. */
        allRecorded:
          "כל סוגי התשלום כבר נרשמו החודש. דף המשכורת מחזיק שורה אחת מכל סוג.",
        amount: "כמה שולם",
        note: "למה",
        noteHint: "לא חובה, אבל זה מה שיסביר את התשלום בעוד שנה",
        /**
         * The months the payment covers (specs.md items 16, 19).
         *
         * **Optional, and the hint says what leaving it empty means** — most
         * payments cover the month they were made in and need nothing said. The
         * national insurance is the one kind the application can offer a period
         * for, because it is paid once a quarter and in arrears (item 19); the
         * yearly fees run forward from an anniversary (item 15) and are left
         * empty rather than guessed.
         */
        period: "בגין אילו חודשים",
        periodHint:
          "לא חובה. אם התשלום מכסה רק את החודש שבו שולם, אפשר להשאיר ריק.",
        periodFrom: "מחודש",
        periodTo: "עד חודש",
        /** The empty option of each select, which is what "no period" reads as
         * in a control that otherwise lists months. */
        periodNone: "—",
        submit: "לרשום",
        /** Reopened with what it holds already in the fields, because
         * correcting a payment by removing it and recording it again is the
         * same two refusals read twice and loses the note in between
         * (item 16). */
        edit: "לתקן",
        editLabel: (paymentType: string) => `לתקן את התשלום על ${paymentType}`,
        editTitle: "תיקון התשלום",
        save: "לשמור",
        cancel: "ביטול",
        remove: "להסיר",
        /** The button shows the word above, which is the same word on every
         * row; this names *which* payment it removes, for a reader who reaches
         * the button without the row around it. */
        removeLabel: (paymentType: string) =>
          `להסיר את התשלום על ${paymentType}`,
      },
      /**
       * The amounts the application worked out, and the user's own figure over
       * one of them (specs.md item 17).
       *
       * **The heading names what the section holds rather than the gesture.**
       * "החלפה ידנית" would be the word for what she does to one row; the list
       * is every derived figure the month has, most of which she will never
       * touch, and a section named for a correction reads as a list of things
       * already gone wrong.
       *
       * **The lead says which amounts are *not* here and where they are
       * instead**, because that division is the whole of the criterion and it
       * is not guessable: a line she typed herself and a payment she recorded
       * are corrected where she entered them, and only an amount that reached
       * this month from somewhere else is replaced here.
       */
      overrides: {
        title: "סכומים שהיישום חישב",
        lead: "אפשר להחליף כל אחד מהם בסכום אחר, והוא יישאר כך גם אחרי כל חישוב מחדש של החודש. סכום שהקלדת בעצמך — שורה משלך, מקדמה או תשלום לגורם שלישי — אינו כאן, ואותו מתקנים במקום שבו הוקלד.",
        empty: "אין החודש סכומים מחושבים.",
        /** Said beside the manual figure, so the row still says what it would
         * otherwise have been (items 17, 24) — which is what makes the
         * replacement checkable without recalculating it by hand. */
        calculated: "היישום חישב",
        change: "להחליף סכום",
        changeLabel: (label: string) => `להחליף את הסכום של ${label}`,
        panelTitle: "סכום במקום החישוב",
        amount: "סכום",
        /** An override is a magnitude and the row gives it its sign (item 17),
         * so the field says so rather than refusing a minus after the fact. */
        amountHint:
          "בלי מינוס. אם השורה מורידה מהשכר, היישום ישאיר אותה שורה שמורידה.",
        note: "למה",
        noteHint: "לא חובה, אבל זה מה שיסביר את הסכום בעוד שנה",
        save: "להחליף",
        cancel: "ביטול",
        /**
         * **Clearing is its own gesture and never the typing back of the
         * calculated figure** (item 17). The two produce the same number and
         * mean opposite things, so the button says what it restores rather than
         * saying "לנקות" — a user who read "clear" would have no reason to
         * prefer it over typing the figure she can see beside it.
         */
        clear: "לחזור לחישוב של היישום",
        clearLabel: (label: string) =>
          `לחזור לסכום שהיישום חישב עבור ${label}`,
        /**
         * The overrides the month is holding for rows it is not drawing
         * (item 17).
         *
         * An amount that is stored, will reappear, and cannot be seen is the
         * one failure in the criterion that looks like nothing went wrong — so
         * they are listed rather than kept out of the way, with the name the
         * row had when the figure was typed.
         */
        orphaned: "סכומים ששמורים לשורות שאינן בחודש הזה",
        orphanedHint:
          "השורות האלה אינן בחודש הזה כרגע — למשל אם לא סומנה עבודה בחג. הסכומים נשמרו ויחזרו יחד עם השורות.",
        /** No name was stored with it, which is a month saved before the name
         * was kept. The amount and the reason are what is left to know it by. */
        unnamed: "שורה ללא שם שמור",
      },

      /** A refusal carries the reason it was refused (specs.md item 25). Each
       * is the sentence shown to the user, not a code written to a log.
       *
       * **None of the refusals here carries a link, and that is item 25's own
       * rule and not an omission**: each is about the *form* of an entry — an
       * amount that is not one, a second row where the sheet holds one, more
       * than the debt — and nothing in law says any of them, so they owe the
       * user the reason and not a reference to a page that would not mention
       * what stopped her. The engine's own `sheet.refusals` are the other case
       * and do carry one.
       */
      refused: {
        label: "צריך לכתוב על מה השורה.",
        amount: "צריך סכום — מספר גדול מאפס, בלי מינוס.",
        shape: "משהו בבחירה לא נקלט. כדאי לבחור שוב ולנסות.",
        noMonth: "אין עדיין רישום לחודש הזה, ולכן אי אפשר להוסיף לו שורות.",
        /**
         * **One sentence for both halves of one question** (specs.md item 17):
         * a row this month does not draw, and a row carrying an amount the
         * month itself recorded. They have one answer — this is not a figure
         * the application worked out — and telling the user which of the two
         * her stale page had got wrong is nothing she can act on.
         */
        notOverridable:
          "אי אפשר להחליף את הסכום הזה — הוא לא סכום שהיישום חישב. סכום שהוקלד ידנית מתקנים במקום שבו הוקלד.",
        /** A page held open over an entry another tab has since removed. */
        entryUnknown:
          "הרישום הזה כבר לא קיים בחודש הזה. כדאי לרענן את הדף ולבדוק מה נשמר.",
        advanceUnknown:
          "המקדמה הזו כבר לא קיימת. כדאי לרענן את הדף ולבחור מחדש.",
        advanceNotYetGiven:
          "המקדמה הזו ניתנה אחרי החודש הזה, ולכן אי אפשר לפרוע אותה בו.",
        advanceRecordedTwice:
          "כבר נרשם החודש פירעון של המקדמה הזו. אפשר להסיר אותו ולרשום סכום אחד מסוכם במקומו.",
        advanceOverRepaid:
          "הסכום גדול ממה שנותר לפרוע מהמקדמה. פירעון מעבר לחוב אינו מקדמה — אם נוכה סכום נוסף, אפשר לרשום אותו כהורדה בשורה משלך.",
        advanceRepaidAlready:
          "כבר נרשמו פירעונות של המקדמה הזו, ולכן אי אפשר להסיר אותה עכשיו — היו נשארים החזרים של חוב שאינו קיים. צריך להסיר קודם את הפירעונות, ואז את המקדמה עצמה.",
        /**
         * **It says "the kind you chose" rather than naming it, and that is a
         * decision.** Every other sentence in this record is a plain string, and
         * `Refusal` reads them by key; one function member would make the whole
         * record `string | ((s: string) => string)` and the component would have
         * to branch on which sort each reason is. The kind is also the thing the
         * user has this second chosen, so naming it back to her adds nothing.
         * `sheet.refusals.thirdPartyPaidTwice` does name it, because that one is
         * read off a stored month nobody is looking at (specs.md item 16).
         *
         * The two exist together on purpose: the engine refuses a stored month
         * and this refuses an entry, and a user who reaches the second has not
         * seen the first. It is reachable only from a stale page or a crafted
         * request, because the chips do not offer a kind already recorded.
         */
        thirdPartyPaidTwice:
          "כבר נרשם החודש תשלום מהסוג שבחרת. דף המשכורת מחזיק שורה אחת מכל סוג, ולכן צריך להסיר את מה שנרשם ולרשום סכום אחד מסוכם במקומו.",
        /** Only one of the two month fields filled. A period is a run of months
         * and half of one names nothing. */
        periodIncomplete:
          "צריך לבחור את שני החודשים — מאיזה ועד איזה — או להשאיר את שניהם ריקים.",
        /** The last month before the first. Refused rather than quietly
         * reordered: which way round she meant it is not the application's to
         * decide, and a period silently flipped is one she will not check. */
        periodBackwards:
          "החודש האחרון מוקדם מהחודש הראשון. כדאי לבדוק את סדר החודשים.",
      },
    },
  },

  /**
   * The workers' list and the worker's own page — `EaseSalary - העובדות` and
   * `EaseSalary - דף העובד` (specs.md items 5, 6, 11, 14, 20, 28).
   *
   * **The profile is where the terms of the employment are changed**, which is
   * a departure from `דף העובד` as drawn: the artboard reads the worker and
   * sends "פרטים והגדרות" to `הגדרות`, whose route belongs to two later
   * stages. The section carries `הגדרות`'s own row vocabulary — a label, the
   * hint under it, the value, and a link that changes it — so the two screens
   * still read as one mechanism when `/settings` is built.
   */
  workers: {
    title: "עובדים/ות",
    lead: "כל מה ששייך לעובד/ת נמצא בדף האישי — החודשים, היתרות והפרטים.",
    /** Item 11's limit, said as a fact about the account rather than as a
     * refusal: a household holds no more than two workers, and a worker shared
     * from another household is that household's and is not counted here. */
    limit:
      "בחשבון אפשר לנהל עד שני עובדים/ות. מי שהתקבל/ה בשיתוף מחשבון אחר לא נספר/ת במסגרת הזו.",
    employedSince: "מועסק/ת מאז",
    /** The country of origin as the application holds it — the code the
     * holiday list is filed under (item 10). It is shown rather than named
     * because there is no country list yet: stage 5 fetches the holidays per
     * country and is where a code becomes a name. */
    country: "ארץ מוצא",
    facts: {
      salary: "שכר בסיס לחודש",
      vacation: "יתרת חופשה",
      sick: "יתרת מחלה",
      advance: "מקדמה שנשארה לפירעון",
    },
    toProfile: (firstName: string) => `לדף של ${firstName}`,
    profile: {
      /** The months she has, listed. **No status badge**: a month's four states
       * are Part 5's and nothing in the application can confirm or export one
       * yet, so a badge here would be a state invented to fill a shape. */
      months: {
        title: "החודשים",
        empty: "עוד לא נרשם אף חודש.",
        /** What the figures in the list are, said **once above them** in the
         * same words the month screen closes with — one figure, one name
         * (Part 5). It is a column heading and not a caption on every row: the
         * same nine words beside nine amounts is noise the eye has to step
         * over to reach the figure it came for. */
        total: "סך הכל תשלום לעובד/ת",
      },
      advances: {
        title: "מקדמות פתוחות",
        empty: "אין מקדמה פתוחה.",
        of: "מתוך",
        repaid: "נפרע",
        /** The artboard's own link out of this section: an advance is *given*
         * and *repaid* on the payments screen, because that is where everything
         * that records a payment lives (item 5). */
        record: "לרשום מקדמה או פירעון",
      },
      terms: {
        title: "תנאי ההעסקה",
        note: "מה שנכון לכל חודש, עד שמשנים אותו. חודש שכבר אושר שומר על התנאים שאיתם חושב.",
        restDay: {
          label: "יום המנוחה השבועי",
          hint: "שישי, שבת או ראשון — לפי מה שמקובל על העובד/ת. הלוח סופר לפיו את ימי המנוחה ואת ערבי המנוחה.",
          /** The day as a bare noun phrase, which is what a chip shows. The
           * gender goes with it (`DAY_WORDS`), so nothing here concatenates. */
          day: (restDay: RestDay) => day(restDay).bare,
          eve: (restDay: RestDay) => eve(restDay).bare,
          /** Said under the chips, because it is the consequence the user is
           * choosing and not a detail behind a "?": the supplement follows the
           * rest day rather than being set beside it (item 14). */
          eveNote: (restDay: RestDay) =>
            `ערב המנוחה הוא ${eve(restDay).bare}, והתוספת השבועית משולמת עליו.`,
        },
        /** The way in to `בחירת חגים` (`build_plan.md` stage 5). The artboard
         * is reached from `הגדרות` and from the home screen's own alert, and
         * neither is built — so the profile carries the link, settled with the
         * user on 2026-09-09. */
        holidays: {
          label: "חגי השנה",
          hint: "התאריכים נבחרים מראש לשנה שלמה, ומגיעים ללוח החודשי מצוירים. מכאן גם בוחרים מאיזו רשימה — ארץ המוצא, מדינה אחרת או דת.",
          chosen: "נבחרו",
          of: "מתוך",
          open: "לבחור חגים",
        },
        /**
         * The recuperation month, and the days it will pay (specs.md item 15).
         *
         * **The row reports the entitlement rather than offering it**, because
         * the days follow from seniority and the user never chooses them — what
         * she chooses is the month. Showing the figure beside the choice is
         * what makes the choice mean something: a month named with nothing
         * beside it says only that a payment happens sometime.
         */
        recuperation: {
          label: "חודש דמי ההבראה",
          hint: "פעם בשנה, בחודש שאת/ה בוחר/ת. מספר הימים נקבע לפי הוותק ואינו נבחר — השנה נמדדת מיום תחילת ההעסקה ולא לפי השנה הקלנדרית.",
          /** Named for what it is, so the row reads as one sentence: "השנה
           * ישולמו 6 ימים". */
          thisYear: "השנה ישולמו",
          days: "ימים",
          /** Before the first employment year is out there is nothing to pay,
           * and saying so is better than a zero the user has to interpret. */
          notYet:
            "אין עדיין זכאות: דמי הבראה משולמים רק אחרי שהושלמה שנת עבודה מלאה.",
        },
        standing: {
          title: "שורות קבועות",
          hint: "שורה שנקבעת פעם אחת ומופיעה בכל חודש מאז, באותו סכום, עד שמשנים אותה או מפסיקים אותה. סכום שונה בחודש מסוים מחליפים במסך התשלומים.",
          empty: "לא נקבעה שורה קבועה.",
          add: "להוסיף שורה קבועה",
          edit: "לתקן",
          editLabel: (label: string) => `לתקן את השורה הקבועה "${label}"`,
          stop: "להפסיק",
          stopLabel: (label: string) => `להפסיק את השורה הקבועה "${label}"`,
        },
        opening: {
          title: "המצב שממנו מתחילים",
          /** Item 6 in the family's own terms, and item 13's consequence said
           * plainly: the balances are replayed from here, so correcting this
           * moves every month at once. That is the correct behaviour and it is
           * said before the fact rather than discovered after it. */
          hint: "מה שכבר נצבר לפני שהתחלנו — ימי חופשה, ימי מחלה, ומקדמה שעדיין נפרעת. היתרות בכל החודשים נספרות מכאן, ולכן תיקון כאן מזיז את כולם.",
          vacation: "ימי חופשה שכבר נצברו",
          sick: "ימי מחלה שכבר נצברו",
          save: "לשמור",
          addAdvance: "להוסיף מקדמה שנשארה מלפני כן",
          principal: "הסכום שניתן",
          repaid: "כמה כבר נפרע",
          repaidHint: "אפשר להשאיר ריק אם עוד לא נפרע דבר",
          note: "למה",
          submit: "להוסיף",
          remove: "להסיר",
          removeLabel: (number: number) => `להסיר את מקדמה ${number}`,
        },
        documents: {
          title: "המסמכים",
          /** Item 28's own division, said once: three documents, three dates,
           * and which of them belongs to whom. The numbers are named as absent
           * on purpose — a user who has typed three dates and no numbers should
           * be told why rather than left looking for the fields. */
          note: "שלושה מסמכים נפרדים, כל אחד עם תאריך תפוגה משלו. המספרים עצמם יישמרו מוצפנים ועדיין לא נשמרים כאן.",
          employmentPermit: "היתר העסקה",
          employmentPermitHint:
            "שייך למעסיק/ה ולא לעובד/ת, ומחודש בבקשה מקוונת לרשות האוכלוסין. בחשבון עם שני עובדים/ות זה אותו היתר.",
          workVisa: "אשרת עבודה",
          workVisaHint: "שייכת לעובד/ת, ומחודשת דרך החברה בתשלום אגרה.",
          passport: "דרכון",
          /** The threshold is not expiry (item 28), and the field holds the
           * expiry — so the sentence says both, or a user reads the date as the
           * moment to act on. */
          passportHint:
            "כאן נשמר תאריך התפוגה. ההתראה תופיע כשנשארו פחות משמונה עשר חודשים, ולא כשהוא פג.",
          none: "לא הוזן",
          save: "לשמור",
          /** The shape the fields ask for. Not a sentence to translate — it is
           * the form of the value — but it is text the user reads. */
          format: "שנה-חודש-יום",
        },
        cancel: "ביטול",
        change: "לשנות",
        /** Why a change was refused, in words (item 25). Each names the field
         * it is about, because the panel that shows it holds several. */
        refused: {
          restDay: "אפשר לבחור רק שישי, שבת או ראשון.",
          recuperationMonth: "צריך לבחור אחד מחודשי השנה.",
          date: "אחד התאריכים אינו תאריך. הצורה היא שנה-חודש-יום, למשל 2027-03-31.",
          days: "מספר הימים צריך להיות מספר שאינו שלילי.",
          principal: "צריך להקליד את הסכום שניתן — מספר גדול מאפס, בלי מינוס.",
          repaid: "מה שנפרע צריך להיות מספר, בלי מינוס.",
          overRepaid:
            "מה שנפרע גדול מהסכום שניתן. אפשר להקטין אותו, או להגדיל את הסכום שניתן.",
          label: "צריך לכתוב על מה השורה.",
          amount: "צריך להקליד סכום — מספר גדול מאפס, בלי מינוס.",
          shape: "אחת מהבחירות אינה מוכרת. כדאי לרענן את הדף ולנסות שוב.",
          entryUnknown:
            "השורה הזאת כבר לא קיימת. כדאי לרענן את הדף ולראות מה נשמר.",
        },
      },
    },
  },

  /**
   * The year's holidays, chosen in advance — `EaseSalary - בחירת חגים`
   * (specs.md item 10).
   *
   * The screen is the only place a holiday's **date** is decided: on the month's
   * calendar the user never marks a day as a holiday (item 9), so the dates
   * arrive from here already drawn and the month records only whether she
   * worked one.
   */
  holidays: {
    title: "חגים לשנת",
    forWorker: "עבור",
    lead: "בוחרים מראש אילו ימים יהיו חגים בתשלום, והלוח החודשי מצייר אותם מוכנים.",
    previousYear: "לשנה הקודמת",
    nextYear: "לשנה הבאה",
    /** How many days are chosen against how many she has, and where the quota
     * comes from — the reasoning behind the figure and not only the figure
     * (item 10). */
    quota: {
      chosen: "נבחרו",
      of: "מתוך",
      days: "ימי חג",
      why: "מאין המכסה?",
      whyLabel: "מאין המכסה",
      rule: "תשעה ימי חג לשנה מלאה. לשנה שנעבדה בחלקה המכסה קטנה באותו יחס — תשעה כפול מספר חודשי ההעסקה בשנה הזו, לחלק לשנים עשר, כאשר החודש שבו ההעסקה התחילה נספר כחודש מלא.",
      /** The example is the workbook's own — `שכר_חודשי_להאנה2024.xlsx` →
       * `חודש  12.24` → C9 and the note in I9. The arithmetic is a separate
       * string because it is not Hebrew and must not be translated or
       * reordered. */
      exampleBefore: "למשל: העסקה שהתחילה באפריל נותנת תשעה חודשים, ולכן",
      exampleFigure: "(9×9)÷12 = 6.75",
      exampleAfter:
        "ימי חג לאותה שנה, ותשעה מלאים מהשנה שאחריה. היתרה מוצגת גם כשהיא אינה מספר שלם.",
      /** Item 10's "an incomplete selection is visible at a glance", said as
       * what it costs rather than as a scolding. */
      incomplete: "עדיין לא נבחרו כל הימים. חודש שבו נופל חג שלא נבחר יחושב בלעדיו.",
      complete: "כל ימי החג של השנה הזו נבחרו.",
    },
    /** The candidate list is a country's **or** a faith's, and the two are one
     * choice with two kinds of answer (item 10). */
    sources: {
      label: "רשימת החגים של",
      religions: "או של דת",
      manual: "להוסיף תאריך בעצמי",
    },
    /** A fetch that came back with nothing, in the three kinds a scrape can
     * fail in — the user is told which happened, because only one of the three
     * is worth retrying (`src/lib/scrape/failure.ts`). Each ends the same way:
     * item 12 requires that she can type the dates herself and carry on. */
    failure: {
      title: "לא הצלחנו להביא את רשימת החגים לשנה הזו",
      unreachable:
        "לא הצלחנו להגיע לאתר שממנו הרשימה נקראת. אפשר להקליד את התאריכים כאן, וכל השאר עובד אותו דבר. ננסה שוב בפעם הבאה שהמסך ייפתח.",
      notFound:
        "האתר נפתח, אבל רשימת החגים לא נמצאה בו — כנראה מבנה העמוד השתנה. אפשר להקליד את התאריכים כאן, וכל השאר עובד אותו דבר.",
      implausible:
        "הרשימה שחזרה נראית שונה מדי מהשנים האחרות של אותו מקור, ולכן לא נשמרה. אפשר להקליד את התאריכים כאן, וכל השאר עובד אותו דבר.",
    },
    row: {
      /** The tick shows no text, so this is its whole meaning to a screen
       * reader. It names the date, because a screen of ticks is otherwise a
       * screen of identical controls. */
      choose: (date: string) => `לסמן את ${date} כחג בתשלום`,
      unchoose: (date: string) => `לבטל את ${date} כחג בתשלום`,
      /** The refusal said where it happened, rather than in a message
       * elsewhere (item 25). */
      blocked: "המכסה נוצלה במלואה",
      move: "להעביר תאריך",
      moveLabel: (date: string) => `להעביר את החג מ-${date} לתאריך אחר`,
      /** A date nobody published: she typed it herself, or moved a holiday onto
       * it. There is no name to show, so the row says what it is. */
      own: "תאריך שהוספת",
      empty: "אין רשימת חגים לשנה הזו.",
      part: {
        label: "כמה מהיום נלקח",
        whole: "יום מלא",
        half: "חצי יום",
        rule: "חג אפשר לקחת גם כחצי יום. הוא משולם באותו יחס ונגרע מהמכסה באותו יחס.",
      },
    },
    add: {
      title: "להוסיף תאריך בעצמי",
      hint: "תאריך שאינו ברשימה — חג שסוכם עם העובד/ת, או שנה שלא הצלחנו להביא.",
      date: "תאריך",
      submit: "להוסיף",
      cancel: "ביטול",
      move: "לאיזה תאריך להעביר",
      /** The button that commits a move. It is not "להעביר תאריך" a second
       * time: the link that opened the form already says that, and two controls
       * reading the same on one row is a row nobody can act on with confidence. */
      moveSubmit: "להעביר",
    },
    /** Why a choice was refused, in words (item 25). */
    refused: {
      holidayLimit:
        "המכסה השנתית נוצלה במלואה. אפשר לבטל יום אחר, או לקחת יום קיים כחצי יום.",
      alreadyMarked: "התאריך הזה כבר מסומן בלוח החודשי. אפשר לבחור תאריך אחר.",
      date: "התאריך אינו תאריך של השנה שמוצגת. הצורה היא שנה-חודש-יום, למשל 2026-05-01.",
      part: "החלק שנבחר אינו מוכר. כדאי לרענן את הדף ולנסות שוב.",
      entryUnknown: "החג הזה כבר לא קיים. כדאי לרענן את הדף ולראות מה נשמר.",
    },
    /** The artboard's own closing sentence, which is also what saving on each
     * gesture means: nothing here is held as a draft. */
    note: "אפשר לחזור ולשנות כל עוד החודש לא יוצא.",
  },

  /**
   * The questions that open an export, and the confirmations that go with them
   * — `EaseSalary - לפני הייצוא` (specs.md items 18, 4 and 15).
   *
   * **Every question is asked beside what the month already knows**, which is
   * the whole of item 18: the user confirms or corrects rather than answering
   * from memory, and a family that reads "no advance was recorded" and
   * disagrees has found exactly the thing that would otherwise have been left
   * out by silence.
   *
   * **A question is a question and not an accusation.** The wording asks what
   * happened; it never says the user forgot something, because most of the time
   * she did not and the screen is asked for on every export.
   */
  beforeExport: {
    eyebrow: "לפני הייצוא",
    /** `[חודש] [שנה] של [שם העובד/ת]`, as the artboard draws it. The three
     * parts are separate elements, so nothing here is a sentence with a name
     * inside it (`CLAUDE.md`). */
    of: "של",
    lead: "כמה שאלות קצרות על מה שמשנה את החודש, כדי ששום דבר לא יישכח בשתיקה.",

    /**
     * The minimum-wage confirmation (specs.md item 4). It carries all four
     * things the item asks for: the figure, the date it took effect, where it
     * was read from, and a way to correct it.
     */
    wage: {
      title: "שכר המינימום שלפיו החודש הזה מחושב",
      /** Where the figure came from and from when it holds. The two are
       * different things and the wording keeps them apart: the row's own
       * effective date, and the address it was read at. */
      inForceFrom: "בתוקף מ־",
      readFrom: "נקרא מ־",
      /** The source page as the user knows it, which is also what item 26's
       * links call it. */
      sourceName: "כל זכות",
      note: "חודש מוערך לפי השער שהיה בתוקף בו, ולא לפי השער של היום. אם הסכום אינו נכון — אפשר להקליד אותו ידנית, והוא יישמר עם התאריך שממנו הוא בתוקף.",
      confirm: "הסכום נכון",
      confirmed: "אושר",
      correct: "לתקן",
      amountLabel: "שכר מינימום חודשי",
      effectiveFromLabel: "בתוקף מהתאריך",
      save: "לשמור את הסכום",
      cancel: "לבטל",
      /** No row in the table covers this month, which is an honest answer and
       * not a failure (item 4): the table says nothing rather than reaching for
       * a figure that was not in force. */
      unknown: "היישום אינו יודע מה היה שכר המינימום בחודש הזה, ולכן צריך להקליד אותו.",
      /**
       * The three ways a fetch ends without an answer, told apart because the
       * user does different things about them (Part 4). A source that is down
       * may work in a minute; markup that moved is a defect in this
       * application; a figure outside the plausible range means the page was
       * read and disbelieved.
       */
      failed: {
        unreachable:
          "לא הצלחנו להגיע לאתר כל זכות כרגע. הסכום למטה הוא האחרון שהיישום מכיר, ואפשר גם להקליד סכום אחר.",
        notFound:
          "הגענו לאתר כל זכות, אבל לא מצאנו בו את המשפט שמפרסם את שכר המינימום. הסכום למטה הוא האחרון שהיישום מכיר, ואפשר גם להקליד סכום אחר.",
        implausible:
          "הסכום שקראנו מהאתר רחוק מדי מהשכר שהיה בתוקף עד כה, ולכן לא סמכנו עליו. הסכום למטה הוא האחרון שהיישום מכיר, ואפשר גם להקליד סכום אחר.",
      },
      /**
       * Item 3: a salary may sit above the minimum wage and may never sit below
       * it. So a profile still holding last year's figure does not stop the
       * export — the month is confirmed at the wage in force — and the screen
       * says it is happening before the user presses, because a salary that
       * changed without being announced is exactly the silent figure Part 5 is
       * about. Settled with the user on 2026-09-09.
       */
      raised: (salary: number, minimum: number) =>
        `המשכורת הרשומה לעובד/ת היא ${formatAgorot(salary)}, ושכר המינימום שבתוקף בחודש הזה גבוה ממנה. החודש יאושר לפי ${formatAgorot(minimum)}, כי משכורת אינה יכולה להיות נמוכה משכר המינימום. אפשר לקבוע משכורת גבוהה יותר בדף העובד/ת.`,
      refused: {
        amount: "צריך להקליד סכום גדול מאפס.",
      },
    },

    /**
     * The recuperation day rate (specs.md item 15), confirmed the way the
     * minimum wage is and asked only in the month the payment falls in.
     *
     * **The days are reported and only the rate is asked**, which is item 15
     * read as it is written: the entitlement is worked out from her seniority,
     * and the day rate is the one figure in it the application cannot derive.
     */
    recuperation: {
      title: "ערך יום הבראה לחודש הזה",
      days: "החודש משולמים",
      note: "ערך יום ההבראה אינו נגזר מהמשכורת — הוא נקבע מחוץ ליישום ומתעדכן כל יולי — ולכן מאשרים אותו כאן ושומרים אותו עם החודש שחושב לפיו.",
      unknown: "היישום אינו יודע מה היה ערך יום ההבראה בחודש הזה, ולכן צריך להקליד אותו.",
      amountLabel: "ערך יום הבראה",
      refused: {
        amount: "צריך להקליד סכום גדול מאפס.",
      },
    },

    /**
     * The open spell of sickness (specs.md items 8 and 18). **A block and not a
     * warning**, which item 18 says outright: the one thing an open spell can
     * get wrong is counting days for a worker who was already back.
     */
    openSpell: {
      title: "יש מחלה שעדיין פתוחה",
      /** Named by the day it began, because that is the fact the family has and
       * the one that says which spell is meant. */
      since: "המחלה נרשמה מ־",
      ask: "האם העובד/ת חזר/ה לעבודה, ובאיזה יום?",
      returnLabel: "תאריך החזרה",
      save: "לסגור את המחלה",
      note: "בלי תשובה אי אפשר לייצא את החודש: מחלה שנשארה פתוחה בטעות סופרת ימים למי שכבר חזרה.",
      refused: {
        beforeTheSpell: "תאריך החזרה צריך להיות אחרי היום שבו התחילה המחלה.",
      },
    },

    /** The month that has not ended (specs.md item 21). It is drawn here as a
     * block, where the month screen draws the same fact as a warning: filling
     * the month in ahead of time is allowed and exporting it is not. */
    notEnded: {
      title: "החודש עדיין לא הסתיים",
      note: "אפשר להמשיך למלא אותו, ואפשר לייצא אותו אחרי שיסתיים.",
    },

    /**
     * The seven questions. Each `ask` is what the user answers, each `from` is
     * what the month already holds — never a sentence about what she should
     * have done — and `detail` words the items themselves.
     *
     * **Every one of them is a question the chips can answer.** The artboard
     * words the holidays as `אילו חגים נעבדו?` and draws כן/לא beneath it,
     * which is a question its own control cannot answer; corrected on
     * 2026-09-09 after the user read it on the built screen. Which holiday was
     * worked is recorded on the holiday itself in the month's calendar — this
     * screen confirms and never records, so the question it may ask is whether
     * there were any.
     *
     * **A count agrees with what it counts.** Hebrew writes one as a word after
     * the noun — `חג אחד`, `יום מחלה אחד` — where every other number is a
     * numeral before a plural, so a format string produces `1 חגים` and the
     * user reads it as a defect in the application. Zero never reaches the
     * counting branch: a month that recorded nothing has a wording of its own,
     * because "no advance was recorded" is what she is being asked to confirm.
     */
    questions: {
      yes: "כן",
      no: "לא",
      /**
       * The recorded items themselves, under the question that asks about them
       * — the dates off the calendar and the amounts off the payments screen
       * (specs.md item 18, settled with the user on 2026-09-10).
       *
       * **A date arrives already worded.** `dateLabels.ts` imports this file,
       * so it cannot be called from inside it; the screen words the day or the
       * range there — where "16–20 באוגוסט" and a range crossing a month are
       * already solved and tested — and hands the string in. What is added here
       * is only what the date alone does not say.
       */
      detail: {
        /** A day taken in part (specs.md item 10). Half is the only part the
         * calendar offers, and any other fraction is still written honestly
         * rather than silently rounded to a whole day. */
        half: "חצי יום",
        partOfDay: (fraction: number) => `${formatDays(fraction)} יום`,
        /** The one fact the month records about a holiday (item 9), beside the
         * date it fell on. Both answers are listed, so the list can be read
         * against the calendar. */
        worked: "נעבד",
        notWorked: "לא נעבד",
        /** Between a date and what is said about it. A middot and not a comma:
         * the two halves are separate facts and neither is a clause. */
        separator: " · ",
      },
      /** **The count is part of the sentence and not only the sum.** A month
       * may record two advances, and `נרשמה מקדמה של 1,000 ₪` then describes
       * one advance of a figure that was never given — the amounts are listed
       * beneath it, and a sum presented as a single payment contradicts them.
       * Corrected on 2026-09-10, when the list made it visible. */
      advanceGranted: {
        ask: "ניתנה מקדמה החודש?",
        from: (agorot: number | null, items: number) => {
          if (agorot === null) return "לא נרשמה מקדמה בחודש הזה";
          if (items <= 1) return `נרשמה מקדמה של ${formatAgorot(agorot)}`;
          return `נרשמו ${formatDays(items)} מקדמות בסך ${formatAgorot(agorot)}`;
        },
        mismatch: "מקדמה שניתנה נרשמת במסך התשלומים, ומשם היא נכנסת לחישוב.",
      },
      advanceRepaid: {
        ask: "נפרע החודש חלק ממקדמה קודמת?",
        from: (agorot: number | null, items: number) => {
          if (agorot === null) return "לא נרשם פירעון בחודש הזה";
          if (items <= 1) return `נרשם פירעון של ${formatAgorot(agorot)}`;
          return `נרשמו ${formatDays(items)} פירעונות בסך ${formatAgorot(agorot)}`;
        },
        mismatch: "פירעון של מקדמה נרשם במסך התשלומים, ומשם הוא נכנס לחישוב.",
      },
      freeRestDays: {
        /** It names her own rest day, so a worker who rests on Friday is asked
         * about Fridays (specs.md item 5) — and the adjective agrees with it,
         * since שבת is feminine and יום שישי is not. */
        ask: (restDay: RestDay) =>
          `היו ${day(restDay).plural} ${agrees(day(restDay)).freePlural}?`,
        from: (restDay: RestDay, days: number) => {
          const words = day(restDay);
          const agreement = agrees(words);
          if (days === 0) {
            return `לא סומנו ${words.plural} ${agreement.freePlural} בלוח`;
          }
          if (days === 1) {
            return `${agreement.wasMarkedOne} בלוח ${words.bare} ${agreement.free} ${agreement.one}`;
          }
          return `סומנו בלוח ${formatDays(days)} ${words.plural} ${agreement.freePlural}`;
        },
        mismatch: "יום מנוחה חופשי מסומן בלוח של החודש.",
      },
      holidaysWorked: {
        /** A question the chips can answer. *Which* holiday she worked is
         * marked on the holiday itself, on the month's calendar, which is where
         * the `mismatch` sentence sends her. */
        ask: "היו חגים שנעבדו?",
        from: (falling: number, worked: number) => {
          if (falling === 0) return "לא נופלים חגים בחודש הזה";
          if (falling === 1) {
            return worked === 1
              ? "בחודש הזה נופל חג אחד, והוא סומן כנעבד"
              : "בחודש הזה נופל חג אחד, והוא לא סומן כנעבד";
          }
          const fell = `בחודש הזה נופלים ${formatDays(falling)} חגים`;
          if (worked === 0) return `${fell}, ואף אחד מהם לא סומן כנעבד`;
          if (worked === 1) return `${fell}, ואחד מהם סומן כנעבד`;
          return `${fell}, ו־${formatDays(worked)} מהם סומנו כנעבדו`;
        },
        mismatch: "מה שנעבד בחג מסומן על החג עצמו בלוח של החודש.",
      },
      /** Added on 2026-09-10 with item 18's own reason: the vacation balance is
       * replayed and never stored (item 13), so a day marked on the wrong month
       * moves every later month — and it was the one mark on the calendar this
       * screen said nothing about. Half days are counted, which is why the
       * count can read `1.5`. */
      vacationDays: {
        ask: "היו ימי חופשה?",
        from: (days: number) => {
          if (days === 0) return "לא סומנו ימי חופשה בחודש הזה";
          if (days === 1) return "סומן יום חופשה אחד";
          return `סומנו ${formatDays(days)} ימי חופשה`;
        },
        mismatch: "ימי חופשה מסומנים בלוח של החודש.",
      },
      sickDays: {
        ask: "היו ימי מחלה?",
        from: (days: number) => {
          if (days === 0) return "לא סומנו ימי מחלה בחודש הזה";
          if (days === 1) return "סומן יום מחלה אחד";
          return `סומנו ${formatDays(days)} ימי מחלה`;
        },
        mismatch: "ימי מחלה מסומנים בלוח של החודש.",
      },
      thirdParty: {
        ask: "שולם משהו לגורם אחר?",
        from: (count: number) => {
          if (count === 0) return "לא נרשמו תשלומים לגורם אחר בחודש הזה";
          if (count === 1) return "נרשם תשלום אחד לגורם אחר";
          return `נרשמו ${formatDays(count)} תשלומים לגורם אחר`;
        },
        mismatch: "תשלום לגורם אחר נרשם במסך התשלומים.",
      },
    },

    /** What a contradicting answer produces — a warning and never a refusal,
     * settled with the user on 2026-09-09. She is the one who knows what
     * happened, and what item 18 buys is that she was asked. */
    mismatch: {
      title: "שווה לבדוק לפני הייצוא",
    },

    /**
     * The month is confirmed here (specs.md Part 5, the four states): the
     * moment the minimum wage is confirmed against it is the moment the base
     * monthly salary is copied off the profile onto the month, and the moment
     * its figures stop moving with the profile.
     */
    finish: {
      /** The artboard's own words, and the version the workbook itself asks
       * for: cell I1 says the helper column is hidden before printing. */
      action: "לייצא לאקסל",
      /**
       * The second of item 2's two versions, as a button of equal weight beside
       * the first — settled with the user on 2026-09-10.
       *
       * **Neither artboard draws a chooser**, so this is the one control stage 2
       * adds that the design pass did not draw. The two differ in one thing
       * only, and the name says which: a file that quietly carried the
       * household's notes under the same name as one that did not is how this
       * pair goes wrong after it leaves the application.
       */
      actionWithNotes: "לייצא עם ההערות",
      /** Under both buttons, because a user reading the two needs to know what
       * the difference actually is before she picks one. */
      versions:
        "שתי הגרסאות זהות בסכומים. הן נבדלות רק בכך שעמודת ההערות מוצגת או מוסתרת, וההערות נכתבות בשתיהן.",
      back: "לחזור לחודש",
      /** Why the buttons are not pressable, in the order the screen resolves
       * them: the blocks first, because no answer makes them go away. */
      blocked: "כדי לייצא צריך קודם לטפל במה שמסומן למעלה.",
      unanswered: "אפשר לייצא אחרי שכל השאלות נענו.",
      /** Said after the month was confirmed and the file was asked for, which
       * are one gesture: confirming is what stops the month moving with the
       * profile, and the file is what the user came for. */
      done: "החודש אושר, והקובץ ירד למחשב.",
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
    /**
     * How the sheet names the worker where a label needs a noun — the
     * `{{worker_role}}` the template carries in four of its own sentences.
     *
     * **Part 3 asks for this to be filled from the profile so a sheet never
     * calls a man a woman, and the profile has no gender field yet.** The
     * inclusive form is what the rest of the application already writes, and it
     * is correct rather than merely safe; it becomes a choice when the profile
     * can hold one.
     */
    workerRole: "עובד/ת",

    /**
     * The rest day as the month template's own labels name it — the five
     * `{{rest_…}}` placeholders nine of its cells carry (specs.md Part 3).
     *
     * **The template says Saturday and Friday literally, and the rest day is a
     * term of the employment (item 5), so those words are the month's and not
     * the template's.** A worker who rests on Friday receives a sheet that says
     * Friday throughout and counts her Fridays, and Hanna's sheet is unchanged
     * word for word — which is what keeps one template rather than three.
     *
     * The one-letter prefixes compose, so `עבודה ב{{rest_day}}` is `עבודה בשבת`
     * for Hanna and `עבודה ביום שישי` for a Friday-resting worker, and no
     * prefixed form is stored.
     */
    restDayTokens: (restDay: RestDay) => ({
      rest_day: day(restDay).bare,
      rest_days: day(restDay).plural,
      rest_days_definite: day(restDay).pluralDefinite,
      /** The rest-eve is the working day before the rest day (item 14), which
       * is Friday only for the Saturday-resting common case. */
      rest_eve_days: eve(restDay).plural,
      rest_eve_days_definite: eve(restDay).pluralDefinite,
    }),

    /** What the exported file is called. */
    file: {
      month: "משכורת",
      /** The version that shows the workbook's helper column, said in the name:
       * two files with one name, one of which quietly carries the household's
       * notes, is how this pair goes wrong after it leaves the application. */
      withNotes: "עם הערות",
    },

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
      recuperation: "דמי הבראה",
      incomeTax: "מס הכנסה",
      advanceGranted: "מקדמה שניתנה",
      advanceRepaid: "מקדמה שנפרעת",
    },

    /**
     * The seven column H rows, **named in the template's own words** (specs.md
     * items 2, 16). Four of these were the application's own paraphrase until
     * 2026-09-04, which item 2 does not allow: the exported file has to carry
     * the labels a month tab carries, and a screen teaching the user a name the
     * sheet does not use sends her looking for a row that is not there.
     * `דמי השמה` and `דמי תאגיד` are two different fees in this
     * industry and neither of them is `דמי תיווך`.
     *
     * Each is `template_month_standard.xlsx` -> `sheet1` cell by cell: B12,
     * B13, B14, B15 and B16 carry these words outright. B10 and B21 are blank
     * in the template because their labels are written at export with the
     * period each covers — the medical insurance's year and the national
     * insurance's quarter (item 19) — so those two are the application's, and
     * are the plain name of the payment without the period.
     */
    thirdParty: {
      medicalInsurance: "ביטוח רפואי",
      placementFee: "דמי השמה",
      agencyFee: "דמי תאגיד",
      visaExtensionFee: "אגרה להארכת ויזה",
      workerVisa: "ויזת עובד זר",
      licenceFee: "אגרה להארכת רשיון העסקה",
      nationalInsurance: "ביטוח לאומי",
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
      /**
       * Recuperation (specs.md item 15). The sentence says the three things the
       * user cannot see from the figure: that the days come from her seniority
       * and not from a choice, that the year is measured from the employment
       * anniversary and not from January, and that the day rate is not derived
       * from the salary — which is why it is confirmed rather than calculated.
       */
      recuperation: (days: number) =>
        `דמי הבראה משולמים פעם בשנה, בחודש שנקבע בפרופיל של העובד/ת. מספר הימים נקבע לפי הוותק: חמישה ימים על השנה הראשונה, שישה על השנייה והשלישית, שבעה מהרביעית עד העשירית, ואילך לפי הסולם שבחוק. השנה נמדדת מיום תחילת ההעסקה ועד יום השנה שאחריו — ולא לפי השנה הקלנדרית, שלפיה נמדדת החופשה — ואין זכאות עד שהושלמה שנת עבודה מלאה. החודש משולמים ${formatDays(days)} ימים. ערך יום ההבראה אינו נגזר מהשכר: הוא נקבע בחוק ומתעדכן בכל יולי, ולכן הוא מאושר ונשמר עם החודש שחושב לפיו.`,
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
      gross: "השכר, התוספות והתשלומים החד־פעמיים של החודש, לפני כל ניכוי. זה מה שהחודש עלה, וממנו נגזר גם אומדן הביטוח הלאומי.",
      afterWithholding:
        "הברוטו פחות מה שמנוכה ממנו — כרגע מס הכנסה בלבד. מקדמה, וכן שורה שהוספה ומקומה נקבע אחרי הסכום, אינן משנות את הנטו אלא רק את מה שמועבר בסוף.",
      net: "מה שמועבר בפועל: הנטו, אחרי המקדמות ואחרי השורות שהוספת וביקשת שישבו אחרי הסכום.",
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
      /**
       * Two movements of one kind on one advance in a month (specs.md item 20).
       * It says the same thing `thirdPartyPaidTwice` says, because it is the
       * same rule: two rows under one key can be neither overridden nor
       * explained apart, and the answer is one summed figure.
       */
      advanceRecordedTwice: (advanceNumber: number, kind: AdvanceKind) =>
        kind === "granted"
          ? `מקדמה מספר ${advanceNumber} נרשמה פעמיים כמקדמה שניתנה באותו חודש. אפשר לרשום אותה כסכום אחד מסוכם.`
          : `נרשמו שני החזרים של מקדמה מספר ${advanceNumber} באותו חודש. דף המשכורת מחזיק שורה אחת לכל החזר בחודש, ושתי שורות באותו שם אי אפשר לעדכן או להסביר בנפרד. אפשר לרשום אותן כהחזר אחד מסוכם.`,
      sickBalanceExhausted: (available: number, requested: number) =>
        `נרשמו ${formatDays(requested)} ימי מחלה, ובמאזן יש ${formatDays(available)} בלבד. יתרת המחלה אינה יורדת מתחת לאפס, ולכן אי אפשר לרשום מעבר לה. ימים מעבר ליתרה הם היעדרות ללא זכאות, וזה מצב שהיישום עדיין אינו יודע לחשב — עדיף לומר זאת מאשר לשלם או לנכות עליהם בשקט.`,
    },

    /** A warning changes no figure and stops nothing. It is worded as what the
     * law asks rather than as what the user did wrong (specs.md item 7). */
    warnings: {
      /**
       * The month that has not ended yet (specs.md item 21), as
       * `חישוב החודש` words it in the כדאי לדעת card.
       *
       * **It says both halves in one sentence**, which is the point: a user who
       * reads only "cannot be exported" would stop filling the month in, and
       * filling it in ahead of time is exactly what item 21 allows.
       */
      monthNotEnded:
        "החודש הזה טרם הסתיים, ולכן אפשר למלא אותו אבל עדיין אי אפשר לייצא אותו.",
      vacationUnderSeven: (year: number, days: number) =>
        `בשנת ${year} נוצלו ${formatDays(days)} ימי חופשה. החוק מבקש לפחות שבעה ימי חופשה בשנה. היתרה עצמה נשמרת ואינה נמחקת.`,
      /** The recuperation month with nothing to price its days at (item 15).
       * It names the days, because that is the part the application does know
       * and the part the user would otherwise have to work out for herself. */
      recuperationRateMissing: (days: number) =>
        `החודש הזה הוא חודש ההבראה, והעובד/ת זכאית ל־${formatDays(days)} ימי הבראה — אבל ערך יום ההבראה שהיה בתוקף בחודש הזה אינו ידוע ליישום, ולכן השורה אינה מופיעה. אפשר להוסיף אותה כשורה משלך עם הסכום הנכון.`,
    },
  },
} as const;

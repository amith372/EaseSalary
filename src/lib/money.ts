/**
 * Money is held as integer agorot everywhere in the application and converted
 * only for display and for the export (CLAUDE.md). Formatting is done here
 * rather than through `Intl.NumberFormat` for two reasons: the ICU data behind
 * `Intl` differs between Node and the browser, which shows up as a hydration
 * mismatch on an amount; and the family compares the export against last
 * month's page by eye, so the way a figure is written is a fixed decision
 * rather than a locale's.
 */

const AGOROT_PER_SHEKEL = 100;
const SHEKEL_SIGN = "₪";

/** Groups the integer part in threes: 730575 -> "7,305". */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * "7,305.75 ₪", and "-2,000.00 ₪" for a deduction. Two decimals always, so a
 * column of amounts lines up. Callers wrap the result in `<bdi>`: an amount is
 * a mixed run of digits and a Hebrew-context sign, and a browser will reorder
 * its pieces if it is left to the surrounding paragraph (specs.md Part 5).
 */
export function formatAgorot(agorot: number): string {
  const rounded = Math.round(agorot);
  const sign = rounded < 0 ? "-" : "";
  const absolute = Math.abs(rounded);
  const shekels = Math.trunc(absolute / AGOROT_PER_SHEKEL);
  const fraction = absolute % AGOROT_PER_SHEKEL;
  return `${sign}${groupThousands(String(shekels))}.${String(fraction).padStart(2, "0")} ${SHEKEL_SIGN}`;
}

/**
 * Days are not money: they are carried at full precision and rounded only for
 * display, because the vacation accrual is a fraction (fourteen twelfths) that
 * drifts if it is rounded per month (specs.md Part 5). A whole number is shown
 * without a decimal point; anything else keeps two places, since a remainder is
 * displayed even when it is not a whole number (item 10).
 */
export function formatDays(days: number): string {
  const rounded = Math.round(days * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

/**
 * Characters a figure can arrive wrapped in and that carry no value: the shekel
 * sign, thousands separators, ordinary and non-breaking spaces, and the bidi
 * controls a paste picks up on a right-to-left page. They are stripped rather
 * than refused — a user who pastes "‎1,234.50 ₪" typed a number, and telling her
 * she did not is the application being pedantic about its own formatting.
 */
const NOISE = /[\s\u00a0\u2000-\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069\u061c,₪]/g;

const AMOUNT = /^(\d*)(?:\.(\d+))?$/;

/**
 * What the user typed, as integer agorot — the one place a figure crosses from
 * the interface into the calculation, and `null` when what she typed is not a
 * figure at all.
 *
 * **It never goes through a float, and that is the whole reason it is here
 * rather than inline in a form.** `Math.round(Number("1.005") * 100)` is 100,
 * because the double nearest to 1.005 sits just below it; the nearest agora to
 * 1.005 shekels is 101, and the missing agora would be invisible on a screen
 * showing two decimals (CLAUDE.md: money is integer agorot, never
 * floating-point shekels, rounded to the nearest agora). Which figures a float
 * gets wrong cannot be reasoned about from the decimal — 12.345 comes out
 * right and 1.005 does not — so the digits are read as digits instead, and the
 * third decimal place is what decides the second.
 *
 * **A minus sign is not a figure.** Nothing in this application asks the user to
 * type one: the direction of a line the user adds carries its sign, and so does
 * an income tax, which is entered as what is withheld (specs.md items 17, 20).
 * A typed minus can only disagree with the label beside it, so it is refused
 * here rather than silently made positive — a refusal the user sees is better
 * than an amount that quietly changed its mind about which way it moves.
 */
export function parseShekels(text: string): number | null {
  const cleaned = text.replace(NOISE, "");
  const match = AMOUNT.exec(cleaned);
  if (match === null) return null;

  const [, whole, fraction = ""] = match;
  // "" is not zero: an empty field is a question the user has not answered.
  if (whole === "" && fraction === "") return null;

  const shekels = whole === "" ? 0 : Number(whole);
  if (!Number.isSafeInteger(shekels)) return null;

  // Two places are agorot and the third rounds them, half away from zero. A
  // fraction of "999" carries into the shekels, which is why the two are added
  // rather than concatenated.
  const agorot = Number(fraction.slice(0, 2).padEnd(2, "0"));
  const carry = Number(fraction.charAt(2) || "0") >= 5 ? 1 : 0;
  const total = shekels * 100 + agorot + carry;
  return Number.isSafeInteger(total) ? total : null;
}

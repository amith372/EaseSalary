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
export const SHEKEL_SIGN = "₪";

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

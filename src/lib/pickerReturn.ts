import { screenName } from "@/lib/help/screens";
import { he } from "@/lib/i18n/he";

/**
 * Where the holiday picker's button goes back to. The picker is opened from
 * `/settings`, from the action list on `/`, `/alerts` and the bell, so the
 * screen that opened it says so in `?from=`.
 *
 * Only a screen named here is honoured, because the value is in the address
 * and a link built from it must never lead off the application. Anything else,
 * and no value at all, is `/settings`, where the picker lives.
 */
const RETURNS = {
  "/": screenName("home"),
  "/workers": screenName("workers"),
  "/payments": screenName("payments"),
  "/settings": screenName("settings"),
  "/reports": screenName("reports"),
  "/alerts": screenName("alerts"),
} as const;

export type PickerReturn = keyof typeof RETURNS;

export const PICKER = "/settings/holidays";

export function pickerReturnOf(asked: string | string[] | undefined): PickerReturn {
  const text = Array.isArray(asked) ? asked[0] : asked;
  return text !== undefined && Object.hasOwn(RETURNS, text)
    ? (text as PickerReturn)
    : "/settings";
}

export function pickerReturnLabel(to: PickerReturn): string {
  return he.holidays.backTo(RETURNS[to]);
}

/** `href` with `from` added when it leads to the picker, and unchanged
 * otherwise. */
export function returningTo(href: string, from: string): string {
  if (href !== PICKER && !href.startsWith(`${PICKER}?`)) return href;
  const url = new URL(href, "http://x");
  url.searchParams.set("from", pickerReturnOf(from));
  return `${url.pathname}${url.search}`;
}

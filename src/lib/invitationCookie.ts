/**
 * The token an invitation link carries, and the cookie it is kept in until the
 * person it was sent to is signed in (specs.md item 11).
 *
 * **A cookie and not the query**, because the link is rarely the page that
 * accepts: a new person signs up, leaves for their mail, and comes back through
 * a confirmation link that carries nothing of the invitation, and a person
 * already signed in is sent past `/sign-in` by the proxy before any screen could
 * read it. The proxy writes it; `acceptInvitationFromCookie` spends it.
 *
 * `httpOnly`, so no script on the page can read or forge it, and a page can only
 * be given one by opening a link on this origin.
 */
export const INVITATION_COOKIE = "invitation";

/** The query parameter the link names the token with. */
export const INVITATION_TOKEN_PARAM = "token";

/** Long enough to sign up and confirm an address, short enough not to linger. */
export const INVITATION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The token, if the text is one; anything else is dropped rather than sent. */
export function invitationToken(text: string | null | undefined): string | null {
  return text && UUID.test(text) ? text : null;
}

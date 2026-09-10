import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * The four identifying numbers, sealed and opened (specs.md items 22 and 28).
 *
 * **The key lives outside the database**, which is the whole requirement Part 3
 * states: a copy of the database on its own must reveal nothing. That rules out
 * every scheme where Postgres holds the key, because a key Postgres can reach
 * travels with the dump. So the sealing happens here, in the application, and
 * the database knows these columns only as bytes.
 *
 * **They are decrypted on the server only, at the moment they are shown to
 * their own account or written into an export**, and they never appear in a
 * log, in a URL, or in anything sent to the browser beyond the screen that
 * needs them (Part 3). Nothing in this file writes to a console or puts a
 * number into an error message, and the last of the tests beside it is what
 * says so.
 *
 * **The key is a parameter and never read from the environment inside a
 * function that uses it**, for the same reason `today` is passed into the
 * engine: a module that reaches for `process.env` on its own is one that cannot
 * be tested without the deployment's real key, and a test that encrypts under
 * the real key is a test that can only be run where the real key is. `keyFrom`
 * below is the one place the environment is read, and it is called by the
 * callers rather than by these two.
 */

/** AES-256, so the key is exactly this long. */
const KEY_BYTES = 32;

/** 96 bits, which is the nonce length AES-GCM is defined for and the only one
 * where a random nonce is safe at this scale. */
const NONCE_BYTES = 12;

/** GCM's authentication tag: what makes a tampered ciphertext fail to open
 * rather than open to something else. */
const TAG_BYTES = 16;

/**
 * The first byte of every sealed value, so that the format can change without
 * a database full of bytes that nobody can tell apart.
 *
 * **One byte, spent deliberately.** A stored format is the kind of decision
 * that cannot be revisited cheaply: rotating the key or moving to another
 * cipher means re-encrypting every row, and doing that safely means being able
 * to tell a row that has been converted from one that has not. Without a
 * version byte the only way to tell is to try both and see which one opens,
 * which is indistinguishable from a corrupted row.
 */
const VERSION = 1;

/**
 * A number that cannot be read without the key: version, nonce, tag,
 * ciphertext, in that order and in one buffer.
 *
 * One buffer rather than three columns because it is one value: three columns
 * can come apart in a partial write, and a nonce beside the wrong ciphertext is
 * a row that fails to open with no way to say why.
 */
export type SealedNumber = Buffer;

/**
 * The key, read from the environment exactly once per call site.
 *
 * `ENCRYPTION_KEY` is 32 random bytes, base64. It is checked here rather than
 * where it is used, because the failure it prevents is silent: a key of the
 * wrong length would either throw deep inside `createCipheriv` with a message
 * about a cipher, or -- worse, had this been a scheme that padded -- seal
 * things under a key nobody meant.
 *
 * **Losing this key makes the four columns unreadable for good.** There is no
 * copy of it in the database by design, so there is nothing to recover it from.
 */
export function keyFrom(value: string | undefined): Buffer {
  if (value === undefined || value === "") {
    throw new Error(
      "ENCRYPTION_KEY is not set: the identifying numbers cannot be read or written without it",
    );
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_BYTES} bytes of base64, and this one is ${key.length}`,
    );
  }
  return key;
}

/**
 * Seal one number.
 *
 * **The same number seals to different bytes every time**, because the nonce is
 * random. That is a property and not an inefficiency: equal ciphertexts would
 * say that two workers share a passport number to anyone holding the database
 * and no key, which is exactly what item 22 is for. It is also why nothing
 * about these columns is indexed or unique -- an equality lookup could never
 * match.
 */
export function sealNumber(plain: string, key: Buffer): SealedNumber {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const sealed = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([
    Buffer.from([VERSION]),
    nonce,
    cipher.getAuthTag(),
    sealed,
  ]);
}

/**
 * Open one number, or throw.
 *
 * **A wrong key and a tampered value are the same failure**, which is what
 * authenticated encryption buys: the tag is checked before anything is
 * returned, so there is no state in which a caller holds a plausible-looking
 * number that is not the one that was stored.
 *
 * The message says what could not be opened and never says what was in it or
 * what came out of it. An error is the place a secret most easily escapes,
 * because an error is the thing that gets logged.
 */
export function openNumber(sealed: SealedNumber, key: Buffer): string {
  if (sealed.length < 1 + NONCE_BYTES + TAG_BYTES) {
    throw new Error("a sealed identifying number is too short to be one");
  }
  const version = sealed[0];
  if (version !== VERSION) {
    throw new Error(
      `a sealed identifying number is version ${version}, and this build reads version ${VERSION}`,
    );
  }
  const nonce = sealed.subarray(1, 1 + NONCE_BYTES);
  const tag = sealed.subarray(1 + NONCE_BYTES, 1 + NONCE_BYTES + TAG_BYTES);
  const body = sealed.subarray(1 + NONCE_BYTES + TAG_BYTES);

  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(body), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    throw new Error(
      "a sealed identifying number could not be opened: the key does not match it, or the bytes have changed",
    );
  }
}

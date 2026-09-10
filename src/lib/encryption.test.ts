import { describe, expect, it } from "vitest";
import { keyFrom, openNumber, sealNumber } from "@/lib/encryption";

/**
 * The identifying numbers, sealed and opened (specs.md items 22 and 28).
 *
 * **Every key here is a fixed one written into this file**, never the
 * deployment's. A test that sealed under `process.env.ENCRYPTION_KEY` would
 * pass on the machine that has it and fail on a fresh clone, and would put the
 * real key into the one process most likely to print its inputs on failure.
 *
 * The expected figures are the format's own — 32 key bytes, a 12-byte nonce, a
 * 16-byte tag and a version byte, which are AES-GCM's numbers and not this
 * module's — and a passport number chosen here.
 */

/** 32 bytes of base64, fixed. `A` repeated is not a secret and is not meant to
 * be one: what these tests check is the shape of the failure, not the strength
 * of the key. */
const KEY = "A".repeat(43) + "=";
const OTHER_KEY = "B".repeat(43) + "=";

/** A passport number in the shape a Philippine one takes. It is invented, and
 * it is here rather than in a fixture file because the point of every
 * assertion below is that this exact string comes back or does not appear. */
const PASSPORT = "P1234567A";

describe("keyFrom", () => {
  it("refuses a missing key by name, rather than failing later inside a cipher", () => {
    expect(() => keyFrom(undefined)).toThrow(/ENCRYPTION_KEY is not set/);
    expect(() => keyFrom("")).toThrow(/ENCRYPTION_KEY is not set/);
  });

  it("refuses a key that is not 32 bytes, and says how long it was", () => {
    // Sixteen bytes of base64: a plausible-looking key, and the wrong length
    // for AES-256. Caught here so that the failure names the environment
    // variable instead of naming a cipher.
    expect(() => keyFrom(Buffer.alloc(16).toString("base64"))).toThrow(
      /must be 32 bytes of base64, and this one is 16/,
    );
  });

  it("accepts 32 bytes", () => {
    expect(keyFrom(KEY)).toHaveLength(32);
  });
});

describe("sealNumber and openNumber", () => {
  it("returns exactly what was sealed", () => {
    const key = keyFrom(KEY);
    expect(openNumber(sealNumber(PASSPORT, key), key)).toBe(PASSPORT);
  });

  it("carries a number with Hebrew and digits in it unchanged", () => {
    // A bank line is written as the family writes it, and a family writes the
    // bank's name in Hebrew. Bytes and not characters is what `utf8` on both
    // sides buys, and a length assertion in the wrong unit is how that gets
    // broken later.
    const key = keyFrom(KEY);
    const account = "בנק לאומי 10-800 12345678";
    expect(openNumber(sealNumber(account, key), key)).toBe(account);
  });

  it("seals the same number to different bytes every time", () => {
    // The property item 22 is for: two workers with the same passport number
    // must not be visible as such to someone holding the database and no key.
    // It is also why nothing about these columns is indexed or unique.
    const key = keyFrom(KEY);
    const once = sealNumber(PASSPORT, key);
    const twice = sealNumber(PASSPORT, key);
    expect(once.equals(twice)).toBe(false);
    expect(openNumber(once, key)).toBe(openNumber(twice, key));
  });

  it("writes the version, the nonce and the tag before the ciphertext", () => {
    // The layout is what a stored format is, so it is asserted rather than
    // assumed: a change to it silently makes every row already written
    // unreadable, and this is the test that says so before the rows exist.
    const sealed = sealNumber(PASSPORT, keyFrom(KEY));
    expect(sealed[0]).toBe(1);
    // AES-GCM is a stream cipher, so the ciphertext is exactly as long as the
    // plaintext: 1 version + 12 nonce + 16 tag + 9 characters.
    expect(sealed).toHaveLength(1 + 12 + 16 + PASSPORT.length);
  });

  it("leaves nothing of the number in the sealed bytes", () => {
    // The whole of item 22 in one assertion: reading the column straight out
    // of the database shows unreadable values. It would catch a change that
    // stored the number beside its ciphertext, or that sealed only part of it.
    const sealed = sealNumber(PASSPORT, keyFrom(KEY));
    expect(sealed.toString("latin1")).not.toContain(PASSPORT);
    expect(sealed.toString("utf8")).not.toContain(PASSPORT);
  });
});

describe("what will not open", () => {
  it("refuses the wrong key rather than returning something plausible", () => {
    const sealed = sealNumber(PASSPORT, keyFrom(KEY));
    expect(() => openNumber(sealed, keyFrom(OTHER_KEY))).toThrow(
      /could not be opened/,
    );
  });

  it("refuses bytes that have been changed", () => {
    // Authenticated encryption is the reason this is a refusal and not a
    // different number. Without the tag, flipping a byte of the ciphertext
    // would produce a passport number that is wrong and looks right — which
    // would reach the exported sheet.
    const key = keyFrom(KEY);
    const sealed = sealNumber(PASSPORT, key);
    const tampered = Buffer.from(sealed);
    tampered[tampered.length - 1] ^= 0x01;
    expect(() => openNumber(tampered, key)).toThrow(/could not be opened/);
  });

  it("refuses a value from a format this build does not read", () => {
    const key = keyFrom(KEY);
    const sealed = Buffer.from(sealNumber(PASSPORT, key));
    sealed[0] = 2;
    expect(() => openNumber(sealed, key)).toThrow(/version 2/);
  });

  it("refuses a value too short to hold a nonce and a tag", () => {
    expect(() => openNumber(Buffer.alloc(8), keyFrom(KEY))).toThrow(
      /too short/,
    );
  });

  it("never puts the number into the message it throws", () => {
    // An error is the place a secret most easily escapes, because an error is
    // the thing that gets logged — and Part 3 says these numbers never appear
    // in a log. This is the test that would catch an error message "improved"
    // later to say which value failed.
    const sealed = sealNumber(PASSPORT, keyFrom(KEY));
    try {
      openNumber(sealed, keyFrom(OTHER_KEY));
      throw new Error("it opened, which it must not have");
    } catch (error) {
      expect(String(error)).not.toContain(PASSPORT);
    }
  });
});

import { describe, expect, it } from "vitest";
import { ACTION_FAULT, answering } from "./actionFault";

/**
 * The server half of the fault surface: a body that throws answers a fault
 * instead of taking the screen down.
 *
 * **The defect this exists to catch.** A server action that throws is rethrown
 * by React from its own dispatch and replaces the whole tree with Next's English
 * screen — measured three ways on 2026-09-29, and the reason this wrapper exists
 * at all. If `answering` ever let an exception past it, every guarded action
 * would silently go back to doing that, and nothing else in the suite would
 * notice: the refusal paths would all still pass.
 *
 * **The expected values come from what a caller must be able to rely on**, not
 * from reading the implementation back: a returned answer arrives untouched
 * whatever its shape, and a throw becomes exactly the one fault value every
 * control knows how to draw.
 */
describe("answering", () => {
  it("hands back what the body answered, untouched", async () => {
    await expect(answering(async () => ({ ok: true }) as const)).resolves.toEqual({
      ok: true,
    });
  });

  /** A refusal is an answer and not a failure, so it must not be turned into a
   * fault — the two say different things to the user and only one of them names
   * something they can act on. */
  it("hands back a refusal as a refusal", async () => {
    await expect(
      answering(async () => ({ ok: false, reason: "noMonth" }) as const),
    ).resolves.toEqual({ ok: false, reason: "noMonth" });
  });

  it("turns a throw into the fault", async () => {
    await expect(
      answering(async () => {
        throw new Error("the database is unreachable");
      }),
    ).resolves.toEqual({ ok: false, fault: true });
  });

  /** Whatever was thrown, nothing of it is carried out: a message can hold a
   * worker id, a Postgres message or ciphertext. */
  it("carries nothing of what was thrown", async () => {
    const answer = await answering(async () => {
      throw new Error("worker 4f1c… — column passport_encrypted");
    });
    expect(Object.keys(answer as object).sort()).toEqual(["fault", "ok"]);
    expect(JSON.stringify(answer)).not.toContain("passport");
  });

  /** A rejection with no `Error` at all — a string, or a value some library
   * throws — is still a fault and not an escape. */
  it("treats a non-Error rejection as a fault too", async () => {
    await expect(
      answering(async () => {
        throw "not an Error";
      }),
    ).resolves.toEqual(ACTION_FAULT);
  });

  /** A body that throws before its first `await` throws synchronously inside the
   * async function, which is the same case — but it is the one a `try` around a
   * bare call would miss, so it is asserted rather than assumed. */
  it("catches a throw that happens before any await", async () => {
    await expect(
      answering(() => {
        throw new Error("thrown while building the promise");
      }),
    ).resolves.toEqual(ACTION_FAULT);
  });
});

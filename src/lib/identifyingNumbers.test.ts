import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepository } from "@/lib/engine/repository";
import type { WorkerProfile } from "@/lib/engine/repository";
import { DEFAULT_INCOME_TAX } from "@/lib/engine/types";
import { SATURDAY } from "@/lib/dates";
import {
  readIdentifyingNumbers,
  saveIdentifyingNumbers,
} from "@/lib/identifyingNumbers";

/**
 * The four identifying numbers on their way into a store and back
 * (specs.md items 22 and 28).
 *
 * **What this would catch is the failure that has no symptom**: a number that
 * reached a store in the clear. Nothing about that looks wrong from the
 * outside — the screen shows the passport either way — so the assertion is made
 * against the bytes the store holds rather than against what comes back out.
 *
 * The key is generated per run and is never the deployment's. `encryption.ts`
 * takes the key as a parameter precisely so this is possible.
 */
const KEY = randomBytes(32).toString("base64");

const SHE: WorkerProfile = {
  id: "w1",
  name: "מריה סנטוס",
  firstName: "מריה",
  gender: "female",
  employedSince: "2026-04-01",
  baseMonthlySalaryAgorot: 644385,
  restDay: SATURDAY,
  restEveSupplementAgorot: 0,
  recuperationMonth: 7,
  incomeTax: DEFAULT_INCOME_TAX,
  standingLines: [],
  country: "PH",
  insurer: "",
  documents: {
    employmentPermitExpiry: null,
    workVisaExpiry: null,
    passportExpiry: null,
  },
  openingPosition: { vacationDays: 0, sickDays: 0, advances: [] },
};

describe("the identifying numbers", () => {
  let previous: string | undefined;

  beforeEach(() => {
    previous = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = KEY;
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = previous;
  });

  async function aStore() {
    return createInMemoryRepository({ workers: [SHE] });
  }

  it("comes back as it was typed", async () => {
    const store = await aStore();
    await saveIdentifyingNumbers(store, "w1", { passport: "P1234567" });
    expect(await readIdentifyingNumbers(store, "w1")).toEqual({
      passport: "P1234567",
    });
  });

  /**
   * **The store holds bytes and the number is not among them.** This is the
   * assertion the whole module exists for: the sealing happens above the
   * repository, so the in-memory store the browser suite runs on is under the
   * same rule as Postgres. A later session that saved a number on
   * `WorkerProfile` instead would pass every other test in this file.
   */
  it("never reaches the store as the number", async () => {
    const store = await aStore();
    await saveIdentifyingNumbers(store, "w1", { passport: "P1234567" });

    const sealed = await store.sealedNumbers("w1");
    expect(sealed.passport).not.toBeNull();
    expect(sealed.passport?.toString("utf8")).not.toContain("P1234567");
    expect(sealed.passport?.toString("hex")).not.toContain(
      Buffer.from("P1234567", "utf8").toString("hex"),
    );
  });

  /** The same number sealed twice is different bytes, because the nonce is
   * random — equal ciphertexts would tell anyone holding the database that two
   * workers share a passport (item 22). */
  it("seals the same number to different bytes each time", async () => {
    const store = await aStore();
    await saveIdentifyingNumbers(store, "w1", { passport: "P1234567" });
    const once = (await store.sealedNumbers("w1")).passport;
    await saveIdentifyingNumbers(store, "w1", { passport: "P1234567" });
    const again = (await store.sealedNumbers("w1")).passport;

    expect(once?.toString("hex")).not.toBe(again?.toString("hex"));
  });

  /**
   * **A write names what it changes and nothing else**, which is the rule that
   * keeps a second worker from erasing the household's permit number: the
   * permit is the employer's position and two workers share it (item 28).
   */
  it("leaves a number a later write did not name", async () => {
    const store = await aStore();
    await saveIdentifyingNumbers(store, "w1", {
      passport: "P1234567",
      employmentPermit: "H-99887",
    });
    await saveIdentifyingNumbers(store, "w1", { bankAccount: "12-345-6789" });

    expect(await readIdentifyingNumbers(store, "w1")).toEqual({
      passport: "P1234567",
      employmentPermit: "H-99887",
      bankAccount: "12-345-6789",
    });
  });

  /**
   * An emptied field clears the number rather than sealing an empty string: a
   * sealed empty value opens to nothing and is indistinguishable from a number,
   * so "has a passport been entered" would need the key to answer.
   */
  it("clears a number the family emptied", async () => {
    const store = await aStore();
    await saveIdentifyingNumbers(store, "w1", { passport: "P1234567" });
    await saveIdentifyingNumbers(store, "w1", { passport: "   " });

    expect(await readIdentifyingNumbers(store, "w1")).toEqual({});
    expect((await store.sealedNumbers("w1")).passport).toBeNull();
  });

  /** A worker the store does not hold is a bug in the caller and is raised,
   * exactly as every other method of the repository raises it. */
  it("refuses a worker who is not there", async () => {
    const store = await aStore();
    await expect(readIdentifyingNumbers(store, "nobody")).rejects.toThrow(
      /nobody/,
    );
  });
});

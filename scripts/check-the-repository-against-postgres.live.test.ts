import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SEEDED_RATES } from "@/lib/datedRates";
import { openNumber, sealNumber } from "@/lib/encryption";
import { UnknownWorkerError } from "@/lib/engine/repository";
import type { MonthRecord, SalaryRepository, WorkerProfile } from "@/lib/engine/repository";
import type { MonthSpan } from "@/lib/engine/types";
import { createPostgresRepository } from "@/lib/supabase/repository";

/**
 * The Postgres repository, asked of Postgres (`build_plan.md` stage 3).
 *
 * **It is not in the unit suite and cannot be.** What this file checks is a
 * mapping between two vocabularies — `WorkerProfile` and a row of columns — and
 * every way of getting that wrong type-checks: a column misspelled, a `numeric`
 * read as a string, an `on conflict` naming the wrong key, a grant nobody made.
 * A fake client would answer whatever the mapping asked it, which is to say it
 * would agree with the code under test about everything including its mistakes.
 * So this runs against the real project, by hand, the way
 * `scripts/check-household-isolation.mjs` and
 * `scripts/check-one-address-one-account.mjs` already do (`specs.md` Part 4):
 *
 *   npx vitest run --config vitest.live.config.ts
 *
 * **It signs in as an ordinary person and holds the publishable key**, never
 * the service-role key, which bypasses row-level security and would prove
 * nothing: every statement below therefore passes the policies of migrations 1
 * and 5 exactly as a browser's would. The service-role key is used once, in this
 * file's own setup, for the one thing a browser cannot do — make a confirmed
 * account without sending mail — and again at the end to delete it.
 *
 * Every expected figure is a fixture written here and read back, never something
 * the repository produced (`CLAUDE.md` rule 11). What it would catch is a stored
 * fact coming back changed.
 */

try {
  process.loadEnvFile(".env");
} catch {
  // Already in the environment, or absent — the guard below says which.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishable || !serviceRole) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be set — run this with a filled-in .env",
  );
}

/** Generated per run. The account it belongs to is made and deleted by this
 * file, so the value means nothing — and a literal beside the word "password"
 * is the shape `hooks/pre-commit` refuses on sight, which it is right to do. */
const password = randomUUID();
const address = `repository-check-${Date.now()}@easesalary.test`;

let userId: string;
let client: SupabaseClient;
let repository: SalaryRepository;
let ownHouseholdId: string;

/** A worker whose every field carries a value, so a column silently dropped on
 * the way in comes back as a difference rather than as a default that happens
 * to match. */
function aWorker(): WorkerProfile {
  return {
    id: randomUUID(),
    name: "עובדת הבדיקה",
    firstName: "בדיקה",
    gender: "female",
    employedSince: "2024-03-01",
    firstMonth: { year: 2026, month: 1 },
    baseMonthlySalaryAgorot: 624765,
    restEveSupplementAgorot: 5000,
    restDay: 5,
    recuperationMonth: 7,
    country: "IN",
    insurer: "סוכנות הביטוח של המשפחה",
    incomeTax: { mode: "percentage", percentage: 0.025 },
    standingLines: [
      {
        id: "standing-1",
        label: "החזר נסיעות",
        direction: "addition",
        agorot: 12000,
      },
    ],
    holidaySource: { kind: "religion", religion: "christian" },
    openingPosition: {
      vacationDays: 4.5,
      sickDays: 2.25,
      vacationUsedThisYear: 1.5,
      holidayUsedThisYear: 1,
      recuperationPaidIn: { year: 2025, month: 3 },
      advances: [
        { number: 1, principalAgorot: 300000, repaidAgorot: 50000, note: "מקדמה" },
      ],
    },
    documents: {
      employmentPermitExpiry: "2027-01-31",
      workVisaExpiry: "2026-11-30",
      passportExpiry: "2029-05-15",
    },
  };
}

/**
 * A worker in the store, and no other.
 *
 * **A household holds no more than two workers and the database is what says
 * so** (criterion 11), so a file of tests that each added one would meet the
 * trigger on the third and fail on the limit rather than on its subject. Each
 * clears what the last one left instead.
 *
 * The deletion goes through the client and not through the repository, because
 * the repository has no `deleteWorker`: nothing in the application removes a
 * worker, and adding a method to the interface so that a test can tidy up would
 * be a method the application does not have.
 */
async function aStoredWorker(
  changes: Partial<WorkerProfile> = {},
): Promise<WorkerProfile> {
  const { error } = await client
    .from("workers")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error !== null) throw error;

  const profile = { ...aWorker(), ...changes };
  await repository.saveWorker(profile);
  return profile;
}

function aMonth(year: number, month: number): MonthRecord {
  return {
    month: { year, month },
    confirmedWage: {
      baseAgorot: 624765,
      minimumAgorot: 624765,
      effectiveFrom: "2025-04-01",
    },
    terms: {
      restDay: 5,
      restEveSupplementAgorot: 5000,
      recuperationMonth: 7,
      incomeTax: { mode: "percentage", percentage: 0.025 },
      standingLines: [],
    },
    advances: [{ number: 1, kind: "granted", agorot: 100000, note: "מקדמה" }],
    thirdPartyPayments: [
      { kind: "medicalInsurance", agorot: 15000, paidOn: `${year}-0${month}-10` },
    ],
    userLines: [
      { id: "line-1", label: "שעות נוספות", direction: "addition", agorot: 8000 },
    ],
    overrides: { recuperation: { agorot: 42000, note: "כפי שסוכם" } },
    incomeTaxAgorot: 15619,
    recuperationDayRateAgorot: 42800,
  };
}

beforeAll(async () => {
  const created = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: address, password, email_confirm: true }),
  });
  if (!created.ok) {
    throw new Error(`could not create the account: ${created.status}`);
  }
  userId = (await created.json()).id as string;

  client = createClient(url, publishable);
  const { error: signInFailure } = await client.auth.signInWithPassword({
    email: address,
    password,
  });
  if (signInFailure !== null) throw signInFailure;

  // The one way in, as migration 4 made it: a household and its first member
  // are one call, so one can never exist that nobody is able to read.
  const { data: householdId, error } = await client.rpc("create_household");
  if (error !== null) throw error;

  ownHouseholdId = householdId as string;
  repository = createPostgresRepository(client, ownHouseholdId);
});

afterAll(async () => {
  // Takes the household, its workers, their spans and their months with it.
  await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
    },
  });
});

describe("the worker", () => {
  test("comes back exactly as she was saved, every field and both sides of the household boundary", async () => {
    const profile = await aStoredWorker();

    const read = await repository.getWorker(profile.id);
    // The permit is the employer's and lives on the household row; the visa and
    // the passport are hers. A round trip that put all three in one place would
    // pass a shallower assertion than this one.
    expect(read).toEqual(profile);

    const all = await repository.listWorkers();
    expect(all).toEqual([profile]);
  });

  test("a worker nobody has heard of is null, and asking for her facts raises", async () => {
    const stranger = randomUUID();
    expect(await repository.getWorker(stranger)).toBeNull();
    await expect(repository.listSpans(stranger)).rejects.toBeInstanceOf(
      UnknownWorkerError,
    );
  });

  test("her own country's list is stored as an absence and not as a copy of her country", async () => {
    const profile = await aStoredWorker({ holidaySource: undefined });
    const read = await repository.getWorker(profile.id);
    expect(read?.holidaySource).toBeUndefined();
    expect(read?.country).toBe("IN");
  });
});

describe("the spans and the months", () => {
  test("a spell that crosses a month boundary is one span and reaches both months", async () => {
    const profile = await aStoredWorker();
    await repository.saveMonth(profile.id, aMonth(2026, 3));
    await repository.saveMonth(profile.id, aMonth(2026, 4));

    const spell: MonthSpan = {
      id: "sick-2026-03-30-2026-04-02",
      kind: "sick",
      from: "2026-03-30",
      to: "2026-04-02",
      note: "מחלה",
    };
    await repository.saveSpan(profile.id, spell);

    // Stored once — a copy against each month would be two things to close.
    expect(await repository.listSpans(profile.id)).toEqual([spell]);

    const march = await repository.getMonth(profile.id, { year: 2026, month: 3 });
    const april = await repository.getMonth(profile.id, { year: 2026, month: 4 });
    expect(march?.spans).toEqual([spell]);
    expect(april?.spans).toEqual([spell]);
  });

  test("an open spell is stored open, and saving it again with an end closes it", async () => {
    const profile = await aStoredWorker();

    const open: MonthSpan = {
      id: "sick-2026-05-04",
      kind: "sick",
      from: "2026-05-04",
      to: null,
    };
    await repository.saveSpan(profile.id, open);
    expect(await repository.listSpans(profile.id)).toEqual([open]);

    await repository.saveSpan(profile.id, { ...open, to: "2026-05-06" });
    // One span with an end, and not a second span beside the first: the id is
    // the key, which is what lets the same run be marked twice.
    expect(await repository.listSpans(profile.id)).toEqual([
      { ...open, to: "2026-05-06" },
    ]);

    await repository.deleteSpan(profile.id, open.id);
    expect(await repository.listSpans(profile.id)).toEqual([]);
  });

  test("a month keeps every fact it was given, and the months come back oldest first", async () => {
    const profile = await aStoredWorker();

    // Written out of order on purpose: `calculateSeries` replays them in date
    // order, and a correction to an old month is written last.
    await repository.saveMonth(profile.id, aMonth(2026, 2));
    await repository.saveMonth(profile.id, aMonth(2025, 12));
    await repository.saveMonth(profile.id, aMonth(2026, 1));

    const months = await repository.listMonths(profile.id);
    expect(months.map((each) => each.month)).toEqual([
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ]);

    const january = await repository.getMonth(profile.id, { year: 2026, month: 1 });
    expect(january).toEqual({ ...aMonth(2026, 1), spans: [] });
  });

  test("a month with no recuperation rate comes back without one, rather than with a zero", async () => {
    const profile = await aStoredWorker();
    const { recuperationDayRateAgorot, ...without } = aMonth(2026, 6);
    void recuperationDayRateAgorot;
    await repository.saveMonth(profile.id, without);

    const read = await repository.getMonth(profile.id, { year: 2026, month: 6 });
    // Null is "not confirmed for this month" and never "worth nothing": the
    // engine falls back to the dated-rates table, and a zero here would price a
    // day of recuperation at nothing.
    expect(read).not.toHaveProperty("recuperationDayRateAgorot");
  });

  test("saving a month twice corrects it rather than refusing it", async () => {
    const profile = await aStoredWorker();
    await repository.saveMonth(profile.id, aMonth(2026, 8));
    await repository.saveMonth(profile.id, {
      ...aMonth(2026, 8),
      incomeTaxAgorot: 20000,
    });

    const months = await repository.listMonths(profile.id);
    expect(months).toHaveLength(1);
    expect(months[0].incomeTaxAgorot).toBe(20000);
  });
});

describe("what the household shares between its workers", () => {
  test("a household that has fetched nothing still knows what the application ships knowing", async () => {
    // The interface promises this is seeded and never empty, so that a family
    // who has never fetched anything can still value a month.
    expect(await repository.listRates()).toEqual(SEEDED_RATES);
  });

  test("a fetched rate replaces the shipped figure for its own key and date, and is read back in its own unit", async () => {
    const fetched = {
      key: "minimumWage" as const,
      value: 700000,
      effectiveFrom: "2027-01-01",
      source: "https://example.test/the-notice",
    };
    await repository.saveRate(fetched);

    const rates = await repository.listRates();
    expect(rates).toContainEqual(fetched);
    // A `numeric` arrives from PostgREST as a string; a household whose minimum
    // wage came back as "700000" would compare and add as text.
    expect(typeof rates.find((each) => each.effectiveFrom === "2027-01-01")?.value).toBe(
      "number",
    );

    // Saved again for the same key and date: replaced, never appended beside
    // itself, or "the rate in force" would be ambiguous.
    await repository.saveRate({ ...fetched, value: 710000 });
    const again = await repository.listRates();
    expect(
      again.filter((each) => each.key === "minimumWage" && each.effectiveFrom === "2027-01-01"),
    ).toEqual([{ ...fetched, value: 710000 }]);
  });

  test("a holiday list is stored with the address it actually came from", async () => {
    const list = {
      source: { kind: "country" as const, code: "NP" },
      year: 2027,
      // Nepal publishes under `/en/` where the other shipped lists are under
      // `/he/`, which is why the address is stored rather than rebuilt.
      sourceUrl: "https://example.test/en/np-2027",
      nameHe: "נפאל",
      holidays: [{ date: "2027-01-15", name: "Maghe Sankranti" }],
    };
    await repository.saveHolidayList(list);

    const lists = await repository.listHolidayLists();
    expect(lists).toContainEqual(list);
    // And the shipped lists are still there beside it.
    expect(lists.length).toBeGreaterThan(1);
  });
});

/**
 * The four identifying numbers, asked of Postgres (specs.md items 22 and 28).
 *
 * **This is where the encoding is actually checked.** A `bytea` crosses
 * PostgREST as Postgres's own hex literal, and there is no type that catches a
 * prefix written wrong: the bytes would go in, come back shorter or longer, and
 * fail to open — which reads as a wrong key rather than as a wrong encoding.
 * The unit suite runs the same sealing against the in-memory store and can say
 * nothing about this.
 *
 * The numbers below are invented for this file and belong to nobody.
 */
describe("the identifying numbers", () => {
  const key = randomBytes(32);

  test("a sealed number goes into Postgres and comes back byte for byte", async () => {
    const profile = await aStoredWorker();
    const sealed = sealNumber("P7781234", key);

    await repository.saveSealedNumbers(profile.id, { passport: sealed });
    const read = await repository.sealedNumbers(profile.id);

    expect(read.passport?.toString("hex")).toBe(sealed.toString("hex"));
    // And it opens, which is the assertion that would fail on an encoding the
    // round trip merely preserved the length of.
    expect(openNumber(read.passport as Buffer, key)).toBe("P7781234");
  });

  /**
   * **A write names what it changes.** The employment permit's number is the
   * household's and two workers share it (item 28), so a save that rewrote every
   * column would erase it the moment a second worker's passport was entered.
   */
  test("a partial write leaves the numbers it did not name", async () => {
    const profile = await aStoredWorker();
    await repository.saveSealedNumbers(profile.id, {
      passport: sealNumber("P7781234", key),
      employmentPermit: sealNumber("H-99887", key),
    });
    await repository.saveSealedNumbers(profile.id, {
      bankAccount: sealNumber("12-345-6789", key),
    });

    const read = await repository.sealedNumbers(profile.id);
    expect(openNumber(read.passport as Buffer, key)).toBe("P7781234");
    expect(openNumber(read.employmentPermit as Buffer, key)).toBe("H-99887");
    expect(openNumber(read.bankAccount as Buffer, key)).toBe("12-345-6789");
  });

  test("an explicit null clears the number, and a worker with none reads as none", async () => {
    const profile = await aStoredWorker();
    const fresh = await repository.sealedNumbers(profile.id);

    // Her three, and not the household's fourth. The employment permit is the
    // employer's position and survives the worker it was entered beside —
    // `aStoredWorker` replaces the workers and leaves the household standing,
    // which is the same thing that happens when a family's caregiver changes.
    expect(fresh.passport).toBeNull();
    expect(fresh.bankAccount).toBeNull();
    expect(fresh.workVisa).toBeNull();

    await repository.saveSealedNumbers(profile.id, {
      workVisa: sealNumber("B1-4457", key),
    });
    await repository.saveSealedNumbers(profile.id, { workVisa: null });
    expect((await repository.sealedNumbers(profile.id)).workVisa).toBeNull();
  });

  /**
   * **Saving her profile does not erase her numbers**, which is the failure a
   * wholesale upsert would produce: the columns are not on `WorkerProfile`, so a
   * save that listed every column would write nulls into them every time a rest
   * day changed.
   */
  test("the numbers survive a save of the profile", async () => {
    const profile = await aStoredWorker();
    await repository.saveSealedNumbers(profile.id, {
      passport: sealNumber("P7781234", key),
    });

    await repository.saveWorker({ ...profile, restEveSupplementAgorot: 45000 });

    const read = await repository.sealedNumbers(profile.id);
    expect(openNumber(read.passport as Buffer, key)).toBe("P7781234");
  });

  test("a worker in no household of ours has no numbers to give", async () => {
    await expect(
      repository.sealedNumbers("00000000-0000-0000-0000-000000000000"),
    ).rejects.toBeInstanceOf(UnknownWorkerError);
  });
});

/**
 * **A worker shared from another household stays that household's** (criterion
 * 11). Someone who accepted an invitation reaches the other family's workers
 * beside their own, and the repository they hold was opened on their *own*
 * household — the one they joined first. Until 2026-09-13 a save of her profile
 * wrote that household's id onto her row, which moved her out of the family
 * that employs her, and put the family's permit onto the wrong household.
 *
 * Last in the file on purpose: `aStoredWorker` clears every worker the account
 * can reach, and from here on that includes the other family's.
 */
describe("a worker shared from another household", () => {
  const familyAddress = `repository-family-${Date.now()}@easesalary.test`;
  let familyUserId: string;
  let familyClient: SupabaseClient;
  let family: SalaryRepository;
  let familyHouseholdId: string;

  beforeAll(async () => {
    const created = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: familyAddress, password, email_confirm: true }),
    });
    if (!created.ok) throw new Error(`could not create the family: ${created.status}`);
    familyUserId = (await created.json()).id as string;

    familyClient = createClient(url, publishable);
    const { error: signInFailure } = await familyClient.auth.signInWithPassword({
      email: familyAddress,
      password,
    });
    if (signInFailure !== null) throw signInFailure;
    const { data, error } = await familyClient.rpc("create_household");
    if (error !== null) throw error;
    familyHouseholdId = data as string;
    family = createPostgresRepository(familyClient, familyHouseholdId);

    // One worker of our own before anything is shared, so the limit below is
    // counted against a household that is not empty.
    await aStoredWorker();

    const { data: invitation, error: inviteFailure } = await familyClient
      .from("household_invitations")
      .insert({ household_id: familyHouseholdId, email: address })
      .select("token")
      .single();
    if (inviteFailure !== null) throw inviteFailure;
    const { data: joined, error: acceptFailure } = await client.rpc(
      "accept_household_invitation",
      { invitation_token: invitation.token },
    );
    if (acceptFailure !== null) throw acceptFailure;
    expect(joined).toBe(1);
  });

  afterAll(async () => {
    await fetch(`${url}/auth/v1/admin/users/${familyUserId}`, {
      method: "DELETE",
      headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
    });
  });

  test("is saved back into her own household, with the permit on it and not on ours", async () => {
    const shared: WorkerProfile = {
      ...aWorker(),
      name: "העובדת של המשפחה",
      documents: {
        employmentPermitExpiry: "2027-06-30",
        workVisaExpiry: null,
        passportExpiry: null,
      },
    };
    await family.saveWorker(shared);

    // Read by the person it was shared with: the permit expiry is the family
    // household's, not whatever ours holds.
    const seen = await repository.getWorker(shared.id);
    expect(seen?.documents.employmentPermitExpiry).toBe("2027-06-30");

    await repository.saveWorker({
      ...shared,
      restEveSupplementAgorot: 7000,
      documents: { ...shared.documents, employmentPermitExpiry: "2028-01-31" },
    });

    const { data: row } = await familyClient
      .from("workers")
      .select("household_id, rest_eve_supplement_agorot")
      .eq("id", shared.id)
      .single();
    expect(row).toEqual({
      household_id: familyHouseholdId,
      rest_eve_supplement_agorot: 7000,
    });

    const { data: households } = await client
      .from("households")
      .select("id, employment_permit_expiry")
      .in("id", [ownHouseholdId, familyHouseholdId]);
    const expiryOf = (id: string) =>
      households?.find((household) => household.id === id)?.employment_permit_expiry;
    expect(expiryOf(familyHouseholdId)).toBe("2028-01-31");
    expect(expiryOf(ownHouseholdId)).not.toBe("2028-01-31");
  });

  test("its permit number is sealed onto its own household", async () => {
    const shared = { ...aWorker(), name: "עובדת שנייה של המשפחה" };
    await family.saveWorker(shared);

    // Ours as the earlier tests left it, so what is asserted is that it did
    // not move rather than that it happens to be empty.
    const ourPermit = async () =>
      (
        await client
          .from("households")
          .select("employment_permit_number_encrypted")
          .eq("id", ownHouseholdId)
          .single()
      ).data?.employment_permit_number_encrypted;
    const before = await ourPermit();

    const key = randomBytes(32);
    const sealed = sealNumber("EP-555", key);
    await repository.saveSealedNumbers(shared.id, { employmentPermit: sealed });

    const theirs = await family.sealedNumbers(shared.id);
    expect(openNumber(theirs.employmentPermit as Buffer, key)).toBe("EP-555");

    const after = await ourPermit();
    expect(after).toEqual(before);
    expect(after).not.toBe(`\\x${sealed.toString("hex")}`);
  });

  test("does not count against our own limit of two", async () => {
    // One worker of ours and two of the family's are all reachable, and there
    // is still room for our second.
    expect((await repository.listWorkers()).length).toBe(3);
    expect(await repository.hasRoomForWorker()).toBe(true);
    expect(await family.hasRoomForWorker()).toBe(false);
  });
});

// The stage's own "done when", asked of the live database rather than of the
// migration that was supposed to produce it (build_plan.md, stage 3):
//
//   a second household cannot reach the first household's worker by any
//   crafted request.
//
// It is a script and not a test in the suite for the same reason the three
// page checks are: the suite reads saved files and never the network (specs.md
// Part 4), and a check that opens a socket would put a hosted service's uptime
// in front of a commit. It is also the check the agent that wrote the policies
// is worst placed to be trusted on, so it asks the database and never the code.
//
// **It talks to PostgREST with the publishable key, exactly as a browser
// would**, and never with the service-role key, which bypasses row-level
// security and would therefore prove nothing. Two real users are created, each
// gets a household and a worker, and then each one is asked for the other's
// row by every route a request can take: by listing the table, by naming the
// row's id, by filtering on the other household, and by trying to write.
//
// Run it from the repository root, with .env filled in:
//   node --env-file=.env scripts/check-household-isolation.mjs
//
// It creates two throwaway users and deletes them at the end, which takes their
// households, workers and memberships with them by cascade.

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !ANON || !SERVICE) {
  console.log("MISSING env: run with node --env-file=.env");
  process.exit(1);
}

let failures = 0;
/** Every check says what it proves, so a run reads as a report and not as a
 * row of ticks. A check that passes for the wrong reason — an empty list
 * because nothing was ever created — is what `expect` guards against below. */
function check(passed, what) {
  console.log(`${passed ? "ok  " : "FAIL"} ${what}`);
  if (!passed) failures += 1;
}

async function rest(path, { token, method = "GET", body, prefer } = {}) {
  const response = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token ?? ANON}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

async function admin(path, { method = "POST", body } = {}) {
  const response = await fetch(`${URL_}/auth/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function signIn(email, password) {
  const response = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  if (!body.access_token) {
    throw new Error(`could not sign in ${email}: ${JSON.stringify(body)}`);
  }
  return body.access_token;
}

const stamp = Date.now().toString(36);
const people = [
  { label: "first", email: `isolation-a-${stamp}@example.com` },
  { label: "second", email: `isolation-b-${stamp}@example.com` },
];
const PASSWORD = `pw-${stamp}-Aa1!`;

/** A worker good enough for every column the migration made `not null`. */
function workerFor(householdId, name) {
  return {
    household_id: householdId,
    name,
    first_name: name,
    gender: "female",
    employed_since: "2025-01-01",
    base_monthly_salary_agorot: 600000,
    recuperation_month: 7,
    country: "PH",
  };
}

const created = [];
try {
  for (const person of people) {
    const account = await admin("admin/users", {
      body: { email: person.email, password: PASSWORD, email_confirm: true },
    });
    if (!account.body?.id) {
      throw new Error(
        `could not create ${person.email}: ${JSON.stringify(account.body)}`,
      );
    }
    person.userId = account.body.id;
    created.push(account.body.id);
    person.token = await signIn(person.email, PASSWORD);

    // The one way in: creating a household and joining it are a single call,
    // because a creator who is not yet a member cannot read the row back.
    const household = await rest("rpc/create_household", {
      token: person.token,
      method: "POST",
      body: { household_name: `בית ${person.label}` },
    });
    check(
      household.status === 200 && typeof household.body === "string",
      `${person.label}: may create a household`,
    );
    person.householdId = household.body;

    const worker = await rest("workers", {
      token: person.token,
      method: "POST",
      body: workerFor(person.householdId, `עובדת ${person.label}`),
      prefer: "return=representation",
    });
    check(
      worker.status === 201 && worker.body?.[0]?.id,
      `${person.label}: may create a worker in her own household`,
    );
    person.workerId = worker.body?.[0]?.id;
  }

  const [a, b] = people;

  // The creator became a member in the same transaction. Without this the
  // insert policy would let someone create a household they cannot then read,
  // which reads as the insert having silently failed rather than as a bug.
  const ownHousehold = await rest("households?select=id", { token: a.token });
  check(
    Array.isArray(ownHousehold.body) &&
      ownHousehold.body.length === 1 &&
      ownHousehold.body[0].id === a.householdId,
    "the creator of a household is its member and sees exactly it",
  );

  // The check that everything below is measured against: the rows really exist
  // and are really reachable by the person they belong to. Without it, every
  // "cannot reach" below would pass against a database where nothing was
  // created at all.
  const ownWorker = await rest("workers?select=id,name", { token: a.token });
  check(
    Array.isArray(ownWorker.body) &&
      ownWorker.body.length === 1 &&
      ownWorker.body[0].id === a.workerId,
    "she reaches her own worker, so the refusals below mean something",
  );

  // Route 1: ask for the whole table. A policy written against the person
  // rather than the household would return both rows here.
  const listed = await rest("workers?select=id", { token: b.token });
  check(
    Array.isArray(listed.body) && !listed.body.some((row) => row.id === a.workerId),
    "listing every worker does not include the other household's",
  );

  // Route 2: name the row directly. This is the crafted request the stage
  // exists to refuse -- a worker id travels in a URL, so it is guessable in
  // exactly the way a listing is not.
  const named = await rest(`workers?select=id&id=eq.${a.workerId}`, {
    token: b.token,
  });
  check(
    Array.isArray(named.body) && named.body.length === 0,
    "naming the other household's worker by id returns nothing",
  );

  // Route 3: filter on the other household. A policy that only filtered the
  // rows it returned, without checking the filter, would answer this.
  const filtered = await rest(
    `workers?select=id&household_id=eq.${a.householdId}`,
    { token: b.token },
  );
  check(
    Array.isArray(filtered.body) && filtered.body.length === 0,
    "filtering by the other household's id returns nothing",
  );

  // Route 4: read the membership table, which is how a person would find out
  // that the other household exists at all.
  const members = await rest(
    `household_members?select=user_id&household_id=eq.${a.householdId}`,
    { token: b.token },
  );
  check(
    Array.isArray(members.body) && members.body.length === 0,
    "the other household's membership is not readable",
  );

  // Route 5: writing. Reading is not the only reach -- an update that silently
  // matched no rows would be a policy that protects the answer and not the row.
  const written = await rest(`workers?id=eq.${a.workerId}`, {
    token: b.token,
    method: "PATCH",
    body: { name: "נכתב בידי זר" },
    prefer: "return=representation",
  });
  check(
    !Array.isArray(written.body) || written.body.length === 0,
    "updating the other household's worker changes nothing",
  );
  const afterWrite = await rest(`workers?select=name&id=eq.${a.workerId}`, {
    token: a.token,
  });
  check(
    afterWrite.body?.[0]?.name === `עובדת ${a.label}`,
    "and her name is still what she was created with",
  );

  // Route 6: joining herself to the other household, which would make every
  // policy above answer yes from then on.
  const joined = await rest("household_members", {
    token: b.token,
    method: "POST",
    body: { household_id: a.householdId, user_id: b.userId },
    prefer: "return=representation",
  });
  check(
    joined.status >= 400,
    "she cannot add herself to a household she is not in",
  );

  // The table's own insert is closed, so the function is not merely the
  // convenient way in but the only one. A direct insert would create a
  // household with no member, which nobody could then reach.
  const directInsert = await rest("households", {
    token: b.token,
    method: "POST",
    body: { name: "בלי חבר" },
  });
  check(
    directInsert.status >= 400,
    "a household cannot be created by inserting into the table directly",
  );

  // Route 7: no token at all. The publishable key reaches the browser by
  // design and is safe there only because these policies stand behind it.
  const anonymous = await rest("workers?select=id");
  check(
    !Array.isArray(anonymous.body) || anonymous.body.length === 0,
    "an unauthenticated request reads no worker at all",
  );

  // The limit of two, which is a rule about the household and not about the
  // screen. The third insert must be refused by the database itself.
  const second = await rest("workers", {
    token: a.token,
    method: "POST",
    body: workerFor(a.householdId, "עובדת שנייה"),
    prefer: "return=representation",
  });
  check(second.status === 201, "a household may hold a second worker");
  const third = await rest("workers", {
    token: a.token,
    method: "POST",
    body: workerFor(a.householdId, "עובדת שלישית"),
    prefer: "return=representation",
  });
  check(third.status >= 400, "and the database itself refuses a third");
} catch (error) {
  console.log("ERROR", error.message);
  failures += 1;
} finally {
  for (const id of created) {
    await admin(`admin/users/${id}`, { method: "DELETE" });
  }
  console.log(`cleaned up ${created.length} throwaway users`);
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

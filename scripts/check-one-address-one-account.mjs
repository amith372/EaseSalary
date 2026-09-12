// One person is one address, and a sub-address is not a second person
// (build_plan.md stage 3, the sign-in step, settled with the user 2026-09-11).
//
//   a second sign-up at the same address wearing a `+` suffix is refused by
//   the database.
//
// It is a script and not a test in the suite, and not a browser spec either,
// for two separate reasons:
//
//   - The suite reads saved files and never the network (specs.md Part 4), and
//     this check is only worth anything asked of the live database. The rule
//     lives in a unique index and a trigger; a unit test of a TypeScript copy
//     of the normalisation would prove that the copy agrees with itself.
//   - A browser spec would have to sign up, and signing up sends a confirmation
//     mail. Supabase's own mail service delivers only to the project's team and
//     only twice an hour, so such a spec would fail on the mail rather than on
//     the rule, and would leave an unusable account behind on every run.
//
// The admin API is used to create the accounts, which is the one thing a
// browser cannot do. It inserts into `auth.users` exactly as a sign-up does, so
// the trigger fires and the index answers; what it skips is the mail. A request
// crafted straight at the sign-up endpoint therefore meets the same refusal
// this proves, because the refusal is not in the endpoint.
//
// Run it from the repository root, with .env filled in:
//   node --env-file=.env scripts/check-one-address-one-account.mjs
//
// It creates up to four throwaway users and deletes them at the end.

import { randomUUID } from "node:crypto";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !ANON || !SERVICE) {
  console.log("MISSING env: run with node --env-file=.env");
  process.exit(1);
}

let failures = 0;
/** Every check says what it proves, so a run reads as a report and not as a
 * row of ticks. */
function check(passed, what) {
  console.log(`${passed ? "ok  " : "FAIL"} ${what}`);
  if (!passed) failures += 1;
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

async function signIn(email) {
  const response = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await response.json();
  if (!body.access_token) {
    throw new Error(`could not sign in ${email}: ${JSON.stringify(body)}`);
  }
  return body.access_token;
}

// Generated per run rather than written here. These accounts live for the
// length of the script and are deleted at the end, so the value means nothing --
// but a literal beside the word "password" is the shape `hooks/pre-commit`
// refuses on sight, and it is right to: the rule cannot tell a throwaway from a
// real one, and the day it is argued with is the day a real one goes in.
const PASSWORD = randomUUID();
const created = [];

/** Creates the account and says whether the database accepted it. */
async function signUp(email) {
  const { status, body } = await admin("admin/users", {
    body: { email, password: PASSWORD, email_confirm: true },
  });
  if (body?.id) created.push(body.id);
  return { accepted: status >= 200 && status < 300 && Boolean(body?.id), status, body };
}

const stamp = Date.now().toString(36);

try {
  // ---------------------------------------------------------------------
  // The `+` suffix, which is a sub-address almost everywhere
  // ---------------------------------------------------------------------

  // The user's own example, in the shape they gave it. The local part carries
  // no hyphen on purpose: `one.address` has to normalise to exactly the plain
  // form, and `one-address` with the dot removed would not.
  const plainGmail = `oneaddress${stamp}@gmail.com`;
  const suffixed = `oneaddress${stamp}+1@gmail.com`;

  const first = await signUp(plainGmail);
  check(first.accepted, "the first address becomes an account");

  const second = await signUp(suffixed);
  check(
    !second.accepted,
    "the same address wearing a `+` suffix is refused, and does not become a second account",
  );

  // ---------------------------------------------------------------------
  // The dot, which is Gmail's alone
  // ---------------------------------------------------------------------

  const dotted = `one.address${stamp}@gmail.com`;
  const dottedAtGmail = await signUp(dotted);
  check(
    !dottedAtGmail.accepted,
    "a dot inside the local part is ignored at Gmail, so the dotted form is refused as well",
  );

  // The half of the rule that fails in the safe-looking direction. Stripping
  // dots everywhere would merge two real strangers at a provider that
  // distinguishes them, and neither of them would ever be told why the second
  // could not sign up — which is why it is checked rather than assumed.
  const plainElsewhere = `oneaddress${stamp}@fastmail.com`;
  const dottedElsewhere = `one.address${stamp}@fastmail.com`;

  const elsewhereFirst = await signUp(plainElsewhere);
  check(elsewhereFirst.accepted, "the same local part at another provider becomes an account");

  const elsewhereSecond = await signUp(dottedElsewhere);
  check(
    elsewhereSecond.accepted,
    "a dot is significant at that provider, so the two are two people and both may sign up",
  );

  // ---------------------------------------------------------------------
  // And the row the index is on says what it was given
  // ---------------------------------------------------------------------

  // A refusal proves the index fired; this proves it fired on the value the
  // rule names, rather than on something that happened to collide.
  //
  // **Asked as the account itself and never with the service-role key**, which
  // is granted nothing on this table and is granted nothing on any of the
  // others either -- the same division `check-household-isolation.mjs` keeps.
  // So this reads through the `account_emails_read_own` policy, and a run that
  // passes has proved the policy lets a person see their own row as well.
  const token = await signIn(plainGmail);
  const rows = await fetch(
    `${URL_}/rest/v1/account_emails?select=email,normalised_email`,
    { headers: { apikey: ANON, Authorization: `Bearer ${token}` } },
  ).then((response) => response.json());

  check(
    Array.isArray(rows) && rows.length === 1 && rows[0]?.normalised_email === plainGmail,
    "the normalised form is stored beside the real address, and the account sees its own row and no other",
  );
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
// `process.exitCode` rather than `process.exit()`, for the reason
// `check-household-isolation.mjs` writes out at the same line: on Windows,
// exiting while `fetch`'s sockets are still closing trips a libuv assertion
// that prints under a passing report and looks like a crash.
process.exitCode = failures === 0 ? 0 : 1;

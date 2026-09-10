-- The identifying numbers, encrypted at rest (specs.md items 22 and 28).
--
-- **Four columns and not five.** Item 22 said five until 2026-09-10 and its own
-- list named four things: it counted the passport twice, once as the number on
-- the sheet's identity line and once as the third of item 28's documents, and a
-- passport carries one number for both. The spec, `CLAUDE.md` and `.env.example`
-- are corrected in the same commit as this file.
--
-- **The application encrypts, not the database.** Part 3 requires the key to
-- live outside the database, so that a copy of the database on its own reveals
-- nothing -- which rules out every in-database scheme, because a key Postgres
-- can reach is a key that travels with the dump. The ciphertext arrives already
-- sealed, from `src/lib/encryption.ts`, keyed by `ENCRYPTION_KEY` in the
-- environment. Postgres therefore knows these columns only as bytes and can
-- neither read them nor be asked to.
--
-- **`bytea` and not `text`.** The value is a sealed box -- a nonce, a tag and a
-- ciphertext -- and never a string; storing it base64 would invite somebody to
-- read a prefix of it as though a prefix meant anything, and would cost a third
-- more space for the privilege.
--
-- **Nothing is indexed, unique or constrained here, and that is not an
-- oversight**: authenticated encryption produces different bytes for the same
-- input every time, so a unique index would never fire and an equality lookup
-- would never match. A number is found by the worker it belongs to and never by
-- itself.

-- The employer's, so it belongs to the household beside its expiry date: a
-- household with two workers holds one permit position and two visas (item 28).
alter table public.households
  add column employment_permit_number_encrypted bytea;

alter table public.workers
  -- The number on the sheet's identity line, and item 28's third document. One
  -- column, for the reason given above.
  add column passport_number_encrypted bytea,
  -- Where the salary is transferred. The sheet writes the bank and branch on
  -- one line and the account number on another; both are the family's own
  -- details about the worker and both are unreadable here.
  add column bank_account_number_encrypted bytea,
  -- אשרת עבודה, B/1 -- the worker's, renewed through the agency (item 28).
  add column work_visa_number_encrypted bytea;

-- **The expiry dates stay in the clear beside them**, which is item 28's own
-- sentence and not an inconsistency: a date identifies nobody, and item 27's
-- warnings have to *query* what is coming due. An encrypted date cannot be
-- indexed or compared, so the bell would have to decrypt every household's
-- dates on every load to discover it has nothing to say.

-- No policy or grant is added. These columns sit on two tables that already
-- have both, and row-level security is a rule about rows rather than about
-- columns: whoever may read the worker row may read these bytes, and the bytes
-- are what they may read. The key is what separates the bytes from the number,
-- and it is not in the database.

import { keyFrom, openNumber, sealNumber } from "@/lib/encryption";
import type { SalaryRepository, SealedNumbers } from "@/lib/engine/repository";

/**
 * The one place the application turns an identifying number into bytes and back
 * (specs.md items 22 and 28).
 *
 * **It sits above the repository and below every screen**, which is what makes
 * the rule structural rather than remembered: `SalaryRepository` takes sealed
 * bytes and can express nothing else, so neither store — Postgres or the
 * in-memory one the browser suite runs on — has a shape a plaintext number
 * would fit into. A later session cannot casually save one without first
 * widening an interface whose docblock says why it is narrow.
 *
 * **It cannot reach a browser bundle, and nothing here has to remember that.**
 * These four numbers may be decrypted server-side alone, for display and for
 * the export (Part 3). `encryption.ts` below it imports `node:crypto`, which a
 * client bundle cannot resolve, so a client component that reached for this
 * file would fail to build rather than ship the key's use into the browser.
 * That is the guard `server-only` would otherwise be, and it is already here —
 * there is no `server-only` package in this repository, as `src/lib/store.ts`
 * records.
 *
 * **The key is read here and nowhere deeper.** `encryption.ts` takes the key as
 * a parameter precisely so it can be tested without the deployment's real one;
 * this is the caller that reads the environment, so the environment is read in
 * one place and `ENCRYPTION_KEY` appears in one file.
 *
 * Nothing here writes to a console or puts a number into an error message. An
 * error is the place a secret most easily escapes, because an error is the
 * thing that gets logged.
 */

/** The four, as the family types and reads them. A key that is absent was not
 * asked about; a key that is present and empty is one the family cleared. */
export type IdentifyingNumbers = Partial<{
  passport: string;
  bankAccount: string;
  workVisa: string;
  employmentPermit: string;
}>;

function key() {
  return keyFrom(process.env.ENCRYPTION_KEY);
}

/**
 * Seals what was given and writes it, leaving every number not named exactly as
 * it was.
 *
 * **An empty string clears the number rather than sealing an empty one.** A
 * family that deletes what they typed means the number is not recorded, and a
 * sealed empty string would be a row that opens to nothing — indistinguishable
 * from a number, and it would make the "has a passport number" question
 * unanswerable without the key.
 */
export async function saveIdentifyingNumbers(
  repository: SalaryRepository,
  workerId: string,
  numbers: IdentifyingNumbers,
): Promise<void> {
  const secret = key();
  const sealed: SealedNumbers = {};

  for (const [name, value] of Object.entries(numbers) as [
    keyof IdentifyingNumbers,
    string,
  ][]) {
    const trimmed = value.trim();
    sealed[name] = trimmed === "" ? null : sealNumber(trimmed, secret);
  }

  if (Object.keys(sealed).length === 0) return;
  await repository.saveSealedNumbers(workerId, sealed);
}

/**
 * The four numbers as the family typed them, for the one screen that shows them
 * and for the export.
 *
 * A number that was never entered comes back absent rather than as an empty
 * string, so a caller cannot print a blank where it meant to print nothing.
 */
export async function readIdentifyingNumbers(
  repository: SalaryRepository,
  workerId: string,
): Promise<IdentifyingNumbers> {
  const secret = key();
  const sealed = await repository.sealedNumbers(workerId);
  const numbers: IdentifyingNumbers = {};

  for (const [name, bytes] of Object.entries(sealed) as [
    keyof IdentifyingNumbers,
    (typeof sealed)[keyof SealedNumbers],
  ][]) {
    if (bytes === null || bytes === undefined) continue;
    numbers[name] = openNumber(bytes, secret);
  }
  return numbers;
}

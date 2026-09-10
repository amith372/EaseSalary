import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The stored templates, read off disk. **The one place in the export that
 * touches the filesystem**, so the filler stays a pure function over bytes and
 * the suite fills real templates without knowing where they live (specs.md
 * Part 4, the idiom the scrapers use for HTML).
 *
 * **These files are committed on purpose and `.gitignore` must never ignore
 * `*.xlsx`** (`CLAUDE.md`). Without them the application still runs and only
 * the export breaks, so the mistake surfaces on someone else's clone rather
 * than here — which is exactly why the failure below names the file it could
 * not find.
 *
 * Resolved from `process.cwd()` and not from `import.meta.url`: the server
 * bundle does not sit beside `data/`, and a fixture that reads a saved file in
 * this repository resolves it the same way.
 */
export const MONTH_TEMPLATE = "template_month_standard.xlsx";
export const BALANCES_TEMPLATE = "template_balances_yearly.xlsx";

export async function readTemplate(name: string): Promise<ArrayBuffer> {
  const file = path.join(process.cwd(), "data", "templates", name);
  const bytes = await readFile(file);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

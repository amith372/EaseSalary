import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright's own output. Both are already in `.gitignore`, but eslint's
    // flat config does not read that file, so a run that left a trace behind
    // put thousands of warnings from a bundled copy of CodeMirror in front of
    // the next `npm run lint` — and `hooks/pre-commit` runs lint, so a failing
    // browser run would block the commit that fixes it. Nothing is turned off
    // here (`CLAUDE.md` rule 7): these are generated files nobody wrote.
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;

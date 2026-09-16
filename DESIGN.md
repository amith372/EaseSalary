# Design — EaseSalary
- Source of truth for the look: the Claude Design canvas, home screen `דף הבית v4`:
  https://claude.ai/design/p/b11cf323-ac11-490d-994d-3145e8e07a6b
- Tokens (colour, radius, fonts): `src/app/globals.css`. Add or change tokens there, never inline.
- Type: Assistant for UI; Gveret Levin only for the band's hand-written slogan.
- RTL, bidi isolation, `dir="auto"`, `translate="no"`: CLAUDE.md "Code conventions".
- No meaningful text inside an image or CSS `content:`; icons are inline `<svg aria-hidden>`.
- A visual change is made on the canvas first, or written down as a departure in CLAUDE.md.
- Out of scope: redesigns, "bolder", "overdrive", "delight".

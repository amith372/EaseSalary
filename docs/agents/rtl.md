# Writing the interface — Hebrew, right-to-left, and translation

Read before touching a component, a page, or any user-facing string. These are the
conventions that render correctly, pass every other test, and are still wrong — each one
is here because it survives a screenshot. The look of a screen is `DESIGN.md`; this is how
the text behaves.

## Direction
- Logical properties only (`ms`/`me`/`ps`/`pe`, `text-start`/`text-end`), never `left`/`right`;
  `lang="he"` and `dir="rtl"` on the document; directional icons mirrored.
- Isolate mixed-script content — numbers, dates, ranges, passport numbers, names written in
  two scripts — with `<bdi>` or `unicode-bidi: isolate`. Numeric inputs stay `dir="ltr"` inside.
- **Never put `dir="auto"` on an element whose only child is a `<bdi>`** — it resolves to
  *left-to-right* and silently left-aligns the text in an RTL row. `dir="auto"` picks the
  direction from the first strong character, and a `<bdi>` is an isolate: from the parent it
  counts as a neutral object, so the parent sees no strong character at all and falls back to
  LTR. The label still reads correctly and sits against the wrong edge. Put `dir="auto"` on the
  element carrying the text, and let a wrapper inherit `rtl`.
- `dir="auto"` on leaf text elements — headings, paragraphs, labels — while layout containers
  stay `dir="rtl"`, so Hebrew resolves right-to-left and translated English resolves
  left-to-right instead of hanging off the edge.
- A range of days is ordered by date, never by screen position. In right-to-left a leftward
  drag moves *forward* in time, so anything keyed off column index or `clientX` inverts while
  looking entirely plausible.

## Gender
**`specs.md` item 31 is the rule** — read it; it is not restated here. The mechanics: `he.ts`'s
`workerWords(gender)` holds the forms, and `Worker.gender` carries the answer to every screen.

## Surviving Chrome's translator
- **Every dynamic string gets its own wrapping element.** Write
  `<span>שלום, </span><bdi>{name}</bdi>`, never `שלום, {name}` — Chrome swaps text nodes in
  place when it translates, and React then throws `NotFoundError` on `removeChild` wherever a
  bare string sits as a sibling of other nodes. This is the convention hardest to hold by hand
  and the one that crashes the page.
- **No meaningful text inside an image or a CSS `content:`** — Chrome can translate neither.
  Chevrons, badges and every directional glyph are inline `<svg aria-hidden="true">` beside a
  real label, mirrored by `rotate-180` under RTL rather than by hand at each call site.
- `translate="no"` on the wordmark, on amounts, and on passport and bank numbers: a translated
  identifier is a wrong identifier.

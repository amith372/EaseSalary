"use client";

/**
 * The root layout itself threw, so there is no application left to draw one
 * inside.
 *
 * **It is reachable and not theoretical.** `layout.tsx` reads the household on
 * every request — the switcher in the bar needs it — so the store being
 * unreachable takes the layout down and not a page, and `error.tsx` never sees
 * it: a boundary catches its children, and a segment's own layout is not one of
 * them. With no parent segment above the root, this file is the only thing
 * between that and the browser's blank tab.
 *
 * **It replaces the root layout while it is showing**, which is Next's own
 * rule, so it carries its own `<html>` and `<body>`. `lang="he"` and `dir="rtl"`
 * are repeated here rather than inherited, because there is nothing left to
 * inherit them from: without them the one screen shown when everything else has
 * failed is the one screen rendered left-to-right.
 *
 * **Its Hebrew is written out here and not read from `he.ts`** — the one
 * deliberate exception to the single-translations-file rule. This is the
 * fallback for a layout that could not render, and a fallback that imports the
 * application's modules can fail for the same reason the layout did. The
 * sentence is `he.fault`'s and the link is `he.wayHome`'s, so a change to either
 * is made in both places; they are kept identical on purpose, which is what the
 * browser spec asserts.
 *
 * **The styling is inline for the same reason**, and not Tailwind: the
 * stylesheet and the fonts are the root layout's, and this screen has to look
 * like something whether or not they arrived.
 *
 * **No retry button** (the user, 2026-09-27) and no `error.message` on the
 * screen: a message can carry a worker id, a Postgres error or ciphertext.
 * Next 16 names the boundary's recovery prop `retry`, not `reset` — a `reset`
 * prop is accepted and silently never fires — and neither is taken here,
 * because the link is the whole of the way out.
 */
export default function GlobalError() {
  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "#fbf8f4",
          color: "#33291f",
          // The root layout's font variables are gone with it, so the stack is
          // named outright and ends at the system's own Hebrew face.
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Arial, 'Noto Sans Hebrew', sans-serif",
        }}
      >
        <main
          style={{
            margin: "48px 16px",
            maxWidth: 560,
            width: "100%",
            boxSizing: "border-box",
            background: "#ffffff",
            border: "1px solid #efe6da",
            borderRadius: 18,
            padding: "18px 20px",
          }}
        >
          <h1
            data-role="fault-screen-message"
            dir="auto"
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.4,
              fontWeight: 600,
            }}
          >
            משהו השתבש, כדאי לנסות שוב או לחזור לדף הבית
          </h1>
          {/* A plain anchor and not `next/link`: the router lives in the tree
              this screen has replaced, so `<Link>` here raises "expected app
              router to be mounted" and takes down the fallback itself. The way
              home is a fresh load, which is also the only thing that can
              rebuild the layout that failed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- see above: there is no router in a replaced tree. */}
          <a
            href="/"
            data-role="fault-screen-way-home"
            dir="auto"
            style={{
              display: "inline-block",
              marginTop: 10,
              fontSize: 15,
              fontWeight: 600,
              color: "#3f6047",
            }}
          >
            לדף הבית
          </a>
        </main>
      </body>
    </html>
  );
}

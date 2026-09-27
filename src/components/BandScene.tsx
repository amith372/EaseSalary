import type { Season } from "@/lib/season";

/**
 * The drawing at the end of the home calendar's band, in the season of the
 * month the calendar is showing.
 *
 * **The four scenes share one frame** — the same `viewBox`, the same footprint,
 * the same sun at the same point, and a branch rising out of the same corner —
 * because the band's clipping rules are measured against that frame: the branch
 * is clipped before the slogan and the sun is never cut (`CalendarBand`). A
 * scene drawn to its own dimensions would be a second layout to keep true.
 *
 * Every colour comes from a `band-*` token, and the tokens are what the season
 * changes (`globals.css`); the shapes below carry only the shapes. So a leaf
 * reads amber in October and sage in July without a word of it here.
 *
 * The whole thing is decoration and is hidden from assistive technology by the
 * band around it — the slogan beside it is real text, which is what a screen
 * reader and Chrome's translation get instead.
 */

/** The lens the leaves of all four scenes are cut from, at five lengths. Each
 * is drawn along its own +x from the origin, so a leaf is placed by translating
 * to where it joins the branch and rotating to where it points. */
const leafLong = "M0 0C11.8 -24.2 40.5 -25.3 65.4 0C40.5 25.3 11.8 24.2 0 0Z";
const leafShort = "M0 0C8.2 -17.9 28.3 -18.7 45.6 0C28.3 18.7 8.2 17.9 0 0Z";
const leafMid = "M0 0C10.5 -23.1 36.2 -24.2 58.3 0C36.2 24.2 10.5 23.1 0 0Z";
const leafLower = "M0 0C11.7 -22.1 40.3 -23.1 65.1 0C40.3 23.1 11.7 22.1 0 0Z";
const leafSide = "M0 0C9.7 -16.8 33.6 -17.6 54.1 0C33.6 17.6 9.7 16.8 0 0Z";

/** The branch: one stem out of the bottom corner and two that fork off it. */
const branch =
  "M56 184C64 152 78 120 98 98M82 114C74 100 66 88 62 76M70 142C88 134 106 132 122 132";

/** A lump of snow, resting on whatever it is translated onto. It is drawn from
 * its own baseline up, so `rotate` tips it with the surface underneath. */
const snowCap =
  "M0 0C0 -6.2 5 -10.4 11.2 -9.4 14.4 -13.4 21.4 -12.4 23.4 -7.2 27.4 -6.2 28.6 -1 26.2 0Z";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 14 218 167" className="block h-26 w-36.5 flex-none">
      {children}
    </svg>
  );
}

/** The sun, and winter's moon in its place. */
function Sun() {
  return <circle cx="170" cy="62" r="42" className="fill-band-sun" />;
}

function Branch({ width }: { width: number }) {
  return (
    <path
      d={branch}
      className="fill-none stroke-band-stem"
      strokeWidth={width}
      strokeLinecap="round"
    />
  );
}

/** June to September: the branch in leaf, as `דף הבית v4` draws it. */
function SummerScene() {
  return (
    <Frame>
      <Sun />
      <Branch width={2.6} />
      <path transform="translate(62 78) rotate(-113.4)" d={leafLong} className="fill-band-leaf" />
      <path transform="translate(98 100) rotate(-74.7)" d={leafShort} className="fill-band-leaf-light" />
      <path transform="translate(58 136) rotate(-149)" d={leafMid} className="fill-band-leaf-deep" />
      <path transform="translate(72 166) rotate(-45)" d={leafLower} className="fill-band-leaf" />
      <path transform="translate(120 132) rotate(4.2)" d={leafSide} className="fill-band-leaf-light" />
    </Frame>
  );
}

/**
 * October and November: the same branch turning, one leaf still olive, and two
 * already down. The midribs are what tell an autumn leaf from a summer one at
 * this size — the colour alone reads as a recolour.
 */
function AutumnScene() {
  const vein = (length: number) => (
    <path
      d={`M${(length * 0.14).toFixed(1)} 0H${(length * 0.82).toFixed(1)}`}
      className="fill-none stroke-band-stem"
      strokeWidth="1.3"
      strokeOpacity="0.32"
      strokeLinecap="round"
    />
  );

  return (
    <Frame>
      <Sun />
      <Branch width={3} />
      <g transform="translate(62 78) rotate(-113.4)">
        <path d={leafLong} className="fill-band-leaf-deep" />
        {vein(65.4)}
      </g>
      <g transform="translate(98 100) rotate(-74.7)">
        <path d={leafShort} className="fill-band-accent-deep" />
        {vein(45.6)}
      </g>
      <g transform="translate(58 136) rotate(-149)">
        <path d={leafMid} className="fill-band-leaf" />
        {vein(58.3)}
      </g>
      <g transform="translate(72 166) rotate(-45)">
        <path d={leafLower} className="fill-band-leaf-light" />
        {vein(65.1)}
      </g>
      <g transform="translate(120 132) rotate(4.2)">
        <path d={leafSide} className="fill-band-leaf" />
        {vein(54.1)}
      </g>
      {/* Down, and past the sun rather than over it. */}
      <path
        transform="translate(176 150) rotate(28) scale(0.4)"
        d={leafLower}
        className="fill-band-accent"
      />
      <path
        transform="translate(146 170) rotate(-14) scale(0.3)"
        d={leafSide}
        className="fill-band-accent"
      />
      <circle cx="112" cy="32" r="3.2" className="fill-band-trace" />
      <circle cx="200" cy="114" r="2.6" className="fill-band-trace" />
      <circle cx="164" cy="172" r="3" className="fill-band-trace" />
      <circle cx="196" cy="166" r="2.2" className="fill-band-trace" />
    </Frame>
  );
}

/**
 * December to February: the branch bare and dark, carrying snow and berries,
 * with the moon where the sun stands the rest of the year. It is the one scene
 * whose branch is nearly black, which is what makes a winter band read as
 * winter at a glance rather than as a paler summer.
 */
function WinterScene() {
  return (
    <Frame>
      <Sun />
      {/* The moon takes a cap of its own, straddling its rim, so the snow is
          not only on the leaves. */}
      <path
        transform="translate(136 44) rotate(-44) scale(0.82)"
        d={snowCap}
        className="fill-band-bloom"
      />
      <Branch width={3.4} />
      <path transform="translate(62 78) rotate(-113.4)" d={leafLong} className="fill-band-leaf" />
      <path transform="translate(58 136) rotate(-149)" d={leafMid} className="fill-band-leaf-deep" />
      <path transform="translate(72 166) rotate(-45)" d={leafLower} className="fill-band-leaf" />
      <path transform="translate(120 132) rotate(4.2)" d={leafSide} className="fill-band-leaf-light" />

      {/* The stalks first, so every berry sits on the end of one. */}
      <path
        d="M84 117 84 105M93 107 98 94M79 117 74 112M97 105 103 106"
        className="fill-none stroke-band-stem"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="84" cy="101" r="5.4" className="fill-band-accent" />
      <circle cx="99" cy="90" r="6" className="fill-band-accent-deep" />
      <circle cx="72" cy="111" r="4.4" className="fill-band-accent-deep" />
      <circle cx="105" cy="106" r="5" className="fill-band-accent" />

      {/* Each cap lies **across** a leaf's upper flank rather than at its tip: a
          leaf tapers to a point, and snow set on the point reads as a shape
          floating beside the leaf instead of resting on it. */}
      <path
        transform="translate(46 40) rotate(-28) scale(0.78)"
        d={snowCap}
        className="fill-band-bloom"
      />
      <path
        transform="translate(78 139) rotate(-45) scale(0.68)"
        d={snowCap}
        className="fill-band-bloom"
      />
      <path
        transform="translate(132 124) rotate(-4) scale(0.95)"
        d={snowCap}
        className="fill-band-bloom"
      />

      {/* Falling clear of the branch: one flake, drawn as six spokes, and the
          two dots that follow it down. */}
      <g
        transform="translate(196 146)"
        className="fill-none stroke-band-trace"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M0 -11V11M-9.5 -5.5 9.5 5.5M-9.5 5.5 9.5 -5.5" />
        <path d="M0 -7.5 -3.4 -10.9M0 -7.5 3.4 -10.9M0 7.5 -3.4 10.9M0 7.5 3.4 10.9" strokeWidth="1.4" />
      </g>
      <circle cx="209" cy="112" r="2.8" className="fill-band-trace" />
      <circle cx="178" cy="176" r="2.2" className="fill-band-trace" />
    </Frame>
  );
}

/**
 * March to May: the branch in blossom. The flowers are drawn after the leaves
 * so they sit on top of them, which is the one place in the four scenes where
 * the order of two shapes is the drawing rather than an accident.
 */
function SpringScene() {
  /** Five petals round an eye. Each petal is one ellipse turned a fifth of the
   * way round, so a blossom is its centre, its size and nothing else. */
  const blossom = (cx: number, cy: number, r: number, turn: number) => (
    <g transform={`translate(${cx} ${cy}) rotate(${turn})`}>
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx={r * 0.52}
          cy="0"
          rx={r * 0.5}
          ry={r * 0.42}
          transform={`rotate(${angle})`}
          className="fill-band-bloom"
        />
      ))}
      <circle r={r * 0.26} className="fill-band-accent-deep" />
    </g>
  );

  return (
    <Frame>
      <Sun />
      <Branch width={3.2} />
      <path transform="translate(62 78) rotate(-113.4)" d={leafLong} className="fill-band-leaf" />
      <path transform="translate(58 136) rotate(-149)" d={leafMid} className="fill-band-leaf-deep" />
      <path transform="translate(72 166) rotate(-45)" d={leafLower} className="fill-band-leaf-light" />
      <path transform="translate(120 132) rotate(4.2)" d={leafSide} className="fill-band-leaf" />

      {/* The buds. Each grows off a stem the branch already has and sits on the
          end of its own twig — set beside one, a bud reads as a pin stuck in
          the drawing rather than as something the branch is about to open. */}
      <path
        d="M98 98 103 92M106 126 126 113"
        className="fill-none stroke-band-stem"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <ellipse cx="106" cy="88" rx="5.6" ry="4" transform="rotate(-50 106 88)" className="fill-band-accent" />
      <ellipse cx="130" cy="110" rx="5.6" ry="4" transform="rotate(-33 130 110)" className="fill-band-accent" />

      {blossom(84, 106, 13, 12)}
      {blossom(110, 143, 11, -24)}
      {blossom(58, 160, 8.5, 40)}

      {/* Let go, and drifting past the sun. */}
      <ellipse cx="172" cy="152" rx="4.5" ry="3.2" transform="rotate(26 172 152)" className="fill-band-trace" />
      <ellipse cx="198" cy="172" rx="3.8" ry="2.7" transform="rotate(-16 198 172)" className="fill-band-trace" />
    </Frame>
  );
}

const scenes: Record<Season, () => React.ReactElement> = {
  summer: SummerScene,
  autumn: AutumnScene,
  winter: WinterScene,
  spring: SpringScene,
};

export function BandScene({ season }: { season: Season }) {
  const Scene = scenes[season];
  return <Scene />;
}

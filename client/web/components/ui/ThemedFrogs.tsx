import type { CSSProperties } from 'react';
import { FROG_COLORS, FROG_PIXELS, toRuns, type Run } from './FrogMascot';

/** A piece of a pixel scene: rows in the frog's own pixel grid, placed at x, y. */
export type Layer = { x: number; y: number; rows: string[]; colors: Record<string, string> };
/** Layers that move together: one `<g>`, animated by its class (see `fs-*` in globals.css). */
type Part = { layers: Layer[]; className?: string; style?: CSSProperties };

const C = {
  cyan: '#36dfff',
  cyanLight: '#d4f8ff',
  purple: '#ad46ff',
  purpleLight: '#efdcff',
  magenta: '#f6339a',
  pink: '#ffd6ea',
  yellow: '#ffd23f',
  orange: '#ff8904',
  green: '#2eff97',
  white: '#f5f5f4',
  ink: '#1c1917',
  stone: '#a8a29e',
  stoneLight: '#d6d3d1',
  glass: '#9ee9ff',
  coffee: '#8a5a2b',
  red: '#fb2c36',
  blue: '#2563eb',
  canvas: '#efe8d8',
  bow: '#ff9ecf',
  printGreen: '#16a34a',
  grass: '#3fb950',
  frogLight: '#a8e6a1',
  canvasShade: '#cfc5ae',
  redLight: '#ff8a8f',
  grip: '#57534e',
};
const SKIN = { g: FROG_COLORS.g };

const layer = (x: number, y: number, rows: string[], colors: Record<string, string>): Layer => ({
  x,
  y,
  rows,
  colors,
});
const frog = (x = 0, y = 0): Layer => layer(x, y, FROG_PIXELS, FROG_COLORS);
const shift = (l: Layer, dx: number, dy = 0): Layer => ({ ...l, x: l.x + dx, y: l.y + dy });

/* ---------- Outfits: on the frog's own grid, shared by the header frog and the page scenes ---------- */

/** A band across the brow (row 3), its knot hanging on one side. */
function headband(color: string, light: string, knot: 'left' | 'right'): Layer[] {
  const band = layer(1, 3, [knot === 'right' ? 'cclccccccccc' : 'cccccccccclcc'], { c: color, l: light });
  const tail =
    knot === 'right'
      ? layer(13, 3, ['c', '.c'], { c: color })
      : layer(-1, 3, ['.c', 'c.'], { c: color });
  return [band, tail];
}

/** Round purple frames around the eyes, a bridge between them, arms to the temples. */
const GLASSES = layer(1, 0, ['..pp....pp..', 'pp..pppp..pp', '.p..p..p..p.', '..pp....pp..'], {
  p: C.purple,
});
/**
 * Shades that read on a dark page: magenta frames round black lenses (black alone vanishes into
 * the background where the eyes stick out of the head), a white glint in each.
 */
const SUNGLASSES = layer(1, 1, ['.mmmm..mmmm.', 'mkwkkmmkwkkm', 'mkkkkmmkkkkm'], {
  m: C.magenta,
  k: C.ink,
  w: C.white,
});
/** A striped cone between the eyes with a pompom. */
const PARTY_HAT = layer(4, -5, ['..yy..', '..mm..', '..pm..', '.mppm.', '.pmmp.', 'mppmmp'], {
  y: C.yellow,
  m: C.magenta,
  p: C.purple,
});
const HEART = (x: number, y: number, light = false): Layer =>
  layer(x, y, ['.m.m.', light ? 'mlmmm' : 'mmmmm', '.mmm.', '..m..'], { m: C.magenta, l: C.pink });
/** Red cone widening to a white rim, the mouthpiece at the frog's mouth (row 8), a grip under it. */
const MEGAPHONE = layer(
  12,
  4,
  [
    '........ww',
    '......llrw',
    '....llrrrw',
    '..lrrrrrrw',
    'kkrrrrrrrw',
    '..rrrrrrrw',
    '....rrrrrw',
    '......rrrw',
    '........ww',
    '....hh....',
    '....hh....',
  ],
  { r: C.red, l: C.redLight, w: C.white, k: C.ink, h: C.grip },
);
/** Two arcs of sound in front of the rim. */
const SOUND = layer(
  23,
  5,
  ['....w', 'w...w', '.w...w', '.w...w', '.w...w', '.w...w', '.w...w', 'w...w', '....w'],
  { w: C.white },
);
const PLUS = layer(12, -3, ['..g..', '..g..', 'ggggg', '..g..', '..g..'], { g: C.green });

/** What the header frog wears on each section's pages. */
export const OUTFITS = {
  team: [{ layers: headband(C.cyan, C.cyanLight, 'right') }],
  charity: [{ layers: [HEART(14, -2, true)], className: 'fs-twinkle' }],
  events: [{ layers: [PARTY_HAT] }],
  news: [{ layers: [GLASSES] }],
  merch: [{ layers: [SUNGLASSES] }],
  join: [{ layers: [PLUS], className: 'fs-twinkle' }],
} satisfies Record<string, Part[]>;
export type FrogOutfit = keyof typeof OUTFITS;

/* ---------- Page scenes ---------- */

const SPARK = layer(14, -2, ['..y..', '.y.y.', 'y...y', '.y.y.', '..y..'], { y: C.yellow });
const ARM_UP_RIGHT = layer(12, 3, ['...gg', '..gg.', '.gg..', 'gg...'], SKIN);
const ARM_UP_LEFT = layer(15, 3, ['gg...', '.gg..', '..gg.', '...gg'], SKIN);

const JAR = layer(3, 9, ['.ssssss.', 'sccccccs', 'scmcmccs', 'scmmmmcs', 'sccmmccs', '.ssssss.'], {
  s: C.stoneLight,
  c: C.glass,
  m: C.magenta,
});
const HANDS_ON_JAR = layer(2, 10, ['gg....gg'], SKIN);

const BALLOON = layer(15, -9, ['.cccc.', 'cwwccc', 'cwcccc', 'cccccc', 'cccccc', '.cccc.', '..cc..'], {
  c: C.cyan,
  w: C.cyanLight,
});
const STRING = layer(13, -2, ['....s', '....s', '...s.', '...s.', '..s..', '..s..', '.s...', '.s...', 's....'], {
  s: C.stoneLight,
});

const NEWSPAPER = layer(
  2,
  8,
  ['wwwwwwwwww', 'wkkkkwgggw', 'wwwwwwcccw', 'wssswwpppw', 'wssswwwwww', 'wwwwwwwwww'],
  { w: C.white, k: C.ink, s: C.stone, g: C.green, c: C.cyan, p: C.purple },
);
const HANDS_ON_PAPER = layer(1, 9, ['gg......gg'], SKIN);
const CUP = layer(16, 9, ['sssss.', 'wbbbws', 'wwwwws', 'wwwww.', '.www..'], {
  s: C.stoneLight,
  w: C.white,
  b: C.coffee,
});
const STEAM = layer(17, 4, ['.s.', 's..', '.s.', '..s', '.s.'], { s: C.stone });

/** The council's merch print: a stained-glass square, the FICE lettering in white on the left. */
const PRINT_ROWS = ['bbgyb', 'wwbpb', 'bgbpp', 'ybkpg', 'bgbyb'];
const PRINT_COLORS = {
  b: C.blue,
  g: C.green,
  y: C.yellow,
  p: C.purple,
  k: C.ink,
  w: C.white,
};
/**
 * An oversized white tee from below the mouth to past the feet: a crew neck, sleeves past the
 * sides with grey cuffs, a body as wide as the frog so its sides and feet stay under it, a grey
 * hem, the toes peeking out under it.
 */
const TEE = layer(
  -2,
  9,
  [
    '...wwwwnnnnwwww...',
    'wwwwwwwwwwwwwwwwww',
    'swwwwwwwwwwwwwwwws',
    '..wwwwwwwwwwwwww..',
    '..wwwwwwwwwwwwww..',
    '..wwwwwwwwwwwwww..',
    '..wwwwwwwwwwwwww..',
    '..ssssssssssssss..',
  ],
  { w: C.white, n: C.stoneLight, s: C.stone },
);
const TOES = layer(3, 17, ['dg....gd'], FROG_COLORS);
/**
 * The Day F square, low on the tee with white either side: a yellow sky with blue waves, round
 * red-and-orange trees, grass and water, a light green frog in shades bottom right, and the red
 * DAY F · FICE … 2026 line under it.
 */
const TEE_PRINT = layer(3, 11, ['yybbyybb', 'roryrory', 'ggbbglkl', 'bbbbglll', 'rrrr..rr'], {
  y: C.yellow,
  b: C.blue,
  r: C.red,
  o: C.orange,
  g: C.grass,
  l: C.frogLight,
  k: C.ink,
});
/** The canvas shopper with the stained-glass print. */
const TOTE = layer(
  18,
  7,
  [
    '...hhh...',
    '..h...h..',
    '..h...h..',
    'ccccccccc',
    'ccccccccs',
    'ccccccccs',
    'ccccccccs',
    'ccccccccs',
    'ccccccccs',
    'ccccccccs',
    'ccccccccs',
    '.ccccccs.',
  ],
  { c: C.canvas, s: C.canvasShade, h: C.canvasShade },
);
const TOTE_PRINT = layer(20, 11, PRINT_ROWS, PRINT_COLORS);

const WAVING_ARM = layer(-3, 2, ['gg.', 'gg.', '.gg', '..g'], SKIN);

const SCENE_PARTS = {
  /** Team: two frogs in the council's colours, high-fiving; only the arms and the spark move. */
  crew: [
    { layers: [frog(0, 0), ...headband(C.cyan, C.cyanLight, 'right')] },
    { layers: [frog(18, 0), ...headband(C.purple, C.purpleLight, 'left').map((l) => shift(l, 18))] },
    { layers: [ARM_UP_RIGHT], className: 'fs-five-l' },
    { layers: [ARM_UP_LEFT], className: 'fs-five-r' },
    { layers: [SPARK], className: 'fs-five-spark' },
  ],
  /** Charity: a jar of hearts, and more floating up. */
  donor: [
    { layers: [frog(), JAR, HANDS_ON_JAR] },
    // Low beside the frog: they rise out of the jar's side and fade before passing its head.
    { layers: [HEART(14, 5, true)], className: 'fs-rise' },
    { layers: [HEART(17, 1)], className: 'fs-rise', style: { animationDelay: '-1.2s' } },
    { layers: [HEART(13, -2)], className: 'fs-rise', style: { animationDelay: '-2.4s' } },
  ],
  /** Events: party hat, and a balloon swaying on a string held by the frog. */
  party: [
    { layers: [BALLOON, STRING], className: 'fs-sway' },
    { layers: [frog(), PARTY_HAT], className: 'fs-hop' },
  ],
  /** News: glasses, the paper, a coffee. */
  reader: [
    { layers: [frog(), GLASSES, NEWSPAPER, HANDS_ON_PAPER] },
    { layers: [CUP] },
    { layers: [STEAM], className: 'fs-steam' },
  ],
  /** Merch: the oversized white Day F tee, shades, and the shopper with its print. */
  tee: [
    { layers: [TOTE, TOTE_PRINT] },
    { layers: [frog(), TEE, TEE_PRINT, TOES, SUNGLASSES], className: 'fs-hop' },
  ],
  /** Join: calling everyone over, waving. */
  herald: [
    { layers: [frog(), MEGAPHONE] },
    { layers: [WAVING_ARM], className: 'fs-wave' },
    { layers: [SOUND], className: 'fs-sound' },
  ],
} satisfies Record<string, Part[]>;

export type FrogSceneName = keyof typeof SCENE_PARTS;

type Built = {
  parts: { runs: Run[]; className?: string; style?: CSSProperties }[];
  viewBox: string;
  /** Size in frog pixels. */
  w: number;
  h: number;
  /** The frog's eye line, in frog pixels up from the scene's bottom edge. */
  eyeFromBottom: number;
};

/** Empty frog pixels around a scene: the farthest any `fs-*` animation moves a part. */
const PAD = { x: 2, top: 3, bottom: 1 };

/** Every part as coloured runs in scene space, with the viewBox that holds them all. */
export function buildScene(parts: Part[]): Built {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const built = parts.map((part) => {
    const runs: Run[] = [];
    for (const l of part.layers) {
      for (const run of toRuns(l.rows, l.colors)) {
        const x = run.x + l.x;
        const y = run.y + l.y;
        runs.push({ ...run, x, y });
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + run.w);
        maxY = Math.max(maxY, y + 1);
      }
    }
    return { runs, className: part.className, style: part.style };
  });
  // Room for the moving parts (most of them move up), so none is cut at the box's edge.
  minX -= PAD.x;
  maxX += PAD.x;
  minY -= PAD.top;
  maxY += PAD.bottom;
  return {
    parts: built,
    viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    w: maxX - minX,
    h: maxY - minY,
    // The frog sits at y = 0 in every scene; its eyes are rows 1–2.
    eyeFromBottom: maxY - 2,
  };
}

export const SCENES: Record<FrogSceneName, Built> = Object.fromEntries(
  (Object.keys(SCENE_PARTS) as FrogSceneName[]).map((name) => [name, buildScene(SCENE_PARTS[name])]),
) as Record<FrogSceneName, Built>;

/** A built scene (or outfit) as `<g>`s of pixels; drop it inside any pixel-grid `<svg>`. */
export function SceneParts({ parts }: { parts: Built['parts'] }) {
  return (
    <>
      {parts.map((part, i) => (
        <g key={i} className={part.className} style={part.style}>
          {/* By index: layers overlap, so two runs can start on the same pixel. */}
          {part.runs.map((r, j) => (
            <rect key={j} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
          ))}
        </g>
      ))}
    </>
  );
}

/** The council's frog dressed for a page. Size it by height: the width follows the scene. */
export function FrogScene({
  scene,
  className,
  style,
}: {
  scene: FrogSceneName;
  className?: string;
  style?: CSSProperties;
}) {
  const { parts, viewBox } = SCENES[scene];
  return (
    <svg
      viewBox={viewBox}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
      style={style}
    >
      <SceneParts parts={parts} />
    </svg>
  );
}

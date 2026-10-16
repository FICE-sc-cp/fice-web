// Layout of the department people wall («сердечко»). People first line the
// heart's outline — evenly spaced, so the shape reads even with a handful of
// people — and the rest fill the inside in rows, clear of the title. All sizes
// are fractions of the frame width: the wall renders with % and cqw and
// scales with its frame without anything ever overlapping.

type Pt = { x: number; y: number };

// Frame margin: outline items are centred on the outline and stick out of it.
const M = 0.07;

// The ❤ shape: two unit circles C = (±LOBE, 0) and straight sides tangent to
// them down to a ~90° tip at (0, -TIP). Corners, not the parametric heart's
// cusps: those left a lone avatar dangling under the tip.
const LOBE = 0.9;
const TIP = 2.4;
// Right half in y-up maths coordinates, from the notch down to the tip.
const HALF: [number, number][] = (() => {
  const d = Math.hypot(LOBE, TIP);
  const tangent = Math.atan2(-TIP, -LOBE) + Math.acos(1 / d);
  const notch = Math.atan2(Math.sqrt(1 - LOBE ** 2), -LOBE);
  const to = tangent > notch ? tangent - 2 * Math.PI : tangent;
  const pts: [number, number][] = [];
  for (let i = 0; i < 160; i++) {
    const a = notch + ((to - notch) * i) / 160;
    pts.push([LOBE + Math.cos(a), Math.sin(a)]);
  }
  const [tx, ty] = [LOBE + Math.cos(to), Math.sin(to)];
  for (let i = 0; i < 40; i++)
    pts.push([tx * (1 - i / 40), ty + ((-TIP - ty) * i) / 40]);
  return pts;
})();
// Whole outline from the tip: left side up, then the right side back down,
// so mirror points sit at mirror arc positions.
const RAW: [number, number][] = [
  [0, -TIP],
  ...[...HALF].reverse().map(([x, y]): [number, number] => [-x, y]),
  ...HALF.slice(1),
];
const W0 = 2 * (LOBE + 1);
const H0 = (1 + TIP) / W0;
const S = (1 - 2 * M) / W0;
const POLY: Pt[] = RAW.map(([x, y]) => ({
  x: M + (x + LOBE + 1) * S,
  y: M + (1 - y) * S,
}));
const NOTCH: Pt = POLY[HALF.length];

/** Frame height in frame widths — the frame's aspect ratio is 1 : FRAME_H. */
export const FRAME_H = 2 * M + (1 - 2 * M) * H0;
/** Title centre, in frame widths from the top: a bit above the middle. */
export const TITLE_Y = M + (1 - 2 * M) * H0 * 0.43;

// Mulish extrabold caps measure up to ~0.7em per letter («ПРОЄКТНОГО»).
const CHAR = 0.72;
export const TITLE_LEADING = 1.1;

export type HeartTitle = { lines: string[]; font: number; w: number; h: number };

/** Title words packed into lines no wider than its longest word. */
export function heartTitle(title: string): HeartTitle {
  const words = title.trim().split(/\s+/);
  const longest = Math.max(...words.map((w) => w.length));
  const lines: string[] = [];
  for (const w of words) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + 1 + w.length <= longest)
      lines[last] += ` ${w}`;
    else lines.push(w);
  }
  const font = Math.min(0.058, 0.38 / (longest * CHAR));
  return {
    lines,
    font,
    w: longest * CHAR * font,
    h: lines.length * TITLE_LEADING * font,
  };
}

/**
 * One person, in avatar sizes: `w` × `h` is the cell including the gaps to
 * the neighbours, `itemW` × `itemH` what is actually drawn; `max` caps the
 * avatar (in frame widths) for small departments.
 */
export type HeartCell = {
  w: number;
  h: number;
  itemW: number;
  itemH: number;
  max: number;
};

/** Avatar with the name under it. */
export const NAMED: HeartCell = { w: 2.2, h: 1.75, itemW: 2, itemH: 1.5, max: 0.075 };
/** Avatars only, for crowds and narrow screens. */
export const AVATARS: HeartCell = { w: 1.2, h: 1.2, itemW: 1, itemH: 1, max: 0.11 };

export type HeartLayout = { avatar: number; slots: Pt[] };

// Horizontal pieces of the heart at height y (scanline over the polygon).
function spans(y: number): [number, number][] {
  const xs: number[] = [];
  for (let i = 0; i < POLY.length; i++) {
    const p = POLY[i];
    const q = POLY[(i + 1) % POLY.length];
    if (p.y <= y !== (q.y <= y)) xs.push(p.x + ((y - p.y) * (q.x - p.x)) / (q.y - p.y));
  }
  xs.sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}

type Seg = { a: number; b: number; y: number; m: number };

function place(
  n: number,
  avatar: number,
  cell: HeartCell,
  t: HeartTitle,
  inside: boolean,
) {
  const cw = avatar * cell.w;
  const ch = avatar * cell.h;
  const tx = t.w / 2 + (avatar * cell.itemW) / 2 + 0.015;
  const ty = t.h / 2 + (avatar * cell.itemH) / 2 + 0.015;
  const clash = (p: Pt, q: Pt) =>
    Math.abs(p.x - q.x) < cw - 1e-9 && Math.abs(p.y - q.y) < ch - 1e-9;
  const onTitle = (p: Pt) =>
    Math.abs(p.x - 0.5) < tx && Math.abs(p.y - TITLE_Y) < ty;

  // Outline: arc length measured in cells (Chebyshev), so points one unit
  // apart never overlap. Tip first, then mirror pairs up to the notch, where
  // the two lobes squeeze together and the points that collide are dropped.
  const cum = [0];
  for (let i = 1; i <= POLY.length; i++) {
    const p = POLY[i - 1];
    const q = POLY[i % POLY.length];
    cum.push(cum[i - 1] + Math.max(Math.abs(q.x - p.x) / cw, Math.abs(q.y - p.y) / ch));
  }
  const L = cum[POLY.length];
  const along = (s: number): Pt => {
    let i = 1;
    while (cum[i] < s) i++;
    const p = POLY[i - 1];
    const q = POLY[i % POLY.length];
    const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f };
  };
  // Most points (but at most n) over the spacings that can still beat it.
  let ring: Pt[] = [];
  for (let k = Math.min(Math.floor(L), n + 6); k > ring.length; k--) {
    const pts = Array.from({ length: k }, (_, i) => along((i * L) / k));
    const kept: Pt[] = [];
    const free = (p: Pt) => !onTitle(p) && kept.every((q) => !clash(p, q));
    let notch = false;
    for (let i = 0; 2 * i <= k; i++) {
      if (i > 0 && 2 * i === k) {
        // The notch point: nudged down out of the lobes' way rather than
        // dropped, so an even number of people still fits the outline.
        for (let d = 0; d <= 1; d += 0.25) {
          const p = { x: pts[i].x, y: pts[i].y + d * ch };
          if (free(p)) {
            kept.push(p);
            notch = true;
            break;
          }
        }
        continue;
      }
      const pair = i === 0 ? [pts[0]] : [pts[i], pts[k - i]];
      if (pair.length === 2 && clash(pair[0], pair[1])) continue;
      if (pair.every(free)) kept.push(...pair);
    }
    // One too many with the notch in (an odd n): leave the notch out — it
    // went in last — instead of shrinking everyone to fit n + 2 spots.
    if (notch && kept.length === n + 1) kept.pop();
    if (kept.length <= n && kept.length > ring.length) ring = kept;
  }
  if (!inside) return { ring, segs: [] as Seg[], cap: ring.length };

  // Inside: rows one cell apart; a row keeps the stretches whose centres are
  // inside the heart, a cell away from every outline point and off the title.
  // The row grid is shifted a few ways and the roomiest shift wins.
  let best: Seg[] = [];
  let bestCap = -1;
  for (const phase of [0, 0.25, 0.5, 0.75]) {
    const segs: Seg[] = [];
    for (let y = M + phase * ch; y < FRAME_H - M; y += ch) {
      // The two lobes come within a cell of each other just above the
      // notch: treat them as one stretch there.
      let free: [number, number][] = [];
      for (const [a, b] of spans(y)) {
        const last = free[free.length - 1];
        if (last && a - last[1] < cw) last[1] = b;
        else free.push([a, b]);
      }
      const cut = (lo: number, hi: number) => {
        free = free.flatMap(([a, b]): [number, number][] =>
          [
            [a, Math.min(b, lo)],
            [Math.max(a, hi), b],
          ].filter(([p, q]) => q >= p) as [number, number][],
        );
      };
      if (Math.abs(y - TITLE_Y) < ty) cut(0.5 - tx, 0.5 + tx);
      // NOTCH too, so the dip between the lobes stays open.
      for (const p of [...ring, NOTCH])
        if (Math.abs(p.y - y) < ch - 1e-9) cut(p.x - cw + 1e-9, p.x + cw - 1e-9);
      for (const [a, b] of free)
        segs.push({ a, b, y, m: Math.floor((b - a) / cw + 1e-9) + 1 });
    }
    const cap = segs.reduce((s, g) => s + g.m, 0);
    if (cap > bestCap) {
      best = segs;
      bestCap = cap;
    }
  }
  return { ring, segs: best, cap: ring.length + bestCap };
}

const OUTLINE_ONLY_MAX = 24;

// The biggest avatar (up to `cell.max`) at which `n` people fit.
function biggest(n: number, cell: HeartCell, t: HeartTitle, inside: boolean) {
  const top = place(n, cell.max, cell, t, inside);
  if (top.cap >= n) return { avatar: cell.max, fit: top };
  let lo = 0.004;
  let hi = cell.max;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (place(n, mid, cell, t, inside).cap >= n) lo = mid;
    else hi = mid;
  }
  return { avatar: lo, fit: place(n, lo, cell, t, inside) };
}

/** Avatar size (in frame widths) and spot of each of `n` people. */
export function heartLayout(
  n: number,
  cell: HeartCell,
  t: HeartTitle,
): HeartLayout {
  // A few people scattered inside the outline just look messy, so small
  // departments go on the outline only. A fixed count (where the inside starts
  // holding a real crowd for every title) so one more person never flips the
  // layout back and forth; a tall title can still make the outline too short.
  const ring = n <= OUTLINE_ONLY_MAX ? biggest(n, cell, t, false) : null;
  const { avatar, fit } =
    ring && ring.fit.cap >= n ? ring : biggest(n, cell, t, true);
  // Spare spots come off the inside, most crowded stretches first and lone
  // points (ranked after any spacing, which is under 1) last.
  const gap = (g: Seg) => (g.m > 1 ? (g.b - g.a) / (g.m - 1) : 1 + g.b - g.a);
  for (let extra = fit.cap - n; extra > 0; extra--) {
    let pick: Seg | null = null;
    for (const g of fit.segs) if (g.m > 0 && (!pick || gap(g) < gap(pick))) pick = g;
    if (!pick) break;
    pick.m--;
  }
  const inside = fit.segs.flatMap((g) =>
    Array.from({ length: g.m }, (_, j) => ({
      x: g.m > 1 ? g.a + ((g.b - g.a) * j) / (g.m - 1) : (g.a + g.b) / 2,
      y: g.y,
    })),
  );
  return { avatar, slots: [...fit.ring, ...inside].slice(0, n) };
}

import { FROG_COLORS, FROG_PIXELS } from '@/components/ui/FrogMascot';
import { cn } from '@/lib/utils';

// "Шари" are also balls: glossy spheres in the brand colours are the motif.
export const SPHERES = {
  green: ['#c8ffe2', '#2eff97', '#0b6b42'],
  cyan: ['#d4f8ff', '#36dfff', '#075f78'],
  purple: ['#efdcff', '#ad46ff', '#43137a'],
  magenta: ['#ffd6ea', '#f6339a', '#6f0d40'],
  orange: ['#ffe4c4', '#ff8904', '#7a3600'],
} as const;
export type SphereColor = keyof typeof SPHERES;

export function Sphere({
  color,
  size,
  className,
  style,
  children,
}: {
  color: SphereColor;
  size: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const [light, base, dark] = SPHERES[color];
  return (
    <span
      aria-hidden={children ? undefined : true}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-black text-black', className)}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 32% 28%, ${light} 0%, ${base} 38%, ${dark} 100%)`,
        boxShadow: `0 0 ${Math.round(size * 0.55)}px ${base}40, inset -${Math.round(size * 0.07)}px -${Math.round(size * 0.09)}px ${Math.round(size * 0.18)}px rgba(0,0,0,0.3)`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Spheres floating around the frog: above, right and below it, never to its
 * left, so they don't run into the title at any width. Phones get just the haze.
 */
const CLOUD: { color: SphereColor; size: number; className: string; float: string; delay: string; blur?: boolean }[] = [
  { color: 'cyan', size: 140, className: '-right-24 -top-24', float: '11s', delay: '-6s', blur: true },
  { color: 'green', size: 54, className: 'left-1/4 -top-16 hidden sm:block', float: '7s', delay: '-1s' },
  { color: 'magenta', size: 30, className: '-right-6 top-1/4 hidden sm:block', float: '6s', delay: '-2s' },
  { color: 'orange', size: 22, className: 'left-1/3 -bottom-8 hidden sm:block', float: '5s', delay: '-3s' },
  { color: 'purple', size: 64, className: '-right-10 -bottom-4 hidden sm:block', float: '9s', delay: '-4s' },
];

/** Goes inside a `relative` box around the frog. */
export function SphereCloud() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {CLOUD.map((s) => (
        <span
          key={s.color}
          className={cn('shari-float absolute', s.className, s.blur && 'opacity-40 blur-sm')}
          style={{ '--float': s.float, '--delay': s.delay } as React.CSSProperties}
        >
          <Sphere color={s.color} size={s.size} />
        </span>
      ))}
    </div>
  );
}

type Layer = { x: number; y: number; rows: string[]; colors: Record<string, string> };

const HAT: Layer = {
  x: 6,
  y: 2,
  colors: { y: '#ffd23f', m: '#f6339a', p: '#ad46ff' },
  rows: ['...y...', '...m...', '..mpm..', '..pmp..', '.mpmpm.', '.pmpmp.', 'mpmpmpm'],
};
const BALLOON: Layer = {
  x: 17,
  y: 0,
  colors: { c: '#36dfff', w: '#e8fbff', s: '#cdcdcd' },
  rows: ['.cccc.', 'cwwccc', 'cwcccc', 'cccccc', 'cccccc', '.cccc.', '..cc..'],
};
const STRING: Layer = {
  x: 16,
  y: 7,
  colors: { s: '#cdcdcd' },
  rows: ['...s', '...s', '..s.', '..s.', '..s.', '.s..', '.s..', 's...', 's...', 's...'],
};
const CONFETTI: Layer = {
  x: 0,
  y: 0,
  colors: { g: '#2eff97', p: '#ad46ff', o: '#ff8904', m: '#f6339a' },
  rows: ['..g.........o', '', '', '', '.....m', 'p', '', '..............o'],
};
const FROG: Layer = { x: 2, y: 9, rows: FROG_PIXELS, colors: FROG_COLORS };

/** The council's pixel frog at its birthday: party hat and a balloon (a "шара"). */
export function PartyFrog({ className }: { className?: string }) {
  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  for (const layer of [CONFETTI, BALLOON, STRING, HAT, FROG]) {
    layer.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; ) {
        if (row[x] === '.') {
          x++;
          continue;
        }
        let w = 1;
        while (row[x + w] === row[x]) w++;
        rects.push({ x: layer.x + x, y: layer.y + y, w, fill: layer.colors[row[x]] });
        x += w;
      }
    });
  }
  return (
    <svg
      viewBox="0 0 24 23"
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label="Жабка-маскот у святковому ковпаку з кулькою"
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}

/** Colour of a shara by what it gives, so a list of them reads at a glance. */
export function sharaColor(bonus: string): SphereColor {
  const text = bonus.toLowerCase();
  if (/літер|оцінк|рівн/.test(text)) return 'purple';
  if (/закрит|лаб|мкр|курсов|практичн/.test(text)) return 'cyan';
  if (/автомат|допуск/.test(text)) return 'orange';
  if (/бал/.test(text)) return 'green';
  return 'magenta';
}

/** A ticket with notches at the stub: the shape of a shara everywhere on these pages. */
export function Ticket({
  color,
  stub,
  className,
  children,
}: {
  color: SphereColor;
  stub: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const [, base] = SPHERES[color];
  return (
    <div
      className={cn('shari-ticket relative flex overflow-hidden rounded-3xl bg-white/[0.045]', className)}
      style={{ '--stub': '5.5rem' } as React.CSSProperties}
    >
      <div
        className="flex w-[5.5rem] shrink-0 flex-col items-center justify-center gap-1 border-r-2 border-dashed border-black/25 px-2 py-5 text-center text-black"
        style={{ background: `linear-gradient(160deg, ${SPHERES[color][0]}, ${base} 55%, ${SPHERES[color][2]})` }}
      >
        {stub}
      </div>
      <div className="min-w-0 flex-1 p-5 sm:p-6">{children}</div>
    </div>
  );
}

/** Progress as a ring, e.g. how many shari of a group already have a recipient. */
export function ProgressRing({ value, total, size = 84 }: { value: number; total: number; size?: number }) {
  const r = 34;
  const length = 2 * Math.PI * r;
  const part = total ? Math.min(1, value / total) : 0;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="shari-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2eff97" />
            <stop offset="50%" stopColor="#36dfff" />
            <stop offset="100%" stopColor="#ad46ff" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="url(#shari-ring)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${part * length} ${length}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <span className="text-center text-sm font-black leading-tight">
        {value}
        <span className="text-subtle">/{total}</span>
      </span>
    </span>
  );
}

const CONFETTI_COLORS = ['#2eff97', '#36dfff', '#ad46ff', '#f6339a', '#ff8904', '#ffd23f'];

/** A burst of pixel confetti from an element (or the top of the screen). */
export function confetti(from?: Element | null) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = from?.getBoundingClientRect();
  const x = box ? box.left + box.width / 2 : window.innerWidth / 2;
  const y = box ? box.top + box.height / 2 : window.innerHeight / 4;
  for (let i = 0; i < 36; i++) {
    const bit = document.createElement('i');
    const size = 5 + Math.random() * 6;
    Object.assign(bit.style, {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
      background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      zIndex: '70',
      pointerEvents: 'none',
    });
    document.body.appendChild(bit);
    const angle = Math.random() * Math.PI * 2;
    const dist = 70 + Math.random() * 150;
    bit
      .animate(
        [
          { transform: 'translate(-50%, -50%)', opacity: 1 },
          {
            transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist + 140}px) rotate(${Math.random() * 540}deg)`,
            opacity: 0,
          },
        ],
        { duration: 900 + Math.random() * 600, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
      )
      .finished.then(() => bit.remove(), () => bit.remove());
  }
}

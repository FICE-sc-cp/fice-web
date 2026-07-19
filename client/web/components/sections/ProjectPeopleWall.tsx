import { Glow } from "@/components/ui/Glow";
import { mediaUrl, type ProjectParticipant } from "@/lib/api";

// Avatar spots traced 1:1 from the «Медійка» reference design (normalized to
// its 16:9 frame). Together they read as a heart: two lobes on top, a tip at
// the bottom centre, an empty middle for the title, names to the right.
const TEMPLATE: [number, number][] = [
  [0.352, 0.075], [0.566, 0.075], // top lobe peaks
  [0.313, 0.147], [0.447, 0.133], [0.61, 0.145],
  [0.246, 0.207], [0.361, 0.207], [0.51, 0.203], [0.648, 0.202],
  [0.217, 0.276], [0.307, 0.276], [0.423, 0.276], [0.52, 0.276], [0.617, 0.276], [0.724, 0.276],
  [0.203, 0.349], [0.281, 0.339], [0.391, 0.356], [0.508, 0.353], [0.638, 0.354], [0.729, 0.34],
  [0.21, 0.435], [0.284, 0.428], [0.369, 0.435], [0.564, 0.424], [0.651, 0.444], [0.727, 0.424],
  [0.725, 0.506],
  [0.232, 0.528], [0.332, 0.528], [0.634, 0.537],
  [0.276, 0.602], [0.711, 0.602],
  [0.311, 0.662], [0.405, 0.664], [0.5, 0.662], [0.612, 0.649],
  [0.37, 0.736], [0.478, 0.726], [0.583, 0.735],
  [0.401, 0.81], [0.483, 0.81], [0.565, 0.81],
  [0.441, 0.884], [0.521, 0.885], // bottom tip pair
];

// Shape-critical spots kept first when there are fewer people than template
// slots: the bottom tip pair, the two lobe peaks, the left/right extremes —
// then the rest, outline before interior.
const CRITICAL = [43, 44, 0, 1, 15, 20];
const CX = 0.47;
const CY = 0.45;
const PRIORITY: number[] = [
  ...CRITICAL,
  ...TEMPLATE.map((_, i) => i)
    .filter((i) => !CRITICAL.includes(i))
    .sort((a, b) => {
      const d = (i: number) =>
        Math.hypot(TEMPLATE[i][0] - CX, (TEMPLATE[i][1] - CY) * 0.6);
      return d(b) - d(a);
    }),
];

// Title clearance (normalized): the mock's title sits at the centre.
const TITLE_X = 0.5;
const TITLE_Y = 0.53;
const TITLE_HX = 0.15;
const TITLE_HY = 0.1;

type Slot = { x: number; y: number };

function slotsFor(n: number): Slot[] {
  if (n <= TEMPLATE.length) {
    return PRIORITY.slice(0, n).map((i) => ({
      x: TEMPLATE[i][0],
      y: TEMPLATE[i][1],
    }));
  }
  // More people than the template: fill the largest gaps with midpoints,
  // avoiding the title box. ponytail: caps out around 2x the template size.
  const pts = TEMPLATE.map(([x, y]) => ({ x, y }));
  let guard = 0;
  while (pts.length < n && guard < 300) {
    guard++;
    let best: Slot | null = null;
    let bestScore = 0;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const mx = (pts[i].x + pts[j].x) / 2;
        const my = (pts[i].y + pts[j].y) / 2;
        if (
          Math.abs(mx - TITLE_X) < TITLE_HX + 0.03 &&
          Math.abs(my - TITLE_Y) < TITLE_HY + 0.04
        )
          continue;
        let near = Infinity;
        for (const p of pts)
          near = Math.min(near, Math.hypot((p.x - mx) * 16, (p.y - my) * 9));
        if (near > bestScore) ((bestScore = near), (best = { x: mx, y: my }));
      }
    }
    if (!best || bestScore < 0.5) break;
    pts.push(best);
  }
  return pts.slice(0, n);
}

// Free room to the right of each slot (next avatar in the band, the title box,
// or the frame edge) — long names go to roomy slots, short names to tight ones,
// exactly like the reference.
function rightSpace(slots: Slot[]): number[] {
  return slots.map((s) => {
    let best = 1 - s.x;
    for (const o of slots) {
      if (o.x > s.x + 0.001 && Math.abs(o.y - s.y) < 0.055)
        best = Math.min(best, o.x - s.x);
    }
    if (
      Math.abs(s.y - TITLE_Y) < TITLE_HY + 0.02 &&
      s.x <= TITLE_X - TITLE_HX + 0.005
    ) {
      best = Math.min(best, Math.max(0.02, TITLE_X - TITLE_HX - s.x));
    }
    return best;
  });
}

export function ProjectPeopleWall({
  title,
  people,
  glow,
}: {
  title: string;
  people: ProjectParticipant[];
  glow: [string, string];
}) {
  const slots = slotsFor(people.length);
  const rs = rightSpace(slots);
  const slotOrder = [...slots.keys()].sort((a, b) => rs[b] - rs[a]);
  const nameOrder = [...people.keys()].sort(
    (a, b) => people[b].fullName.length - people[a].fullName.length,
  );
  const pos: (Slot | undefined)[] = new Array(people.length);
  slotOrder.forEach((si, k) => {
    const p = nameOrder[k];
    if (p != null) pos[p] = slots[si];
  });

  const titleLines = title.trim().split(/\s+/);

  const avatar = (p: ProjectParticipant, cls: string) => {
    const src = mediaUrl(p.photo);
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`${cls} shrink-0 rounded-full object-cover ring-2 ring-white/10`}
      />
    ) : (
      <span
        className={`${cls} grid shrink-0 place-items-center rounded-full bg-white/10 font-bold text-white ring-2 ring-white/10`}
      >
        {p.fullName.trim().charAt(0).toUpperCase()}
      </span>
    );
  };

  return (
    // Desktop-only: the traced heart needs room, on phones it degraded into
    // an unreadable blob — so it simply isn't shown there.
    <section className="relative isolate hidden overflow-hidden py-12 md:block lg:py-16">
      <Glow
        color={glow[1]}
        className="left-1/2 top-1/2 h-[22rem] w-[30rem] -translate-x-1/2 -translate-y-1/2"
      />

      <div className="mx-auto w-full max-w-[90rem] px-4">
        <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
          <h2
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 text-center text-4xl font-extrabold uppercase leading-[1.1] tracking-tight text-white lg:text-5xl"
            style={{ left: `${TITLE_X * 100}%`, top: `${TITLE_Y * 100}%` }}
          >
            {titleLines.map((w, i) => (
              <span key={i} className="block">
                {w}
              </span>
            ))}
          </h2>

          {people.map((p, k) => {
            const slot = pos[k] ?? { x: 0.5, y: 0.95 };
            return (
              <div
                key={k}
                className="absolute z-10 flex -translate-y-1/2 items-center gap-2"
                style={{ left: `${slot.x * 100}%`, top: `${slot.y * 100}%` }}
              >
                {avatar(p, "h-8 w-8 text-sm lg:h-10 lg:w-10")}
                <span className="max-w-[8rem] truncate text-xs font-medium text-white lg:text-sm">
                  {p.fullName}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

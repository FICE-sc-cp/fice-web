import { Glow } from "@/components/ui/Glow";
import { mediaUrl, type ProjectParticipant } from "@/lib/api";

// Avatar spots traced 1:1 from the reference design (normalized to a 16:9
// frame, x shifted so the hollow middle sits under the centred title).
// Together they read as a heart: two lobe peaks on top, a tip at the bottom
// centre, an empty middle for the title, names to the right of avatars.
const TEMPLATE: [number, number][] = [
  [0.298, 0.108], [0.604, 0.106], // top lobe peaks
  [0.226, 0.197], [0.376, 0.194], [0.506, 0.194], [0.654, 0.194], [0.765, 0.172],
  [0.161, 0.286], [0.3, 0.269], [0.437, 0.287], [0.587, 0.289], [0.749, 0.292],
  [0.315, 0.355], [0.694, 0.378], [0.152, 0.381], [0.773, 0.422],
  [0.156, 0.464], [0.28, 0.466], [0.755, 0.507],
  [0.201, 0.55], [0.308, 0.548], [0.743, 0.593],
  [0.225, 0.656], [0.356, 0.674], [0.501, 0.677], [0.618, 0.676], [0.721, 0.696],
  [0.25, 0.744], [0.369, 0.766], [0.517, 0.759], [0.673, 0.775],
  [0.311, 0.83], [0.478, 0.849], [0.574, 0.843],
  [0.343, 0.91], [0.588, 0.914],
  [0.462, 0.947], // bottom tip
];

// Shape-critical spots kept first when fewer people than template slots:
// bottom tip, the two lobe peaks, the left/right extremes — then the rest,
// outline before interior.
const CRITICAL = [36, 0, 1, 14, 15];
const CX = 0.46;
const CY = 0.53;
const PRIORITY: number[] = [
  ...CRITICAL,
  ...TEMPLATE.map((_, i) => i)
    .filter((i) => !CRITICAL.includes(i))
    .sort((a, b) => {
      const d = (i: number) =>
        Math.hypot(TEMPLATE[i][0] - CX, TEMPLATE[i][1] - CY);
      return d(b) - d(a);
    }),
];

// Title clearance (normalized): names of slots left of the title must stop
// before it; extra slots must not be created inside it.
const TITLE_HX = 0.135;
const TITLE_HY = 0.085;

function slotsFor(n: number): [number, number][] {
  if (n <= TEMPLATE.length) {
    return PRIORITY.slice(0, n).map((i) => TEMPLATE[i]);
  }
  // More people than the template: fill the largest gaps with midpoints,
  // avoiding the title box. ponytail: caps out ~2x template size.
  const pts = [...TEMPLATE];
  let guard = 0;
  while (pts.length < n && guard < 300) {
    guard++;
    let best: [number, number] | null = null;
    let bestScore = 0;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const mx = (pts[i][0] + pts[j][0]) / 2;
        const my = (pts[i][1] + pts[j][1]) / 2;
        if (Math.abs(mx - 0.5) < TITLE_HX + 0.03 && Math.abs(my - 0.5) < TITLE_HY + 0.05)
          continue;
        let near = Infinity;
        for (const p of pts) near = Math.min(near, Math.hypot((p[0] - mx) * 16, (p[1] - my) * 9));
        if (near > bestScore) ((bestScore = near), (best = [mx, my]));
      }
    }
    if (!best || bestScore < 0.55) break;
    pts.push(best);
  }
  return pts.slice(0, n);
}

// Free horizontal room to the right of each slot (next avatar in the same
// band, the title box, or the frame edge) — long names go to roomy slots,
// short names to tight ones, exactly like the reference.
function rightSpace(slots: [number, number][]): number[] {
  return slots.map(([x, y]) => {
    let best = 1 - x;
    for (const [ox, oy] of slots) {
      if (ox > x + 0.001 && Math.abs(oy - y) < 0.07) best = Math.min(best, ox - x);
    }
    if (Math.abs(y - 0.5) < TITLE_HY && x < 0.5 - TITLE_HX) {
      best = Math.min(best, 0.5 - TITLE_HX - x);
    }
    return best;
  });
}

export function ProjectPeopleWall({
  people,
  glow,
}: {
  people: ProjectParticipant[];
  gradient: string;
  glow: [string, string];
}) {
  const slots = slotsFor(people.length);
  const rs = rightSpace(slots);
  const slotOrder = [...slots.keys()].sort((a, b) => rs[b] - rs[a]);
  const nameOrder = [...people.keys()].sort(
    (a, b) => people[b].fullName.length - people[a].fullName.length,
  );
  const pos: ([number, number] | undefined)[] = new Array(people.length);
  slotOrder.forEach((si, k) => {
    const p = nameOrder[k];
    if (p != null) pos[p] = slots[si];
  });

  const avatar = (p: ProjectParticipant, cls: string) => {
    const src = mediaUrl(p.photo);
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={`${cls} shrink-0 rounded-full object-cover ring-2 ring-white/10`} />
    ) : (
      <span className={`${cls} grid shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold text-white ring-2 ring-white/10`}>
        {p.fullName.trim().charAt(0).toUpperCase()}
      </span>
    );
  };

  return (
    <section className="relative isolate overflow-hidden py-12 lg:py-16">
      <Glow
        color={glow[1]}
        className="left-1/2 top-1/2 h-[22rem] w-[30rem] -translate-x-1/2 -translate-y-1/2"
      />

      {/* Mobile: simple centred cloud under the title */}
      <div className="px-4 md:hidden">
        <h2 className="text-center text-3xl font-extrabold uppercase leading-tight text-white">
          Люди
          <br />
          проєктного
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {people.map((p, k) => (
            <span key={k} title={p.fullName}>
              {avatar(p, "h-9 w-9")}
            </span>
          ))}
        </div>
      </div>

      {/* Desktop: the traced reference layout */}
      <div className="mx-auto hidden w-full max-w-6xl px-4 md:block">
        <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
          <h2 className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-center text-4xl font-extrabold uppercase leading-[1.1] tracking-tight text-white">
            Люди
            <br />
            проєктного
          </h2>

          {people.map((p, k) => {
            const [x, y] = pos[k] ?? [0.5, 0.95];
            return (
              <div
                key={k}
                className="absolute z-10 flex -translate-y-1/2 items-center gap-2"
                style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
              >
                {avatar(p, "h-10 w-10")}
                <span className="max-w-[10rem] truncate text-sm font-medium text-white">
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

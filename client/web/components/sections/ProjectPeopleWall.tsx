import { Glow } from "@/components/ui/Glow";
import { mediaUrl, type ProjectParticipant } from "@/lib/api";
import {
  AVATARS,
  FRAME_H,
  NAMED,
  TITLE_LEADING,
  TITLE_Y,
  heartLayout,
  heartTitle,
} from "@/lib/heartLayout";

// Names only show while the named layout keeps avatars at least this big;
// below it (narrow screens, big departments) the wall switches to avatars
// only, with the name on hover.
const MIN_NAMED_AVATAR_PX = 30;

// Frame width (px — the site's rem is 14px) from which the named layout
// shows. Literal class strings so Tailwind sees them.
const NAMED_FROM: [number, string, string][] = [
  [320, "hidden @min-[320px]:block", "@min-[320px]:hidden"],
  [360, "hidden @min-[360px]:block", "@min-[360px]:hidden"],
  [400, "hidden @min-[400px]:block", "@min-[400px]:hidden"],
  [440, "hidden @min-[440px]:block", "@min-[440px]:hidden"],
  [480, "hidden @min-[480px]:block", "@min-[480px]:hidden"],
  [520, "hidden @min-[520px]:block", "@min-[520px]:hidden"],
  [560, "hidden @min-[560px]:block", "@min-[560px]:hidden"],
  [600, "hidden @min-[600px]:block", "@min-[600px]:hidden"],
  [640, "hidden @min-[640px]:block", "@min-[640px]:hidden"],
  [680, "hidden @min-[680px]:block", "@min-[680px]:hidden"],
  [720, "hidden @min-[720px]:block", "@min-[720px]:hidden"],
  [760, "hidden @min-[760px]:block", "@min-[760px]:hidden"],
  [800, "hidden @min-[800px]:block", "@min-[800px]:hidden"],
  [840, "hidden @min-[840px]:block", "@min-[840px]:hidden"],
  [880, "hidden @min-[880px]:block", "@min-[880px]:hidden"],
  [920, "hidden @min-[920px]:block", "@min-[920px]:hidden"],
];

const pct = (v: number) => `${v * 100}%`;
const cqw = (v: number) => `${v * 100}cqw`;
const at = (s: { x: number; y: number }) => ({
  left: pct(s.x),
  top: pct(s.y / FRAME_H),
});

function Avatar({
  person,
  size,
  className = "",
}: {
  person: ProjectParticipant;
  size: number;
  className?: string;
}) {
  const src = mediaUrl(person.photo);
  const style = { width: cqw(size), height: cqw(size) };
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      style={style}
      className={`${className} shrink-0 rounded-full object-cover ring-2 ring-white/10`}
    />
  ) : (
    <span
      style={{ ...style, fontSize: cqw(size * 0.4) }}
      className={`${className} grid shrink-0 place-items-center rounded-full bg-white/10 font-bold text-white ring-2 ring-white/10`}
    >
      {/* First code point, so a name starting with an emoji keeps it whole. */}
      {Array.from(person.fullName.trim())[0]?.toUpperCase()}
    </span>
  );
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
  const t = heartTitle(title);
  const named = heartLayout(people.length, NAMED, t);
  const dense = heartLayout(people.length, AVATARS, t);
  const toggle = NAMED_FROM.find(
    ([px]) => px * named.avatar >= MIN_NAMED_AVATAR_PX,
  );

  return (
    <section className="relative isolate overflow-hidden py-12 lg:py-16">
      {/* Never taller than the screen, so the whole heart is seen at once. */}
      <div className="mx-auto w-full max-w-[min(70rem,100svh)] px-4">
        <div
          className="@container relative w-full"
          style={{ aspectRatio: `1 / ${FRAME_H}` }}
        >
          <div
            className="absolute left-1/2"
            style={{ top: pct(TITLE_Y / FRAME_H) }}
          >
            <Glow
              color={glow[1]}
              className="left-0 top-0 h-[40cqw] w-[55cqw] -translate-x-1/2 -translate-y-1/2"
            />
          </div>

          <h2
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 text-center font-extrabold uppercase tracking-tight text-white"
            style={{
              left: "50%",
              top: pct(TITLE_Y / FRAME_H),
              fontSize: cqw(t.font),
              lineHeight: TITLE_LEADING,
            }}
          >
            {t.lines.map((line, i) => (
              <span key={i} className="block whitespace-nowrap">
                {line}
              </span>
            ))}
          </h2>

          {toggle && (
            <div className={`absolute inset-0 ${toggle[1]}`}>
              {people.map((p, k) => {
                const s = named.slots[k];
                if (!s) return null;
                return (
                  <div
                    key={k}
                    className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                    style={{
                      ...at(s),
                      width: cqw(named.avatar * NAMED.itemW),
                      gap: cqw(named.avatar * 0.1),
                    }}
                  >
                    <Avatar person={p} size={named.avatar} />
                    <span
                      title={p.fullName}
                      className="w-full truncate text-center font-medium leading-tight text-white"
                      style={{
                        fontSize: `clamp(11px, ${cqw(named.avatar * 0.26)}, 13px)`,
                      }}
                    >
                      {p.fullName}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className={`absolute inset-0 ${toggle?.[2] ?? ""}`}>
            {people.map((p, k) => {
              const s = dense.slots[k];
              if (!s) return null;
              return (
                <div
                  key={k}
                  className="group absolute flex -translate-x-1/2 -translate-y-1/2 hover:z-30"
                  style={at(s)}
                >
                  <Avatar
                    person={p}
                    size={dense.avatar}
                    className="transition-transform duration-200 group-hover:scale-110"
                  />
                  {/* Edge avatars open the name inwards so it stays on screen. */}
                  <span
                    className={`pointer-events-none absolute bottom-full mb-1.5 whitespace-nowrap rounded-md bg-black/85 px-2 py-0.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 ${
                      s.x < 0.3
                        ? "left-0"
                        : s.x > 0.7
                          ? "right-0"
                          : "left-1/2 -translate-x-1/2"
                    }`}
                  >
                    {p.fullName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

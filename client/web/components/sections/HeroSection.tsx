import { Container } from "@/components/ui/Container";
import { PhotoCard } from "@/components/ui/PhotoCard";

const PHOTOS = [
  { src: "/photo-2.png", className: "left-0 top-12 h-56 w-80 rotate-[7deg]" },
  {
    src: "/photo-4.png",
    className: "left-6 top-[40%] h-56 w-72 -rotate-[6deg]",
  },
  { src: "/photo-6.png", className: "bottom-8 left-0 h-52 w-72 rotate-[8deg]" },
  { src: "/photo-1.png", className: "right-0 top-10 h-56 w-80 -rotate-[8deg]" },
  {
    src: "/photo-3.png",
    className: "right-0 top-[42%] h-56 w-80 rotate-[4deg]",
  },
  {
    src: "/photo-5.png",
    className: "bottom-2 left-[78%] h-52 w-72 -translate-x-1/2 -rotate-[4deg]",
  },
];

export function HeroSection() {
  return (
    <section className="relative flex min-h-[calc(100svh_-_5rem)] items-center overflow-hidden py-16 sm:py-20 lg:min-h-[44rem] lg:py-24">
      <div className="pointer-events-none absolute inset-0 hidden lg:block">
        <div className="relative mx-auto h-full max-w-7xl">
          {PHOTOS.map((p, i) => (
            <PhotoCard
              key={p.src}
              src={p.src}
              alt=""
              className={`absolute animate-fade ${p.className}`}
              style={{ animationDelay: `${250 + i * 120}ms` }}
            />
          ))}
        </div>
      </div>

      <Container className="relative z-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
          <h1 className="animate-rise text-5xl font-bold uppercase leading-[1.05] sm:text-6xl lg:text-7xl xl:text-8xl">
            Студентська рада ФІОТ
          </h1>
          <p
            className="animate-rise max-w-xl text-lg text-muted sm:text-xl lg:text-2xl"
            style={{ animationDelay: "140ms" }}
          >
            Ми знайшли баланс між незалежністю та ефективною співпрацею — зі
            студентами, університетом і партнерами.
          </p>
          <a
            href="#about"
            className="animate-rise mt-2 inline-flex items-center justify-center rounded-2xl bg-gradient-main px-10 py-4 text-xl font-bold text-black transition-transform hover:scale-[1.03] hover:opacity-95 active:scale-95 lg:px-14 lg:py-5 lg:text-2xl"
            style={{ animationDelay: "280ms" }}
          >
            Дізнатись більше
          </a>
        </div>
      </Container>
    </section>
  );
}

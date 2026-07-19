import { Container } from "@/components/ui/Container";
import { HeroPhotos } from "@/components/sections/HeroPhotos";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[calc(85svh_-_5rem)] items-center overflow-hidden pb-10 pt-24 sm:min-h-[calc(100svh_-_5rem)] sm:pb-20 sm:pt-28 lg:min-h-[44rem] lg:pb-24 lg:pt-32">
      <HeroPhotos />

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

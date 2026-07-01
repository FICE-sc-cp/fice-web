import { TeamSection } from "@/components/sections/TeamSection";
import { Container } from "@/components/ui/Container";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { GradientText } from "@/components/ui/GradientText";
import { Marquee } from "@/components/sections/Marquee";
import { Glow } from "@/components/ui/Glow";

export default function TeamPage() {
  return (
    <>
      <Header />
      <main className="overflow-x-clip">
        {/* hero */}
        <section className="relative isolate pb-8 pt-20 lg:pt-28">
          <Glow
            color="#ad46ff"
            className="left-0 top-32 h-[26rem] w-[36rem] -translate-x-1/4"
          />
          <Glow
            color="#30c3e0"
            className="right-0 top-4 h-[28rem] w-[36rem] translate-x-1/4"
          />
          <Container>
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Команда <GradientText>Студради ФІОТ</GradientText>
              </h1>
              <p className="max-w-xl text-lg text-muted sm:text-xl">
                Ті, хто створює майбутнє нашого інституту вже сьогодні. Твоє
                самоврядування, твій простір, твоя команда. Лідери, які роблять
                зміни
              </p>
              <a
                href="/join"
                className="mt-2 inline-flex items-center justify-center rounded-2xl bg-gradient-main px-10 py-4 text-lg font-bold text-black transition-opacity hover:opacity-90"
              >
                Приєднатись до команди
              </a>
            </div>
          </Container>
        </section>

        {/* team section */}
        <TeamSection />
        <Marquee />
        <br />
        <br />
        <br />
      </main>
      <Footer />
    </>
  );
}

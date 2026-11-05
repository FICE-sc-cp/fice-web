import type { Metadata } from "next";
import { TeamSection } from "@/components/sections/TeamSection";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { GradientText } from "@/components/ui/GradientText";
import { PageHero } from "@/components/ui/PageHero";
import { Marquee } from "@/components/sections/Marquee";
import { Glow } from "@/components/ui/Glow";

export const metadata: Metadata = {
  title: "Команда",
  description:
    "Знайомся з командою Студради ФІОТ КПІ: президія та голови департаментів — лідери, які створюють майбутнє факультету вже сьогодні.",
};

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
          <PageHero
            title={
              <>
                Люди, які творять <GradientText>Студраду ФІОТ</GradientText>
              </>
            }
            scene="crew"
            says="Одна команда, яка організовує заходи, запускає проєкти й відстоює інтереси студентів ФІОТ. Знайомся з нами."
          />
        </section>

        {/* team section */}
        <TeamSection />
        <div className="pb-0">
          <Marquee />
        </div>
      </main>
      <Footer />
    </>
  );
}

import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Glow } from "@/components/ui/Glow";
import { Reveal, RevealGroup } from "@/components/ui/Reveal";
import { CountUp } from "@/components/ui/CountUp";
import { EMPTY_FACTS, fice, safe, type Facts } from "@/lib/api";

const LOGO_ROWS = [4, 3, 4];

const STAT_DEFS: { key: keyof Facts; label: string; gradient: string }[] = [
  {
    key: "activeStudents",
    label: "Активних студентів",
    gradient: "bg-gradient-magenta",
  },
  {
    key: "activePartners",
    label: "Діючих партнерів",
    gradient: "bg-gradient-green",
  },
  { key: "eventsPerYear", label: "Заходів щороку", gradient: "bg-gradient-blue" },
  {
    key: "projectsDone",
    label: "Реалізованих проєктів",
    gradient: "bg-gradient-orange",
  },
];

export async function PartnersSection() {
  const facts = await safe(fice.facts(), EMPTY_FACTS);

  return (
    <section
      id="partners"
      className="relative isolate scroll-mt-28 py-20 lg:py-28"
    >
      <Glow
        color="#3BCA5B"
        className="left-1/2 top-[78%] h-[26rem] w-[40rem] -translate-y-full ml-[26rem] z-0"
      />

      <Container>
        <Reveal>
          <SectionHeader title="Наші партнери" gradient="bg-gradient-blue" />
        </Reveal>

        <RevealGroup className="mt-14 flex flex-col items-center gap-8">
          {LOGO_ROWS.map((count, r) => (
            <div
              key={r}
              className="flex flex-wrap justify-center gap-x-12 gap-y-8"
            >
              {Array.from({ length: count }).map((_, i) => (
                <Image
                  key={i}
                  src="/logo_white.png"
                  alt="Логотип партнера"
                  width={184}
                  height={101}
                  className="h-auto w-28 opacity-50 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0 sm:w-36 lg:w-44"
                />
              ))}
            </div>
          ))}
        </RevealGroup>

        <Reveal className="mt-12 rounded-lg bg-gradient-main p-0.5">
          <div className="rounded-lg bg-bg px-6 pb-12 pt-8 lg:px-16">
            <h3 className="text-center text-4xl font-bold lg:text-6xl">
              Стати партнером
            </h3>

            <div className="mt-12 flex flex-col gap-12 lg:flex-row lg:gap-24">
              <div className="flex flex-col justify-between gap-8 lg:max-w-[536px]">
                <p className="text-xl font-medium leading-6 text-stone-300">
                  Співпраця зі студентською радою ФІОТ — це інвестиція у
                  майбутнє, можливість підтримати молодь та розвиток освіти, а
                  також вихід на цільову аудиторію талановитих студентів.
                </p>
                <a
                  href="#"
                  className="rounded-2xl bg-gradient-main px-6 py-5 text-center text-xl font-bold text-black transition-transform hover:scale-[1.02] hover:opacity-95 active:scale-95 sm:px-12 sm:py-6 sm:text-2xl lg:text-3xl"
                >
                  Стати партнером
                </a>
              </div>

              <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                {STAT_DEFS.map((stat) => (
                  <div
                    key={stat.label}
                    className={`rounded-lg p-px transition-transform duration-300 hover:-translate-y-1 ${stat.gradient}`}
                  >
                    <div className="flex h-full flex-col gap-2 rounded-lg bg-bg p-6">
                      <CountUp
                        value={facts[stat.key]}
                        suffix="+"
                        className={`bg-clip-text text-4xl font-bold text-transparent ${stat.gradient}`}
                      />
                      <span className="text-xl font-medium text-stone-300">
                        {stat.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

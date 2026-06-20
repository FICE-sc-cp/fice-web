import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Glow } from "@/components/ui/Glow";

const LOGO_ROWS = [4, 3, 4];

const STATS: { value: string; label: string; gradient: string }[] = [
  {
    value: "1000+",
    label: "Активних студентів",
    gradient: "bg-gradient-magenta",
  },
  { value: "15+", label: "Діючих партнерів", gradient: "bg-gradient-green" },
  { value: "20+", label: "Заходів щороку", gradient: "bg-gradient-blue" },
  {
    value: "100%",
    label: "Прозорість діяльності",
    gradient: "bg-gradient-orange",
  },
];

export function PartnersSection() {
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
        <SectionHeader title="Нашим партнерам" gradient="bg-gradient-blue" />

        <div className="mt-14 flex flex-col items-center gap-8">
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
                  className="h-auto w-28 opacity-50 sm:w-36 lg:w-44"
                />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-lg bg-gradient-main p-0.5">
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
                  className="rounded-2xl bg-gradient-main px-12 py-6 text-center text-2xl font-bold text-black transition-opacity hover:opacity-90 lg:text-3xl"
                >
                  Стати партнером
                </a>
              </div>

              <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                {STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className={`rounded-lg p-px ${stat.gradient}`}
                  >
                    <div className="flex h-full flex-col gap-2 rounded-lg bg-bg p-6">
                      <span
                        className={`bg-clip-text text-4xl font-bold text-transparent ${stat.gradient}`}
                      >
                        {stat.value}
                      </span>
                      <span className="text-xl font-medium text-stone-300">
                        {stat.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

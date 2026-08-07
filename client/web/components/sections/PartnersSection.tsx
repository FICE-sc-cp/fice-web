import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Glow } from "@/components/ui/Glow";
import { Reveal, RevealGroup } from "@/components/ui/Reveal";
import { CountUp } from "@/components/ui/CountUp";
import {
  EMPTY_FACTS,
  fice,
  mediaUrl,
  safe,
  type Facts,
  type Partner,
} from "@/lib/api";

const MAX_LOGOS = 10;

const EMPTY_PARTNERS = {
  items: [] as Partner[],
  total: 0,
  page: 1,
  limit: MAX_LOGOS,
  totalPages: 0,
};

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
  const [facts, partnersPage] = await Promise.all([
    safe(fice.facts(), EMPTY_FACTS),
    safe(fice.partners(50), EMPTY_PARTNERS),
  ]);

  const logos = partnersPage.items
    .map((p) => ({
      id: p.id,
      name: p.name,
      websiteLink: p.websiteLink,
      logo: mediaUrl(p.logoImage),
    }))
    .filter((p): p is typeof p & { logo: string } => !!p.logo)
    .slice(0, MAX_LOGOS);

  return (
    <section
      id="partners"
      className="relative isolate scroll-mt-36 py-12 lg:py-16"
    >
      <Glow
        color="#3BCA5B"
        className="left-1/2 top-[78%] h-[26rem] w-[40rem] -translate-y-full ml-[26rem] z-0"
      />

      <Container>
        <Reveal>
          <SectionHeader title="Наші партнери" gradient="bg-gradient-blue" />
        </Reveal>

        {logos.length > 0 && (
          <RevealGroup className="mt-14 flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
            {logos.map((p) => {
              const logo = (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.logo}
                  alt={p.name}
                  className="h-14 w-28 object-contain transition-transform duration-300 hover:-translate-y-1 hover:scale-110 sm:h-16 sm:w-36 lg:h-20 lg:w-44"
                />
              );
              return p.websiteLink ? (
                <a
                  key={p.id}
                  href={p.websiteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={p.name}
                >
                  {logo}
                </a>
              ) : (
                <div key={p.id} title={p.name}>
                  {logo}
                </div>
              );
            })}
          </RevealGroup>
        )}

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
                <Link
                  href="/partners/join"
                  className="rounded-2xl bg-gradient-main px-6 py-5 text-center text-xl font-bold text-black transition-transform hover:scale-[1.02] hover:opacity-95 active:scale-95 sm:px-12 sm:py-6 sm:text-2xl lg:text-3xl"
                >
                  Стати партнером
                </Link>
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

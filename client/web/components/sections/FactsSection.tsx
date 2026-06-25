import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Glow } from "@/components/ui/Glow";
import { UkraineMap } from "@/components/ui/UkraineMap";
import {
  AccentCard,
  accentGradient,
  type Accent,
} from "@/components/ui/AccentCard";
import {
  MoneyBagIcon,
  PeopleIcon,
  CheckDoneIcon,
  JarIcon,
  MapPinIcon,
  type IconComponent,
} from "@/components/ui/icons";
import { Reveal, RevealGroup } from "@/components/ui/Reveal";
import { CountUp } from "@/components/ui/CountUp";
import { EMPTY_FACTS, fice, safe, type Facts } from "@/lib/api";

const STAT_DEFS: {
  key: keyof Facts;
  label: string;
  accent: Accent;
  Icon: IconComponent;
}[] = [
  {
    key: "charityRaised",
    label: "зібрано на благодійність",
    accent: "magenta",
    Icon: MoneyBagIcon,
  },
  {
    key: "membersCount",
    label: "активних учасників",
    accent: "cyan",
    Icon: PeopleIcon,
  },
  {
    key: "eventsHeld",
    label: "проведених заходів",
    accent: "orange",
    Icon: CheckDoneIcon,
  },
  {
    key: "closedFundraisers",
    label: "закритих зборів",
    accent: "green",
    Icon: JarIcon,
  },
];

const PINS = [
  { left: "19%", top: "19.5%" },
  { left: "24%", top: "24.5%" },
  { left: "45%", top: "30.5%" },
  { left: "53%", top: "10.5%" },
  { left: "68%", top: "20.5%" },
  { left: "75%", top: "63.5%" },
  { left: "54%", top: "38.5%" },
  { left: "49%", top: "23.5%" },
  { left: "68%", top: "48.5%" },
  { left: "84%", top: "31.5%" },
  { left: "65%", top: "69.5%" },
  { left: "9%", top: "49.5%" },
  { left: "40%", top: "80.5%" },
];

export async function FactsSection() {
  const facts = await safe(fice.facts(), EMPTY_FACTS);

  return (
    <section
      id="facts"
      className="relative isolate scroll-mt-28 py-20 lg:py-28"
    >
      <Glow
        color="#00E3F3"
        className="bottom-0 left-1/2 h-[34.93106rem] w-[70.75rem] -translate-x-1/2 -translate-y-2/3 ml-[16rem]"
      />

      <Container>
        <Reveal className="flex flex-col items-center gap-4 text-center">
          <SectionTitle gradient="bg-gradient-magenta">
            Факти та результати
          </SectionTitle>
          <p className="text-lg text-subtle lg:text-xl">
            Те, що ми зробили разом зі студентами та партнерами.
          </p>
        </Reveal>

        <RevealGroup className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {STAT_DEFS.map(({ key, label, accent, Icon }) => (
            <AccentCard
              key={key}
              accent={accent}
              interactive
              className="flex flex-col gap-6"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-medium leading-tight text-fg">
                  {label}
                </span>
                <span className="size-7 shrink-0">
                  <Icon gradient={accentGradient[accent]} />
                </span>
              </div>
              <CountUp
                value={facts[key]}
                className="text-4xl font-bold lg:text-5xl"
              />
            </AccentCard>
          ))}
        </RevealGroup>

        <Reveal className="relative mx-auto mt-16 aspect-[968/671] w-full max-w-3xl">
          <UkraineMap
            preserveAspectRatio="none"
            className="absolute inset-0"
            oblastFill="rgba(13,46,53,0.88)"
            oblastStroke="rgba(0,227,243,0.5)"
          />
          {PINS.map((pin, i) => (
            <span
              key={i}
              style={{
                left: `calc(${pin.left} - 2%)`,
                top: `calc(${pin.top} + 3%)`,
              }}
              className="absolute -translate-x-1/2 -translate-y-full"
            >
              <MapPinIcon className="h-10 w-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]" />
            </span>
          ))}
        </Reveal>

        <Reveal>
          <AccentCard accent="teal" className="mt-12 px-8 py-8 lg:px-24 lg:py-10">
            <p className="text-center text-2xl font-medium leading-relaxed text-fg lg:text-3xl">
              Наша спільнота не має меж. Кожна позначка на карті — це місто, з
              якого походять наші учасники. Попри різну географію, ми
              об&rsquo;єдналися заради спільної мети, щоб разом допомагати,
              організовувати заходи та змінювати країну на краще.
              <br />
              <br />
              Разом ми — сила, що діє в кожному куточку України.
            </p>
          </AccentCard>
        </Reveal>
      </Container>
    </section>
  );
}

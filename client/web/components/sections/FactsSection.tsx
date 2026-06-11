import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Glow } from "@/components/ui/Glow";
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

const STATS: {
  value: string;
  label: string;
  accent: Accent;
  Icon: IconComponent;
}[] = [
  {
    value: "656 432",
    label: "зібрано на благодійність",
    accent: "magenta",
    Icon: MoneyBagIcon,
  },
  {
    value: "178",
    label: "активних учасників",
    accent: "cyan",
    Icon: PeopleIcon,
  },
  {
    value: "43",
    label: "проведених заходів",
    accent: "orange",
    Icon: CheckDoneIcon,
  },
  { value: "5", label: "закритих зборів", accent: "green", Icon: JarIcon },
];

const PINS = [
  { left: "20%", top: "21.5%" },
  { left: "24%", top: "26.5%" },
  { left: "44%", top: "32.5%" },
  { left: "50%", top: "14.5%" },
  { left: "64%", top: "24.5%" },
  { left: "73%", top: "63.5%" },
  { left: "53%", top: "39.5%" },
  { left: "49%", top: "26.5%" },
  { left: "66%", top: "48.5%" },
  { left: "80%", top: "31.5%" },
  { left: "62%", top: "69.5%" },
  { left: "9%", top: "48.5%" },
  { left: "39%", top: "79.5%" },
];

export function FactsSection() {
  return (
    <section
      id="facts"
      className="relative isolate scroll-mt-28 py-20 lg:py-28"
    >
      <Glow
        color="#00E3F3"
        className="bottom-0 left-1/2 h-[34.93106rem] w-[70.75rem] -translate-x-1/2 -translate-y-2/3 ml-[16rem] opacity-60"
      />

      <Container>
        <div className="flex flex-col items-center gap-4 text-center">
          <SectionTitle gradient="bg-gradient-magenta">
            Факти та результати
          </SectionTitle>
          <p className="text-lg text-subtle lg:text-xl">
            Те, що ми зробили разом зі студентами та партнерами.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {STATS.map(({ value, label, accent, Icon }) => (
            <AccentCard
              key={label}
              accent={accent}
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
              <span className="text-4xl font-bold lg:text-5xl">{value}</span>
            </AccentCard>
          ))}
        </div>

        <div className="relative mx-auto mt-16 aspect-[968/671] w-full max-w-4xl">
          <Image
            src="/ukraine-map.png"
            alt="Карта України з містами, з яких походять учасники"
            fill
            sizes="(min-width: 1024px) 56rem, 100vw"
            className="object-contain"
          />
          {PINS.map((pin, i) => (
            <span
              key={i}
              style={{ left: pin.left, top: pin.top }}
              className="absolute -translate-x-1/2 -translate-y-full"
            >
              <MapPinIcon className="h-10 w-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]" />
            </span>
          ))}
        </div>

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
      </Container>
    </section>
  );
}

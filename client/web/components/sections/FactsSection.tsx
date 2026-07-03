import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Glow } from "@/components/ui/Glow";
import Image from "next/image";
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
  { left: "19.5%", top: "19%", count: 2 }, // Луцьк 2
  { left: "13%", top: "30%", count: 1 }, // Львів 1
  //{ left: "38%", top: "40%" }, // Вінниця 0
  { left: "53%", top: "10%", count: 1 }, // Чернігів 1
  { left: "72%", top: "18%", count: 2 }, // Суми 2
  { left: "74.5%", top: "57%", count: 5 }, // Запоріжжя 5
  { left: "43.5%", top: "55.5%", count: 1 }, // Подільськ)))))))))))))) 1
  { left: "48.7%", top: "23.7%", count: 41 }, // Київ 41
  { left: "65%", top: "55%", count: 2 }, // Кривий Ріг 2
  { left: "81%", top: "29.5%", count: 3 }, // Харків 3
  { left: "57%", top: "65.5%", count: 2 }, // Миколаїв 2
  { left: "74%", top: "49.5%", count: 1 }, // Дінпро 1
  { left: "49%", top: "71.5%", count: 2 }, // Одеса 2
  { left: "60%", top: "70%", count: 2 }, // Херсон 2
  { left: "38.5%", top: "25%", count: 4 }, // Житомир 4
  { left: "70%", top: "34%", count: 3 }, // Полтава 3
  { left: "16.5%", top: "13%", count: 4 }, // Ковель 4
  { left: "25%", top: "21%", count: 3 }, // Рівне 3
  { left: "56.5%", top: "38.5%", count: 1 }, // Сміла 1
  { left: "55.5%", top: "25%", count: 1 }, // Яготин 1
  { left: "39.5%", top: "45.5%", count: 1 }, // Тульчин 1
  { left: "56%", top: "16%", count: 1 }, // Ніжин 1
  { left: "69%", top: "90%", count: 1 }, // Сімферополь 1
  { left: "47%", top: "44.5%", count: 1 }, // Умань 1
  { left: "46.5%", top: "31%", count: 2 }, // Біла Церква 2
  { left: "88.5%", top: "53.5%", count: 1 }, // Донецьк 1
  { left: "83.2%", top: "69%", count: 1 }, // Бердянськ 1
  { left: "40%", top: "85%", count: 1 }, // с. Кислиця 1
  { left: "88.6%", top: "49%", count: 1 }, // Торецьк 1
  { left: "31.9%", top: "27%", count: 1 }, // Полонне 1
  { left: "65%", top: "4.5%", count: 1 }, // Шостка 1
  { left: "78%", top: "49%", count: 2 }, // Павлоград 2
  { left: "58%", top: "48.5%", count: 1 }, // Кропивницький 1
  { left: "87.5%", top: "64.8%", count: 1 }, // Маріуполь 1
  { left: "83.5%", top: "35.6%", count: 1 }, // Балаклія 1
  { left: "92.8%", top: "42%", count: 1 }, // Сєвєродонецьк 1
  { left: "30%", top: "31.5%", count: 1 }, // Старокостянтинів 1
  { left: "51.5%", top: "40.5%", count: 1 }, // Звенигородка 1

  { left: "2.9%", top: "46.3%", count: 1 }, // Ужгород 1
  { left: "23.5%", top: "50%", count: 1 }, // Чернівці 1
  { left: "16.5%", top: "43%", count: 1 }, // Івано-Франківськ 1
  { left: "21.5%", top: "34.5%", count: 1 }, // Тернопіль 1
];

const PIN_SIZE: Record<number, string> = {
  1: "h-6",
  2: "h-8",
  3: "h-10",
  4: "h-12",
  5: "h-14",
};

function pinHeight(count: number) {
  if (count > 5) return "h-20";
  return PIN_SIZE[count] ?? "h-10";
}

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
          <Image
            src="/ukraine-map.svg"
            alt="Карта України"
            fill
            unoptimized
            sizes="(min-width: 1024px) 48rem, 100vw"
            className="object-fill"
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
              <MapPinIcon
                className={`${pinHeight(pin.count)} w-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]`}
              />
            </span>
          ))}
        </Reveal>

        <Reveal>
          <AccentCard
            accent="teal"
            className="mt-12 px-8 py-8 lg:px-24 lg:py-10"
          >
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

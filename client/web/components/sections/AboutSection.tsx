import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Glow } from "@/components/ui/Glow";
import {
  AccentCard,
  accentGradient,
  type Accent,
} from "@/components/ui/AccentCard";
import { MoneyBagIcon } from "@/components/ui/icons";

const CARDS: { title: string; accent: Accent; text: string }[] = [
  {
    title: "Візія",
    accent: "magenta",
    text: "Динамічне середовище, де кожен студент може розвивати себе та впливати на життя факультету.",
  },
  {
    title: "Місія",
    accent: "orange",
    text: "Створювати умови для активного студентського самоврядування та розвитку студентства ФІОТ.",
  },
];

export function AboutSection() {
  return (
    <section
      id="about"
      className="relative isolate scroll-mt-28 py-20 lg:py-28"
    >
      <Glow
        color="#3BCA5B"
        className="left-1/2 top-[34%] h-[30.41706rem] w-[61.75rem] -translate-x-1/2 -translate-y-1/2 ml-[32rem]"
      />

      <Container>
        <SectionTitle gradient="bg-gradient-main">Хто ми?</SectionTitle>

        <div className="mt-14 grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col gap-8">
            <p className="text-2xl font-medium leading-snug text-fg lg:text-3xl">
              Студрада ФІОТ — ініціатор позитивних змін в освітніх процесах та
              житті студентської спільноти.
            </p>
            <div className="relative aspect-[546/351] w-full overflow-hidden rounded-xl ring-1 ring-white/10">
              <Image
                src="/photo-7.png"
                alt="Команда студради ФІОТ"
                fill
                sizes="(min-width: 1024px) 32rem, 100vw"
                className="object-cover"
              />
            </div>
          </div>

          <div className="flex flex-col gap-8">
            {CARDS.map((card) => (
              <AccentCard
                key={card.title}
                accent={card.accent}
                className="flex flex-col gap-4 px-6 py-8 lg:px-8 lg:py-10"
              >
                <span className="size-12">
                  <MoneyBagIcon gradient={accentGradient[card.accent]} />
                </span>
                <h3 className="text-3xl font-bold lg:text-4xl">{card.title}</h3>
                <p className="text-lg text-muted">{card.text}</p>
              </AccentCard>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

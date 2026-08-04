import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { GradientText } from "@/components/ui/GradientText";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AccentCard, type Accent } from "@/components/ui/AccentCard";
import { PartnerFormSection } from "@/components/sections/PartnerFormSection";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Партнерство зі Студрадою ФІОТ",
  description:
    "Станьте партнером Студентської ради ФІОТ — розкажіть про свою компанію та формат співпраці, який Ви пропонуєте.",
};

const REASONS: {
  num: string;
  title: string;
  text: string;
  accent: Accent;
  badge: string;
}[] = [
  {
    num: "01",
    title: "Молода аудиторія",
    text: "Тисячі студентів ФІОТ — майбутні ІТ-спеціалісти, які вже сьогодні обирають бренди, продукти та роботодавців.",
    accent: "magenta",
    badge: "bg-gradient-magenta",
  },
  {
    num: "02",
    title: "Спільні події",
    text: "Інтеграції на заходах факультету: від хакатонів і лекцій до фестивалів — з вашим брендом у центрі уваги.",
    accent: "cyan",
    badge: "bg-gradient-blue",
  },
  {
    num: "03",
    title: "Гнучкі формати",
    text: "Ми відкриті до різних форматів співпраці — пропонуйте свій, і разом знайдемо варіант, вигідний обом сторонам.",
    accent: "green",
    badge: "bg-gradient-green",
  },
  {
    num: "04",
    title: "Соціальний вплив",
    text: "Партнерство з нами — це підтримка освіти, студентських ініціатив і благодійних зборів разом із спільнотою.",
    accent: "orange",
    badge: "bg-gradient-orange",
  },
];

export default function PartnerJoinPage() {
  return (
    <>
      <Header />
      <main className="overflow-x-clip">
        <section className="relative isolate pb-8 pt-20 lg:pt-28">
          <Glow
            color="#2B7FFF"
            className="left-0 top-4 h-[26rem] w-[36rem] -translate-x-1/4"
          />
          <Glow
            color="#3BCA5B"
            className="right-0 top-16 h-[28rem] w-[36rem] translate-x-1/4"
          />
          <Container>
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Станьте нашим <GradientText>Партнером</GradientText>
              </h1>
              <p className="max-w-xl text-lg text-muted sm:text-xl">
                Співпраця зі Студрадою ФІОТ — це інвестиція у майбутнє:
                підтримка молоді й освіти та вихід на аудиторію талановитих
                студентів. Заповніть заявку — і ми звʼяжемось із Вами.
              </p>
              <a
                href="#form"
                className="mt-2 inline-flex items-center justify-center rounded-2xl bg-gradient-main px-10 py-4 text-lg font-bold text-black transition-opacity hover:opacity-90"
              >
                Подати заявку
              </a>
            </div>
          </Container>
        </section>

        <section className="relative isolate scroll-mt-28 py-16 lg:py-24">
          <Container>
            <SectionHeader
              title="Чому варто співпрацювати з нами"
              subtitle="Чотири причини, чому компанії обирають партнерство зі Студрадою."
              gradient="bg-gradient-blue"
            />
            <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {REASONS.map((r) => (
                <AccentCard
                  key={r.num}
                  accent={r.accent}
                  className="flex flex-col gap-3 bg-surface/40 p-7"
                >
                  <span
                    className={cn(
                      "inline-flex size-12 items-center justify-center rounded-xl text-xl font-extrabold text-black",
                      r.badge,
                    )}
                  >
                    {r.num}
                  </span>
                  <h3 className="mt-1 text-2xl font-bold">{r.title}</h3>
                  <p className="text-base leading-relaxed text-subtle">
                    {r.text}
                  </p>
                </AccentCard>
              ))}
            </div>
          </Container>
        </section>

        <PartnerFormSection />
      </main>
      <Footer />
    </>
  );
}

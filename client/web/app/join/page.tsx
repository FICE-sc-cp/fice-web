import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { Glow } from "@/components/ui/Glow";
import { GradientText } from "@/components/ui/GradientText";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AccentCard, type Accent } from "@/components/ui/AccentCard";
import { ApplicationFormSection } from "@/components/sections/ApplicationFormSection";
import {
  ApplicationsClosedSection,
  FICE_TIME_URL,
} from "@/components/sections/ApplicationsClosedSection";
import { TelegramIcon } from "@/components/ui/icons";
import { fice, safe } from "@/lib/api";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "Вступ до Студради ФІОТ" },
  description:
    "Заповни заявку, щоб приєднатися до Студентської ради ФІОТ — обери департамент і розкажи про себе.",
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
    title: "Реальний вплив",
    text: "Ти береш участь у рішеннях, що формують освітній процес та життя факультету — не на словах, а на ділі.",
    accent: "magenta",
    badge: "bg-gradient-magenta",
  },
  {
    num: "02",
    title: "Розвиток навичок",
    text: "Лідерство, організація подій, комунікація, командна робота — навички, які працюють і в навчанні, і в карʼєрі.",
    accent: "cyan",
    badge: "bg-gradient-blue",
  },
  {
    num: "03",
    title: "Нові знайомства",
    text: "Спільнота активних та амбітних студентів, викладачів і партнерів, з якими цікаво створювати щось велике.",
    accent: "green",
    badge: "bg-gradient-green",
  },
  {
    num: "04",
    title: "Цікаві проєкти",
    text: "Реалізація власних ідей, підтримка від команди та отримання досвіду.",
    accent: "orange",
    badge: "bg-gradient-orange",
  },
];

export default async function JoinPage() {
  const { open } = await safe(fice.applicationStatus(), {
    open: true,
    updatedAt: null,
  });

  return (
    <>
      <Header />
      <main className="overflow-x-clip">
        {/* hero */}
        <section className="relative isolate pb-8 pt-16 lg:pt-24">
          <Glow
            color="#2EFF97"
            className="left-0 top-4 h-[26rem] w-[36rem] -translate-x-1/4"
          />
          <Glow
            color="#AD46FF"
            className="right-0 top-16 h-[28rem] w-[36rem] translate-x-1/4"
          />
          <PageHero
            title={
              <>
                Стань частиною{" "}
                <GradientText className="whitespace-nowrap">
                  Студради&nbsp;ФІОТ
                </GradientText>
              </>
            }
            scene="herald"
            says={
              open
                ? "Шукаємо тих, хто хоче не лише вчитися, а й змінювати. Заповни заявку — ми звʼяжемося з тобою в Telegram."
                : "Зараз набір закрито, але це ненадовго. Стеж за анонсами у FICE Time — і готуй заявку."
            }
          >
            {open ? (
              <a
                href="#form"
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-main px-10 py-4 text-lg font-bold text-black transition-opacity hover:opacity-90"
              >
                Подати заявку
              </a>
            ) : (
              <a
                href={FICE_TIME_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-main px-10 py-4 text-lg font-bold text-black transition-opacity hover:opacity-90"
              >
                <span className="size-5 shrink-0">
                  <TelegramIcon />
                </span>
                Стежити за анонсами
              </a>
            )}
          </PageHero>
        </section>

        {/* why us */}
        <section className="relative isolate scroll-mt-28 py-16 lg:py-24">
          <Container>
            <SectionHeader
              title="Чому саме ми"
              subtitle="Чотири причини, чому студенти обирають Студраду — і залишаються."
              gradient="bg-gradient-green"
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

        {open ? <ApplicationFormSection /> : <ApplicationsClosedSection />}
      </main>
      <Footer />
    </>
  );
}

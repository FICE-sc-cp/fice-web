import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { Reveal, RevealGroup } from "@/components/ui/Reveal";
import { EventCard } from "@/components/sections/EventCard";
import { IconDefs, PeopleIcon } from "@/components/ui/icons";
import { fice, safe, type EventItem } from "@/lib/api";
import { cn } from "@/lib/utils";

const GRADIENT = "bg-gradient-magenta";
const GLOW: [string, string] = ["#F6339A", "#9810FA"];
const NAME = "Департамент роботи з абітурієнтами";
const SLOGAN =
  "Ми стали містком між амбіціями майбутніх студентів та можливостями університету — створюючи простір для впевненого старту і свідомого вибору.";
const MEMBER_COUNT = 9;

const PERSON_OUTLINE =
  "drop-shadow(3px 3px 0 #fff) drop-shadow(-3px -3px 0 #fff) drop-shadow(3px -3px 0 #fff) drop-shadow(-3px 3px 0 #fff)";

const ABOUT =
  "Наша головна місія – допомогти абітурієнтам не потонути в хаосі дат, документів і вимог вступної кампанії. Ми беремо на себе всю інформаційну та організаційну підтримку, щоб зробити цей шлях зрозумілим і легким.";

const ROLES = [
  {
    name: "Хедорг",
    description:
      "Лідер, який бере на себе відповідальність за весь напрямок. Координує команду, визначає загальний вектор заходу, відповідає за якість та фінальний результат.",
  },
  {
    name: "Організатор",
    description:
      "Людина, яка бере на себе частину відповідальності за проєкт/подію. Це лідер команди або відповідальний за певний робочий блок (стек проєкту).",
  },
  {
    name: "Спікер",
    description:
      "Обличчя та голос нашого факультету на заходах. Представник своєї спеціальності, який розповідає батькам та абітурієнтам про специфіку навчання та надихає вступити саме до нас.",
  },
  {
    name: "Волонтер",
    description:
      "Головний рушій і активний помічник нашої команди. Людина, яка ініціативно долучається до проєктів на всіх етапах організації та допомагає реалізувати ідеї на практиці.",
  },
];

const QUALITIES = [
  {
    title: "Сміливість",
    text: "брати на себе відповідальність за проєкти чи окремі задачі. Нам потрібні люди, готові діяти, приймати рішення та втілювати круті ідеї в життя.",
  },
  {
    title: "Любов",
    text: "до спілкування і нових знайомств. Ти станеш голосом та підтримкою для сотень людей, тому щире бажання допомагати іншим та терпіння — твої головні інструменти.",
  },
  {
    title: "Вміння",
    text: "перевіряти інформацію та структурувати її. Вступна кампанія — це робота з точними даними, тому ми цінуємо тих, хто вміє знаходити суть та відсіювати фейки.",
  },
];

const FESTS_LIMIT = 3;

const EMPTY_EVENTS = {
  items: [] as EventItem[],
  total: 0,
  page: 1,
  limit: FESTS_LIMIT,
  totalPages: 0,
};

export const metadata: Metadata = {
  title: "Департамент роботи з абітурієнтами — Студрада ФІОТ",
  description:
    "Допомагаємо абітурієнтам розібратися з хаосом документів і дат вступної кампанії.",
};

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="inline-flex flex-col items-center gap-3 self-center text-center">
      <h2 className="text-3xl font-bold sm:text-4xl">{title}</h2>
      <span className={cn("h-1.5 w-full rounded-full", GRADIENT)} />
    </div>
  );
}

export default async function ApplicantsPage() {
  const joinHref = `/join?dept=${encodeURIComponent(NAME)}`;
  const memberCount = MEMBER_COUNT;

  const [upcomingData, pastData] = await Promise.all([
    safe(fice.events(FESTS_LIMIT, 1, false, true), EMPTY_EVENTS),
    safe(fice.events(FESTS_LIMIT, 1, true, true), EMPTY_EVENTS),
  ]);
  const fests = [...upcomingData.items, ...pastData.items].slice(0, FESTS_LIMIT);

  return (
    <>
      <IconDefs />
      <Header />
      <main className="overflow-x-clip">
        <section className="relative isolate pb-10 pt-20 lg:pt-28">
          <Glow
            color={GLOW[0]}
            className="left-0 top-10 h-[26rem] w-[36rem] -translate-x-1/4"
          />
          <Glow
            color={GLOW[1]}
            className="right-0 top-24 h-[28rem] w-[36rem] translate-x-1/4"
          />
          <Container>
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
              <Link
                href="/#departments"
                className="inline-flex items-center gap-1 text-lg font-semibold text-subtle transition-colors hover:text-fg"
              >
                ← Усі департаменти
              </Link>
              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                <span className={cn("bg-clip-text text-transparent", GRADIENT)}>
                  {NAME}
                </span>
              </h1>
              <p className="max-w-xl text-xl text-muted sm:text-2xl">
                {SLOGAN}
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
                {memberCount != null && (
                  <span className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-surface/50 px-4 text-base font-semibold text-fg">
                    <span className="size-5">
                      <PeopleIcon gradient="magenta" />
                    </span>
                    {memberCount} учасників
                  </span>
                )}
                <Link
                  href={joinHref}
                  className={cn(
                    "inline-flex h-11 items-center rounded-full px-6 text-base font-bold text-black transition-transform hover:scale-[1.03] active:scale-95",
                    GRADIENT,
                  )}
                >
                  Долучитися
                </Link>
              </div>
            </div>
          </Container>
        </section>

        <section id="about" className="relative isolate scroll-mt-28 py-16 lg:py-24">
          <Container className="flex flex-col">
            <Reveal>
              <div className="flex flex-col items-center">
                <SectionHeading title="Про департамент" />
              </div>
            </Reveal>
            <div className="mt-12 grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <Reveal className="relative overflow-hidden rounded-3xl border border-white/10">
                <Image
                  src="/photo-7.png"
                  alt={NAME}
                  width={0}
                  height={0}
                  sizes="(min-width: 1024px) 32rem, 100vw"
                  className="h-auto w-full"
                />
              </Reveal>
              <Reveal>
                <p className="text-xl leading-relaxed text-muted sm:text-2xl">
                  {ABOUT}
                </p>
              </Reveal>
            </div>
          </Container>
        </section>

        <section className="relative isolate py-16 lg:py-24">
          <Glow
            color={GLOW[1]}
            className="right-0 top-1/3 h-[24rem] w-[34rem] translate-x-1/4"
          />
          <Container className="flex flex-col">
            <Reveal className="flex flex-col items-center">
              <SectionHeading title="Ролі у департаменті" />
            </Reveal>
            <RevealGroup className="mt-12 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {ROLES.map((role) => (
                <article
                  key={role.name}
                  className="mx-auto flex w-full max-w-[18rem] flex-col gap-4 sm:max-w-none"
                >
                  <div className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-brand-magenta bg-surface/40">
                    <Image
                      src="/placeholder-person.png"
                      alt={role.name}
                      fill
                      sizes="(min-width: 1024px) 18rem, 50vw"
                      className="object-contain object-bottom"
                      style={{ filter: PERSON_OUTLINE }}
                    />
                    <div className="absolute inset-0 hidden items-center justify-center bg-black/80 p-4 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 sm:flex sm:p-5">
                      <p className="text-center text-sm leading-snug text-stone-200 sm:text-base">
                        {role.description}
                      </p>
                    </div>
                  </div>
                  <h3 className="text-center text-xl font-bold sm:text-2xl">
                    {role.name}
                  </h3>
                  <p className="text-center text-base leading-relaxed text-stone-300 sm:hidden">
                    {role.description}
                  </p>
                </article>
              ))}
            </RevealGroup>
          </Container>
        </section>

        <section className="relative isolate py-16 lg:py-24">
          <Glow
            color={GLOW[0]}
            className="left-0 top-1/2 h-[24rem] w-[34rem] -translate-x-1/4 -translate-y-1/2"
          />
          <Container className="flex flex-col">
            <Reveal className="flex flex-col items-center">
              <SectionHeading title="Кого ми шукаємо?" />
            </Reveal>
            <Reveal className={cn("mt-12 rounded-3xl p-px", GRADIENT)}>
              <div className="grid grid-cols-1 gap-10 rounded-3xl bg-bg p-8 sm:p-12 md:grid-cols-3">
                {QUALITIES.map((q) => (
                  <div key={q.title} className="flex flex-col gap-3">
                    <h3
                      className={cn(
                        "bg-clip-text text-2xl font-bold text-transparent",
                        GRADIENT,
                      )}
                    >
                      {q.title}
                    </h3>
                    <p className="text-lg leading-relaxed text-stone-300">
                      {q.text}
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>
          </Container>
        </section>

        {fests.length > 0 && (
          <section className="relative isolate py-16 pb-24 lg:py-24 lg:pb-32">
            <Container className="flex flex-col">
              <Reveal className="flex flex-col items-center">
                <SectionHeading title="Події" />
              </Reveal>
              <RevealGroup className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {fests.map((fest) => (
                  <EventCard key={fest.id} event={fest} />
                ))}
              </RevealGroup>
            </Container>
          </section>
        )}

      </main>
      <Footer />
    </>
  );
}

import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { GradientText } from "@/components/ui/GradientText";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { EventCard } from "@/components/sections/EventCard";
import { LoadMoreList } from "@/components/ui/LoadMoreList";
import { PastEvents } from "@/components/sections/PastEvents";
import { fice, safe, type EventItem } from "@/lib/api";

export const metadata: Metadata = {
  title: "Заходи",
  description:
    "Заходи Студентської ради ФІОТ КПІ ім. Ігоря Сікорського: анонси майбутніх подій факультету, реєстрація та минулі заходи — від нетворкінгу до благодійних ініціатив.",
};

const EMPTY = {
  items: [] as EventItem[],
  total: 0,
  page: 1,
  limit: 60,
  totalPages: 0,
};
const PAST_PAGE_SIZE = 6;

export default async function EventsCatalogPage() {
  const [upcomingData, pastData] = await Promise.all([
    safe(fice.events(60, 1, false), EMPTY),
    safe(fice.events(PAST_PAGE_SIZE, 1, true), EMPTY),
  ]);
  const upcoming = upcomingData.items;
  const past = pastData.items;
  const hasAny = upcoming.length > 0 || past.length > 0;

  return (
    <>
      <Header />
      <main className="overflow-x-clip pb-8">
        <section className="relative isolate pb-10 pt-16 lg:pt-24">
          <Glow
            color="#00E3F3"
            className="left-0 top-6 h-[22rem] w-[26rem] -translate-x-1/2"
          />
          <Glow
            color="#00E3F3"
            className="right-0 top-16 h-[22rem] w-[26rem] translate-x-1/2"
          />
          <PageHero
            title={
              <>
                Життя <GradientText>поза парами</GradientText>
              </>
            }
            scene="party"
            says="Усе, що Студрада готує для студентів ФІОТ, в одному місці. Обирай захід і реєструйся за кілька кліків."
          />
        </section>

        {!hasAny ? (
          <Container>
            <p className="py-16 text-center text-muted">
              Поки що немає запланованих заходів. Зазирни трохи пізніше 👀
            </p>
          </Container>
        ) : (
          <Container className="flex flex-col gap-14 pt-6">
            {upcoming.length > 0 && (
              <div>
                <Reveal className="mb-8">
                  <SectionTitle className="text-3xl sm:text-4xl lg:text-4xl">
                    Найближчі
                  </SectionTitle>
                </Reveal>
                <LoadMoreList
                  pageSize={9}
                  className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
                  items={upcoming.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                />
              </div>
            )}
            {past.length > 0 && (
              <div>
                <Reveal className="mb-8">
                  <SectionTitle
                    className="text-3xl sm:text-4xl lg:text-4xl"
                    gradient="bg-neutral-600"
                  >
                    Минулі
                  </SectionTitle>
                </Reveal>
                <PastEvents
                  initial={past}
                  total={pastData.total}
                  pageSize={PAST_PAGE_SIZE}
                />
              </div>
            )}
          </Container>
        )}
      </main>
      <Footer />
    </>
  );
}

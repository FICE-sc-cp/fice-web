import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { GradientText } from "@/components/ui/GradientText";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { EventCard } from "@/components/sections/EventCard";
import { LoadMoreList } from "@/components/ui/LoadMoreList";
import { PastEvents } from "@/components/sections/PastEvents";
import { fice, safe, type EventItem } from "@/lib/api";

export const metadata: Metadata = {
  title: "Заходи — Студрада ФІОТ",
  description: "Майбутні та минулі заходи Студентської ради ФІОТ.",
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
        <section className="relative isolate pb-4 pt-16 lg:pt-24">
          <Glow
            color="#00E3F3"
            className="left-0 top-6 h-[22rem] w-[26rem] -translate-x-1/2"
          />
          <Glow
            color="#00E3F3"
            className="right-0 top-16 h-[22rem] w-[26rem] translate-x-1/2"
          />
          <Container>
            <div className="flex flex-col items-center gap-4 text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                <GradientText>Заходи</GradientText>
              </h1>
              <p className="max-w-xl text-lg text-muted">
                Приєднуйся до найцікавіших подій факультету — від нетворкінгу до
                благодійних ініціатив.
              </p>
            </div>
          </Container>
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
                <div className="mb-8">
                  <SectionTitle className="text-3xl sm:text-4xl lg:text-4xl">
                    Найближчі
                  </SectionTitle>
                </div>
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
                <div className="mb-8">
                  <SectionTitle
                    className="text-3xl sm:text-4xl lg:text-4xl"
                    gradient="bg-neutral-600"
                  >
                    Минулі
                  </SectionTitle>
                </div>
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

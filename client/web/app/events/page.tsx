import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Container } from '@/components/ui/Container';
import { Glow } from '@/components/ui/Glow';
import { GradientText } from '@/components/ui/GradientText';
import { EventCard } from '@/components/sections/EventCard';
import { fice, safe, type EventItem } from '@/lib/api';
import { isEventPast } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Заходи — Студрада ФІОТ',
  description: 'Майбутні та минулі заходи Студентської ради ФІОТ.',
};

const EMPTY = { items: [] as EventItem[], total: 0, page: 1, limit: 60, totalPages: 0 };

export default async function EventsCatalogPage() {
  const data = await safe(fice.events(60, 1), EMPTY);
  const upcoming = data.items
    .filter((e) => !isEventPast(e.date))
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const past = data.items
    .filter((e) => isEventPast(e.date))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <>
      <Header />
      <main className="overflow-x-clip pb-8">
        <section className="relative isolate pb-4 pt-16 lg:pt-24">
          <Glow
            color="#00E3F3"
            className="left-1/2 top-0 h-[24rem] w-[40rem] -translate-x-1/2"
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

        {data.items.length === 0 ? (
          <Container>
            <p className="py-16 text-center text-muted">
              Поки що немає запланованих заходів. Зазирни трохи пізніше 👀
            </p>
          </Container>
        ) : (
          <Container className="flex flex-col gap-14 pt-6">
            {upcoming.length > 0 && (
              <div>
                <h2 className="mb-6 text-2xl font-bold">Найближчі</h2>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {past.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              </div>
            )}
          </Container>
        )}
      </main>
      <Footer />
    </>
  );
}

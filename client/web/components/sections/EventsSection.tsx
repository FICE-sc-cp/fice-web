import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Glow } from '@/components/ui/Glow';
import { EventCard } from '@/components/sections/EventCard';
import { Reveal, RevealGroup } from '@/components/ui/Reveal';
import { fice, safe, type EventItem } from '@/lib/api';

const EMPTY = { items: [] as EventItem[], total: 0, page: 1, limit: 3, totalPages: 0 };

export async function EventsSection() {
  const data = await safe(fice.events(3, 1), EMPTY);
  const events = data.items;

  return (
    <section id="events" className="relative isolate scroll-mt-28 py-20 lg:py-28">
      <Glow
        color="#00E3F3"
        className="bottom-0 left-1/2 h-[20rem] w-[36rem] -translate-x-full -translate-y-1/4 rotate-30"
      />
      <Container>
        <Reveal>
          <SectionHeader
            title="Заходи"
            subtitle="Приєднуйся до найцікавіших подій факультету"
            gradient="bg-gradient-green"
          />
        </Reveal>

        {events.length === 0 ? (
          <p className="mt-14 text-center text-lg text-muted">
            Незабаром анонсуємо нові заходи 👀
          </p>
        ) : (
          <RevealGroup className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </RevealGroup>
        )}

        <div className="mt-14 flex justify-center">
          <Link
            href="/events"
            className="rounded-2xl bg-neutral-600/40 px-10 py-4 text-xl font-bold text-white transition-all hover:bg-neutral-600/60 hover:scale-[1.02] active:scale-95 sm:px-16 sm:py-5 sm:text-2xl lg:text-3xl"
          >
            Переглянути всі
          </Link>
        </div>
      </Container>
    </section>
  );
}

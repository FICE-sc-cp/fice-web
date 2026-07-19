import { ViewAllLink } from '@/components/ui/ViewAllLink';
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
    <section id="events" className="relative isolate scroll-mt-36 py-12 lg:py-16">
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
          <RevealGroup className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
            {events.map((e) => (
              <div
                key={e.id}
                className="w-[85vw] max-w-[22rem] shrink-0 snap-center sm:w-auto sm:max-w-none sm:shrink sm:[&>*]:h-full"
              >
                <EventCard event={e} />
              </div>
            ))}
          </RevealGroup>
        )}

        <div className="mt-10 flex justify-center">
          <ViewAllLink
            href="/events"
            gradient="bg-gradient-green"
            accent="text-brand-green"
          >
            Переглянути всі
          </ViewAllLink>
        </div>
      </Container>
    </section>
  );
}

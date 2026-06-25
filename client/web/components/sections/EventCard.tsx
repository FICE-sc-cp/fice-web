import Link from 'next/link';
import { CalendarIcon, ClockIcon, PinIcon } from '@/components/ui/icons';
import { cn, eventRegistrationOpen } from '@/lib/utils';
import { mediaUrl, type EventItem } from '@/lib/api';

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Kyiv',
  }).format(d);
const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  }).format(d);

export function EventCard({ event }: { event: EventItem }) {
  const date = new Date(event.date);
  const open = eventRegistrationOpen(event);
  const cover = mediaUrl(event.photoUrl);

  const details = [
    { Icon: CalendarIcon, text: fmtDate(date) },
    { Icon: ClockIcon, text: fmtTime(date) },
    ...(event.location ? [{ Icon: PinIcon, text: event.location }] : []),
  ];

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-border p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-green/40 hover:shadow-xl hover:shadow-brand-green/10">
      <Link
        href={`/events/${event.id}`}
        aria-label={event.name}
        className="relative aspect-square w-full overflow-hidden rounded-lg bg-cover bg-center"
        style={{
          backgroundImage: cover
            ? `url(${cover})`
            : 'linear-gradient(135deg,#16161b,#1d1d24)',
        }}
      />

      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Link href={`/events/${event.id}`}>
            <h3 className="text-xl font-bold text-white transition-colors hover:text-brand-cyan">
              {event.name}
            </h3>
          </Link>
          <div className="flex flex-col gap-2 text-base text-stone-300">
            {details.map(({ Icon, text }) => (
              <div key={text} className="flex items-center gap-2">
                <span className="size-5 shrink-0">
                  <Icon />
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>

        <Link
          href={open ? `/events/${event.id}#register` : `/events/${event.id}`}
          className={cn(
            'mt-auto rounded-lg px-7 py-3.5 text-center text-lg font-bold transition-opacity',
            open
              ? 'bg-gradient-green text-black hover:opacity-90'
              : 'bg-neutral-600/60 text-white hover:opacity-80',
          )}
        >
          {open ? 'Зареєструватись' : 'Переглянути'}
        </Link>
      </div>
    </article>
  );
}

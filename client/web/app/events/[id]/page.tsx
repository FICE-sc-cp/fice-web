import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Container } from '@/components/ui/Container';
import { Glow } from '@/components/ui/Glow';
import { EventRegistrationForm } from '@/components/sections/EventRegistrationForm';
import { fice, mediaUrl, safe } from '@/lib/api';
import { renderRichInline } from '@/lib/richText';
import { eventRegistrationOpen } from '@/lib/utils';

const TZ = 'Europe/Kyiv';
const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  }).format(d);
const fmtWeekday = (d: Date) =>
  new Intl.DateTimeFormat('uk-UA', { weekday: 'long', timeZone: TZ }).format(d);
const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(d);

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());

function Fact({
  label,
  value,
  note,
  color,
  href,
}: {
  label: string;
  value: string;
  note?: string;
  color: string;
  href?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-white/8 bg-surface/45 p-5">
      <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
        {label}
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xl font-extrabold text-brand-cyan underline-offset-2 hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="text-xl font-extrabold">{value}</span>
      )}
      {note && <span className="text-sm text-gray-400">{note}</span>}
    </div>
  );
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await safe(fice.event(id), null);

  if (!event) {
    return (
      <>
        <Header />
        <main className="overflow-x-clip">
          <Container>
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
              <h1 className="text-3xl font-bold">Захід не знайдено</h1>
              <p className="text-muted">
                Можливо, його видалено, або сервер тимчасово недоступний.
              </p>
              <Link
                href="/events"
                className="rounded-xl bg-gradient-main px-6 py-3 font-bold text-black"
              >
                Усі заходи
              </Link>
            </div>
          </Container>
        </main>
        <Footer />
      </>
    );
  }

  const date = new Date(event.date);
  const registrationOpen = eventRegistrationOpen(event);
  const fee = event.feeAmount != null ? Number(event.feeAmount) : 0;
  const cover = mediaUrl(event.photoUrl);
  const partners = (event.eventPartners ?? [])
    .map((ep) => ({
      id: ep.id,
      name: ep.name ?? ep.partner?.name ?? '',
      logoImage: ep.logoImage ?? ep.partner?.logoImage ?? null,
      websiteLink: ep.websiteLink ?? ep.partner?.websiteLink ?? null,
    }))
    .filter((p) => p.logoImage);
  const program = event.program ?? [];

  return (
    <>
      <Header />
      <main className="overflow-x-clip pb-4">
        {/* hero */}
        <section className="relative isolate pt-10">
          <Glow
            color="#2EFF97"
            className="left-0 top-0 h-[24rem] w-[34rem] -translate-x-1/3"
          />
          <Glow
            color="#AD46FF"
            className="right-0 top-40 h-[26rem] w-[34rem] translate-x-1/3"
          />
          <Container>
            <Link
              href="/events"
              className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-brand-cyan transition-opacity hover:opacity-70"
            >
              ← Усі заходи
            </Link>

            {cover && (
              <div className="overflow-hidden rounded-3xl border border-white/8">
                <div
                  className="aspect-[16/7] w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${cover})` }}
                />
              </div>
            )}
            <div className={cover ? 'mt-6' : ''}>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-gradient-main px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide text-black">
                  Захід
                </span>
                <span className="rounded-full border border-white/15 bg-surface px-4 py-1.5 text-xs font-bold">
                  {registrationOpen ? '🎟 Триває реєстрація' : 'Реєстрацію завершено'}
                </span>
              </div>
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                {event.name}
              </h1>
            </div>
          </Container>
        </section>

        {/* key facts */}
        <section className="relative z-[1] pt-7">
          <Container>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Fact
                label="Дата"
                value={fmtDate(date)}
                note={fmtWeekday(date)}
                color="#36dfff"
              />
              <Fact label="Час" value={fmtTime(date)} note={event.timeNote ?? undefined} color="#2eff97" />
              <Fact
                label="Локація"
                value={event.location ?? 'Уточнюється'}
                href={
                  event.locationNote && isUrl(event.locationNote)
                    ? event.locationNote
                    : undefined
                }
                note={
                  event.locationNote && isUrl(event.locationNote)
                    ? 'Відкрити на карті ↗'
                    : undefined
                }
                color="#ad46ff"
              />
              <Fact
                label="Внесок"
                value={fee > 0 ? `${fee} грн` : 'Безкоштовно'}
                note={fee > 0 ? 'Донат на ЗСУ' : undefined}
                color="#ff8904"
              />
            </div>
          </Container>
        </section>

        {/* collection results */}
        {event.details &&
          (Number(event.details.moneyCollected) > 0 ||
            Number(event.details.charityAmount) > 0 ||
            event.details.visitorsAmount != null) && (
            <section className="relative z-[1] pt-7">
              <Container>
                <div className="flex flex-wrap gap-x-10 gap-y-4 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-5">
                  {Number(event.details.moneyCollected) > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold uppercase tracking-wide text-brand-green">
                        Зібрано
                      </span>
                      <span className="text-2xl font-extrabold">
                        {Number(event.details.moneyCollected).toLocaleString('uk-UA')} грн
                      </span>
                    </div>
                  )}
                  {Number(event.details.charityAmount) > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold uppercase tracking-wide text-brand-teal">
                        На благодійність
                      </span>
                      <span className="text-2xl font-extrabold">
                        {Number(event.details.charityAmount).toLocaleString('uk-UA')} грн
                      </span>
                    </div>
                  )}
                  {event.details.visitorsAmount != null && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold uppercase tracking-wide text-brand-cyan">
                        Відвідувачів
                      </span>
                      <span className="text-2xl font-extrabold">
                        {event.details.visitorsAmount}
                      </span>
                    </div>
                  )}
                </div>
              </Container>
            </section>
          )}

        {/* about + program */}
        {(event.description || program.length > 0) && (
          <section className="relative z-[1] pt-11">
            <Container>
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.5fr_1fr]">
                <div>
                  <h2 className="mb-4 text-3xl font-bold">Про захід</h2>
                  <p
                    className="whitespace-pre-wrap text-lg leading-relaxed text-gray-300"
                    dangerouslySetInnerHTML={{
                      __html: renderRichInline(
                        event.description ?? 'Деталі скоро зʼявляться.',
                      ),
                    }}
                  />
                </div>
                {program.length > 0 && (
                  <div className="rounded-2xl border border-white/8 bg-surface/45 p-6">
                    <h3 className="mb-4 text-xl font-bold">Програма</h3>
                    <div className="flex flex-col">
                      {program.map((p, i) => (
                        <div
                          key={p.id}
                          className={
                            'flex gap-4 py-3' +
                            (i < program.length - 1 ? ' border-b border-white/7' : '')
                          }
                        >
                          <span className="w-14 shrink-0 font-bold text-brand-cyan">
                            {p.time}
                          </span>
                          <span className="text-gray-300">{p.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Container>
          </section>
        )}

        {/* partners */}
        {partners.length > 0 && (
          <section className="relative z-[1] pt-11">
            <Container>
              <h2 className="mb-5 text-2xl font-bold">Партнери заходу</h2>
              <div className="flex flex-wrap gap-4">
                {partners.map((p) => {
                  const logo = mediaUrl(p.logoImage);
                  const inner = (
                    <div
                      className="h-16 w-36 rounded-xl border border-white/8 bg-white/5 bg-contain bg-center bg-no-repeat transition-colors hover:border-brand-cyan"
                      style={{ backgroundImage: logo ? `url(${logo})` : undefined }}
                      title={p.name}
                      role="img"
                      aria-label={p.name}
                    />
                  );
                  return p.websiteLink ? (
                    <a
                      key={p.id}
                      href={p.websiteLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div key={p.id}>{inner}</div>
                  );
                })}
              </div>
            </Container>
          </section>
        )}

        {/* registration / closed */}
        <section id="register" className="relative isolate z-[1] scroll-mt-28 pt-12">
          {registrationOpen && (
            <Glow
              color="#36DFFF"
              className="left-1/2 top-1/2 h-[26rem] w-[44rem] -translate-x-1/2 -translate-y-1/2"
            />
          )}
          <Container>
            {registrationOpen ? (
              <EventRegistrationForm event={event} />
            ) : (
              <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-3xl border border-white/5 bg-surface/40 p-10 text-center">
                <h2 className="text-3xl font-bold">Реєстрацію завершено</h2>
                <p className="max-w-md text-muted">
                  {event.photoAlbumUrl
                    ? 'Дякуємо всім, хто був із нами! Дивись, як це було:'
                    : 'Слідкуй за анонсами, щоб не пропустити наступний захід.'}
                </p>
                {event.photoAlbumUrl && (
                  <a
                    href={event.photoAlbumUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl bg-gradient-main px-8 py-4 text-lg font-bold text-black transition-opacity hover:opacity-90"
                  >
                    Переглянути фото
                  </a>
                )}
              </div>
            )}
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}

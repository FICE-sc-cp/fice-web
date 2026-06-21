import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IconDefs } from '@/components/ui/icons';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Container } from '@/components/ui/Container';
import { Glow } from '@/components/ui/Glow';
import { fice, mediaUrl, safe, type News, type Paginated } from '@/lib/api';
import {
  bodyParagraphs,
  categoryLabel,
  formatEventDateTime,
  formatNewsDate,
  readingTime,
} from '@/lib/news';

const EMPTY: Paginated<News> = {
  items: [],
  total: 0,
  page: 1,
  limit: 7,
  totalPages: 0,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await safe<News | null>(fice.newsItem(id), null);
  if (!item) return { title: 'Новина — ФІОТ' };
  return { title: `${item.title} — Новини ФІОТ` };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await safe<News | null>(fice.newsItem(id), null);
  if (!item) notFound();

  const { items } = await safe(fice.news(7, 1), EMPTY);
  const related = items.filter((n) => n.id !== item.id).slice(0, 3);

  const cover = mediaUrl(item.image);
  const paragraphs = bodyParagraphs(item.details);
  const [lead, ...rest] = paragraphs;
  const event = item.eventDate ? formatEventDateTime(item.eventDate) : null;

  return (
    <>
      <IconDefs />
      <Header />
      <main className="relative isolate overflow-x-clip">
        <Glow
          color="#2EFF97"
          className="right-[-11rem] -top-28 h-[30rem] w-[39rem] opacity-50"
        />
        <Glow
          color="#AD46FF"
          className="left-[-12rem] top-[56rem] h-[32rem] w-[40rem] opacity-50"
        />

        <article className="relative z-[1] mx-auto max-w-3xl px-4 pt-10 sm:px-6">
          <Link
            href="/news"
            className="mb-6 inline-flex items-center gap-2 text-[15px] font-extrabold text-brand-cyan transition-opacity hover:opacity-70"
          >
            ← Усі новини
          </Link>

          <div className="mb-4 flex flex-wrap items-center gap-3.5">
            <span className="inline-flex items-center rounded-full bg-gradient-main px-3.5 py-1.5 text-[12.5px] font-extrabold uppercase tracking-wide text-stone-950">
              {categoryLabel(item.category)}
            </span>
            <span className="text-[14.5px] font-semibold text-gray-400">
              {formatNewsDate(item.publishDate)}
            </span>
            {item.details && (
              <span className="text-[14.5px] font-semibold text-gray-400">
                · {readingTime(item.details)}
              </span>
            )}
          </div>

          <h1 className="mb-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-balance sm:text-[2.875rem]">
            {item.title}
          </h1>

          {cover && (
            <div
              className="mb-10 aspect-[16/9] overflow-hidden rounded-2xl border border-white/10 bg-cover bg-center"
              style={{ backgroundImage: `url("${cover}")` }}
            />
          )}

          {event && (
            <div
              className="mb-11 overflow-hidden rounded-2xl border border-brand-cyan p-7 sm:p-8"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, rgba(54,223,255,0.08), rgba(173,70,255,0.06))',
              }}
            >
              <span className="mb-4 inline-flex items-center gap-2 text-[12.5px] font-extrabold uppercase tracking-wider text-brand-cyan">
                📣 Оголошення про захід
              </span>
              <div className="mb-7 grid gap-5 sm:grid-cols-3">
                <EventField label="Дата" value={event.date} />
                <EventField label="Час" value={event.time} />
                <EventField
                  label="Локація"
                  value={item.eventLocation ?? 'Уточнюється'}
                />
              </div>
              {/* registration page is not built yet — placeholder target */}
              <a
                href="#"
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-main px-8 py-3.5 text-[17px] font-extrabold text-stone-950 transition-opacity hover:opacity-90"
              >
                Зареєструватися на захід →
              </a>
            </div>
          )}

          {paragraphs.length > 0 ? (
            <div className="flex flex-col">
              {lead && (
                <p className="mb-6 text-xl font-medium leading-relaxed text-zinc-200">
                  {lead}
                </p>
              )}
              {rest.map((p, i) => (
                <p
                  key={i}
                  className="mb-6 text-[18.5px] leading-[1.72] text-zinc-300"
                >
                  {p}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-[18.5px] leading-relaxed text-subtle">
              Деталі новини зʼявляться згодом.
            </p>
          )}
        </article>

        {related.length > 0 && (
          <section className="relative z-[1] pb-24 pt-16">
            <Container>
              <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-3xl font-extrabold tracking-tight">
                  Інші новини
                </h2>
                <Link
                  href="/news"
                  className="text-[15px] font-extrabold text-brand-cyan transition-opacity hover:opacity-70"
                >
                  Усі новини →
                </Link>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((n) => {
                  const url = mediaUrl(n.image);
                  return (
                    <Link
                      key={n.id}
                      href={`/news/${n.id}`}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface/45 transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-cyan/60 hover:shadow-2xl hover:shadow-black/40"
                    >
                      <div className="relative h-42 overflow-hidden">
                        <div
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                          style={
                            url ? { backgroundImage: `url("${url}")` } : undefined
                          }
                        >
                          {!url && (
                            <div className="absolute inset-0 bg-gradient-main opacity-20" />
                          )}
                        </div>
                        <span className="absolute left-3.5 top-3.5 inline-flex items-center rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-wide text-white">
                          {categoryLabel(n.category)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2 p-4.5">
                        <span className="text-[12.5px] font-bold text-subtle">
                          {formatNewsDate(n.publishDate)}
                        </span>
                        <h3 className="line-clamp-2 text-lg font-extrabold leading-snug">
                          {n.title}
                        </h3>
                        <span className="inline-flex items-center gap-1.5 pt-0.5 text-sm font-extrabold text-brand-cyan">
                          Читати →
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Container>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}

function EventField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12.5px] font-bold uppercase tracking-wide text-gray-400">
        {label}
      </span>
      <span className="text-lg font-extrabold text-white">{value}</span>
    </div>
  );
}

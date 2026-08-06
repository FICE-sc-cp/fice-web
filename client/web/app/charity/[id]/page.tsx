import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { DonateCard } from "@/components/charity/DonateCard";
import { fice, mediaUrl, safe } from "@/lib/api";
import { renderRichInline } from "@/lib/richText";
import { cn, daysLeft, fundraiserTheme } from "@/lib/utils";

export default async function CharityDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fundraiser = await safe(fice.fundraiser(id), null);

  if (!fundraiser) {
    return (
      <>
        <Header />
        <main className="overflow-x-clip">
          <Container>
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
              <h1 className="text-3xl font-bold">Збір не знайдено</h1>
              <p className="text-muted">
                Можливо, його видалено, або сервер тимчасово недоступний.
              </p>
              <Link
                href="/charity"
                className="rounded-xl bg-gradient-orange px-6 py-3 font-bold text-black"
              >
                Усі збори
              </Link>
            </div>
          </Container>
        </main>
        <Footer />
      </>
    );
  }

  const isActive = fundraiser.status === "ACTIVE";
  const cover = mediaUrl(fundraiser.imageUrl);
  const left = daysLeft(fundraiser.endDate);
  const theme = fundraiserTheme(fundraiser.id);
  const chip =
    "inline-flex items-center gap-2 rounded-xl border border-white/12 bg-bg/60 px-4 py-2 text-sm font-bold backdrop-blur";

  const metaChips = (
    <>
      <span className={chip}>
        🗓 {fmtDay(fundraiser.startDate)} – {fmtDay(fundraiser.endDate)}
      </span>
      <span className={chip}>
        <span
          className={cn(
            "size-2 rounded-full",
            isActive ? "bg-brand-green shadow-[0_0_10px_#2eff97]" : "bg-subtle",
          )}
        />
        {isActive ? "Збір триває" : "Збір завершено"}
      </span>
      {fundraiser.location && (
        <span className={chip}> {fundraiser.location}</span>
      )}
      {isActive && left !== null && (
        <span className={chip}>
          {left > 0
            ? `Залишилось ${left} ${pluralDays(left)}`
            : "Останній день"}
        </span>
      )}
    </>
  );

  return (
    <>
      <Header />
      <main className="overflow-x-clip pb-4">
        <section className="relative isolate pt-8">
          <Glow
            color={theme.glowA}
            className="right-0 top-0 h-[24rem] w-[36rem] translate-x-1/4 -translate-y-1/4"
          />
          <Glow
            color={theme.glowB}
            className="bottom-0 left-0 h-[26rem] w-[34rem] -translate-x-1/3 translate-y-1/4"
          />
          <Container>
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_380px]">
              <div className="flex min-w-0 flex-col gap-10">
                <div className="max-w-3xl">
                  <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                    {fundraiser.name}
                  </h1>
                  <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
                    {fundraiser.description}
                  </p>
                  {!cover && (
                    <div className="mt-6 flex flex-wrap gap-2.5">
                      {metaChips}
                    </div>
                  )}
                </div>

                {cover && (
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl border border-border bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cover}
                      alt={fundraiser.name}
                      className="absolute inset-0 size-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-bg/85 via-transparent to-transparent" />
                    <div className="absolute inset-x-5 bottom-5 flex flex-wrap gap-2.5">
                      {metaChips}
                    </div>
                  </div>
                )}

                {(fundraiser.story || fundraiser.detailsLink) && (
                  <section>
                    <div className="mb-5 inline-flex flex-col gap-3">
                      <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                        Про збір
                      </h2>
                      <span
                        className={cn(
                          "h-1.5 w-full rounded-full",
                          theme.gradient,
                        )}
                      />
                    </div>
                    {fundraiser.story && (
                      <p
                        className="whitespace-pre-wrap text-lg leading-relaxed text-muted"
                        dangerouslySetInnerHTML={{
                          __html: renderRichInline(fundraiser.story),
                        }}
                      />
                    )}
                    {fundraiser.detailsLink && (
                      <a
                        href={fundraiser.detailsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "mt-5 inline-flex items-center gap-2 text-base font-bold transition-opacity hover:opacity-80",
                          theme.accentText,
                        )}
                      >
                        Детальніше та звітність ↗
                      </a>
                    )}
                  </section>
                )}
              </div>

              {/* right column — live donate card */}
              <aside className="lg:sticky lg:top-24">
                <DonateCard initial={fundraiser} />
              </aside>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}

function fmtDay(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  }).format(new Date(iso));
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дні";
  return "днів";
}

import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Container } from '@/components/ui/Container';
import { Glow } from '@/components/ui/Glow';
import { GradientText } from '@/components/ui/GradientText';
import { PageHero } from '@/components/ui/PageHero';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { FundraiserCard } from '@/components/charity/FundraiserCard';
import { LoadMoreList } from '@/components/ui/LoadMoreList';
import { ClosedFundraisers } from '@/components/charity/ClosedFundraisers';
import { fice, safe, type Fundraiser } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Благодійність',
  description:
    'Благодійні збори Студентської ради ФІОТ КПІ: актуальні збори та їхній прогрес, а також завершені збори. Кожен донат — це конкретна допомога.',
};

const EMPTY = { items: [] as Fundraiser[], total: 0, page: 1, limit: 60, totalPages: 0 };
const CLOSED_PAGE_SIZE = 6;

export default async function CharityCatalogPage() {
  const [activeData, closedData] = await Promise.all([
    safe(fice.fundraisers(60, 1, 'ACTIVE'), EMPTY),
    safe(fice.fundraisers(CLOSED_PAGE_SIZE, 1, 'CLOSED'), EMPTY),
  ]);
  const active = activeData.items;
  const closed = closedData.items;
  const hasAny = active.length > 0 || closed.length > 0;

  return (
    <>
      <Header />
      <main className="overflow-x-clip pb-8">
        <section className="relative isolate pb-10 pt-16 lg:pt-24">
          <Glow
            color="#2EFF97"
            className="left-0 top-6 h-[22rem] w-[26rem] -translate-x-1/2"
          />
          <Glow
            color="#00E3F3"
            className="right-0 top-16 h-[22rem] w-[26rem] translate-x-1/2"
          />
          <PageHero
            title={
              <>
                Кожна гривня <GradientText>має адресу</GradientText>
              </>
            }
            scene="donor"
            says="Збираємо на конкретні потреби й звітуємо про кожен закритий збір. Долучайся будь-якою сумою."
          />
        </section>

        {!hasAny ? (
          <Container>
            <p className="py-16 text-center text-muted">
              Активних зборів поки немає — скоро анонсуємо 💛
            </p>
          </Container>
        ) : (
          <Container className="flex flex-col gap-14 pt-6">
            {active.length > 0 && (
              <div>
                <div className="mb-8">
                  <SectionTitle className="text-3xl sm:text-4xl lg:text-4xl">
                    Активні збори
                  </SectionTitle>
                </div>
                <LoadMoreList
                  pageSize={9}
                  className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
                  items={active.map((f) => (
                    <FundraiserCard key={f.id} fundraiser={f} />
                  ))}
                />
              </div>
            )}
            {closed.length > 0 && (
              <div>
                <div className="mb-8">
                  <SectionTitle
                    className="text-3xl sm:text-4xl lg:text-4xl"
                    gradient="bg-neutral-600"
                  >
                    Завершені
                  </SectionTitle>
                </div>
                <ClosedFundraisers
                  initial={closed}
                  total={closedData.total}
                  pageSize={CLOSED_PAGE_SIZE}
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

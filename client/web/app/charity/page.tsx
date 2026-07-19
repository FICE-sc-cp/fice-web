import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Container } from '@/components/ui/Container';
import { Glow } from '@/components/ui/Glow';
import { GradientText } from '@/components/ui/GradientText';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { FundraiserCard } from '@/components/charity/FundraiserCard';
import { LoadMoreList } from '@/components/ui/LoadMoreList';
import { fice, safe, type Fundraiser } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Благодійність — Студрада ФІОТ',
  description: 'Актуальні та завершені збори Студентської ради ФІОТ.',
};

const EMPTY = { items: [] as Fundraiser[], total: 0, page: 1, limit: 60, totalPages: 0 };

export default async function CharityCatalogPage() {
  const data = await safe(fice.fundraisers(60, 1), EMPTY);
  const active = data.items.filter((f) => f.status === 'ACTIVE');
  const closed = data.items.filter((f) => f.status === 'CLOSED');

  return (
    <>
      <Header />
      <main className="overflow-x-clip pb-8">
        <section className="relative isolate pb-4 pt-16 lg:pt-24">
          <Glow
            color="#FF8904"
            className="left-0 top-6 h-[22rem] w-[26rem] -translate-x-1/2"
          />
          <Glow
            color="#FF8904"
            className="right-0 top-16 h-[22rem] w-[26rem] translate-x-1/2"
          />
          <Container>
            <div className="flex flex-col items-center gap-4 text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                <GradientText>Благодійність</GradientText>
              </h1>
              <p className="max-w-xl text-lg text-muted">
                Кожен донат — це конкретна допомога. Долучайся до активних зборів і
                наближай нашу спільну перемогу.
              </p>
            </div>
          </Container>
        </section>

        {data.items.length === 0 ? (
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
                <LoadMoreList
                  pageSize={9}
                  className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
                  items={closed.map((f) => (
                    <FundraiserCard key={f.id} fundraiser={f} />
                  ))}
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

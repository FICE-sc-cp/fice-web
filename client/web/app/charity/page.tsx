import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Container } from '@/components/ui/Container';
import { Glow } from '@/components/ui/Glow';
import { GradientText } from '@/components/ui/GradientText';
import { FundraiserCard } from '@/components/charity/FundraiserCard';
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
            className="left-1/2 top-0 h-[24rem] w-[40rem] -translate-x-1/2"
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
                <h2 className="mb-6 text-2xl font-bold">Активні збори</h2>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {active.map((f) => (
                    <FundraiserCard key={f.id} fundraiser={f} />
                  ))}
                </div>
              </div>
            )}
            {closed.length > 0 && (
              <div>
                <h2 className="mb-6 text-2xl font-bold text-subtle">Завершені</h2>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {closed.map((f) => (
                    <FundraiserCard key={f.id} fundraiser={f} />
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

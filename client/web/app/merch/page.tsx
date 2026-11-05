import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Catalog } from '@/components/merch/Catalog';
import { Container } from '@/components/ui/Container';
import { Glow } from '@/components/ui/Glow';
import { GradientText } from '@/components/ui/GradientText';
import { PageHero } from '@/components/ui/PageHero';
import { safe } from '@/lib/api';
import { merchCatalog } from '@/lib/merch';
import { openGraph } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Мерч',
  description: 'Мерч Студентської ради ФІОТ: каталог, ціни та замовлення онлайн.',
  alternates: { canonical: '/merch' },
  openGraph: openGraph('/merch', '/merch-main-photo.jpg'),
};

export default async function Page() {
  await connection(); // per request: live stock, and the filters come from the URL
  return (
    <main className="overflow-x-clip pb-12">
      <section className="relative isolate pb-10 pt-16 lg:pt-24">
        <Glow color="#AD46FF" className="left-0 top-6 h-[22rem] w-[26rem] -translate-x-1/2" />
        <Glow color="#9810FA" className="right-0 top-16 h-[22rem] w-[26rem] translate-x-1/2" />
        <PageHero
          title={
            <>
              ФІОТ, який можна <GradientText>вдягнути</GradientText>
            </>
          }
          scene="tee"
          says="Речі з жабкою, щоб ФІОТ було видно здалеку. Обирай, оформлюй замовлення — і отримуй зручним для себе способом."
        />
      </section>
      {/* Raised, or the hero's glow paints over the chips and the first cards. */}
      <Container className="relative z-[1] pt-4">
        <Catalog initial={await safe(merchCatalog(), null)} />
      </Container>
    </main>
  );
}

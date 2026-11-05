import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductScreen } from '@/components/merch/ProductScreen';
import { Container } from '@/components/ui/Container';
import { Glow } from '@/components/ui/Glow';
import { ApiError, mediaUrl, safe } from '@/lib/api';
import { merchProduct, priceText } from '@/lib/merch';
import { NOINDEX, openGraph, plainText } from '@/lib/seo';

type Props = { params: Promise<{ id: string }> };

const ID = /^[1-9]\d{0,8}$/;

const load = async (id: string) => {
  if (!ID.test(id)) notFound();
  try {
    return await merchProduct(id);
  } catch (err) {
    if (err instanceof ApiError && err.status < 500) notFound();
    throw err; // app/error.tsx, not a false 404 during an API blip
  }
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = ID.test(id) ? await safe(merchProduct(id), null) : null; // same fetch, deduped
  if (!item) return { title: 'Товар не знайдено', robots: NOINDEX };
  const photo = item.photos.find((p) => p.color === item.defaultColor) ?? item.photos[0];
  return {
    title: item.title,
    description: [item.minPrice && `від ${priceText(item.minPrice)} грн.`, plainText(item.description)]
      .filter(Boolean)
      .join(' '),
    alternates: { canonical: `/merch/${item.id}` },
    openGraph: openGraph(`/merch/${item.id}`, mediaUrl(photo?.url)),
    ...(item.archived && { robots: NOINDEX }),
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const initial = await load(id);
  return (
    <main className="relative isolate overflow-x-clip pb-12 pt-6">
      <Glow color="#AD46FF" className="left-0 top-0 h-[22rem] w-[26rem] -translate-x-1/2" />
      <Glow color="#9810FA" className="right-0 top-16 h-[22rem] w-[26rem] translate-x-1/2" />
      <Container>
        <ProductScreen id={id} initial={initial} />
      </Container>
    </main>
  );
}

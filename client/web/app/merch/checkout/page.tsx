import type { Metadata } from 'next';
import { CheckoutScreen } from '@/components/merch/CheckoutScreen';
import { Container } from '@/components/ui/Container';
import { Glow } from '@/components/ui/Glow';
import { NOINDEX } from '@/lib/seo';

export const metadata: Metadata = { title: 'Оформлення замовлення', robots: NOINDEX };

export default function Page() {
  return (
    <main className="relative isolate overflow-x-clip pb-12 pt-6">
      <Glow color="#AD46FF" className="left-0 top-0 h-[22rem] w-[26rem] -translate-x-1/2" />
      <Container className="max-w-2xl">
        <CheckoutScreen />
      </Container>
    </main>
  );
}

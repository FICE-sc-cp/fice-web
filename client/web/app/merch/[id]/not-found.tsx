'use client';

import { usePathname } from 'next/navigation';
import { ProductScreen } from '@/components/merch/ProductScreen';
import { Container } from '@/components/ui/Container';

/**
 * A real 404 that still opens for a linked group member: SSR sees no token, so it answers 404, and
 * ProductScreen retries with the stored token in the browser.
 */
export default function NotFound() {
  const id = usePathname().split('/').pop() ?? '';
  return (
    <main className="overflow-x-clip pb-12 pt-6">
      <Container>
        <ProductScreen id={id} initial={null} />
      </Container>
    </main>
  );
}

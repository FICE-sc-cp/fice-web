'use client';

import { use } from 'react';
import { ProductScreen } from '@/components/merch/ProductScreen';

/** A client page: a soft navigation to SSR would show nothing until the server answers. */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ProductScreen id={id} initial={null} />;
}
